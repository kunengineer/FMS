from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import (
    OperationLog, Vehicle, Operator, IdempotencyKey,
    FailureLog, RepairLog, ChecklistItem, ChecklistResult, SystemSetting
)
from app.schemas import (
    OperationLogCreate, OperationLogEnd, OperationLogDetailSchema, OperationLogSchema,
    ChecklistItemSchema
)
from app.core.audit import log_audit_event
from typing import List, Optional
from datetime import datetime, timedelta, date
from decimal import Decimal
import uuid

router = APIRouter(prefix="/operations", tags=["operations"])

# --- CHECKLIST ITEMS ---

@router.get("/checklist-items", response_model=List[ChecklistItemSchema])
def list_checklist_items(
    vehicle_type_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    items = db.query(ChecklistItem).filter(ChecklistItem.active == True).all()
    if vehicle_type_id is not None:
        filtered = []
        for item in items:
            if item.applies_to_vehicle_types is None or len(item.applies_to_vehicle_types) == 0:
                filtered.append(item)
            elif vehicle_type_id in item.applies_to_vehicle_types:
                filtered.append(item)
        return filtered
    return items


# --- OPERATION LOGS ---

@router.get("/list", response_model=List[OperationLogSchema])
def list_operations(
    vehicle_id: Optional[uuid.UUID] = None,
    work_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log", "reports:view"]))
):
    query = db.query(OperationLog).options(
        joinedload(OperationLog.vehicle),
        joinedload(OperationLog.operator),
        joinedload(OperationLog.shift),
        joinedload(OperationLog.operators),
        joinedload(OperationLog.failures).joinedload(FailureLog.repairs).joinedload(RepairLog.mechanic)
    )
    if current_user.role_rel.role_name == "NGƯỜI VẬN HÀNH":
        query = query.filter(OperationLog.operator_id == current_user.operator_id)
    if vehicle_id:
        query = query.filter(OperationLog.vehicle_id == vehicle_id)
    if work_date:
        query = query.filter(OperationLog.work_date == work_date)
        
    return query.order_by(OperationLog.work_date.desc(), OperationLog.operation_id.desc()).all()

@router.get("/{operation_id}", response_model=OperationLogDetailSchema)
def get_operation_detail(
    operation_id: int,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log", "reports:view"]))
):
    op = db.query(OperationLog).options(
        joinedload(OperationLog.vehicle),
        joinedload(OperationLog.operator),
        joinedload(OperationLog.shift),
        joinedload(OperationLog.operators),
        joinedload(OperationLog.checklist_results).joinedload(ChecklistResult.checklist_item),
        joinedload(OperationLog.failures).joinedload(FailureLog.repairs).joinedload(RepairLog.mechanic)
    ).filter(OperationLog.operation_id == operation_id).first()
    
    if not op:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký ca làm việc")
    return op

@router.post("/start", response_model=OperationLogDetailSchema)
def start_operation(
    payload: OperationLogCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    # 1. Chống trùng lặp / chống spam nhập liệu (Idempotency check)
    idem = db.query(IdempotencyKey).filter(IdempotencyKey.key == payload.idempotency_key).first()
    if idem:
        if datetime.now() - idem.created_at < timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Yêu cầu trùng lặp trong vòng 5 phút. Vui lòng thử lại sau."
            )
        else:
            db.delete(idem)
            db.commit()
            
    # Save idempotency key
    new_idem = IdempotencyKey(key=payload.idempotency_key)
    db.add(new_idem)
    db.commit()

    # 2. Check vehicle active and not repairing
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == payload.vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")
        
    if vehicle.status in ("repairing", "stopped_repair") and payload.work_type != "repair":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phương tiện đang sửa chữa hoặc ngưng sửa chữa - không thể mở ca mới."
        )
    elif vehicle.status == "inactive":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phương tiện đang ngưng hoạt động - không thể mở ca mới."
        )

    # 3. Một xe – một ca – không chồng chéo: UNIQUE(vehicle_id, work_date, shift_id)
    existing_op = db.query(OperationLog).filter(
        OperationLog.vehicle_id == payload.vehicle_id,
        OperationLog.work_date == payload.work_date,
        OperationLog.shift_id == payload.shift_id
    ).first()
    if existing_op:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phương tiện đã được đăng ký chạy ca này trong ngày hôm nay."
        )

    # 4. Rule bàn giao ca: kiểm tra hư hỏng chưa sửa từ ca trước
    active_failures = db.query(FailureLog).filter(
        FailureLog.vehicle_id == payload.vehicle_id,
        FailureLog.is_repaired == False
    ).all()
    if active_failures and not payload.acknowledged_previous_failure:
        # We raise 400 but return failure info so client can prompt check box
        failure_details = [
            {"failure_id": f.failure_id, "category_name": f.category.category_name if f.category else "Khác", "description": f.description, "failure_time": (f.failure_time + timedelta(hours=7)).strftime("%d/%m/%Y %H:%M")}
            for f in active_failures
        ]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "HANDOVER_ACKNOWLEDGEMENT_REQUIRED",
                "message": "Phương tiện có lỗi chưa sửa từ ca trước. Người vận hành phải xác nhận trước khi mở ca.",
                "failures": failure_details
            }
        )

    # 5. Create Operation Log
    db_op = OperationLog(
        vehicle_id=payload.vehicle_id,
        operator_id=payload.operator_id,
        shift_id=payload.shift_id,
        work_date=payload.work_date,
        start_hour=payload.start_hour,
        hourmeter_start=payload.hourmeter_start,
        condition_before_shift=payload.condition_before_shift,
        is_safety_confirmed=payload.is_safety_confirmed,
        signature_data=payload.signature_data,
        signature_time=payload.signature_time or (datetime.now() if payload.signature_data else None),
        acknowledged_previous_failure=payload.acknowledged_previous_failure,
        acknowledged_by=payload.acknowledged_by,
        idempotency_key=payload.idempotency_key,
        notes=payload.notes,
        safety_reason=payload.safety_reason,
        work_type=payload.work_type
    )
    
    # Associate assistant operators if any
    if payload.assistant_operator_ids:
        assistants = db.query(Operator).filter(Operator.operator_id.in_(payload.assistant_operator_ids)).all()
        db_op.operators = assistants

    db.add(db_op)
    db.commit()
    db.refresh(db_op)

    # Save Checklist Results
    for cr in payload.checklist_results:
        db_cr = ChecklistResult(
            operation_id=db_op.operation_id,
            checklist_id=cr.checklist_id,
            result=cr.result,
            note=cr.note
        )
        db.add(db_cr)
    db.commit()
    db.refresh(db_op)

    log_audit_event(db, current_user.operator_id, "operation_logs", db_op.operation_id, "create", None, db_op)
    return db_op

