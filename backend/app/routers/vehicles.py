from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import Vehicle, VehicleType, Operator
from app.schemas import VehicleSchema, VehicleCreate, VehicleUpdate, VehicleTypeSchema, VehicleTypeCreate
from app.core.audit import log_audit_event
from typing import List, Optional
import uuid

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# --- VEHICLE TYPES ---

@router.get("/types", response_model=List[VehicleTypeSchema])
def list_vehicle_types(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:read"]))
):
    return db.query(VehicleType).all()

@router.post("/types", response_model=VehicleTypeSchema)
def create_vehicle_type(
    payload: VehicleTypeCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    existing = db.query(VehicleType).filter(VehicleType.type_name == payload.type_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Loại xe này đã tồn tại")
    
    vt = VehicleType(type_name=payload.type_name)
    db.add(vt)
    db.commit()
    db.refresh(vt)
    
    log_audit_event(db, current_user.operator_id, "vehicle_types", vt.vehicle_type_id, "create", None, vt)
    return vt

@router.delete("/types/{type_id}")
def delete_vehicle_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    vt = db.query(VehicleType).filter(VehicleType.vehicle_type_id == type_id).first()
    if not vt:
        raise HTTPException(status_code=404, detail="Không tìm thấy loại xe")
        
    db.delete(vt)
    db.commit()
    log_audit_event(db, current_user.operator_id, "vehicle_types", type_id, "delete", vt, None)
    return {"detail": "Xóa loại xe thành công"}


# --- VEHICLES ---

@router.get("/list", response_model=List[VehicleSchema])
def list_vehicles(
    type_id: Optional[int] = None,
    status_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:read"]))
):
    query = db.query(Vehicle).filter(Vehicle.active == True)
    if type_id:
        query = query.filter(Vehicle.vehicle_type_id == type_id)
    if status_code:
        query = query.filter(Vehicle.status == status_code)
    return query.order_by(Vehicle.vehicle_code).all()

@router.get("/{vehicle_id}", response_model=VehicleSchema)
def get_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:read"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")
    return vehicle

@router.post("", response_model=VehicleSchema)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:write"]))
):
    # Check vehicle code uniqueness
    existing = db.query(Vehicle).filter(Vehicle.vehicle_code == payload.vehicle_code, Vehicle.active == True).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã phương tiện đã tồn tại trong hệ thống")
        
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    
    log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "create", None, vehicle)
    return vehicle

@router.put("/{vehicle_id}", response_model=VehicleSchema)
def update_vehicle(
    vehicle_id: uuid.UUID,
    payload: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["vehicle:write"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")
        
    old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    
    # Update fields
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(vehicle, k, v)
        
    db.commit()
    db.refresh(vehicle)
    
    log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "update", old_val, vehicle)
    return vehicle

@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id, Vehicle.active == True).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Không tìm thấy phương tiện")
        
    old_val = {c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns}
    vehicle.active = False # soft delete
    db.commit()
    
    log_audit_event(db, current_user.operator_id, "vehicles", vehicle.vehicle_id, "delete", old_val, None)
    return {"detail": "Xóa phương tiện thành công"}
