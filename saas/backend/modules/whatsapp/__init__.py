"""Module WhatsApp : notifications (expédition, facture) et diffusion catalogue
par segment client, via WhatsApp Business Cloud API (ou console en dev).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.dependencies import get_current_user, require_roles
from core.models import User, Client, Tenant
from core.models.client import ClientType
from ..registry import ModuleRegistry, ModuleManifest, NavItem
from .models import WhatsAppMessage, MessageStatus
from .schemas import SendRequest, BroadcastRequest, MessageOut, BroadcastResult
from .provider import get_provider, SendResult

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


async def _tenant_config(tenant_id: uuid.UUID, db: AsyncSession) -> dict:
    res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = res.scalar_one()
    return (tenant.integrations or {}).get("whatsapp", {})


async def _record(
    db: AsyncSession, tenant_id: uuid.UUID, client_id: uuid.UUID | None,
    to: str, body: str, result: SendResult,
) -> WhatsAppMessage:
    msg = WhatsAppMessage(
        tenant_id=tenant_id, client_id=client_id, to_number=to, body=body,
        status=MessageStatus.sent if result.ok else MessageStatus.failed,
        provider_message_id=result.provider_message_id, error=result.error,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return msg


@router.post("/send", response_model=MessageOut, status_code=201)
async def send_message(
    payload: SendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Envoie un message à un client (par son numéro WhatsApp) ou à un numéro libre."""
    to = payload.to_number
    client_id = None
    if payload.client_id:
        res = await db.execute(
            select(Client).where(Client.id == payload.client_id, Client.tenant_id == current_user.tenant_id)
        )
        client = res.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        client_id = client.id
        to = to or client.whatsapp or client.phone
    if not to:
        raise HTTPException(status_code=400, detail="Aucun numéro de destination")

    provider = get_provider(await _tenant_config(current_user.tenant_id, db))
    result = await provider.send_text(to, payload.body)
    return await _record(db, current_user.tenant_id, client_id, to, payload.body, result)


@router.post("/broadcast", response_model=BroadcastResult)
async def broadcast(
    payload: BroadcastRequest,
    current_user: User = Depends(require_roles("admin", "commercial")),
    db: AsyncSession = Depends(get_db),
):
    """Diffusion catalogue/promo à un segment de clients (ceux ayant un WhatsApp)."""
    q = select(Client).where(Client.tenant_id == current_user.tenant_id, Client.is_active == True)
    if payload.client_type:
        q = q.where(Client.type == payload.client_type)
    clients = (await db.execute(q)).scalars().all()

    provider = get_provider(await _tenant_config(current_user.tenant_id, db))
    sent = failed = skipped = 0
    for client in clients:
        to = client.whatsapp or client.phone
        if not to:
            skipped += 1
            continue
        result = await provider.send_text(to, payload.body)
        await _record(db, current_user.tenant_id, client.id, to, payload.body, result)
        if result.ok:
            sent += 1
        else:
            failed += 1
    return BroadcastResult(sent=sent, failed=failed, skipped_no_number=skipped)


@router.get("/messages", response_model=list[MessageOut])
async def list_messages(
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.tenant_id == current_user.tenant_id)
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(limit)
    )
    return res.scalars().all()


ModuleRegistry.register(ModuleManifest(
    slug="whatsapp",
    name="WhatsApp",
    version="1.0.0",
    description="Notifications et diffusion catalogue par segment client (WhatsApp Business)",
    router=router,
    nav_items=[NavItem(label="WhatsApp", path="/whatsapp", icon="MessageCircle")],
    required_roles=["admin", "commercial"],
))
