"""Module Analytics : agrège les indicateurs de tous les modules pour le dashboard.

Lecture seule. Tolérant : si un module n'a pas de données, les compteurs valent 0.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.dependencies import get_current_user
from core.models import User, Client
from ..registry import ModuleRegistry, ModuleManifest
from ..stock.models import StockItem, StockItemStatus
from ..commerce.models import Order, OrderStatus
from ..accounting.models import Invoice, InvoiceStatus, InvoiceLine

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _count_by(db, column, tenant_id, model):
    res = await db.execute(
        select(column, func.count()).where(model.tenant_id == tenant_id).group_by(column)
    )
    return {str(k.value if hasattr(k, "value") else k): v for k, v in res.all()}


@router.get("/overview")
async def overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tid = current_user.tenant_id

    # --- Stock ---
    stock_by_status = await _count_by(db, StockItem.status, tid, StockItem)
    stock_by_grade = await _count_by(db, StockItem.grade, tid, StockItem)
    total_stock = sum(stock_by_status.values())

    # Valeur du stock disponible (non vendu / non rebut), au prix de vente.
    val_res = await db.execute(
        select(func.coalesce(func.sum(StockItem.sale_price), 0.0)).where(
            StockItem.tenant_id == tid,
            StockItem.status.notin_([StockItemStatus.sold, StockItemStatus.scrapped]),
        )
    )
    stock_value = round(val_res.scalar() or 0.0, 2)

    # Marge réalisée sur les machines vendues (vente - achat).
    margin_res = await db.execute(
        select(
            func.coalesce(func.sum(StockItem.sale_price), 0.0),
            func.coalesce(func.sum(StockItem.purchase_price), 0.0),
        ).where(StockItem.tenant_id == tid, StockItem.status == StockItemStatus.sold)
    )
    sold_sale, sold_purchase = margin_res.one()
    realized_margin = round((sold_sale or 0.0) - (sold_purchase or 0.0), 2)

    # --- Commerce ---
    orders_by_status = await _count_by(db, Order.status, tid, Order)

    # --- Comptabilité : CA facturé / payé / impayé (sur lignes HT) ---
    async def _invoiced(statuses):
        res = await db.execute(
            select(func.coalesce(func.sum(InvoiceLine.quantity * InvoiceLine.unit_price_ht), 0.0))
            .select_from(InvoiceLine)
            .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
            .where(Invoice.tenant_id == tid, Invoice.status.in_(statuses))
        )
        return round(res.scalar() or 0.0, 2)

    invoiced_ht = await _invoiced([InvoiceStatus.issued, InvoiceStatus.paid])
    paid_ht = await _invoiced([InvoiceStatus.paid])
    unpaid_ht = await _invoiced([InvoiceStatus.issued])

    # --- Clients ---
    clients_by_type = await _count_by(db, Client.type, tid, Client)
    total_clients = sum(clients_by_type.values())

    return {
        "stock": {
            "total": total_stock,
            "by_status": stock_by_status,
            "by_grade": {k: v for k, v in stock_by_grade.items() if k != "None"},
            "available_value": stock_value,
            "realized_margin": realized_margin,
        },
        "commerce": {
            "by_status": orders_by_status,
            "total": sum(orders_by_status.values()),
        },
        "accounting": {
            "invoiced_ht": invoiced_ht,
            "paid_ht": paid_ht,
            "unpaid_ht": unpaid_ht,
        },
        "clients": {
            "total": total_clients,
            "by_type": clients_by_type,
        },
    }


ModuleRegistry.register(ModuleManifest(
    slug="analytics",
    name="Tableau de bord analytique",
    version="1.0.0",
    description="Indicateurs agrégés : valeur de stock, CA, marges, alertes impayés",
    router=router,
    nav_items=[],  # alimente le Dashboard (page d'accueil)
    required_roles=["admin", "accountant", "commercial"],
))
