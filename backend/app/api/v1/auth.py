import secrets
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User
from app.core.security import verify_password, create_access_token, decode_access_token
from app.schemas.logistics import Token, LoginRequest, UserOut
from app.services.audit import log_audit_event
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email: str = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user(current_user: Optional[User] = Depends(get_optional_current_user)) -> User:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_roles(*allowed_roles: str):
    """Return a dependency that allows access only to the supplied roles."""
    def validate_role(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return validate_role


def get_current_user_or_workflow_token(
    current_user: Optional[User] = Depends(get_optional_current_user),
    workflow_token: Optional[str] = Header(default=None, alias="X-Workflow-Token"),
) -> Optional[User]:
    """Permit an authenticated user or n8n with its service token (read-only automation reads)."""
    if current_user is not None:
        return current_user
    if settings.WORKFLOW_API_TOKEN and workflow_token and secrets.compare_digest(
        workflow_token, settings.WORKFLOW_API_TOKEN
    ):
        return None
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Workflow authentication failed.")


def authorize_workflow_trigger(    current_user: Optional[User] = Depends(get_optional_current_user),
    workflow_token: Optional[str] = Header(default=None, alias="X-Workflow-Token"),
) -> Optional[User]:
    """Permit an operations manager/admin or n8n with its service token."""
    if current_user is not None:
        if current_user.role in {"operations_manager", "admin"}:
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to trigger workflows.")

    if settings.WORKFLOW_API_TOKEN and workflow_token and secrets.compare_digest(
        workflow_token, settings.WORKFLOW_API_TOKEN
    ):
        return None

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Workflow authentication failed.")


@router.post("/login", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(subject=user.email, role=user.role)
    log_audit_event(db, "auth.login", "user", actor=user)
    db.commit()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_name": user.full_name,
        "email": user.email
    }


@router.post("/token", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(subject=user.email, role=user.role)
    log_audit_event(db, "auth.login", "user", actor=user)
    db.commit()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_name": user.full_name,
        "email": user.email
    }


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
