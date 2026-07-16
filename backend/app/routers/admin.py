from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import (
    Operator, Role, ChecklistItem, FailureCategory,
    AuditLog, Shift, SeverityLevel, Permission, ChecklistResult
)
from app.schemas import (
    OperatorSchema, OperatorCreate, OperatorUpdate,
    ChecklistItemSchema, ChecklistItemCreate,
    FailureCategorySchema, FailureCategoryCreate,
    AuditLogSchema, ShiftSchema, ShiftCreate, RoleSchema
)
from app.core.security import get_password_hash
from app.core.audit import log_audit_event
from typing import List, Optional
import datetime

router = APIRouter(prefix="/admin", tags=["admin"])

# --- OPERATORS/USERS CRUD ---

@router.get("/operators", response_model=List[OperatorSchema])
def list_operators(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    return db.query(Operator).options(joinedload(Operator.role_rel)).all()

@router.post("/operators", response_model=OperatorSchema)
def create_operator(
    payload: OperatorCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    existing = db.query(Operator).filter(Operator.operator_id == payload.operator_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã nhân viên đã tồn tại")
        
    db_op = Operator(
        operator_id=payload.operator_id,
        full_name=payload.full_name,
        department=payload.department,
        role_id=payload.role_id,
        phone=payload.phone,
        password_hash=get_password_hash(payload.password),
        active=payload.active
    )
    db.add(db_op)
    db.commit()
    db.refresh(db_op)
    
    log_audit_event(db, current_user.operator_id, "operators", db_op.operator_id, "create", None, db_op)
    return db_op

@router.put("/operators/{operator_id}", response_model=OperatorSchema)
def update_operator(
    operator_id: str,
    payload: OperatorUpdate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    op = db.query(Operator).filter(Operator.operator_id == operator_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    old_val = {c.name: getattr(op, c.name) for c in op.__table__.columns}
    
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        op.password_hash = get_password_hash(data["password"])
        del data["password"]
    for k, v in data.items():
        if k != "password":
            setattr(op, k, v)
            
    db.commit()
    db.refresh(op)
    
    log_audit_event(db, current_user.operator_id, "operators", op.operator_id, "update", old_val, op)
    return op

@router.delete("/operators/{operator_id}")
def delete_operator(
    operator_id: str,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    op = db.query(Operator).filter(Operator.operator_id == operator_id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    if op.operator_id == current_user.operator_id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự xóa tài khoản của chính mình")
    old_val = {c.name: getattr(op, c.name) for c in op.__table__.columns}
    op.active = False
    db.commit()
    log_audit_event(db, current_user.operator_id, "operators", op.operator_id, "delete", old_val, None)
    return {"message": "Xóa tài khoản thành công"}


# --- CHECKLIST ITEMS CRUD ---

@router.post("/checklists", response_model=ChecklistItemSchema)
def create_checklist_item(
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    existing = db.query(ChecklistItem).filter(ChecklistItem.item_name == payload.item_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Hạng mục checklist này đã tồn tại")
        
    ci = ChecklistItem(**payload.model_dump())
    db.add(ci)
    db.commit()
    db.refresh(ci)
    
    log_audit_event(db, current_user.operator_id, "checklist_items", ci.checklist_id, "create", None, ci)
    return ci

@router.put("/checklists/{checklist_id}", response_model=ChecklistItemSchema)
def update_checklist_item(
    checklist_id: int,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    ci = db.query(ChecklistItem).filter(ChecklistItem.checklist_id == checklist_id).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Không tìm thấy hạng mục checklist")
        
    old_val = {c.name: getattr(ci, c.name) for c in ci.__table__.columns}
    
    data = payload.model_dump()
    for k, v in data.items():
        setattr(ci, k, v)
        
    db.commit()
    db.refresh(ci)
    
    log_audit_event(db, current_user.operator_id, "checklist_items", ci.checklist_id, "update", old_val, ci)
    return ci

@router.delete("/checklists/{checklist_id}")
def delete_checklist_item(
    checklist_id: int,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    ci = db.query(ChecklistItem).filter(ChecklistItem.checklist_id == checklist_id).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Không tìm thấy hạng mục checklist")
        
    old_val = {c.name: getattr(ci, c.name) for c in ci.__table__.columns}
    
    # Check if there are checklist results referring to this item
    has_results = db.query(ChecklistResult).filter(ChecklistResult.checklist_id == checklist_id).first() is not None
    
    if has_results:
        ci.active = False
        db.commit()
        log_audit_event(db, current_user.operator_id, "checklist_items", checklist_id, "update", old_val, ci)
    else:
        db.delete(ci)
        db.commit()
        log_audit_event(db, current_user.operator_id, "checklist_items", checklist_id, "delete", old_val, None)
        
    return {"detail": "Xóa thành công hạng mục checklist"}


# --- FAILURE CATEGORIES CRUD ---

@router.get("/failure-categories", response_model=List[FailureCategorySchema])
def list_failure_categories(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all", "operation:log", "repair:write"]))
):
    return db.query(FailureCategory).all()

@router.post("/failure-categories", response_model=FailureCategorySchema)
def create_failure_category(
    payload: FailureCategoryCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    existing = db.query(FailureCategory).filter(FailureCategory.category_name == payload.category_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Danh mục hư hỏng này đã tồn tại")
        
    fc = FailureCategory(**payload.model_dump())
    db.add(fc)
    db.commit()
    db.refresh(fc)
    
    log_audit_event(db, current_user.operator_id, "failure_categories", fc.category_id, "create", None, fc)
    return fc

@router.put("/failure-categories/{category_id}", response_model=FailureCategorySchema)
def update_failure_category(
    category_id: int,
    payload: FailureCategoryCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    fc = db.query(FailureCategory).filter(FailureCategory.category_id == category_id).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục hư hỏng")
        
    old_val = {c.name: getattr(fc, c.name) for c in fc.__table__.columns}
    
    data = payload.model_dump()
    for k, v in data.items():
        setattr(fc, k, v)
        
    db.commit()
    db.refresh(fc)
    
    log_audit_event(db, current_user.operator_id, "failure_categories", fc.category_id, "update", old_val, fc)
    return fc

@router.delete("/failure-categories/{category_id}")
def delete_failure_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    fc = db.query(FailureCategory).filter(FailureCategory.category_id == category_id).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục hư hỏng")
        
    old_val = {c.name: getattr(fc, c.name) for c in fc.__table__.columns}
    db.delete(fc)
    db.commit()
    
    log_audit_event(db, current_user.operator_id, "failure_categories", category_id, "delete", old_val, None)
    return {"detail": "Xóa thành công danh mục hư hỏng"}


# --- SHIFTS CRUD ---

@router.get("/shifts", response_model=List[ShiftSchema])
def list_shifts(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all", "operation:log"]))
):
    return db.query(Shift).order_by(Shift.start_time.asc()).all()

@router.post("/shifts", response_model=ShiftSchema)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    existing = db.query(Shift).filter(Shift.shift_name == payload.shift_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ca làm việc đã tồn tại")
        
    sh = Shift(**payload.model_dump())
    db.add(sh)
    db.commit()
    db.refresh(sh)
    
    log_audit_event(db, current_user.operator_id, "shifts", sh.shift_id, "create", None, sh)
    return sh

@router.put("/shifts/{shift_id}", response_model=ShiftSchema)
def update_shift(
    shift_id: int,
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    sh = db.query(Shift).filter(Shift.shift_id == shift_id).first()
    if not sh:
        raise HTTPException(status_code=404, detail="Không tìm thấy ca làm việc")
        
    old_val = {c.name: getattr(sh, c.name) for c in sh.__table__.columns}
    
    data = payload.model_dump()
    for k, v in data.items():
        setattr(sh, k, v)
        
    db.commit()
    db.refresh(sh)
    
    log_audit_event(db, current_user.operator_id, "shifts", sh.shift_id, "update", old_val, sh)
    return sh

@router.delete("/shifts/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    sh = db.query(Shift).filter(Shift.shift_id == shift_id).first()
    if not sh:
        raise HTTPException(status_code=404, detail="Không tìm thấy ca làm việc")
        
    old_val = {c.name: getattr(sh, c.name) for c in sh.__table__.columns}
    db.delete(sh)
    db.commit()
    
    log_audit_event(db, current_user.operator_id, "shifts", shift_id, "delete", old_val, None)
    return {"detail": "Xóa thành công ca làm việc"}


# --- ROLES & PERMISSIONS ---

@router.get("/roles", response_model=List[RoleSchema])
def list_roles(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    return db.query(Role).options(joinedload(Role.permissions)).all()


# --- AUDIT LOGS ---

@router.get("/audit-logs", response_model=List[AuditLogSchema])
def list_audit_logs(
    table_name: Optional[str] = None,
    action: Optional[str] = None,
    operator_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    query = db.query(AuditLog).options(joinedload(AuditLog.operator))
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action)
    if operator_id:
        query = query.filter(AuditLog.operator_id == operator_id)
        
    return query.order_by(AuditLog.created_at.desc()).limit(200).all()
