import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models import (
    Role, Permission, VehicleStatus, SeverityLevel,
    ConditionStatus, FailurePhase, RepairStatus,
    VehicleType, Shift, ChecklistItem, FailureCategory,
    Operator, SystemSetting,
    Vehicle, FailureLog, RepairLog, OperationLog, ChecklistResult
)
from app.core.security import get_password_hash

def seed_db(db: Session):
    # 1. System Enums (Seed cố định)
    # Vehicle Statuses
    vehicle_statuses = {
        "active": "Hoạt động",
        "repairing": "Đang sửa chữa",
        "stopped_repair": "Ngưng sửa chữa",
        "inactive": "Ngưng hoạt động"
    }
    for code, label in vehicle_statuses.items():
        if not db.query(VehicleStatus).filter_by(status_code=code).first():
            db.add(VehicleStatus(status_code=code, status_label=label))

    # Severity Levels
    severity_levels = {
        "light": "Nhẹ",
        "heavy": "Nặng",
        "dangerous": "Nguy hiểm"
    }
    for code, label in severity_levels.items():
        if not db.query(SeverityLevel).filter_by(severity_code=code).first():
            db.add(SeverityLevel(severity_code=code, severity_label=label))

    # Condition Statuses
    condition_statuses = {
        "ok": "Bình thường",
        "broken": "Có hư hỏng"
    }
    for code, label in condition_statuses.items():
        if not db.query(ConditionStatus).filter_by(status_code=code).first():
            db.add(ConditionStatus(status_code=code, status_label=label))

    # Failure Phases
    failure_phases = {
        "before_shift": "Trước ca làm việc",
        "during_shift": "Trong ca làm việc",
        "out_of_shift": "Ngoài ca làm việc"
    }
    for code, label in failure_phases.items():
        if not db.query(FailurePhase).filter_by(phase_code=code).first():
            db.add(FailurePhase(phase_code=code, phase_label=label))

    # Repair Statuses
    repair_statuses = {
        "pending": "Chờ sửa chữa",
        "in_progress": "Đang sửa chữa",
        "done": "Đã hoàn thành",
        "cancelled": "Đã hủy bỏ",
        "rejected": "Không sửa được"
    }
    for code, label in repair_statuses.items():
        if not db.query(RepairStatus).filter_by(status_code=code).first():
            db.add(RepairStatus(status_code=code, status_label=label))

    db.commit()

    # 2. Permissions (Quyền lõi)
    permissions_data = [
        {"permission_key": "admin:all", "description": "Toàn quyền hệ thống"},
        {"permission_key": "dashboard:view", "description": "Xem màn hình tổng quan"},
        {"permission_key": "vehicle:read", "description": "Xem danh sách phương tiện"},
        {"permission_key": "vehicle:write", "description": "Thêm/sửa phương tiện"},
        {"permission_key": "operation:log", "description": "Ghi nhật ký ca làm việc"},
        {"permission_key": "repair:write", "description": "Ghi nhận sửa chữa"},
        {"permission_key": "repair:assign", "description": "Phân công sửa chữa cho nhân viên"},
        {"permission_key": "reports:view", "description": "Xem và xuất báo cáo"}
    ]
    perms_cache = {}
    for p in permissions_data:
        perm = db.query(Permission).filter_by(permission_key=p["permission_key"]).first()
        if not perm:
            perm = Permission(permission_key=p["permission_key"], description=p["description"])
            db.add(perm)
            db.commit()
            db.refresh(perm)
        perms_cache[p["permission_key"]] = perm

    # 3. Roles
    roles_data = [
        {"role_name": "ADMIN", "description": "Quản trị viên toàn hệ thống", "perms": ["admin:all"]},
        {"role_name": "QUẢN LÝ ĐỘI", "description": "Giám sát, xem báo cáo, quản lý đội xe và phân công sửa chữa", "perms": ["dashboard:view", "vehicle:read", "vehicle:write", "reports:view", "repair:assign"]},
        {"role_name": "NGƯỜI VẬN HÀNH", "description": "Vận hành xe, mở/đóng ca, báo hư & tự sửa chữa", "perms": ["operation:log", "vehicle:read", "repair:write"]},
        {"role_name": "THỢ SỬA CHỮA", "description": "Thợ bảo trì sửa chữa xe", "perms": ["repair:write", "vehicle:read"]},
        {"role_name": "VIEWER", "description": "Chỉ xem báo cáo", "perms": ["dashboard:view", "reports:view"]}
    ]
    roles_cache = {}
    for r in roles_data:
        role = db.query(Role).filter_by(role_name=r["role_name"]).first()
        if not role:
            role = Role(role_name=r["role_name"], description=r["description"])
            db.add(role)
            db.commit()
            db.refresh(role)
        
        # Link permissions
        role.permissions.clear()
        for pk in r["perms"]:
            if pk == "admin:all":
                # admin gets all permissions
                role.permissions = list(perms_cache.values())
                break
            role.permissions.append(perms_cache[pk])
        db.commit()
        roles_cache[r["role_name"]] = role

    # 4. Default Admin User
    admin_id = "ADMIN"
    if not db.query(Operator).filter_by(operator_id=admin_id).first():
        hashed_password = get_password_hash("admin")
        admin_op = Operator(
            operator_id=admin_id,
            full_name="Quản trị hệ thống",
            department="IT",
            role_id=roles_cache["ADMIN"].role_id,
            phone="0900000000",
            password_hash=hashed_password,
            active=True
        )
        db.add(admin_op)

    # Sample Operator User
    operator_id = "OP01"
    if not db.query(Operator).filter_by(operator_id=operator_id).first():
        hashed_password = get_password_hash("123456")
        op_user = Operator(
            operator_id=operator_id,
            full_name="Nguyễn Văn Vận Hành",
            department="Đội Xe 1",
            role_id=roles_cache["NGƯỜI VẬN HÀNH"].role_id,
            phone="0911111111",
            password_hash=hashed_password,
            active=True
        )
        db.add(op_user)

    # Sample Operator 2 User
    operator_id_2 = "OP02"
    if not db.query(Operator).filter_by(operator_id=operator_id_2).first():
        hashed_password = get_password_hash("123456")
        op_user_2 = Operator(
            operator_id=operator_id_2,
            full_name="Lê Văn Vận Hành Ca Sau",
            department="Đội Xe 1",
            role_id=roles_cache["NGƯỜI VẬN HÀNH"].role_id,
            phone="0944444444",
            password_hash=hashed_password,
            active=True
        )
        db.add(op_user_2)

    # Sample Manager User
    manager_id = "MGR01"
    if not db.query(Operator).filter_by(operator_id=manager_id).first():
        hashed_password = get_password_hash("123456")
        mgr_user = Operator(
            operator_id=manager_id,
            full_name="Phạm Văn Quản Lý",
            department="Ban Điều Hành",
            role_id=roles_cache["QUẢN LÝ ĐỘI"].role_id,
            phone="0933333333",
            password_hash=hashed_password,
            active=True
        )
        db.add(mgr_user)

    # Sample Mechanic User
    mechanic_id = "ME01"
    if not db.query(Operator).filter_by(operator_id=mechanic_id).first():
        hashed_password = get_password_hash("123456")
        mech_user = Operator(
            operator_id=mechanic_id,
            full_name="Trần Văn Thợ Máy",
            department="Tổ Bảo Trì",
            role_id=roles_cache["THỢ SỬA CHỮA"].role_id,
            phone="0922222222",
            password_hash=hashed_password,
            active=True
        )
        db.add(mech_user)

    db.commit()

    # 5. Dynamic Business Categories (Mẫu nghiệp vụ)
    # Vehicle Types
    vehicle_types = ["Cần cẩu", "Xe nâng", "Xe cuốc", "Xe đào"]
    vtype_cache = {}
    for vt_name in vehicle_types:
        vt = db.query(VehicleType).filter_by(type_name=vt_name).first()
        if not vt:
            vt = VehicleType(type_name=vt_name)
            db.add(vt)
            db.commit()
            db.refresh(vt)
        vtype_cache[vt_name] = vt

    # Shifts
    shifts_data = [
        {"shift_name": "Ca Ngày", "start_time": datetime.time(6, 0), "end_time": datetime.time(18, 0)},
        {"shift_name": "Ca Đêm", "start_time": datetime.time(18, 0), "end_time": datetime.time(6, 0)}
    ]
    for s in shifts_data:
        exist = db.query(Shift).filter_by(shift_name=s["shift_name"]).first()
        if exist:
            exist.start_time = s["start_time"]
            exist.end_time = s["end_time"]
        else:
            db.add(Shift(shift_name=s["shift_name"], start_time=s["start_time"], end_time=s["end_time"]))
    db.commit()

    # Clean up old shifts that are not in the new shifts_data to maintain consistency
    new_names = [s["shift_name"] for s in shifts_data]
    ca_ngay = db.query(Shift).filter_by(shift_name="Ca Ngày").first()
    ca_dem = db.query(Shift).filter_by(shift_name="Ca Đêm").first()
    
    old_shifts = db.query(Shift).filter(~Shift.shift_name.in_(new_names)).all()
    for old_s in old_shifts:
        target_shift = ca_ngay if "Trưa" in old_s.shift_name or "Sáng" in old_s.shift_name else ca_dem
        db.query(OperationLog).filter_by(shift_id=old_s.shift_id).update({"shift_id": target_shift.shift_id})
        db.delete(old_s)
    db.commit()

    # Checklist Items
    checklists = [
        {"item_name": "Kiểm tra mức nhớt động cơ", "applies": None, "severity": "light"},
        {"item_name": "Kiểm tra hệ thống phanh chân/tay", "applies": None, "severity": "dangerous"},
        {"item_name": "Kiểm tra áp suất & tình trạng lốp", "applies": [vtype_cache["Xe nâng"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra còi, đèn chiếu sáng & cảnh báo", "applies": None, "severity": "light"},
        # Crane specific checklist (17 items)
        {"item_name": "Kiểm tra bánh xe, motor di chuyển", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra neo, chốt chống bão", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Kiểm tra tang cáp điện động lực", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra đường ray di chuyển", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra móc cẩu", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Kiểm tra cáp kéo hàng", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Pully cáp nâng hạ cần", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra cáp nâng cần", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Pully cáp kéo hàng", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Bu lông lắp ghép chân cẩu", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra kết cấu thép sàn thao tác", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra nhớt hộp số", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra cảnh báo trên bảng điều khiển", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra các hạn vị", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Kiểm tra đèn chiếu sáng", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "light"},
        {"item_name": "Kiểm tra hệ thống phanh kéo hàng, quay cầu, nâng hạ cần", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"},
        {"item_name": "Hệ thống báo tải", "applies": [vtype_cache["Cần cẩu"].vehicle_type_id], "severity": "dangerous"}
    ]
    for c in checklists:
        if not db.query(ChecklistItem).filter_by(item_name=c["item_name"]).first():
            db.add(ChecklistItem(item_name=c["item_name"], applies_to_vehicle_types=c["applies"], active=True, severity=c["severity"]))

    # Failure Categories
    failure_cats = [
        {"category_name": "Hỏng động cơ", "severity": "heavy"},
        {"category_name": "Mất phanh / Hỏng phanh", "severity": "dangerous"},
        {"category_name": "Xì bể ống thủy lực", "severity": "light"},
        {"category_name": "Bể lốp / Nổ lốp", "severity": "heavy"},
        {"category_name": "Đứt cáp cẩu", "severity": "dangerous"},
        {"category_name": "Hư bình ắc quy / Không đề được", "severity": "light"}
    ]
    for fc in failure_cats:
        if not db.query(FailureCategory).filter_by(category_name=fc["category_name"]).first():
            db.add(FailureCategory(category_name=fc["category_name"], severity_default=fc["severity"]))

    # 6. System Settings
    settings_data = [
        {"key": "max_repair_days", "value": "3", "description": "Số ngày sửa chữa tối đa cho phép trước khi cảnh báo trễ"},
        {"key": "warning_days", "value": "30", "description": "Thời hạn cảnh báo đăng kiểm xe"},
        {"key": "max_upload_size", "value": "10", "description": "Dung lượng upload file tối đa (MB)"},
        {"key": "max_photos_per_failure", "value": "5", "description": "Số ảnh tối đa đính kèm cho mỗi báo cáo sự cố"},
        {"key": "maintenance_hourmeter_interval", "value": "250.0", "description": "Chu kỳ bảo trì xe tính theo giờ máy thực tế (giờ)"}
    ]
    for sd in settings_data:
        if not db.query(SystemSetting).filter_by(key=sd["key"]).first():
            db.add(SystemSetting(key=sd["key"], value=sd["value"], description=sd["description"]))

    # 7. Vehicles (Seed phương tiện với đầy đủ trạng thái để test)
    import uuid
    
    vehicles_data = [
        {
            "code": "CNC-01",
            "name": "Cần cẩu Kobelco 50T",
            "type_name": "Cần cẩu",
            "status": "active",
            "hourmeter": 120.0,
            "last_maint": 100.0
        },
        {
            "code": "XN-01",
            "name": "Xe nâng Toyota 3T",
            "type_name": "Xe nâng",
            "status": "repairing",
            "hourmeter": 240.0,
            "last_maint": 200.0
        },
        {
            "code": "CNC-02",
            "name": "Cần cẩu Liebherr 100T",
            "type_name": "Cần cẩu",
            "status": "repairing",
            "hourmeter": 450.0,
            "last_maint": 450.0
        },
        {
            "code": "XC-01",
            "name": "Xe cuốc Komatsu 0.8m3",
            "type_name": "Xe cuốc",
            "status": "inactive",
            "hourmeter": 600.0,
            "last_maint": 500.0
        },
        {
            "code": "XD-01",
            "name": "Xe đào Hitachi 1.2m3",
            "type_name": "Xe đào",
            "status": "repairing",
            "hourmeter": 365.0, # (365 - 100) = 265 > 250 -> Cảnh báo cần bảo trì
            "last_maint": 100.0
        },
        {
            "code": "CNC-03",
            "name": "Cần cẩu Zoomlion 70T",
            "type_name": "Cần cẩu",
            "status": "repairing",
            "hourmeter": 300.0,
            "last_maint": 200.0
        }
    ]
    
    veh_cache = {}
    for v in vehicles_data:
        veh = db.query(Vehicle).filter_by(vehicle_code=v["code"]).first()
        if not veh:
            veh = Vehicle(
                vehicle_id=uuid.uuid4(),
                vehicle_code=v["code"],
                vehicle_name=v["name"],
                vehicle_type_id=vtype_cache[v["type_name"]].vehicle_type_id,
                status=v["status"],
                current_hourmeter=v["hourmeter"],
                last_maintenance_hourmeter=v["last_maint"],
                active=True
            )
            db.add(veh)
            db.commit()
            db.refresh(veh)
        veh_cache[v["code"]] = veh

    # 8. Unresolved failure on XN-01 to trigger Handover Warning (sự cố chưa sửa cần bàn giao ca)
    has_fail = db.query(FailureLog).filter_by(vehicle_id=veh_cache["XN-01"].vehicle_id, is_repaired=False).first()
    if not has_fail:
        hỏng_phanh_cat = db.query(FailureCategory).filter_by(category_name="Mất phanh / Hỏng phanh").first()
        fail = FailureLog(
            vehicle_id=veh_cache["XN-01"].vehicle_id,
            category_id=hỏng_phanh_cat.category_id,
            description="Phanh tay rơ nhiều, không ăn khi kéo hết nấc",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(hours=6),
            severity="dangerous",
            phase="before_shift",
            is_repaired=False,
            transferred_to_next_shift=True,
            created_by="OP01"
        )
        db.add(fail)
        db.commit()
        db.refresh(fail)

    # 9. Active failure on CNC-02 to trigger Repair Log creation for ME01 (đang sửa chữa)
    has_fail_cnc2 = db.query(FailureLog).filter_by(vehicle_id=veh_cache["CNC-02"].vehicle_id, is_repaired=False).first()
    if not has_fail_cnc2:
        xì_thủy_lực_cat = db.query(FailureCategory).filter_by(category_name="Xì bể ống thủy lực").first()
        fail_cnc2 = FailureLog(
            vehicle_id=veh_cache["CNC-02"].vehicle_id,
            category_id=xì_thủy_lực_cat.category_id,
            description="Xì dầu ty nâng cẩu chính, rò rỉ mạnh dưới gầm",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(days=1),
            severity="heavy",
            phase="during_shift",
            is_repaired=False,
            transferred_to_next_shift=True,
            created_by="OP01"
        )
        db.add(fail_cnc2)
        db.commit()
        db.refresh(fail_cnc2)
        
        # Create corresponding pending repair log
        repair = RepairLog(
            failure_id=fail_cnc2.failure_id,
            mechanic_id="ME01",
            repair_start=datetime.datetime.utcnow() - datetime.timedelta(hours=20),
            repair_status="in_progress",
            repaired_in_shift=False
        )
        db.add(repair)
        db.commit()

    # Extra Failure & Repair cases for complete operator-level and state testing
    # Case A: Pending failure on XC-01 by OP02
    has_extra_a = db.query(FailureLog).filter_by(vehicle_id=veh_cache["XC-01"].vehicle_id, is_repaired=False).first()
    if not has_extra_a:
        bể_lốp_cat = db.query(FailureCategory).filter_by(category_name="Bể lốp / Nổ lốp").first()
        fail_a = FailureLog(
            vehicle_id=veh_cache["XC-01"].vehicle_id,
            category_id=bể_lốp_cat.category_id,
            description="Nổ lốp sau bên trái khi đang lùi xe vào bãi",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(hours=4),
            severity="heavy",
            phase="out_of_shift",
            is_repaired=False,
            created_by="OP02"
        )
        db.add(fail_a)
        db.commit()

    # Case B: In-progress repair on XD-01 assigned to OP01
    has_extra_b = db.query(FailureLog).filter_by(vehicle_id=veh_cache["XD-01"].vehicle_id, is_repaired=False).first()
    if not has_extra_b:
        xì_thủy_lực_cat = db.query(FailureCategory).filter_by(category_name="Xì bể ống thủy lực").first()
        fail_b = FailureLog(
            vehicle_id=veh_cache["XD-01"].vehicle_id,
            category_id=xì_thủy_lực_cat.category_id,
            description="Rò rỉ nhẹ dầu thủy lực ở đường ống nối gầu xúc",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(hours=5),
            severity="light",
            phase="during_shift",
            is_repaired=False,
            created_by="OP01"
        )
        db.add(fail_b)
        db.commit()
        db.refresh(fail_b)

        rep_b = RepairLog(
            failure_id=fail_b.failure_id,
            mechanic_id="OP01",
            repair_start=datetime.datetime.utcnow() - datetime.timedelta(hours=2),
            repair_status="in_progress",
            repaired_in_shift=False
        )
        db.add(rep_b)
        db.commit()

    # Case C: In-progress repair on CNC-03 assigned to OP02
    veh_cnc3 = veh_cache["CNC-03"]
    has_extra_c = db.query(FailureLog).filter(FailureLog.vehicle_id == veh_cnc3.vehicle_id, FailureLog.is_repaired == False, FailureLog.created_by == "OP02").first()
    if not has_extra_c:
        hỏng_ắc_quy_cat = db.query(FailureCategory).filter_by(category_name="Hư bình ắc quy / Không đề được").first()
        fail_c = FailureLog(
            vehicle_id=veh_cnc3.vehicle_id,
            category_id=hỏng_ắc_quy_cat.category_id,
            description="Bình điện yếu, đề máy kêu tạch tạch khó nổ",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(hours=3),
            severity="light",
            phase="during_shift",
            is_repaired=False,
            created_by="OP02"
        )
        db.add(fail_c)
        db.commit()
        db.refresh(fail_c)

        rep_c = RepairLog(
            failure_id=fail_c.failure_id,
            mechanic_id="OP02",
            repair_start=datetime.datetime.utcnow() - datetime.timedelta(hours=1),
            repair_status="in_progress",
            repaired_in_shift=False
        )
        db.add(rep_c)
        db.commit()

    # Case D: Cancelled repair on XD-01
    has_extra_d = db.query(FailureLog).filter(FailureLog.vehicle_id == veh_cache["XD-01"].vehicle_id, FailureLog.is_repaired == True, FailureLog.description.like("%động cơ kêu gõ%")).first()
    if not has_extra_d:
        hỏng_động_cơ_cat = db.query(FailureCategory).filter_by(category_name="Hỏng động cơ").first()
        fail_d = FailureLog(
            vehicle_id=veh_cache["XD-01"].vehicle_id,
            category_id=hỏng_động_cơ_cat.category_id,
            description="Động cơ kêu gõ lớn, khói đen mù mịt",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(days=2),
            severity="dangerous",
            phase="during_shift",
            is_repaired=True,
            created_by="OP01"
        )
        db.add(fail_d)
        db.commit()
        db.refresh(fail_d)

        rep_d = RepairLog(
            failure_id=fail_d.failure_id,
            mechanic_id="ME01",
            repair_start=fail_d.failure_time + datetime.timedelta(minutes=30),
            repair_end=fail_d.failure_time + datetime.timedelta(hours=4),
            repair_status="cancelled",
            repaired_in_shift=False,
            note="Không đủ dụng cụ và linh kiện để đại tu tại công trường. Hủy yêu cầu để chuyển xe về xưởng dịch vụ ngoài."
        )
        db.add(rep_d)
        db.commit()

    # 10. History of Closed Operations & Repairs for MTTR/MTBF and Dashboard Charts
    has_history = db.query(OperationLog).filter_by(vehicle_id=veh_cache["CNC-01"].vehicle_id).first()
    if not has_history:
        shift_cag = db.query(Shift).filter_by(shift_name="Ca Ngày").first()
        for i in range(5, 0, -1):
            day = datetime.date.today() - datetime.timedelta(days=i)
            # Create completed shift log
            op_log = OperationLog(
                vehicle_id=veh_cache["CNC-01"].vehicle_id,
                operator_id="OP01",
                shift_id=shift_cag.shift_id,
                work_date=day,
                start_hour=datetime.time(6, 0),
                hourmeter_start=100.0 + (5 - i) * 8.0,
                condition_before_shift="ok",
                is_safety_confirmed=True,
                signature_data="data:image/png;base64,mock_sig",
                signature_time=datetime.datetime.combine(day, datetime.time(6, 5)),
                acknowledged_previous_failure=False,
                hourmeter_end=100.0 + (5 - i) * 8.0 + 7.5,
                end_hour=datetime.time(14, 0),
                notes=f"Vận hành ngày {day} bình thường. Máy êm.",
                idempotency_key=uuid.uuid4()
            )
            db.add(op_log)
            db.commit()
            db.refresh(op_log)

            # Seed checklist result for each
            checklist_all = db.query(ChecklistItem).all()
            for chk in checklist_all:
                res = ChecklistResult(
                    operation_id=op_log.operation_id,
                    checklist_id=chk.checklist_id,
                    result=True,
                    note="Đạt tiêu chuẩn"
                )
                db.add(res)
            db.commit()

        # Seed historical resolved failures & repairs for CNC-01 to calculate MTTR/MTBF
        # F1: 10 days ago, repaired 10 days ago (took 3 hours)
        hỏng_ắc_quy_cat = db.query(FailureCategory).filter_by(category_name="Hư bình ắc quy / Không đề được").first()
        f_hist1 = FailureLog(
            vehicle_id=veh_cache["CNC-01"].vehicle_id,
            category_id=hỏng_ắc_quy_cat.category_id,
            description="Đề máy không nổ, bình yếu",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            severity="light",
            phase="before_shift",
            is_repaired=True,
            transferred_to_next_shift=False,
            created_by="OP01"
        )
        db.add(f_hist1)
        db.commit()
        db.refresh(f_hist1)

        r_hist1 = RepairLog(
            failure_id=f_hist1.failure_id,
            mechanic_id="ME01",
            repair_start=f_hist1.failure_time + datetime.timedelta(minutes=15),
            repair_end=f_hist1.failure_time + datetime.timedelta(hours=3, minutes=15),
            repaired_in_shift=False,
            parts_used="Thay bình ắc quy GS 12V 70Ah",
            note="Đã sạc lại bình cũ và lắp bình mới dự phòng.",
            repair_status="done"
        )
        db.add(r_hist1)
        db.commit()

        # F2: 6 days ago, repaired 6 days ago (took 5 hours)
        # Interval between F1 (10 days ago) and F2 (6 days ago) is 4 days -> MTBF calculation will show real numbers!
        f_hist2 = FailureLog(
            vehicle_id=veh_cache["CNC-01"].vehicle_id,
            category_id=hỏng_ắc_quy_cat.category_id,
            description="Bình mới sụt nguồn đột ngột",
            failure_time=datetime.datetime.utcnow() - datetime.timedelta(days=6),
            severity="light",
            phase="during_shift",
            is_repaired=True,
            transferred_to_next_shift=False,
            created_by="OP01"
        )
        db.add(f_hist2)
        db.commit()
        db.refresh(f_hist2)

        r_hist2 = RepairLog(
            failure_id=f_hist2.failure_id,
            mechanic_id="ME01",
            repair_start=f_hist2.failure_time + datetime.timedelta(minutes=30),
            repair_end=f_hist2.failure_time + datetime.timedelta(hours=5, minutes=30),
            repaired_in_shift=False,
            parts_used="Thay dây cáp nối mát và siết lại cọc bình",
            note="Cọc bình lỏng tiếp xúc kém gây mất nguồn.",
            repair_status="done"
        )
        db.add(r_hist2)
        db.commit()

    db.commit()
    print("Database seeded successfully!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # Create tables first in case they do not exist
        Base.metadata.create_all(bind=engine)
        seed_db(db)
    finally:
        db.close()
