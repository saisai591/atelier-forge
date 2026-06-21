import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Client
from ..models.client import ClientType
from ..schemas import ClientCreate, ClientUpdate, ClientOut
from ..dependencies import get_current_user

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=list[ClientOut])
async def list_clients(
    type: ClientType | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Client).where(
        Client.tenant_id == current_user.tenant_id,
        Client.is_active == True,
    )
    if type:
        q = q.where(Client.type == type)
    result = await db.execute(q.order_by(Client.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ClientOut, status_code=201)
async def create_client(
    payload: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = Client(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(client)
    await db.flush()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.tenant_id == current_user.tenant_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client


@router.patch("/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.tenant_id == current_user.tenant_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    return client


@router.delete("/{client_id}", status_code=204)
async def delete_client(
    client_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.tenant_id == current_user.tenant_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    client.is_active = False
