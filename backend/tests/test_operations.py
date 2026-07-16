import pytest
from datetime import date, time, datetime, timedelta
import uuid
from app.models import FailureLog, FailureCategory, RepairLog, Vehicle
from decimal import Decimal

# Helper to generate a unique UUID for idempotency keys
def generate_uuid():
    return str(uuid.uuid4())

def test_start_shift_success(client, operator_headers):
    # Success scenario: start a shift
    payload = {
        "vehicle_id": "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0",
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": str(date.today()),
        "start_hour": "06:00:00",
        "hourmeter_start": 100.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "data:image/png;base64,mock_sig",
        "acknowledged_previous_failure": False,
        "idempotency_key": generate_uuid(),
        "checklist_results": []
    }
    
    response = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["operator_id"] == "OP01"
    assert float(data["hourmeter_start"]) == 100.0

def test_start_shift_uniqueness_constraint(client, operator_headers):
    # Should block duplicate (vehicle_id, work_date, shift_id)
    vehicle_id = "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0"
    work_date = str(date.today() + timedelta(days=1)) # use tomorrow to avoid clash with first test
    
    payload1 = {
        "vehicle_id": vehicle_id,
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": work_date,
        "start_hour": "06:00:00",
        "hourmeter_start": 105.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "sig",
        "idempotency_key": generate_uuid(),
        "checklist_results": []
    }
    
    response1 = client.post("/api/operations/start", json=payload1, headers=operator_headers)
    assert response1.status_code == 200
    
    # Try duplicate shift registration
    payload2 = payload1.copy()
    payload2["idempotency_key"] = generate_uuid() # different idempotency
    
    response2 = client.post("/api/operations/start", json=payload2, headers=operator_headers)
    assert response2.status_code == 400
    assert "đã được đăng ký chạy ca" in response2.json()["detail"]

def test_start_shift_idempotency(client, operator_headers):
    # Repeat the same request with the same idempotency key
    work_date = str(date.today() + timedelta(days=2))
    idem_key = generate_uuid()
    
    payload = {
        "vehicle_id": "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0",
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": work_date,
        "start_hour": "06:00:00",
        "hourmeter_start": 110.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "sig",
        "idempotency_key": idem_key,
        "checklist_results": []
    }
    
    response1 = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response1.status_code == 200
    
    # Send again
    response2 = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response2.status_code == 400
    assert "Yêu cầu trùng lặp" in response2.json()["detail"]

def test_start_shift_locked_vehicle(client, operator_headers):
    # CNC-02 status is 'repairing'. Starting shift should fail.
    payload = {
        "vehicle_id": "b62b0fc0-f2ae-5785-0c3a-8d26c24004e1",
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": str(date.today() + timedelta(days=3)),
        "start_hour": "06:00:00",
        "hourmeter_start": 200.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "sig",
        "idempotency_key": generate_uuid(),
        "checklist_results": []
    }
    response = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response.status_code == 400
    assert "đang sửa chữa" in response.json()["detail"]

def test_shift_handover_warning(client, db, operator_headers):
    # Ensure vehicle is active
    vehicle_id = "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0"
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == uuid.UUID(vehicle_id)).first()
    v.status = "active"
    db.commit()
    
    # 1. Seed an active failure category and log
    cat = FailureCategory(category_id=10, category_name="Hỏng phanh tay", severity_default="dangerous")
    db.add(cat)
    db.commit()
    
    fail = FailureLog(
        failure_id=99,
        vehicle_id=uuid.UUID(vehicle_id),
        category_id=10,
        description="Đứt dây cáp phanh",
        failure_time=datetime.utcnow() - timedelta(hours=2),
        severity="dangerous",
        phase="before_shift",
        is_repaired=False,
        transferred_to_next_shift=True,
        created_by="OP01"
    )
    db.add(fail)
    db.commit()
    
    work_date = str(date.today() + timedelta(days=4))
    
    # Try starting shift without acknowledging previous failure
    payload = {
        "vehicle_id": vehicle_id,
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": work_date,
        "start_hour": "06:00:00",
        "hourmeter_start": 120.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "sig",
        "acknowledged_previous_failure": False,
        "idempotency_key": generate_uuid(),
        "checklist_results": []
    }
    
    response = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response.status_code == 400
    assert response.json()["detail"]["error_code"] == "HANDOVER_ACKNOWLEDGEMENT_REQUIRED"
    
    # Try with acknowledgement -> should succeed
    payload["acknowledged_previous_failure"] = True
    payload["idempotency_key"] = generate_uuid()
    response2 = client.post("/api/operations/start", json=payload, headers=operator_headers)
    assert response2.status_code == 200
    
    # Clean up failure log to prevent issues in other tests
    db.delete(fail)
    db.delete(cat)
    db.commit()

