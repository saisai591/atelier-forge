import uuid
import csv
import io
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
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
    AtelierScanEvent,
    AtelierScanEventType,
    AtelierScanSession,
    AtelierScanSessionStatus,
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
    AtelierScanEventCreate,
    AtelierScanEventOut,
    AtelierScanSessionCreate,
    AtelierScanSessionOut,
    AtelierScanSessionUpdate,
    AtelierShipmentCreate,
    AtelierShipmentOut,
    AtelierShipmentUpdate,
    SupplierImportCommit,
    SupplierImportFieldGuess,
    SupplierImportPreview,
)
from .palette_pdf import build_pallet_label_pdf

router = APIRouter(prefix="/atelier-erp", tags=["atelier_erp"])

FIELD_SYNONYMS = {
    "serial_number": ["serial", "serialnumber", "sn", "s/n", "numero serie", "numero de serie", "service tag"],
    "brand": ["brand", "marque", "manufacturer", "constructeur", "vendor"],
    "model": ["model", "modele", "product", "product name", "designation", "description"],
    "asset_tag": ["asset", "asset tag", "inventaire", "reference", "ref", "code"],
    "grade": ["grade", "etat", "condition", "quality", "qualite"],
    "cpu": ["cpu", "processor", "processeur"],
    "ram": ["ram", "memory", "memoire"],
    "disk": ["disk", "ssd", "hdd", "storage", "stockage"],
    "battery": ["battery", "batterie", "usure", "health"],
}


def _normalize_header(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .replace(".", " ")
        .replace("  ", " ")
    )


def _guess_fields(columns: list[str]) -> list[SupplierImportFieldGuess]:
    guesses: list[SupplierImportFieldGuess] = []
    for column in columns:
        normalized = _normalize_header(column)
        best_field = "extra"
        best_score = 35
        for target, aliases in FIELD_SYNONYMS.items():
            for alias in aliases:
                if normalized == alias:
                    best_field = target
                    best_score = 98
                    break
                if alias in normalized or normalized in alias:
                    score = 82 if len(alias) > 2 else 65
                    if score > best_score:
                        best_field = target
                        best_score = score
            if best_score == 98:
                break
        guesses.append(
            SupplierImportFieldGuess(source_column=column, target_field=best_field, confidence=best_score)
        )
    return guesses


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _parse_csv(data: bytes) -> tuple[list[str], list[dict], int, list[str]]:
    text = _decode_text(data)
    warnings: list[str] = []
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
        warnings.append("Separateur CSV non detecte automatiquement, virgule utilisee par defaut.")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    columns = [column.strip() for column in (reader.fieldnames or []) if column and column.strip()]
    rows = []
    total = 0
    for row in reader:
        total += 1
        if len(rows) < 20:
            rows.append({key: (value or "").strip() for key, value in row.items() if key})
    return columns, rows, total, warnings


def _parse_xml(data: bytes) -> tuple[list[str], list[dict], int, list[str]]:
    warnings: list[str] = []
    root = ElementTree.fromstring(data)
    candidates = [node for node in root.iter() if len(list(node)) >= 2]
    rows: list[dict] = []
    for node in candidates:
        row = {}
        for child in list(node):
            text = (child.text or "").strip()
            if text:
                row[child.tag.split("}")[-1]] = text
        if row:
            rows.append(row)
        if len(rows) >= 20:
            break
    columns = sorted({key for row in rows for key in row.keys()})
    total = len([node for node in candidates if len(list(node)) >= 2])
    if not rows:
        warnings.append("Aucune ligne exploitable detectee dans le XML.")
    return columns, rows, total, warnings


