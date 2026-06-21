import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from ..database import get_db
from ..security import verify_password, create_access_token, create_refresh_token, decode_token
from ..models import User
from ..schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")

    access_token = create_access_token(str(user.id), {"role": user.role, "tenant": str(user.tenant_id)})
    refresh_token = create_refresh_token(str(user.id))

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 86400,
    )
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token manquant")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalide")
        user_id: str = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expiré")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    access_token = create_access_token(str(user.id), {"role": user.role, "tenant": str(user.tenant_id)})
    new_refresh = create_refresh_token(str(user.id))
    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 86400,
    )
    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"detail": "Déconnecté"}
