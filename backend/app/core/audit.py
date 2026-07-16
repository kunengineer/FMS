from sqlalchemy.orm import Session
from app.models import AuditLog
from fastapi.encoders import jsonable_encoder
from typing import Any, Optional

def log_audit_event(
    db: Session,
    operator_id: Optional[str],
    table_name: str,
    record_id: str,
    action: str,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None
):
    try:
        # Convert objects to dicts if they are SQLAlchemy models or pydantic schemas
        serial_old = jsonable_encoder(old_value) if old_value is not None else None
        serial_new = jsonable_encoder(new_value) if new_value is not None else None
        
        # Strip potential passwords or sensitive fields from log
        for doc in [serial_old, serial_new]:
            if isinstance(doc, dict):
                doc.pop("password_hash", None)
                doc.pop("password", None)
                doc.pop("signature_data", None) # signature data is large base64, omit to keep DB light

        audit = AuditLog(
            operator_id=operator_id,
            table_name=table_name,
            record_id=str(record_id),
            action=action,
            old_value=serial_old,
            new_value=serial_new
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        # Fallback to printing in logs so that main transaction doesn't fail due to auditing errors
        print(f"Failed to log audit event: {e}")
