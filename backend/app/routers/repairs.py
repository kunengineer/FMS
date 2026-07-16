from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import RepairLog, FailureLog, Vehicle, Operator
from app.schemas import RepairLogSchema, RepairLogCreate, RepairLogEnd, OperatorSchema, RepairAssignment
from app.core.audit import log_audit_event
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/repairs", tags=["repairs"])

@router.get("/list", response_model=List[RepairLogSchema])
def list_repairs(
    failure_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["repair:write"]))
):
    query = db.query(RepairLog).options(
        joinedload(RepairLog.mechanic),
        joinedload(RepairLog.failure).joinedload(FailureLog.vehicle),
        joinedload(RepairLog.failure).joinedload(FailureLog.category)
    )
    if failure_id:
        query = query.filter(RepairLog.failure_id == failure_id)
    return query.order_by(RepairLog.repair_start.desc()).all()

@router.post("/start", response_model=RepairLogSchema)
def start_repair(
    payload: RepairLogCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["repair:write"]))
):
    failure = db.query(FailureLog).filter(FailureLog.failure_id == payload.failure_id).first()
    if not failure:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự cố")
        
    if failure.is_repaired:
        raise HTTPException(status_code=400, detail="Sự cố này đã được sửa chữa trước đó")

    # Check if there is already an in_progress repair for this failure
    existing = db.query(RepairLog).filter(
        RepairLog.failure_id == payload.failure_id,
        RepairLog.repair_status == "in_progress"
    ).first()
    if existing:
        return existing

    # Check if there is a pending repair for this failure to promote to in_progress
    pending_repair = db.query(RepairLog).filter(
        RepairLog.failure_id == payload.failure_id,
        RepairLog.repair_status == "pending"
    ).first()
    
    if pending_repair:
        pending_repair.repair_status = "in_progress"
        pending_repair.mechanic_id = current_user.operator_id
        pending_repair.repair_start = payload.repair_start or datetime.now()
        repair = pending_repair
    else:
        # Create repair log
        repair = RepairLog(
            failure_id=payload.failure_id,
            mechanic_id=current_user.operator_id,
            repair_start=payload.repair_start or datetime.now(),
            repaired_in_shift=payload.repaired_in_shift,
            repair_status="in_progress"
        )
        db.add(repair)
    
    # Immediately make sure vehicle status is repairing
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == failure.vehicle_id).first()
    if vehicle and vehicle.status != "repairing":
        vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
        vehicle.status = "repairing"
        db.commit()
        log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)
        
    db.commit()
    db.refresh(repair)

    log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "create", None, repair)
    return repair

@router.post("/end/{repair_id}", response_model=RepairLogSchema)
def end_repair(
    repair_id: int,
    payload: RepairLogEnd,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["repair:write"]))
):
    repair = db.query(RepairLog).filter(RepairLog.repair_id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký sửa chữa")
        
    if repair.repair_status == "done":
        raise HTTPException(status_code=400, detail="Nhật ký sửa chữa này đã hoàn thành")

    old_val = {c.name: getattr(repair, c.name) for c in repair.__table__.columns}

    # Update repair log details
    repair.repair_status = payload.repair_status
    repair.repair_end = payload.repair_end or datetime.now()
    repair.parts_used = payload.parts_used
    repair.note = payload.note

    # Update failure log status if repair is done or cancelled
    if payload.repair_status in ["done", "cancelled"]:
        failure = db.query(FailureLog).filter(FailureLog.failure_id == repair.failure_id).first()
        if failure:
            failure_old_val = {c.name: getattr(failure, c.name) for c in failure.__table__.columns}
            failure.is_repaired = True
            db.commit()
            log_audit_event(db, current_user.operator_id, "failure_logs", failure.failure_id, "update", failure_old_val, failure)
            
            # Check other active failures for the vehicle
            vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == failure.vehicle_id).first()
            if vehicle:
                active_failures_exist = db.query(FailureLog).filter(
                    FailureLog.vehicle_id == vehicle.vehicle_id,
                    FailureLog.is_repaired == False
                ).first() is not None
                
                vehicle_old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
                if not active_failures_exist:
                    vehicle.status = "active"
                else:
                    vehicle.status = "repairing"
                db.commit()
                log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", vehicle_old_val, vehicle)
    elif payload.repair_status == "in_progress":
        # Create a new active segment for the next update phase
        new_repair = RepairLog(
            failure_id=repair.failure_id,
            mechanic_id=repair.mechanic_id,
            repair_start=datetime.now(),
            repaired_in_shift=False,
            repair_status="in_progress"
        )
        db.add(new_repair)

    db.commit()
    db.refresh(repair)
    
    log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "update", old_val, repair)
    return repair

@router.get("/assignable-operators", response_model=List[OperatorSchema])
def list_assignable_operators(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["repair:write", "repair:assign"]))
):
    return db.query(Operator).options(joinedload(Operator.role_rel)).filter(
        Operator.active == True,
        Operator.role_id.in_([2, 3])
    ).all()

@router.post("/assign", response_model=RepairLogSchema)
def assign_repair(
    payload: RepairAssignment,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["repair:assign"]))
):
    failure = db.query(FailureLog).filter(FailureLog.failure_id == payload.failure_id).first()
    if not failure:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự cố")
        
    if failure.is_repaired:
        raise HTTPException(status_code=400, detail="Sự cố này đã được sửa chữa")

    mechanic = db.query(Operator).filter(Operator.operator_id == payload.mechanic_id, Operator.active == True).first()
    if not mechanic:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên sửa chữa")

    repair = db.query(RepairLog).filter(
        RepairLog.failure_id == payload.failure_id,
        RepairLog.repair_status == "in_progress"
    ).first()
    
    if repair:
        old_val = {c.name: getattr(repair, c.name) for c in repair.__table__.columns}
        repair.mechanic_id = payload.mechanic_id
        db.commit()
        db.refresh(repair)
        log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "update", old_val, repair)
    else:
        # Check if there is a pending repair for this failure to promote to in_progress
        pending_repair = db.query(RepairLog).filter(
            RepairLog.failure_id == payload.failure_id,
            RepairLog.repair_status == "pending"
        ).first()
        
        if pending_repair:
            old_val = {c.name: getattr(pending_repair, c.name) for c in pending_repair.__table__.columns}
            pending_repair.repair_status = "in_progress"
            pending_repair.mechanic_id = payload.mechanic_id
            pending_repair.repair_start = datetime.now() # assign sets start time to now
            db.commit()
            db.refresh(pending_repair)
            log_audit_event(db, current_user.operator_id, "repair_logs", pending_repair.repair_id, "update", old_val, pending_repair)
            repair = pending_repair
        else:
            repair = RepairLog(
                failure_id=payload.failure_id,
                mechanic_id=payload.mechanic_id,
                repair_status="in_progress",
                repaired_in_shift=False
            )
            db.add(repair)
            db.commit()
            db.refresh(repair)
            log_audit_event(db, current_user.operator_id, "repair_logs", repair.repair_id, "create", None, repair)
        
    return repair
