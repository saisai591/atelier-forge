import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..database import Base


class ClientType(str, PyEnum):
    particulier = "particulier"
    grossiste = "grossiste"
    semi_grossiste = "semi_grossiste"
    revendeur = "revendeur"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[ClientType] = mapped_column(Enum(ClientType))
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[dict] = mapped_column(JSONB, default=dict)
    tax_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discount_rate: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="clients")
