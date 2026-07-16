from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import FailureLog, Vehicle, Operator, SystemSetting, FailureAttachment, RepairLog, FailureCategory, OperationLog
from app.schemas import FailureLogSchema, FailureAttachmentSchema
from app.core.audit import log_audit_event
from app.core.config import settings
from typing import List, Optional
import os
import uuid
from datetime import datetime, time, date

router = APIRouter(prefix="/failures", tags=["failures"])

@router.get("/list", response_model=List[FailureLogSchema])
def list_failures(
    vehicle_id: Optional[uuid.UUID] = None,
    is_repaired: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:read"]))
):
    query = db.query(FailureLog).options(
        joinedload(FailureLog.category),
        joinedload(FailureLog.attachments),
        joinedload(FailureLog.vehicle),
        joinedload(FailureLog.creator),
        joinedload(FailureLog.operation).joinedload(OperationLog.shift),
        joinedload(FailureLog.repairs).joinedload(RepairLog.mechanic)
    )
    if vehicle_id:
        query = query.filter(FailureLog.vehicle_id == vehicle_id)
    if is_repaired is not None:
        query = query.filter(FailureLog.is_repaired == is_repaired)
    return query.order_by(FailureLog.failure_time.desc()).all()

@router.post("/during-shift", response_model=FailureLogSchema)
def create_failure_during_shift(
    vehicle_id: uuid.UUID,
    category_id: int,
    description: str,
    severity: str,
    operation_id: int,
    repaired_in_shift: bool,
    parts_used: Optional[str] = None,
    repair_note: Optional[str] = None,
    failure_time_str: Optional[str] = None, # format: "HH:MM"
    repair_start_str: Optional[str] = None, # format: "HH:MM"
    repair_end_str: Optional[str] = None,   # format: "HH:MM"
    repair_option: Optional[str] = None,    # "repaired_done", "repaired_pending", "repaired_none"
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")

    op_log = db.query(OperationLog).filter(OperationLog.operation_id == operation_id).first()
    work_date = op_log.work_date if op_log else datetime.now().date()

    # Parse failure time
    failure_time = datetime.now()
    if failure_time_str:
        try:
            hour, minute = map(int, failure_time_str.split(":"))
            failure_time = datetime.combine(work_date, time(hour, minute))
        except Exception:
            pass

    # Create failure log
    failure = FailureLog(
        operation_id=operation_id,
        vehicle_id=vehicle_id,
        category_id=category_id,
        description=description,
        failure_time=failure_time,
        severity=severity,
        phase="during_shift",
        is_repaired=repaired_in_shift,
        transferred_to_next_shift=not repaired_in_shift,
        created_by=current_user.operator_id
    )
    db.add(failure)
    db.commit()
    db.refresh(failure)

    if repaired_in_shift:
        repair_start = failure_time
        repair_end = datetime.now()
        
        if repair_start_str:
            try:
                hour, minute = map(int, repair_start_str.split(":"))
                repair_start = datetime.combine(work_date, time(hour, minute))
            except Exception:
                pass
        if repair_end_str:
            try:
                hour, minute = map(int, repair_end_str.split(":"))
                repair_end = datetime.combine(work_date, time(hour, minute))
            except Exception:
                pass

        # Create completed repair log
        repair = RepairLog(
            failure_id=failure.failure_id,
            mechanic_id=current_user.operator_id,
            repair_start=repair_start,
            repair_end=repair_end,
            repaired_in_shift=True,
            parts_used=parts_used,
            note=repair_note,
            repair_status="done"
        )
        db.add(repair)
        db.commit()
    else:
        # If pending repair option selected
        if repair_option == "repaired_pending":
            repair = RepairLog(
                failure_id=failure.failure_id,
                mechanic_id=current_user.operator_id,
                repair_start=failure_time,
                repaired_in_shift=False,
                note="Sự cố chưa sửa xong - Chuyển ca sau tiếp quản",
                repair_status="in_progress"
            )
            db.add(repair)
            db.commit()

        # Transferring to next shift, vehicle enters repairing status immediately
        vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
        vehicle.status = "repairing"
        db.commit()
        log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)

    log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "create", None, failure)
    return failure

@router.post("/before-shift", response_model=FailureLogSchema)
def create_failure_before_shift(
    vehicle_id: uuid.UUID,
    category_id: int,
    description: str,
    severity: str,
    operation_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")

    # Create failure log
    failure = FailureLog(
        operation_id=operation_id,
        vehicle_id=vehicle_id,
        category_id=category_id,
        description=description,
        failure_time=datetime.now(),
        severity=severity,
        phase="before_shift",
        is_repaired=False,
        transferred_to_next_shift=True,
        created_by=current_user.operator_id
    )
    db.add(failure)
    
    # Update vehicle status to repairing immediately
    vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    vehicle.status = "repairing"
    db.commit()
    db.refresh(failure)

    log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)
    log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "create", None, failure)
    return failure

@router.post("/out-of-shift", response_model=FailureLogSchema)
def create_failure_out_of_shift(
    vehicle_id: uuid.UUID,
    category_id: int,
    description: str,
    severity: str,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")

    # Create failure log
    failure = FailureLog(
        operation_id=None,
        vehicle_id=vehicle_id,
        category_id=category_id,
        description=description,
        failure_time=datetime.now(),
        severity=severity,
        phase="out_of_shift",
        is_repaired=False,
        transferred_to_next_shift=True,
        created_by=current_user.operator_id
    )
    db.add(failure)
    
    # Update vehicle status to repairing immediately
    vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    vehicle.status = "repairing"
    db.commit()
    db.refresh(failure)

    log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)
    log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "create", None, failure)
    return failure

