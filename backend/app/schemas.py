from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, time, datetime
from uuid import UUID
from decimal import Decimal

# Shared Model Configuration
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Auth Schemas
class LoginRequest(BaseModel):
    operator_id: str = Field(..., max_length=20)
    password: str

class Token(BaseSchema):
    access_token: str
    token_type: str

class TokenData(BaseSchema):
    username: Optional[str] = None
    role: Optional[str] = None

# Permission & Role
class PermissionSchema(BaseSchema):
    permission_id: int
    permission_key: str
    description: Optional[str] = None

class RoleSchema(BaseSchema):
    role_id: int
    role_name: str
    description: Optional[str] = None
    permissions: List[PermissionSchema] = []

# Operator (User)
class OperatorBase(BaseSchema):
    operator_id: str
    full_name: str
    department: Optional[str] = None
    role_id: int
    phone: Optional[str] = None
    active: bool = True

class OperatorCreate(OperatorBase):
    password: str

class OperatorUpdate(BaseSchema):
    full_name: Optional[str] = None
    department: Optional[str] = None
    role_id: Optional[int] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class OperatorSchema(OperatorBase):
    role_rel: Optional[RoleSchema] = None

# Vehicle Type
class VehicleTypeBase(BaseSchema):
    type_name: str

class VehicleTypeCreate(VehicleTypeBase):
    pass

class VehicleTypeSchema(VehicleTypeBase):
    vehicle_type_id: int

# Shift
class ShiftBase(BaseSchema):
    shift_name: str
    start_time: time
    end_time: time

class ShiftCreate(ShiftBase):
    pass

class ShiftSchema(ShiftBase):
    shift_id: int

# Vehicle Status
class VehicleStatusSchema(BaseSchema):
    status_code: str
    status_label: str

# Vehicle
class VehicleBase(BaseSchema):
    vehicle_code: str
    vehicle_name: str
    vehicle_type_id: int
    model: Optional[str] = None
    manufacture_year: Optional[int] = None
    status: str = "active"
    current_hourmeter: Decimal = Field(default=Decimal("0.0"))
    last_maintenance_hourmeter: Decimal = Field(default=Decimal("0.0"))
    active: bool = True

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseSchema):
    vehicle_code: Optional[str] = None
    vehicle_name: Optional[str] = None
    vehicle_type_id: Optional[int] = None
    model: Optional[str] = None
    manufacture_year: Optional[int] = None
    status: Optional[str] = None
    current_hourmeter: Optional[Decimal] = None
    last_maintenance_hourmeter: Optional[Decimal] = None
    active: Optional[bool] = None

class VehicleSchema(VehicleBase):
    vehicle_id: UUID
    vehicle_type: Optional[VehicleTypeSchema] = None
    vehicle_status: Optional[VehicleStatusSchema] = None

# Checklist Item
class ChecklistItemBase(BaseSchema):
    item_name: str
    applies_to_vehicle_types: Optional[List[int]] = None
    active: bool = True
    severity: str = "light"

class ChecklistItemCreate(ChecklistItemBase):
    pass

class ChecklistItemSchema(ChecklistItemBase):
    checklist_id: int

# Checklist Result
class ChecklistResultBase(BaseSchema):
    checklist_id: int
    result: bool
    note: Optional[str] = None

class ChecklistResultCreate(ChecklistResultBase):
    pass

class ChecklistResultSchema(ChecklistResultBase):
    result_id: int
    operation_id: int
    checklist_item: Optional[ChecklistItemSchema] = None

# Failure Category
class FailureCategoryBase(BaseSchema):
    category_name: str
    severity_default: str

class FailureCategoryCreate(FailureCategoryBase):
    pass

class FailureCategorySchema(FailureCategoryBase):
    category_id: int

# Failure Attachment
class FailureAttachmentSchema(BaseSchema):
    attachment_id: int
    failure_id: int
    file_path: str
    uploaded_by: str
    uploaded_at: datetime

# Repair Log
class RepairLogCreate(BaseSchema):
    failure_id: int
    repair_start: datetime = Field(default_factory=datetime.now)
    repaired_in_shift: bool = False

class RepairLogEnd(BaseSchema):
    repair_end: datetime = Field(default_factory=datetime.now)
    parts_used: Optional[str] = None
    note: Optional[str] = None
    repair_status: str = "done"

