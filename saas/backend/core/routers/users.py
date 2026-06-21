import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOut
from ..security import hash_password
from ..dependencies import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=list[UserOut])
async def list_users(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id, User.is_active == True)
    )
    return result.scalars().all()


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email déjà utilisé")

    user = User(
        tenant_id=current_user.tenant_id,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de se désactiver soi-même")
    user.is_active = False
