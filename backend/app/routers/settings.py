from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import SystemSetting, Operator
from app.schemas import SystemSettingSchema, SystemSettingUpdate
from app.core.audit import log_audit_event
from typing import List

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=List[SystemSettingSchema])
def get_settings(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    return db.query(SystemSetting).all()

@router.put("/{setting_id}", response_model=SystemSettingSchema)
def update_setting(
    setting_id: int,
    payload: SystemSettingUpdate,
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["admin:all"]))
):
    setting = db.query(SystemSetting).filter(SystemSetting.setting_id == setting_id).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình")

    old_val = {c.name: getattr(setting, c.name) for c in setting.__table__.columns}
    setting.value = payload.value
    db.commit()
    db.refresh(setting)

    log_audit_event(db, current_user.operator_id, "system_settings", setting.setting_id, "update", old_val, setting)
    return setting
