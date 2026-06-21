"""Module Commerce + Logistique : commandes (devis -> livrée), lignes liées au
stock, prix segmenté par client, expédition (transporteur + suivi).
"""
import uuid
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.dependencies import get_current_user
from core.models import User, Client
from ..registry import ModuleRegistry, ModuleManifest, NavItem
from ..stock.models import StockItem, StockItemStatus
from .models import Order, OrderLine, OrderStatus
from .schemas import OrderCreate, OrderUpdate, OrderOut, OrderLineOut, ShipRequest

router = APIRouter(prefix="/orders", tags=["commerce"])


def _serialize(order: Order) -> OrderOut:
    lines = [
        OrderLineOut(
            id=ln.id,
            stock_item_id=ln.stock_item_id,
            description=ln.description,
            quantity=ln.quantity,
            unit_price=ln.unit_price,
            line_total=round(ln.quantity * ln.unit_price, 2),
        )
        for ln in order.lines
    ]
    subtotal = round(sum(l.line_total for l in lines), 2)
    total = round(subtotal * (1 - order.discount_rate / 100), 2)
    return OrderOut(
        id=order.id,
        client_id=order.client_id,
        reference=order.reference,
        status=order.status,
        discount_rate=order.discount_rate,
        carrier=order.carrier,
        tracking_number=order.tracking_number,
        shipping_address=order.shipping_address,
        notes=order.notes,
        created_at=order.created_at,
        shipped_at=order.shipped_at,
        lines=lines,
        subtotal=subtotal,
        total=total,
    )


async def _get_order(order_id: uuid.UUID, user: User, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.tenant_id == user.tenant_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return order


@router.get("/", response_model=list[OrderOut])
async def list_orders(
    status: OrderStatus | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Order).where(Order.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(Order.status == status)
    if client_id:
        q = q.where(Order.client_id == client_id)
    result = await db.execute(q.order_by(Order.created_at.desc()))
    return [_serialize(o) for o in result.scalars().all()]


@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Vérifie le client et hérite de sa remise de segment.
    res = await db.execute(
        select(Client).where(Client.id == payload.client_id, Client.tenant_id == current_user.tenant_id)
    )
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    reference = f"CMD-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(2).upper()}"
    order = Order(
        tenant_id=current_user.tenant_id,
        client_id=client.id,
        reference=reference,
        discount_rate=client.discount_rate,
        shipping_address=payload.shipping_address,
        notes=payload.notes,
    )
    db.add(order)
    await db.flush()

    for ln in payload.lines:
        db.add(OrderLine(
            order_id=order.id,
            stock_item_id=ln.stock_item_id,
            description=ln.description,
            quantity=ln.quantity,
            unit_price=ln.unit_price,
        ))
    await db.flush()
    await db.refresh(order)
    return _serialize(order)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return _serialize(await _get_order(order_id, current_user, db))


@router.patch("/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order(order_id, current_user, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    await db.flush()
    await db.refresh(order)
    return _serialize(order)


@router.post("/{order_id}/ship", response_model=OrderOut)
async def ship_order(
    order_id: uuid.UUID,
    payload: ShipRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marque la commande expédiée et bascule les machines liées en 'vendu'."""
    order = await _get_order(order_id, current_user, db)
    if order.status in (OrderStatus.cancelled, OrderStatus.delivered):
        raise HTTPException(status_code=409, detail="Commande déjà clôturée")

    order.status = OrderStatus.shipped
    order.carrier = payload.carrier
    order.tracking_number = payload.tracking_number
    order.shipped_at = datetime.now(timezone.utc)

    # Les articles sérialisés liés passent en vendu.
    item_ids = [ln.stock_item_id for ln in order.lines if ln.stock_item_id]
    if item_ids:
        res = await db.execute(
            select(StockItem).where(
                StockItem.id.in_(item_ids),
                StockItem.tenant_id == current_user.tenant_id,
            )
        )
        for item in res.scalars().all():
            item.status = StockItemStatus.sold
            item.sold_at = order.shipped_at

    await db.flush()
    await db.refresh(order)
    return _serialize(order)


@router.delete("/{order_id}", status_code=204)
async def cancel_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order(order_id, current_user, db)
    order.status = OrderStatus.cancelled


ModuleRegistry.register(ModuleManifest(
    slug="commerce",
    name="Commerce & Logistique",
    version="1.0.0",
    description="Commandes, devis, prix segmentés et expédition (transporteur + suivi)",
    router=router,
    nav_items=[NavItem(label="Commandes", path="/orders", icon="ShoppingCart")],
    required_roles=["admin", "commercial", "logistics"],
))
