import uuid
from datetime import datetime, timezone, date
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, Date, ForeignKey, Enum, Float, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class InvoiceStatus(str, PyEnum):
    draft = "draft"        # brouillon (modifiable)
    issued = "issued"      # émise (numéro définitif, verrouillée)
    paid = "paid"          # payée
    cancelled = "cancelled"  # annulée (avoir)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    # Numéro séquentiel sans trou (obligation légale FR). NULL tant que brouillon.
    number: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    seq: Mapped[int | None] = mapped_column(Integer, nullable=True)  # rang annuel
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.draft)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["InvoiceLine"]] = relationship(
        "InvoiceLine", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin"
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True
    )
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price_ht: Mapped[float] = mapped_column(Float, default=0.0)
    vat_rate: Mapped[float] = mapped_column(Float, default=20.0)  # TVA % (FR standard = 20)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="lines")
