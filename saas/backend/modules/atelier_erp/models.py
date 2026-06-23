import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class AtelierReceptionStatus(str, PyEnum):
    import_pending = "import_pending"
    receiving = "receiving"
    scanning = "scanning"
    quality_control = "quality_control"
    closed = "closed"


class AtelierPalletStatus(str, PyEnum):
    expected = "expected"
    in_progress = "in_progress"
    complete = "complete"
    blocked = "blocked"


class AtelierShipmentStatus(str, PyEnum):
    draft = "draft"
    picking = "picking"
    quality_control = "quality_control"
    ready_for_carrier = "ready_for_carrier"
    shipped = "shipped"


class AtelierDocumentType(str, PyEnum):
    supplier_manifest = "supplier_manifest"
    pallet_label = "pallet_label"
    delivery_note = "delivery_note"
    packing_list = "packing_list"
    quality_report = "quality_report"


class AtelierScanSessionStatus(str, PyEnum):
    open = "open"
    paused = "paused"
    closed = "closed"


class AtelierScanEventType(str, PyEnum):
    found = "found"
    unknown = "unknown"
    duplicate = "duplicate"
    wrong_batch = "wrong_batch"
    manual_note = "manual_note"


class AtelierReception(Base):
    __tablename__ = "atelier_receptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    reference: Mapped[str] = mapped_column(String(64), index=True)
    supplier_name: Mapped[str] = mapped_column(String(255), index=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_format: Mapped[str | None] = mapped_column(String(32), nullable=True)
    expected_items: Mapped[int] = mapped_column(Integer, default=0)
    scanned_items: Mapped[int] = mapped_column(Integer, default=0)
    pallet_count: Mapped[int] = mapped_column(Integer, default=0)
    location: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[AtelierReceptionStatus] = mapped_column(
        Enum(AtelierReceptionStatus), default=AtelierReceptionStatus.import_pending
    )
    mapping_profile: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AtelierPallet(Base):
    __tablename__ = "atelier_pallets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    reception_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_receptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_shipments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reference: Mapped[str] = mapped_column(String(64), index=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expected_items: Mapped[int] = mapped_column(Integer, default=0)
    scanned_items: Mapped[int] = mapped_column(Integer, default=0)
    location: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[AtelierPalletStatus] = mapped_column(Enum(AtelierPalletStatus), default=AtelierPalletStatus.expected)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class AtelierClient(Base):
    __tablename__ = "atelier_clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[dict] = mapped_column(JSONB, default=dict)
    transport_preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class AtelierShipment(Base):
    __tablename__ = "atelier_shipments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reference: Mapped[str] = mapped_column(String(64), index=True)
    client_name: Mapped[str] = mapped_column(String(255), index=True)
    carrier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expected_items: Mapped[int] = mapped_column(Integer, default=0)
    pallet_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[AtelierShipmentStatus] = mapped_column(
        Enum(AtelierShipmentStatus), default=AtelierShipmentStatus.draft
    )
    document_state: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AtelierDocument(Base):
    __tablename__ = "atelier_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    reception_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_receptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    shipment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_shipments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    document_type: Mapped[AtelierDocumentType] = mapped_column(Enum(AtelierDocumentType))
    title: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class AtelierScanSession(Base):
    __tablename__ = "atelier_scan_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    reception_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_receptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pallet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_pallets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    operator_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[AtelierScanSessionStatus] = mapped_column(
        Enum(AtelierScanSessionStatus), default=AtelierScanSessionStatus.open
    )
    scanned_count: Mapped[int] = mapped_column(Integer, default=0)
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AtelierScanEvent(Base):
    __tablename__ = "atelier_scan_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("atelier_scan_sessions.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[AtelierScanEventType] = mapped_column(Enum(AtelierScanEventType))
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    matched_stock_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
