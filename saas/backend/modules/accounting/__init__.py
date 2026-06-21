"""Module Comptabilité : facturation conforme (numérotation séquentielle,
HT/TVA/TTC), génération depuis commande, export FEC.
"""
import uuid
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from core.database import get_db
from core.dependencies import get_current_user, require_roles
from core.models import User, Client, Tenant
from ..registry import ModuleRegistry, ModuleManifest, NavItem
from ..commerce.models import Order, OrderLine
from .models import Invoice, InvoiceLine, InvoiceStatus
from .schemas import InvoiceCreate, InvoiceOut, InvoiceLineOut
from .fec import build_fec
from .pdf import build_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["accounting"])


def _line_amounts(ln: InvoiceLine) -> tuple[float, float, float]:
    ht = round(ln.quantity * ln.unit_price_ht, 2)
    vat = round(ht * ln.vat_rate / 100, 2)
    return ht, vat, round(ht + vat, 2)


def _serialize(inv: Invoice) -> InvoiceOut:
    out_lines, total_ht, total_vat = [], 0.0, 0.0
    for ln in inv.lines:
        ht, vat, ttc = _line_amounts(ln)
        total_ht += ht
        total_vat += vat
        out_lines.append(InvoiceLineOut(
            id=ln.id, description=ln.description, quantity=ln.quantity,
            unit_price_ht=ln.unit_price_ht, vat_rate=ln.vat_rate,
            line_ht=ht, line_vat=vat, line_ttc=ttc,
        ))
    total_ht = round(total_ht, 2)
    total_vat = round(total_vat, 2)
    return InvoiceOut(
        id=inv.id, client_id=inv.client_id, order_id=inv.order_id,
        number=inv.number, status=inv.status, issue_date=inv.issue_date,
        due_date=inv.due_date, notes=inv.notes, created_at=inv.created_at,
        paid_at=inv.paid_at, lines=out_lines,
        total_ht=total_ht, total_vat=total_vat, total_ttc=round(total_ht + total_vat, 2),
    )


async def _get_invoice(invoice_id: uuid.UUID, user: User, db: AsyncSession) -> Invoice:
    res = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == user.tenant_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Facture introuvable")
    return inv


