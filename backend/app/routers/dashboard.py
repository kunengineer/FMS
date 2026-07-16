from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.dependencies import PermissionChecker, get_current_user
from app.models import Vehicle, OperationLog, FailureLog, FailureCategory, SystemSetting, Operator
from typing import List, Dict, Any
from datetime import datetime, timedelta, date
from decimal import Decimal
import uuid

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: Operator = Depends(PermissionChecker(["dashboard:view"]))
):
    # Find latest data reference time to dynamically shift charts
    latest_failure = db.query(func.max(FailureLog.failure_time)).scalar()
    latest_op_log = db.query(func.max(OperationLog.work_date)).scalar()
    
    ref_time = datetime.now()
    ref_date = date.today()
    
    db_latest = None
    if latest_failure:
        db_latest = latest_failure
    if latest_op_log:
        latest_op_dt = datetime.combine(latest_op_log, datetime.max.time())
        if not db_latest or latest_op_dt > db_latest:
            db_latest = latest_op_dt
            
    if db_latest and (datetime.now() - db_latest).days > 7:
        ref_time = db_latest
        ref_date = db_latest.date()
        
    # 1. Total vehicles counts
    total_vehicles = db.query(Vehicle).filter(Vehicle.active == True).count()
    active_vehicles = db.query(Vehicle).filter(Vehicle.active == True, Vehicle.status == "active").count()
    repairing_vehicles = db.query(Vehicle).filter(Vehicle.active == True, Vehicle.status == "repairing").count()
    stopped_repair_vehicles = db.query(Vehicle).filter(Vehicle.active == True, Vehicle.status == "stopped_repair").count()
    inactive_vehicles = db.query(Vehicle).filter(Vehicle.active == True, Vehicle.status == "inactive").count()
    
    # 2. Total shifts/logs on reference date
    today_shifts = db.query(OperationLog).filter(OperationLog.work_date == ref_date).count()
    
    # 3. Realtime vehicle status breakdown (for Donut chart)
    status_breakdown = [
        {"status": "Hoạt động", "code": "active", "count": active_vehicles},
        {"status": "Đang sửa chữa", "code": "repairing", "count": repairing_vehicles},
        {"status": "Có sự cố (Ngưng sửa chữa)", "code": "stopped_repair", "count": stopped_repair_vehicles},
        {"status": "Ngưng hoạt động", "code": "inactive", "count": inactive_vehicles}
    ]
    
    # 4. Weekly failure by category (for Bar chart)
    one_week_ago = ref_time - timedelta(days=7)
    failures_by_cat = db.query(
        FailureCategory.category_name,
        func.count(FailureLog.failure_id).label("count")
    ).join(
        FailureLog, FailureLog.category_id == FailureCategory.category_id
    ).filter(
        FailureLog.failure_time >= one_week_ago
    ).group_by(
        FailureCategory.category_name
    ).all()
    
    weekly_failures = [{"category": name, "count": count} for name, count in failures_by_cat]
    
    # 5. Shift count over the last 30 days (for Line chart)
    thirty_days_ago = ref_date - timedelta(days=30)
    shifts_by_day = db.query(
        OperationLog.work_date,
        func.count(OperationLog.operation_id).label("count")
    ).filter(
        OperationLog.work_date >= thirty_days_ago
    ).group_by(
        OperationLog.work_date
    ).order_by(
        OperationLog.work_date.asc()
    ).all()
    
    daily_shifts = [{"date": d.strftime("%d/%m"), "count": count} for d, count in shifts_by_day]

    # 6. Vehicles with outstanding unresolved failures (Red indicator)
    unresolved_vehicles = db.query(Vehicle).filter(
        Vehicle.active == True,
        Vehicle.vehicle_id.in_(
            db.query(FailureLog.vehicle_id).filter(FailureLog.is_repaired == False)
        )
    ).all()
    
    red_alerts = []
    for v in unresolved_vehicles:
        # Get latest active failure description
        latest_failure = db.query(FailureLog).options(joinedload(FailureLog.category)).filter(
            FailureLog.vehicle_id == v.vehicle_id,
            FailureLog.is_repaired == False
        ).order_by(FailureLog.failure_time.desc()).first()
        
        red_alerts.append({
            "vehicle_id": v.vehicle_id,
            "vehicle_code": v.vehicle_code,
            "vehicle_name": v.vehicle_name,
            "status": v.status,
            "latest_failure_category": latest_failure.category.category_name if latest_failure and latest_failure.category else "Chưa phân loại",
            "latest_failure_desc": latest_failure.description if latest_failure else "Có sự cố",
            "latest_failure_time": (latest_failure.failure_time + timedelta(hours=7)).strftime("%d/%m/%Y %H:%M") if latest_failure else ""
        })

    # 7. Vehicles nearing maintenance interval (Yellow indicator)
    setting = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_hourmeter_interval").first()
    maintenance_interval = Decimal(setting.value) if setting else Decimal("250.0")
    
    yellow_alerts = []
    all_vehicles = db.query(Vehicle).filter(Vehicle.active == True).all()
    for v in all_vehicles:
        diff = v.current_hourmeter - v.last_maintenance_hourmeter
        # Alert if within 20 hours or exceeded
        if diff >= (maintenance_interval - Decimal("20.0")):
            yellow_alerts.append({
                "vehicle_id": v.vehicle_id,
                "vehicle_code": v.vehicle_code,
                "vehicle_name": v.vehicle_name,
                "current_hourmeter": float(v.current_hourmeter),
                "last_maintenance_hourmeter": float(v.last_maintenance_hourmeter),
                "run_hours": float(diff),
                "threshold": float(maintenance_interval)
            })

    return {
        "cards": {
            "total_vehicles": total_vehicles,
            "active_vehicles": active_vehicles,
            "repairing_vehicles": repairing_vehicles,
            "stopped_repair_vehicles": stopped_repair_vehicles,
            "inactive_vehicles": inactive_vehicles,
            "today_shifts": today_shifts
        },
        "status_breakdown": status_breakdown,
        "weekly_failures": weekly_failures,
        "daily_shifts": daily_shifts,
        "red_alerts": red_alerts,
        "yellow_alerts": yellow_alerts
    }