class RepairAssignment(BaseSchema):
    failure_id: int
    mechanic_id: str

class FailureMinSchema(BaseSchema):
    failure_id: int
    vehicle_id: UUID
    category_id: int
    description: str
    severity: str
    failure_time: datetime
    created_by: str
    category: Optional[FailureCategorySchema] = None
    vehicle: Optional[VehicleSchema] = None

class RepairLogSchema(BaseSchema):
    repair_id: int
    failure_id: int
    mechanic_id: str
    repair_start: datetime
    repair_end: Optional[datetime] = None
    repaired_in_shift: bool
    parts_used: Optional[str] = None
    note: Optional[str] = None
    repair_status: str
    mechanic: Optional[OperatorBase] = None
    failure: Optional[FailureMinSchema] = None

class OperationMinSchema(BaseSchema):
    operation_id: int
    work_date: date
    shift: Optional[ShiftSchema] = None

# Failure Log
class FailureLogBase(BaseSchema):
    vehicle_id: UUID
    category_id: int
    description: str
    severity: str
    failure_time: datetime = Field(default_factory=datetime.now)

class FailureLogCreateDuringShift(FailureLogBase):
    operation_id: int
    phase: str = "during_shift"

class FailureLogCreateOutOfShift(FailureLogBase):
    phase: str = "out_of_shift"

class FailureLogSchema(FailureLogBase):
    failure_id: int
    operation_id: Optional[int] = None
    phase: str
    is_repaired: bool
    transferred_to_next_shift: bool
    created_by: str
    category: Optional[FailureCategorySchema] = None
    attachments: List[FailureAttachmentSchema] = []
    vehicle: Optional[VehicleSchema] = None
    creator: Optional[OperatorBase] = None
    operation: Optional[OperationMinSchema] = None
    repairs: List[RepairLogSchema] = []

# Operation Log
class OperationLogCreate(BaseSchema):
    vehicle_id: UUID
    operator_id: str
    shift_id: int
    work_date: date
    start_hour: time
    hourmeter_start: Decimal
    condition_before_shift: str
    is_safety_confirmed: bool
    signature_data: Optional[str] = None  # Base64 signature
    signature_time: Optional[datetime] = None
    acknowledged_previous_failure: bool = False
    acknowledged_by: Optional[str] = None
    idempotency_key: UUID
    notes: Optional[str] = None
    safety_reason: Optional[str] = None
    assistant_operator_ids: List[str] = [] # list of extra operators
    checklist_results: List[ChecklistResultCreate] = []
    work_type: Optional[str] = "production"

class OperationLogEnd(BaseSchema):
    hourmeter_end: Decimal
    end_hour: time
    notes: Optional[str] = None
    is_repair_done: Optional[bool] = None
    parts_used: Optional[str] = None
    repair_note: Optional[str] = None

class OperationLogBaseSchema(BaseSchema):
    operation_id: int
    vehicle_id: UUID
    operator_id: str
    shift_id: int
    work_date: date
    start_hour: time
    end_hour: Optional[time] = None
    hourmeter_start: Decimal
    hourmeter_end: Optional[Decimal] = None
    condition_before_shift: str
    is_safety_confirmed: bool
    signature_data: Optional[str] = None
    signature_time: Optional[datetime] = None
    acknowledged_previous_failure: bool
    acknowledged_by: Optional[str] = None
    idempotency_key: UUID
    notes: Optional[str] = None
    safety_reason: Optional[str] = None
    work_type: str = "production"

class OperationLogSchema(OperationLogBaseSchema):
    vehicle: Optional[VehicleSchema] = None
    operator: Optional[OperatorBase] = None
    shift: Optional[ShiftSchema] = None
    operators: List[OperatorBase] = []
    failures: List[FailureLogSchema] = []

class OperationLogDetailSchema(OperationLogSchema):
    checklist_results: List[ChecklistResultSchema] = []

# Repair Log Placeholder - Moved above

# System Settings
class SystemSettingSchema(BaseSchema):
    setting_id: int
    key: str
    value: str
    description: Optional[str] = None

class SystemSettingUpdate(BaseSchema):
    value: str

# Audit Log
class AuditLogSchema(BaseSchema):
    audit_id: int
    operator_id: Optional[str] = None
    table_name: str
    record_id: str
    action: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    created_at: datetime
    operator: Optional[OperatorBase] = None
