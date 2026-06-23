import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from .models import (
    AtelierDocumentType,
    AtelierPalletStatus,
    AtelierReceptionStatus,
    AtelierScanEventType,
    AtelierScanSessionStatus,
    AtelierShipmentStatus,
)


class AtelierReceptionCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=64)
    supplier_name: str = Field(min_length=1, max_length=255)
    source_filename: str | None = None
    source_format: str | None = None
    expected_items: int = 0
    scanned_items: int = 0
    pallet_count: int = 0
    location: str | None = None
    status: AtelierReceptionStatus = AtelierReceptionStatus.import_pending
    mapping_profile: dict = Field(default_factory=dict)
    notes: str | None = None


class AtelierReceptionUpdate(BaseModel):
    supplier_name: str | None = None
    source_filename: str | None = None
    source_format: str | None = None
    expected_items: int | None = None
    scanned_items: int | None = None
    pallet_count: int | None = None
    location: str | None = None
    status: AtelierReceptionStatus | None = None
    mapping_profile: dict | None = None
    notes: str | None = None


class AtelierReceptionOut(AtelierReceptionCreate):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AtelierPalletCreate(BaseModel):
    reception_id: uuid.UUID | None = None
    shipment_id: uuid.UUID | None = None
    reference: str = Field(min_length=1, max_length=64)
    label: str | None = None
    expected_items: int = 0
    scanned_items: int = 0
    location: str | None = None
    status: AtelierPalletStatus = AtelierPalletStatus.expected
    metadata_json: dict = Field(default_factory=dict)


class AtelierPalletUpdate(BaseModel):
    reception_id: uuid.UUID | None = None
    shipment_id: uuid.UUID | None = None
    label: str | None = None
    expected_items: int | None = None
    scanned_items: int | None = None
    location: str | None = None
    status: AtelierPalletStatus | None = None
    metadata_json: dict | None = None


class AtelierPalletOut(AtelierPalletCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AtelierClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: dict = Field(default_factory=dict)
    transport_preferences: dict = Field(default_factory=dict)
    notes: str | None = None


class AtelierClientUpdate(BaseModel):
    name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: dict | None = None
    transport_preferences: dict | None = None
    notes: str | None = None


class AtelierClientOut(AtelierClientCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AtelierShipmentCreate(BaseModel):
    client_id: uuid.UUID | None = None
    reference: str = Field(min_length=1, max_length=64)
    client_name: str = Field(min_length=1, max_length=255)
    carrier: str | None = None
    expected_items: int = 0
    pallet_count: int = 0
    status: AtelierShipmentStatus = AtelierShipmentStatus.draft
    document_state: dict = Field(default_factory=dict)
    notes: str | None = None


class AtelierShipmentUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    carrier: str | None = None
    expected_items: int | None = None
    pallet_count: int | None = None
    status: AtelierShipmentStatus | None = None
    document_state: dict | None = None
    notes: str | None = None
    shipped_at: datetime | None = None


class AtelierShipmentOut(AtelierShipmentCreate):
    id: uuid.UUID
    created_at: datetime
    shipped_at: datetime | None

    model_config = {"from_attributes": True}


class AtelierDocumentCreate(BaseModel):
    reception_id: uuid.UUID | None = None
    shipment_id: uuid.UUID | None = None
    document_type: AtelierDocumentType
    title: str = Field(min_length=1, max_length=255)
    file_path: str | None = None
    payload: dict = Field(default_factory=dict)


class AtelierDocumentOut(AtelierDocumentCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class AtelierOverview(BaseModel):
    receptions_open: int
    items_expected: int
    items_scanned: int
    pallets_active: int
    shipments_open: int
    documents_ready: int


class SupplierImportFieldGuess(BaseModel):
    source_column: str
    target_field: str
    confidence: int


class SupplierImportPreview(BaseModel):
    filename: str
    file_format: str
    detected_columns: list[str]
    row_count: int
    sample_rows: list[dict]
    field_guesses: list[SupplierImportFieldGuess]
    warnings: list[str] = Field(default_factory=list)


class SupplierImportCommit(BaseModel):
    reference: str = Field(min_length=1, max_length=64)
    supplier_name: str = Field(min_length=1, max_length=255)
    source_filename: str
    source_format: str
    expected_items: int
    pallet_count: int = 0
    location: str | None = None
    mapping_profile: dict = Field(default_factory=dict)
    notes: str | None = None


class AtelierScanSessionCreate(BaseModel):
    reception_id: uuid.UUID | None = None
    pallet_id: uuid.UUID | None = None
    operator_name: str | None = None
    device_name: str | None = None
    device_type: str | None = None


class AtelierScanSessionUpdate(BaseModel):
    status: AtelierScanSessionStatus | None = None
    operator_name: str | None = None
    device_name: str | None = None
    device_type: str | None = None


class AtelierScanSessionOut(AtelierScanSessionCreate):
    id: uuid.UUID
    status: AtelierScanSessionStatus
    scanned_count: int
    anomaly_count: int
    created_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}


class AtelierScanEventCreate(BaseModel):
    code: str = Field(min_length=1, max_length=255)
    event_type: AtelierScanEventType | None = None
    message: str | None = None
    matched_stock_item_id: uuid.UUID | None = None
    payload: dict = Field(default_factory=dict)


class AtelierScanEventOut(AtelierScanEventCreate):
    id: uuid.UUID
    session_id: uuid.UUID
    event_type: AtelierScanEventType
    created_at: datetime

    model_config = {"from_attributes": True}


class AtelierMachineLookupResult(BaseModel):
    code: str
    found: bool
    source: str
    stock_item_id: uuid.UUID | None = None
    audit_id: str | None = None
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    grade: str | None = None
    status: str | None = None
    summary: dict = Field(default_factory=dict)
