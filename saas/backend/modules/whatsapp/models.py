import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class MessageStatus(str, PyEnum):
    sent = "sent"
    failed = "failed"


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    to_number: Mapped[str] = mapped_column(String(32))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[MessageStatus] = mapped_column(Enum(MessageStatus))
    provider_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
