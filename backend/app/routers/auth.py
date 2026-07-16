from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user
from app.models import Operator, Role
from app.schemas import LoginRequest, Token, OperatorSchema
from jose import JWTError
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/operator-info/{operator_id}")
def get_operator_info(
    operator_id: str,
    db: Session = Depends(get_db)
):
    user = db.query(Operator).filter(
        Operator.operator_id == operator_id.upper(),
        Operator.active == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mã nhân viên không tồn tại hoặc đã bị khóa"
        )
        
    return {
        "full_name": user.full_name,
        "department": user.department
    }

@router.post("/login")
def login(
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    user = db.query(Operator).filter(
        Operator.operator_id == login_data.operator_id,
        Operator.active == True
    ).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mã nhân viên hoặc mật khẩu không chính xác"
        )
        
    access_token = create_access_token(subject=user.operator_id)
    refresh_token = create_refresh_token(subject=user.operator_id)
    
    # Store refresh token in HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production (requires HTTPS)
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: str = Cookie(None),
    db: Session = Depends(get_db)
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy Refresh Token"
        )
        
    try:
        payload = decode_token(refresh_token)
        username: str = payload.get("sub")
        token_type: str = payload.get("type")
        if username is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh Token không hợp lệ"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh Token không hợp lệ"
        )
        
    user = db.query(Operator).filter(
        Operator.operator_id == username,
        Operator.active == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại hoặc đã bị khóa"
        )
        
    new_access_token = create_access_token(subject=user.operator_id)
    new_refresh_token = create_refresh_token(subject=user.operator_id)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"detail": "Đăng xuất thành công"}

@router.get("/me", response_model=OperatorSchema)
def get_me(current_user: Operator = Depends(get_current_user)):
    return current_user
