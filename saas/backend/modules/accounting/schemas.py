import uuid
from datetime import datetime, date
from pydantic import BaseModel
from .models import InvoiceStatus


class InvoiceLineCreate(BaseModel):
    description: str
    quantity: int = 1
    unit_price_ht: float = 0.0
    vat_rate: float = 20.0


class InvoiceLineOut(BaseModel):
    id: uuid.UUID
    description: str
    quantity: int
    unit_price_ht: float
    vat_rate: float
    line_ht: float
    line_vat: float
    line_ttc: float
    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    client_id: uuid.UUID
    lines: list[InvoiceLineCreate] = []
    due_date: date | None = None
    notes: str | None = None


class InvoiceOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    order_id: uuid.UUID | None
    number: str | None
    status: InvoiceStatus
    issue_date: date | None
    due_date: date | None
    notes: str | None
    created_at: datetime
    paid_at: datetime | None
    lines: list[InvoiceLineOut]
    total_ht: float
    total_vat: float
    total_ttc: float
    model_config = {"from_attributes": True}
