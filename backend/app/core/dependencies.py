from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Operator, Role, Permission
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> Operator:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        if username is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Eagerly load role and its permissions to avoid extra queries in RBAC check
    user = db.query(Operator).options(
        joinedload(Operator.role_rel).joinedload(Role.permissions)
    ).filter(Operator.operator_id == username, Operator.active == True).first()
    
    if user is None:
        raise credentials_exception
    return user

class PermissionChecker:
    def __init__(self, required_permissions: list[str]):
        self.required_permissions = required_permissions

    def __call__(self, current_user: Operator = Depends(get_current_user)) -> Operator:
        role = current_user.role_rel
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role not found"
            )
            
        # Get all keys for permissions mapped to this user's role
        user_permission_keys = {p.permission_key for p in role.permissions}
        
        # If the user has 'admin:all', bypass check
        if "admin:all" in user_permission_keys:
            return current_user
            
        # Check if the user has any of the required permissions
        # If any of required_permissions is met, allow access.
        if not any(perm in user_permission_keys for perm in self.required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inadequate permissions to perform this action"
            )
            
        return current_user