@router.post("/end/{operation_id}", response_model=OperationLogDetailSchema)
def end_operation(
    operation_id: int,
    payload: OperationLogEnd,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    op = db.query(OperationLog).filter(OperationLog.operation_id == operation_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký ca làm việc")
        
    if op.hourmeter_end is not None:
        raise HTTPException(status_code=400, detail="Ca làm việc này đã được kết thúc trước đó")

    # 1. Hourmeter validation: hourmeter_end >= hourmeter_start
    if payload.hourmeter_end < op.hourmeter_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số giờ máy kết thúc ca không được nhỏ hơn số giờ máy bắt đầu ca."
        )

    old_val = {c.name: getattr(op, c.name) for c in op.__table__.columns}

    # 2. Update operation log
    op.hourmeter_end = payload.hourmeter_end
    op.end_hour = payload.end_hour
    if payload.notes:
        op.notes = (op.notes or "") + "\n" + payload.notes

    # Update failures and repairs if is_repair_done is specified
    if payload.is_repair_done is not None:
        op_failures = db.query(FailureLog).filter(FailureLog.operation_id == operation_id).all()
        for failure in op_failures:
            if payload.is_repair_done:
                failure_old_val = {c.name: getattr(failure, c.name) for c in failure.__table__.columns}
                failure.is_repaired = True
                log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "update", failure_old_val, failure)
                
                # Check for existing repair log
                repair = db.query(RepairLog).filter(
                    RepairLog.failure_id == failure.failure_id,
                    RepairLog.repair_status.in_(["pending", "in_progress"])
                ).first()
                
                if repair:
                    rep_old_val = {c.name: getattr(repair, c.name) for c in repair.__table__.columns}
                    repair.repair_status = "done"
                    repair.repair_end = datetime.now()
                    repair.parts_used = payload.parts_used
                    repair.note = payload.repair_note or "Sửa xong khi kết thúc ca"
                    log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "update", rep_old_val, repair)
                else:
                    repair = RepairLog(
                        failure_id=failure.failure_id,
                        mechanic_id=current_user.operator_id,
                        repair_start=datetime.combine(op.work_date, op.start_hour),
                        repair_end=datetime.now(),
                        repaired_in_shift=True,
                        parts_used=payload.parts_used,
                        note=payload.repair_note or "Sửa xong khi kết thúc ca",
                        repair_status="done"
                    )
                    db.add(repair)
                    db.commit()

    # 3. Update vehicle current hourmeter
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == op.vehicle_id).first()
    if vehicle:
        vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
        vehicle.current_hourmeter = payload.hourmeter_end

        # Determine vehicles.status: còn hư chưa sửa -> repairing, ngược lại active
        has_failures = db.query(FailureLog).filter(
            FailureLog.vehicle_id == vehicle.vehicle_id,
            FailureLog.is_repaired == False
        ).first() is not None
        
        if has_failures:
            vehicle.status = "repairing"
        else:
            vehicle.status = "active"

        db.commit()
        log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)

    db.commit()
    db.refresh(op)
    
    log_audit_event(db, current_user.operator_id, "operation_logs", op.operation_id, "update", old_val, op)
    return op