def test_hourmeter_validation_on_close_shift(client, operator_headers):
    # 1. Start a shift first
    work_date = str(date.today() + timedelta(days=5))
    payload = {
        "vehicle_id": "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0",
        "operator_id": "OP01",
        "shift_id": 1,
        "work_date": work_date,
        "start_hour": "06:00:00",
        "hourmeter_start": 130.0,
        "condition_before_shift": "ok",
        "is_safety_confirmed": True,
        "signature_data": "sig",
        "idempotency_key": generate_uuid(),
        "checklist_results": []
    }
    response = client.post("/api/operations/start", json=payload, headers=operator_headers)
    op_id = response.json()["operation_id"]
    
    # 2. End shift with hourmeter_end < hourmeter_start -> fail
    close_payload = {
        "hourmeter_end": 129.5,
        "end_hour": "14:00:00",
        "notes": "Mắc lỗi nhập số nhỏ hơn"
    }
    response_close = client.post(f"/api/operations/end/{op_id}", json=close_payload, headers=operator_headers)
    assert response_close.status_code == 400
    assert "không được nhỏ hơn" in response_close.json()["detail"]
    
    # 3. End shift with hourmeter_end >= hourmeter_start -> success
    close_payload["hourmeter_end"] = 135.5
    response_close_ok = client.post(f"/api/operations/end/{op_id}", json=close_payload, headers=operator_headers)
    assert response_close_ok.status_code == 200
    assert float(response_close_ok.json()["hourmeter_end"]) == 135.5

def test_mttr_mtbf_calculation(client, db, admin_headers):
    # Uses admin token since reports require reports:view permission (admin:all overrides)
    headers = admin_headers
    
    vehicle_id = "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0"
    
    # Clear existing logs for vehicle
    db.query(RepairLog).delete()
    db.query(FailureLog).delete()
    db.commit()
    
    # Seed failure categories
    cat = FailureCategory(category_id=20, category_name="Hư lốp xe", severity_default="heavy")
    db.add(cat)
    db.commit()
    
    # Seed failures at specific timestamps
    # F1: 10 hours ago
    # F2: 5 hours ago (5 hours interval between F1 and F2)
    # F3: 2 hours ago (3 hours interval between F2 and F3)
    # Total intervals = 2, lengths = 5 hours, 3 hours -> MTBF = (5+3)/2 = 4.0 hours
    now = datetime.utcnow()
    f1 = FailureLog(failure_id=1, vehicle_id=uuid.UUID(vehicle_id), category_id=20, description="Hư lốp", failure_time=now - timedelta(hours=10), severity="heavy", phase="before_shift", is_repaired=True, created_by="OP01")
    f2 = FailureLog(failure_id=2, vehicle_id=uuid.UUID(vehicle_id), category_id=20, description="Hư lốp tiếp", failure_time=now - timedelta(hours=5), severity="heavy", phase="during_shift", is_repaired=True, created_by="OP01")
    f3 = FailureLog(failure_id=3, vehicle_id=uuid.UUID(vehicle_id), category_id=20, description="Hư phanh", failure_time=now - timedelta(hours=2), severity="heavy", phase="during_shift", is_repaired=True, created_by="OP01")
    db.add_all([f1, f2, f3])
    db.commit()
    
    # Seed completed repairs
    # Repair 1: F1 repair took 2 hours
    # Repair 2: F2 repair took 1 hour
    # Repair 3: F3 repair took 3 hours
    # Total repair time = 2 + 1 + 3 = 6 hours. Number of repairs = 3. MTTR = 6/3 = 2.0 hours.
    r1 = RepairLog(failure_id=1, mechanic_id="ME01", repair_start=now - timedelta(hours=10), repair_end=now - timedelta(hours=8), repaired_in_shift=False, repair_status="done")
    r2 = RepairLog(failure_id=2, mechanic_id="ME01", repair_start=now - timedelta(hours=5), repair_end=now - timedelta(hours=4), repaired_in_shift=False, repair_status="done")
    r3 = RepairLog(failure_id=3, mechanic_id="ME01", repair_start=now - timedelta(hours=2), repair_end=now + timedelta(hours=1), repaired_in_shift=False, repair_status="done")
    db.add_all([r1, r2, r3])
    db.commit()
    
    response = client.get("/api/reports/metrics", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    
    # Filter for our test vehicle
    vehicle_metrics = [m for m in data["mttr_mtbf"] if m["vehicle_code"] == "CNC-01"][0]
    
    assert vehicle_metrics["mttr"] == 2.0
    assert vehicle_metrics["mtbf"] == 4.0

def test_operator_info_lookup(client):
    response = client.get("/api/auth/operator-info/OP01")
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Operator Test"
    assert data["department"] is None

    response = client.get("/api/auth/operator-info/INVALID_OP")
    assert response.status_code == 404

def test_report_failure_before_shift(client, operator_headers, db):
    vehicle_id = "a51a9fb0-f1ad-4674-9b2f-7c15b13993d0"
    response = client.post(
        f"/api/failures/before-shift?vehicle_id={vehicle_id}&category_id=1&description=Hu%20hong%20phanh&severity=heavy",
        headers=operator_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["phase"] == "before_shift"
    assert data["is_repaired"] is False

    # Check vehicle status is updated to repairing
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == uuid.UUID(vehicle_id)).first()
    assert v.status == "repairing"
