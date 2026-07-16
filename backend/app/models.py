import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Boolean,
    Date,
    Time,
    DateTime,
    Text,
    ForeignKey,
    Table,
    BigInteger,
    ForeignKeyConstraint,
    PrimaryKeyConstraint,
    UUID,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator
from sqlalchemy import JSON

class IntArray(TypeDecorator):
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(ARRAY(Integer))
        else:
            return dialect.type_descriptor(JSON)

class JSONBOrJSON(TypeDecorator):
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB)
        else:
            return dialect.type_descriptor(JSON)

from sqlalchemy.ext.compiler import compiles
from sqlalchemy import BigInteger

@compiles(BigInteger, 'sqlite')
def compile_big_int_sqlite(type_, compiler, **kw):
    return "INTEGER"

from app.core.database import Base

# Many-to-Many association for role permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.role_id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.permission_id", ondelete="CASCADE"), primary_key=True),
)

# Many-to-Many association for operations and operator assistants
operation_log_operators = Table(
    "operation_log_operators",
    Base.metadata,
    Column("operation_id", BigInteger, ForeignKey("operation_logs.operation_id", ondelete="CASCADE"), primary_key=True),
    Column("operator_id", String(20), ForeignKey("operators.operator_id", ondelete="CASCADE"), primary_key=True),
)

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    operators = relationship("Operator", back_populates="role_rel")

class Permission(Base):
    __tablename__ = "permissions"
    permission_id = Column(Integer, primary_key=True, index=True)
    permission_key = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

class Operator(Base):
    __tablename__ = "operators"
    operator_id = Column(String(20), primary_key=True) # Employee code
    full_name = Column(String(100), nullable=False)
    department = Column(String(50), nullable=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    phone = Column(String(15), nullable=True)
    password_hash = Column(String(255), nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    role_rel = relationship("Role", back_populates="operators")

class VehicleType(Base):
    __tablename__ = "vehicle_types"
    vehicle_type_id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(50), unique=True, nullable=False)

class VehicleStatus(Base):
    __tablename__ = "vehicle_statuses"
    status_code = Column(String(20), primary_key=True) # active, repairing, inactive
    status_label = Column(String(50), nullable=False)

class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_code = Column(String(20), unique=True, nullable=False)
    vehicle_name = Column(String(100), nullable=False)
    vehicle_type_id = Column(Integer, ForeignKey("vehicle_types.vehicle_type_id"), nullable=False)
    model = Column(String(50), nullable=True)
    manufacture_year = Column(Integer, nullable=True)
    status = Column(String(20), ForeignKey("vehicle_statuses.status_code"), nullable=False, default="active")
    current_hourmeter = Column(Numeric(10, 1), nullable=False, default=0.0)
    last_maintenance_hourmeter = Column(Numeric(10, 1), nullable=False, default=0.0)
    active = Column(Boolean, default=True, nullable=False) # Soft delete

    vehicle_type = relationship("VehicleType")
    vehicle_status = relationship("VehicleStatus")

class Shift(Base):
    __tablename__ = "shifts"
    shift_id = Column(Integer, primary_key=True, index=True)
    shift_name = Column(String(20), unique=True, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

class ConditionStatus(Base):
    __tablename__ = "condition_statuses"
    status_code = Column(String(20), primary_key=True) # ok, broken
    status_label = Column(String(50), nullable=False)

class OperationLog(Base):
    __tablename__ = "operation_logs"
    operation_id = Column(BigInteger, primary_key=True, autoincrement=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=False)
    operator_id = Column(String(20), ForeignKey("operators.operator_id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.shift_id"), nullable=False)
    work_date = Column(Date, nullable=False)
    start_hour = Column(Time, nullable=False)
    end_hour = Column(Time, nullable=True)
    hourmeter_start = Column(Numeric(10, 1), nullable=False)
    hourmeter_end = Column(Numeric(10, 1), nullable=True)
    condition_before_shift = Column(String(20), ForeignKey("condition_statuses.status_code"), nullable=False)
    is_safety_confirmed = Column(Boolean, nullable=False, default=False)
    signature_data = Column(Text, nullable=True) # Base64 signature
    signature_time = Column(DateTime, nullable=True)
    acknowledged_previous_failure = Column(Boolean, nullable=False, default=False)
    acknowledged_by = Column(String(20), ForeignKey("operators.operator_id"), nullable=True)
    idempotency_key = Column(UUID(as_uuid=True), unique=True, nullable=False)
    notes = Column(Text, nullable=True)
    safety_reason = Column(Text, nullable=True)
    work_type = Column(String(20), nullable=False, default="production", server_default="production")

    # Ràng buộc UNIQUE(vehicle_id, work_date, shift_id)
    __table_args__ = (
        PrimaryKeyConstraint("operation_id"),
        ForeignKeyConstraint(["vehicle_id"], ["vehicles.vehicle_id"]),
        ForeignKeyConstraint(["operator_id"], ["operators.operator_id"]),
        ForeignKeyConstraint(["shift_id"], ["shifts.shift_id"]),
        ForeignKeyConstraint(["condition_before_shift"], ["condition_statuses.status_code"]),
        ForeignKeyConstraint(["acknowledged_by"], ["operators.operator_id"]),
    )

    vehicle = relationship("Vehicle")
    operator = relationship("Operator", foreign_keys=[operator_id])
    shift = relationship("Shift")
    condition = relationship("ConditionStatus")
    acknowledged_operator = relationship("Operator", foreign_keys=[acknowledged_by])
    
    # Operators in this shift (main operator + secondary operators)
    operators = relationship("Operator", secondary=operation_log_operators)
    checklist_results = relationship("ChecklistResult", back_populates="operation_log", cascade="all, delete-orphan")
    failures = relationship("FailureLog", primaryjoin="OperationLog.operation_id == FailureLog.operation_id")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    checklist_id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String(100), unique=True, nullable=False)
    applies_to_vehicle_types = Column(IntArray, nullable=True) # Postgres array of vehicle type IDs
    active = Column(Boolean, default=True, nullable=False)
    severity = Column(String(20), default="light", server_default="light", nullable=False)

class ChecklistResult(Base):
    __tablename__ = "checklist_results"
    result_id = Column(BigInteger, primary_key=True, autoincrement=True)
    operation_id = Column(BigInteger, ForeignKey("operation_logs.operation_id", ondelete="CASCADE"), nullable=False)
    checklist_id = Column(Integer, ForeignKey("checklist_items.checklist_id"), nullable=False)
    result = Column(Boolean, nullable=False)
    note = Column(Text, nullable=True)

    operation_log = relationship("OperationLog", back_populates="checklist_results")
    checklist_item = relationship("ChecklistItem")

class SeverityLevel(Base):
    __tablename__ = "severity_levels"
    severity_code = Column(String(20), primary_key=True) # light, heavy, dangerous
    severity_label = Column(String(50), nullable=False)

class FailurePhase(Base):
    __tablename__ = "failure_phases"
    phase_code = Column(String(20), primary_key=True) # before_shift, during_shift, out_of_shift
    phase_label = Column(String(50), nullable=False)

class FailureCategory(Base):
    __tablename__ = "failure_categories"
    category_id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), unique=True, nullable=False)
    severity_default = Column(String(20), ForeignKey("severity_levels.severity_code"), nullable=False)

    severity_default_rel = relationship("SeverityLevel")