@router.get("/", response_model=list[InvoiceOut])
async def list_invoices(
    status: InvoiceStatus | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Invoice).where(Invoice.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(Invoice.status == status)
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    res = await db.execute(q.order_by(Invoice.created_at.desc()))
    return [_serialize(i) for i in res.scalars().all()]


@router.post("/", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Client).where(Client.id == payload.client_id, Client.tenant_id == current_user.tenant_id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client introuvable")

    inv = Invoice(
        tenant_id=current_user.tenant_id, client_id=payload.client_id,
        due_date=payload.due_date, notes=payload.notes,
    )
    db.add(inv)
    await db.flush()
    for ln in payload.lines:
        db.add(InvoiceLine(
            invoice_id=inv.id, description=ln.description, quantity=ln.quantity,
            unit_price_ht=ln.unit_price_ht, vat_rate=ln.vat_rate,
        ))
    await db.flush()
    await db.refresh(inv)
    return _serialize(inv)


@router.post("/from-order/{order_id}", response_model=InvoiceOut, status_code=201)
async def invoice_from_order(
    order_id: uuid.UUID,
    vat_rate: float = Query(default=20.0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Génère une facture brouillon depuis une commande (applique sa remise)."""
    res = await db.execute(
        select(Order).where(Order.id == order_id, Order.tenant_id == current_user.tenant_id)
    )
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    inv = Invoice(
        tenant_id=current_user.tenant_id, client_id=order.client_id, order_id=order.id,
        notes=f"Facture de la commande {order.reference}",
    )
    db.add(inv)
    await db.flush()
    # Prix HT remisé ligne à ligne selon la remise de la commande.
    factor = 1 - order.discount_rate / 100
    for ln in order.lines:
        db.add(InvoiceLine(
            invoice_id=inv.id, description=ln.description, quantity=ln.quantity,
            unit_price_ht=round(ln.unit_price * factor, 2), vat_rate=vat_rate,
        ))
    await db.flush()
    await db.refresh(inv)
    return _serialize(inv)


@router.post("/{invoice_id}/issue", response_model=InvoiceOut)
async def issue_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "accountant")),
    db: AsyncSession = Depends(get_db),
):
    """Émet la facture : numéro séquentiel annuel SANS TROU, puis verrouillage."""
    inv = await _get_invoice(invoice_id, current_user, db)
    if inv.status != InvoiceStatus.draft:
        raise HTTPException(status_code=409, detail="Facture déjà émise")

    year = datetime.now(timezone.utc).year
    res = await db.execute(
        select(func.max(Invoice.seq)).where(
            Invoice.tenant_id == current_user.tenant_id,
            extract("year", Invoice.issue_date) == year,
        )
    )
    next_seq = (res.scalar() or 0) + 1
    inv.seq = next_seq
    inv.number = f"FAC-{year}-{next_seq:04d}"
    inv.issue_date = date.today()
    inv.status = InvoiceStatus.issued
    await db.flush()
    await db.refresh(inv)
    return _serialize(inv)


@router.post("/{invoice_id}/pay", response_model=InvoiceOut)
async def pay_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inv = await _get_invoice(invoice_id, current_user, db)
    if inv.status not in (InvoiceStatus.issued,):
        raise HTTPException(status_code=409, detail="Seule une facture émise peut être payée")
    inv.status = InvoiceStatus.paid
    inv.paid_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(inv)
    return _serialize(inv)


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return _serialize(await _get_invoice(invoice_id, current_user, db))


@router.get("/{invoice_id}/pdf")
async def invoice_pdf(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF de la facture (identité vendeur = config company du tenant)."""
    inv = await _get_invoice(invoice_id, current_user, db)
    ser = _serialize(inv)

    tres = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tres.scalar_one()
    cres = await db.execute(select(Client).where(Client.id == inv.client_id))
    client = cres.scalar_one_or_none()

    invoice_dict = {
        "number": ser.number,
        "issue_date": ser.issue_date.isoformat() if ser.issue_date else None,
        "due_date": ser.due_date.isoformat() if ser.due_date else None,
        "lines": [
            {
                "description": l.description, "quantity": l.quantity,
                "unit_price_ht": l.unit_price_ht, "vat_rate": l.vat_rate, "line_ht": l.line_ht,
            }
            for l in ser.lines
        ],
        "total_ht": ser.total_ht, "total_vat": ser.total_vat, "total_ttc": ser.total_ttc,
    }
    client_dict = {
        "company_name": client.company_name if client else None,
        "first_name": client.first_name if client else None,
        "last_name": client.last_name if client else None,
        "email": client.email if client else None,
        "tax_number": client.tax_number if client else None,
    }

    pdf_bytes = build_invoice_pdf(invoice_dict, tenant.company or {}, client_dict)
    fname = f"{(ser.number or 'facture').replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )


@router.get("/export/fec", response_class=PlainTextResponse)
async def export_fec(
    year: int = Query(..., description="Année comptable (AAAA)"),
    current_user: User = Depends(require_roles("admin", "accountant")),
    db: AsyncSession = Depends(get_db),
):
    """Export FEC des factures émises/payées de l'année (format légal FR)."""
    res = await db.execute(
        select(Invoice).where(
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.paid]),
            extract("year", Invoice.issue_date) == year,
        ).order_by(Invoice.seq)
    )
    invoices = res.scalars().all()

    # Pré-charge les clients pour les libellés auxiliaires.
    payload = []
    for inv in invoices:
        cres = await db.execute(select(Client).where(Client.id == inv.client_id))
        client = cres.scalar_one_or_none()
        cname = ""
        if client:
            cname = client.company_name or f"{client.first_name or ''} {client.last_name or ''}".strip()
        ser = _serialize(inv)
        payload.append({
            "number": inv.number,
            "issue_date": inv.issue_date,
            "client_code": str(inv.client_id)[:8],
            "client_name": cname or "Client",
            "total_ht": ser.total_ht,
            "total_vat": ser.total_vat,
            "total_ttc": ser.total_ttc,
        })

    content = build_fec(payload)
    filename = f"FEC-{current_user.tenant_id}-{year}.txt"
    return PlainTextResponse(
        content,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


ModuleRegistry.register(ModuleManifest(
    slug="accounting",
    name="Comptabilité",
    version="1.0.0",
    description="Facturation conforme (HT/TVA/TTC), numérotation séquentielle, export FEC",
    router=router,
    nav_items=[NavItem(label="Factures", path="/invoices", icon="FileText")],
    required_roles=["admin", "accountant"],
))
