import uuid
from datetime import datetime
from pydantic import BaseModel
from core.models.client import ClientType
from .models import MessageStatus


class SendRequest(BaseModel):
    # Soit un client connu, soit un numéro libre.
    client_id: uuid.UUID | None = None
    to_number: str | None = None
    body: str


class BroadcastRequest(BaseModel):
    # Diffusion ciblée : par segment client (None = tous les clients avec WhatsApp).
    client_type: ClientType | None = None
    body: str


class MessageOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID | None
    to_number: str
    body: str
    status: MessageStatus
    provider_message_id: str | None
    error: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class BroadcastResult(BaseModel):
    sent: int
    failed: int
    skipped_no_number: int
