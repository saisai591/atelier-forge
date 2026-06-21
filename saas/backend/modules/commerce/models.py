import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, ForeignKey, Enum, Float, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class OrderStatus(str, PyEnum):
    draft = "draft"            # devis
    confirmed = "confirmed"    # commande confirmée
    prepared = "prepared"      # préparée (colis prêt)
    shipped = "shipped"        # expédiée
    delivered = "delivered"    # livrée
    cancelled = "cancelled"    # annulée


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    reference: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.draft)
    # Remise globale appliquée (héritée du segment client à la création).
    discount_rate: Mapped[float] = mapped_column(Float, default=0.0)
    # Logistique / expédition.
    carrier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    shipping_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lines: Mapped[list["OrderLine"]] = relationship(
        "OrderLine", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    # Lien optionnel vers une machine sérialisée du stock (article unique).
    stock_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_items.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    order: Mapped["Order"] = relationship("Order", back_populates="lines")