@router.post("/{failure_id}/attachments", response_model=FailureAttachmentSchema)
async def upload_failure_attachment(
    failure_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["operation:log", "repair:write"]))
):
    failure = db.query(FailureLog).filter(FailureLog.failure_id == failure_id).first()
    if not failure:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký sự cố")

    # 1. Check max photos per failure constraint
    setting_max_photos = db.query(SystemSetting).filter(SystemSetting.key == "max_photos_per_failure").first()
    max_photos = int(setting_max_photos.value) if setting_max_photos else 5
    
    current_photos_count = db.query(FailureAttachment).filter(FailureAttachment.failure_id == failure_id).count()
    if current_photos_count >= max_photos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số lượng ảnh tối đa đính kèm cho mỗi sự cố là {max_photos}."
        )

    # 2. Check max file size constraint
    setting_max_size = db.query(SystemSetting).filter(SystemSetting.key == "max_upload_size").first()
    max_size_mb = float(setting_max_size.value) if setting_max_size else 10.0
    
    # Read file to check size
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > max_size_mb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dung lượng ảnh vượt quá giới hạn cho phép ({max_size_mb} MB)."
        )

    # Save to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"failure_{failure_id}_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as f:
        f.write(contents)

    # Save attachment log
    attachment = FailureAttachment(
        failure_id=failure_id,
        file_path=file_path,
        uploaded_by=current_user.operator_id,
        uploaded_at=datetime.now()
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    log_audit_event(db, current_user.operator_id, "failure_attachments", attachment.attachment_id, "create", None, attachment)
    return attachment

from pydantic import BaseModel

class FailureAdminUpdateSchema(BaseModel):
    failure_time: datetime
    description: str
    severity: str
    mechanic_id: Optional[str] = None
    repair_status: Optional[str] = None # "pending", "in_progress", "done"
    repair_start: Optional[datetime] = None
    repair_end: Optional[datetime] = None
    repair_note: Optional[str] = None

@router.put("/{failure_id}/admin-update")
def admin_update_failure(
    failure_id: int,
    payload: FailureAdminUpdateSchema,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    failure = db.query(FailureLog).filter(FailureLog.failure_id == failure_id).first()
    if not failure:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký sự cố")
        
    failure_old_val = {c.name: getattr(failure, c.name) for c in failure.__table__.columns}
    
    # Update failure fields
    failure.failure_time = payload.failure_time
    failure.description = payload.description
    failure.severity = payload.severity
    
    # Check if there is an associated repair record
    repair = db.query(RepairLog).filter(RepairLog.failure_id == failure_id).first()
    
    # If repair status is updated to 'done', mark failure as repaired
    if payload.repair_status == "done":
        failure.is_repaired = True
    else:
        failure.is_repaired = False
        
    db.commit()
    log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "update", failure_old_val, failure)
    
    # Update or create repair record
    if repair:
        repair_old_val = {c.name: getattr(repair, c.name) for c in repair.__table__.columns}
        if payload.mechanic_id:
            repair.mechanic_id = payload.mechanic_id
        if payload.repair_status:
            repair.repair_status = payload.repair_status
        repair.repair_start = payload.repair_start
        repair.repair_end = payload.repair_end
        if payload.repair_note is not None:
            repair.note = payload.repair_note
        db.commit()
        log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "update", repair_old_val, repair)
    else:
        # Create a new repair log if it didn't exist
        mechanic_id = payload.mechanic_id
        if not mechanic_id:
            # Fallback to default mechanic
            from app.routers.imports import get_or_create_operator
            mechanic = get_or_create_operator(db, "Thợ cơ điện mặc định", "THỢ SỬA CHỮA")
            mechanic_id = mechanic.operator_id
            
        repair = RepairLog(
            failure_id=failure_id,
            mechanic_id=mechanic_id,
            repair_status=payload.repair_status or "pending",
            repair_start=payload.repair_start or payload.failure_time,
            repair_end=payload.repair_end,
            note=payload.repair_note or payload.description
        )
        db.add(repair)
        db.commit()
        log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "create", None, repair)
        
    # Update vehicle status dynamically
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == failure.vehicle_id).first()
    if vehicle:
        vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
        
        # Check if there are other unresolved failures for this vehicle
        unresolved_count = db.query(FailureLog).filter(
            FailureLog.vehicle_id == vehicle.vehicle_id,
            FailureLog.is_repaired == False,
            FailureLog.failure_id != failure_id
        ).count()
        
        if failure.is_repaired:
            if unresolved_count == 0:
                # All failures resolved, set to active
                vehicle.status = "active"
            else:
                # Still has other failures
                vehicle.status = "repairing"
        else:
            # This failure is not repaired, vehicle is in repairing or stopped_repair
            # Keep stopped_repair if it was already stopped_repair and is not resolved
            if vehicle.status != "stopped_repair":
                vehicle.status = "repairing"
                
        db.commit()
        log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)
        
    return failure