def _read_xlsx_strings(zip_file: zipfile.ZipFile) -> list[str]:
    try:
        xml_data = zip_file.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ElementTree.fromstring(xml_data)
    strings = []
    for item in root.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
        parts = [node.text or "" for node in item.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
        strings.append("".join(parts))
    return strings


def _cell_value(cell, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
    if value_node is None or value_node.text is None:
        inline_node = cell.find(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
        return (inline_node.text or "").strip() if inline_node is not None else ""
    value = value_node.text
    if cell_type == "s":
        try:
            return shared_strings[int(value)].strip()
        except (ValueError, IndexError):
            return ""
    return value.strip()


def _parse_xlsx(data: bytes) -> tuple[list[str], list[dict], int, list[str]]:
    warnings: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zip_file:
        shared_strings = _read_xlsx_strings(zip_file)
        sheet_names = [name for name in zip_file.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
        if not sheet_names:
            return [], [], 0, ["Aucune feuille Excel detectee."]
        sheet_xml = zip_file.read(sorted(sheet_names)[0])
    root = ElementTree.fromstring(sheet_xml)
    rows_xml = root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row")
    matrix: list[list[str]] = []
    for row in rows_xml[:21]:
        values = [_cell_value(cell, shared_strings) for cell in row.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c")]
        if any(values):
            matrix.append(values)
    if not matrix:
        return [], [], 0, ["Feuille Excel vide."]
    columns = [value or f"Colonne {index + 1}" for index, value in enumerate(matrix[0])]
    rows = []
    for values in matrix[1:]:
        rows.append({columns[index]: values[index] if index < len(values) else "" for index in range(len(columns))})
    total = max(len(rows_xml) - 1, 0)
    if total > len(rows):
        warnings.append("Apercu limite aux 20 premieres lignes.")
    return columns, rows, total, warnings


def _parse_supplier_file(filename: str, data: bytes) -> SupplierImportPreview:
    lower_name = filename.lower()
    if lower_name.endswith(".csv") or lower_name.endswith(".txt"):
        file_format = "csv"
        columns, rows, total, warnings = _parse_csv(data)
    elif lower_name.endswith(".xml"):
        file_format = "xml"
        columns, rows, total, warnings = _parse_xml(data)
    elif lower_name.endswith(".xlsx"):
        file_format = "xlsx"
        columns, rows, total, warnings = _parse_xlsx(data)
    else:
        raise HTTPException(status_code=400, detail="Format non supporte. Utiliser CSV, XLSX ou XML.")

    if not columns:
        warnings.append("Aucune colonne detectee.")

    return SupplierImportPreview(
        filename=filename,
        file_format=file_format,
        detected_columns=columns,
        row_count=total,
        sample_rows=rows,
        field_guesses=_guess_fields(columns),
        warnings=warnings,
    )


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


@router.post("/supplier-import/preview", response_model=SupplierImportPreview)
async def preview_supplier_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    return _parse_supplier_file(file.filename or "supplier-file", data)


@router.post("/supplier-import/commit", response_model=AtelierReceptionOut, status_code=201)
async def commit_supplier_import(
    payload: SupplierImportCommit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reception = AtelierReception(
        tenant_id=current_user.tenant_id,
        reference=payload.reference,
        supplier_name=payload.supplier_name,
        source_filename=payload.source_filename,
        source_format=payload.source_format,
        expected_items=payload.expected_items,
        scanned_items=0,
        pallet_count=payload.pallet_count,
        location=payload.location,
        status=AtelierReceptionStatus.receiving,
        mapping_profile=payload.mapping_profile,
        notes=payload.notes,
    )
    db.add(reception)
    await db.flush()
    await db.refresh(reception)
    return reception


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


@router.get("/pallets/{pallet_id}/label.pdf")
async def download_pallet_label(
    pallet_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pallet = await _get_owned(db, AtelierPallet, pallet_id, current_user.tenant_id)
    shipment = None
    if pallet.shipment_id:
        shipment = await _get_owned(db, AtelierShipment, pallet.shipment_id, current_user.tenant_id)

    payload = {
        "client_name": shipment.client_name if shipment else "Stock atelier",
        "shipment_reference": shipment.reference if shipment else "Palette interne",
        "pallet_reference": pallet.reference,
        "status": pallet.status.value.upper(),
        "expected_items": pallet.expected_items,
        "carrier": shipment.carrier if shipment else "",
        "location": pallet.location or "",
        "document_state": "BL / colisage" if shipment else "Reception",
        "barcode_text": f"PALLET:{pallet.reference}",
    }
    pdf = build_pallet_label_pdf(payload)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="palette-{pallet.reference}.pdf"'},
    )


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


@router.get("/scan-sessions", response_model=list[AtelierScanSessionOut])
async def list_scan_sessions(
    status: AtelierScanSessionStatus | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AtelierScanSession).where(AtelierScanSession.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(AtelierScanSession.status == status)
    result = await db.execute(q.order_by(AtelierScanSession.created_at.desc()))
    return result.scalars().all()


@router.post("/scan-sessions", response_model=AtelierScanSessionOut, status_code=201)
async def create_scan_session(
    payload: AtelierScanSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = AtelierScanSession(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.patch("/scan-sessions/{session_id}", response_model=AtelierScanSessionOut)
async def update_scan_session(
    session_id: uuid.UUID,
    payload: AtelierScanSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned(db, AtelierScanSession, session_id, current_user.tenant_id)
    values = payload.model_dump(exclude_none=True)
    if values.get("status") == AtelierScanSessionStatus.closed and session.closed_at is None:
        session.closed_at = datetime.now(timezone.utc)
    for field, value in values.items():
        setattr(session, field, value)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("/scan-sessions/{session_id}/events", response_model=list[AtelierScanEventOut])
async def list_scan_events(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned(db, AtelierScanSession, session_id, current_user.tenant_id)
    result = await db.execute(
        select(AtelierScanEvent)
        .where(AtelierScanEvent.session_id == session_id, AtelierScanEvent.tenant_id == current_user.tenant_id)
        .order_by(AtelierScanEvent.created_at.desc())
    )
    return result.scalars().all()


@router.post("/scan-sessions/{session_id}/events", response_model=AtelierScanEventOut, status_code=201)
async def create_scan_event(
    session_id: uuid.UUID,
    payload: AtelierScanEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned(db, AtelierScanSession, session_id, current_user.tenant_id)
    duplicate_result = await db.execute(
        select(AtelierScanEvent.id).where(
            AtelierScanEvent.session_id == session_id,
            AtelierScanEvent.tenant_id == current_user.tenant_id,
            AtelierScanEvent.code == payload.code,
        )
    )
    event_type = payload.event_type or AtelierScanEventType.found
    if duplicate_result.first():
        event_type = AtelierScanEventType.duplicate

    event = AtelierScanEvent(
        tenant_id=current_user.tenant_id,
        session_id=session_id,
        code=payload.code,
        event_type=event_type,
        message=payload.message,
        matched_stock_item_id=payload.matched_stock_item_id,
        payload=payload.payload,
    )
    session.scanned_count += 1
    if event_type != AtelierScanEventType.found:
        session.anomaly_count += 1
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


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
