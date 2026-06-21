import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, ForeignKey, Enum, Float, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class StockItemStatus(str, PyEnum):
    received = "received"
    in_diagnosis = "in_diagnosis"
    in_refurbishment = "in_refurbishment"
    ready = "ready"
    sold = "sold"
    scrapped = "scrapped"


class StockItem(Base):
    __tablename__ = "stock_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(64), default="laptop")
    status: Mapped[StockItemStatus] = mapped_column(Enum(StockItemStatus), default=StockItemStatus.received)
    grade: Mapped[str | None] = mapped_column(String(8), nullable=True)
    purchase_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    sale_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    audit_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    erase_cert: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
