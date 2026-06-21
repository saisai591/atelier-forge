import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.dependencies import get_current_user
from core.models import User
from ..registry import ModuleRegistry, ModuleManifest, NavItem
from .models import StockItem, StockItemStatus
from .schemas import StockItemCreate, StockItemUpdate, StockItemOut

router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("/", response_model=list[StockItemOut])
async def list_items(
    status: StockItemStatus | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockItem).where(StockItem.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(StockItem.status == status)
    result = await db.execute(q.order_by(StockItem.received_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=StockItemOut, status_code=201)
async def add_item(
    payload: StockItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = StockItem(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/{item_id}", response_model=StockItemOut)
async def get_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StockItem).where(StockItem.id == item_id, StockItem.tenant_id == current_user.tenant_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return item


@router.patch("/{item_id}", response_model=StockItemOut)
async def update_item(
    item_id: uuid.UUID,
    payload: StockItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StockItem).where(StockItem.id == item_id, StockItem.tenant_id == current_user.tenant_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Article introuvable")
    for f, v in payload.model_dump(exclude_none=True).items():
        setattr(item, f, v)
    return item


ModuleRegistry.register(ModuleManifest(
    slug="stock",
    name="Gestion du stock",
    version="1.0.0",
    description="Réception, inventaire et traçabilité des machines reconditionnées",
    router=router,
    nav_items=[
        NavItem(label="Stock", path="/stock", icon="Package"),
        NavItem(label="Réception", path="/stock/reception", icon="PackagePlus"),
    ],
    required_roles=["admin", "technician", "logistics"],
))
