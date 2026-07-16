import os
# Force SQLite database URL for tests before importing the app
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.main import app
from app.core.security import create_access_token
from app.models import Operator, Role, Vehicle, VehicleType, Shift
from decimal import Decimal
import uuid
import datetime

# SQLite in-memory DB configuration for unit tests
# Note: Since SQLite doesn't natively support PostgreSQL arrays and JSONB type natively in some constraints,
# we ensure that standard operations are tested in a compatible manner.
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    # Create tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        # Seed basic roles
        admin_role = Role(role_id=1, role_name="ADMIN", description="Admin")
        op_role = Role(role_id=2, role_name="NGƯỜI VẬN HÀNH", description="Operator")
        mech_role = Role(role_id=3, role_name="THỢ SỬA CHỮA", description="Mechanic")
        db.add_all([admin_role, op_role, mech_role])
        db.commit()
        
        # Seed basic users
        admin_user = Operator(
            operator_id="ADMIN",
            full_name="Admin Test",
            role_id=1,
            password_hash="hashed_pw",
            active=True
        )
        op_user = Operator(
            operator_id="OP01",
            full_name="Operator Test",
            role_id=2,
            password_hash="hashed_pw",
            active=True
        )
        mech_user = Operator(
            operator_id="ME01",
            full_name="Mechanic Test",
            role_id=3,
            password_hash="hashed_pw",
            active=True
        )
        db.add_all([admin_user, op_user, mech_user])
        db.commit()
        
        # Seed vehicle type
        vt = VehicleType(vehicle_type_id=1, type_name="Cần cẩu")
        db.add(vt)
        db.commit()
        
        # Seed basic shift
        sh = Shift(shift_id=1, shift_name="Ca Ngày", start_time=datetime.time(6, 0), end_time=datetime.time(18, 0))
        db.add(sh)
        db.commit()
        
        # Seed basic vehicle
        vehicle1 = Vehicle(
            vehicle_id=uuid.UUID("a51a9fb0-f1ad-4674-9b2f-7c15b13993d0"),
            vehicle_code="CNC-01",
            vehicle_name="Cần cẩu Kobelco",
            vehicle_type_id=1,
            status="active",
            current_hourmeter=Decimal("100.0"),
            last_maintenance_hourmeter=Decimal("100.0"),
            active=True
        )
        vehicle2 = Vehicle(
            vehicle_id=uuid.UUID("b62b0fc0-f2ae-5785-0c3a-8d26c24004e1"),
            vehicle_code="CNC-02",
            vehicle_name="Cần cẩu Liebherr",
            vehicle_type_id=1,
            status="repairing", # starts as repairing
            current_hourmeter=Decimal("200.0"),
            last_maintenance_hourmeter=Decimal("200.0"),
            active=True
        )
        db.add_all([vehicle1, vehicle2])
        db.commit()
        
    finally:
        db.close()
        
    yield
    
    # Tear down database
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def admin_headers():
    token = create_access_token(subject="ADMIN")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def operator_headers():
    token = create_access_token(subject="OP01")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def mechanic_headers():
    token = create_access_token(subject="ME01")
    return {"Authorization": f"Bearer {token}"}