class FailureLog(Base):
    __tablename__ = "failure_logs"
    failure_id = Column(BigInteger, primary_key=True, autoincrement=True)
    operation_id = Column(BigInteger, ForeignKey("operation_logs.operation_id", ondelete="SET NULL"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("failure_categories.category_id"), nullable=False)
    description = Column(Text, nullable=False)
    failure_time = Column(DateTime, nullable=False, default=datetime.now)
    severity = Column(String(20), ForeignKey("severity_levels.severity_code"), nullable=False)
    phase = Column(String(20), ForeignKey("failure_phases.phase_code"), nullable=False)
    is_repaired = Column(Boolean, default=False, nullable=False)
    transferred_to_next_shift = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(20), ForeignKey("operators.operator_id"), nullable=False)

    vehicle = relationship("Vehicle")
    category = relationship("FailureCategory")
    severity_rel = relationship("SeverityLevel")
    phase_rel = relationship("FailurePhase")
    creator = relationship("Operator")
    operation = relationship("OperationLog", foreign_keys=[operation_id], overlaps="failures")
    
    attachments = relationship("FailureAttachment", back_populates="failure", cascade="all, delete-orphan")
    repairs = relationship("RepairLog", back_populates="failure", cascade="all, delete-orphan")

class FailureAttachment(Base):
    __tablename__ = "failure_attachments"
    attachment_id = Column(BigInteger, primary_key=True, autoincrement=True)
    failure_id = Column(BigInteger, ForeignKey("failure_logs.failure_id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(255), nullable=False)
    uploaded_by = Column(String(20), ForeignKey("operators.operator_id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.now)

    failure = relationship("FailureLog", back_populates="attachments")
    uploader = relationship("Operator")

class RepairStatus(Base):
    __tablename__ = "repair_statuses"
    status_code = Column(String(20), primary_key=True) # pending, in_progress, done
    status_label = Column(String(50), nullable=False)

class RepairLog(Base):
    __tablename__ = "repair_logs"
    repair_id = Column(BigInteger, primary_key=True, autoincrement=True)
    failure_id = Column(BigInteger, ForeignKey("failure_logs.failure_id", ondelete="CASCADE"), nullable=False)
    mechanic_id = Column(String(20), ForeignKey("operators.operator_id"), nullable=False)
    repair_start = Column(DateTime, nullable=False, default=datetime.now)
    repair_end = Column(DateTime, nullable=True)
    repaired_in_shift = Column(Boolean, nullable=False, default=False)
    parts_used = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    repair_status = Column(String(20), ForeignKey("repair_statuses.status_code"), nullable=False, default="pending")

    failure = relationship("FailureLog", back_populates="repairs")
    mechanic = relationship("Operator")
    status_rel = relationship("RepairStatus")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    setting_id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    audit_id = Column(BigInteger, primary_key=True, autoincrement=True)
    operator_id = Column(String(20), ForeignKey("operators.operator_id", ondelete="SET NULL"), nullable=True)
    table_name = Column(String(50), nullable=False)
    record_id = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False) # create, update, delete
    old_value = Column(JSONBOrJSON, nullable=True)
    new_value = Column(JSONBOrJSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    operator = relationship("Operator")

class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    key = Column(UUID(as_uuid=True), primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
