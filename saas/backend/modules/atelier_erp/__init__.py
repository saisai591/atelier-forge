import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.models import User
from modules.registry import ModuleManifest, ModuleRegistry, NavItem

from .models import (
    AtelierClient,
    AtelierDocument,
    AtelierPallet,
    AtelierReception,
    AtelierReceptionStatus,
    AtelierShipment,
    AtelierShipmentStatus,
)
from .schemas import (
    AtelierClientCreate,
    AtelierClientOut,
    AtelierClientUpdate,
    AtelierDocumentCreate,
    AtelierDocumentOut,
    AtelierOverview,
    AtelierPalletCreate,
    AtelierPalletOut,
    AtelierPalletUpdate,
    AtelierReceptionCreate,
    AtelierReceptionOut,
    AtelierReceptionUpdate,
    AtelierShipmentCreate,
    AtelierShipmentOut,
    AtelierShipmentUpdate,
)

router = APIRouter(prefix="/atelier-erp", tags=["atelier_erp"])


async def _get_owned(db: AsyncSession, model, item_id: uuid.UUID, tenant_id: uuid.UUID):
    result = await db.execute(select(model).where(model.id == item_id, model.tenant_id == tenant_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Element introuvable")
    return item


@router.get("/overview", response_model=AtelierOverview)
async def overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id

    receptions_open = await db.scalar(
        select(func.count()).select_from(AtelierReception).where(
            AtelierReception.tenant_id == tenant_id,
            AtelierReception.status != AtelierReceptionStatus.closed,
        )
    )
    expected = await db.scalar(
        select(func.coalesce(func.sum(AtelierReception.expected_items), 0)).where(
            AtelierReception.tenant_id == tenant_id,
            AtelierReception.status != AtelierReceptionStatus.closed,
        )
    )
    scanned = await db.scalar(
        select(func.coalesce(func.sum(AtelierReception.scanned_items), 0)).where(
            AtelierReception.tenant_id == tenant_id,
            AtelierReception.status != AtelierReceptionStatus.closed,
        )
    )
    pallets_active = await db.scalar(
        select(func.count()).select_from(AtelierPallet).where(AtelierPallet.tenant_id == tenant_id)
    )
    shipments_open = await db.scalar(
        select(func.count()).select_from(AtelierShipment).where(
            AtelierShipment.tenant_id == tenant_id,
            AtelierShipment.status != AtelierShipmentStatus.shipped,
        )
    )
    documents_ready = await db.scalar(
        select(func.count()).select_from(AtelierDocument).where(AtelierDocument.tenant_id == tenant_id)
    )

    return AtelierOverview(
        receptions_open=receptions_open or 0,
        items_expected=expected or 0,
        items_scanned=scanned or 0,
        pallets_active=pallets_active or 0,
        shipments_open=shipments_open or 0,
        documents_ready=documents_ready or 0,
    )


@router.get("/receptions", response_model=list[AtelierReceptionOut])
async def list_receptions(
    status: AtelierReceptionStatus | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AtelierReception).where(AtelierReception.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(AtelierReception.status == status)
    result = await db.execute(q.order_by(AtelierReception.created_at.desc()))
    return result.scalars().all()


@router.post("/receptions", response_model=AtelierReceptionOut, status_code=201)
async def create_reception(
    payload: AtelierReceptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = AtelierReception(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/receptions/{reception_id}", response_model=AtelierReceptionOut)
async def update_reception(
    reception_id: uuid.UUID,
    payload: AtelierReceptionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned(db, AtelierReception, reception_id, current_user.tenant_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/pallets", response_model=list[AtelierPalletOut])
async def list_pallets(
    reception_id: uuid.UUID | None = Query(default=None),
    shipment_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AtelierPallet).where(AtelierPallet.tenant_id == current_user.tenant_id)
    if reception_id:
        q = q.where(AtelierPallet.reception_id == reception_id)
    if shipment_id:
        q = q.where(AtelierPallet.shipment_id == shipment_id)
    result = await db.execute(q.order_by(AtelierPallet.created_at.desc()))
    return result.scalars().all()


@router.post("/pallets", response_model=AtelierPalletOut, status_code=201)
async def create_pallet(
    payload: AtelierPalletCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = AtelierPallet(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/pallets/{pallet_id}", response_model=AtelierPalletOut)
async def update_pallet(
    pallet_id: uuid.UUID,
    payload: AtelierPalletUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned(db, AtelierPallet, pallet_id, current_user.tenant_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/clients", response_model=list[AtelierClientOut])
async def list_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AtelierClient)
        .where(AtelierClient.tenant_id == current_user.tenant_id)
        .order_by(AtelierClient.name.asc())
    )
    return result.scalars().all()


@router.post("/clients", response_model=AtelierClientOut, status_code=201)
async def create_client(
    payload: AtelierClientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = AtelierClient(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/clients/{client_id}", response_model=AtelierClientOut)
async def update_client(
    client_id: uuid.UUID,
    payload: AtelierClientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned(db, AtelierClient, client_id, current_user.tenant_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/shipments", response_model=list[AtelierShipmentOut])
async def list_shipments(
    status: AtelierShipmentStatus | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AtelierShipment).where(AtelierShipment.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(AtelierShipment.status == status)
    result = await db.execute(q.order_by(AtelierShipment.created_at.desc()))
    return result.scalars().all()


@router.post("/shipments", response_model=AtelierShipmentOut, status_code=201)
async def create_shipment(
    payload: AtelierShipmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = AtelierShipment(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/shipments/{shipment_id}", response_model=AtelierShipmentOut)
async def update_shipment(
    shipment_id: uuid.UUID,
    payload: AtelierShipmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_owned(db, AtelierShipment, shipment_id, current_user.tenant_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/documents", response_model=list[AtelierDocumentOut])
async def list_documents(
    reception_id: uuid.UUID | None = Query(default=None),
    shipment_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AtelierDocument).where(AtelierDocument.tenant_id == current_user.tenant_id)
    if reception_id:
        q = q.where(AtelierDocument.reception_id == reception_id)
    if shipment_id:
        q = q.where(AtelierDocument.shipment_id == shipment_id)
    result = await db.execute(q.order_by(AtelierDocument.created_at.desc()))
    return result.scalars().all()


@router.post("/documents", response_model=AtelierDocumentOut, status_code=201)
async def create_document(
    payload: AtelierDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = AtelierDocument(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


ModuleRegistry.register(
    ModuleManifest(
        slug="atelier_erp",
        name="Atelier ERP",
        version="0.1.0",
        description="Receptions fournisseur, palettes, clients, sorties, documents et terminaux atelier",
        router=router,
        nav_items=[
            NavItem(label="Atelier ERP", path="/erp", icon="Warehouse"),
            NavItem(label="Receptions", path="/erp/receptions", icon="FileSpreadsheet"),
            NavItem(label="Sorties client", path="/erp/shipments", icon="Truck"),
        ],
        required_roles=["admin", "technician", "logistics"],
    )
)
