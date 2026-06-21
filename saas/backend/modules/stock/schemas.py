import uuid
from datetime import datetime
from pydantic import BaseModel
from .models import StockItemStatus


class StockItemCreate(BaseModel):
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    category: str = "laptop"
    status: StockItemStatus = StockItemStatus.received
    grade: str | None = None
    purchase_price: float | None = None
    sale_price: float | None = None
    audit_data: dict = {}
    erase_cert: dict = {}
    notes: str | None = None


class StockItemUpdate(BaseModel):
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    category: str | None = None
    status: StockItemStatus | None = None
    grade: str | None = None
    purchase_price: float | None = None
    sale_price: float | None = None
    audit_data: dict | None = None
    erase_cert: dict | None = None
    notes: str | None = None


class StockItemOut(BaseModel):
    id: uuid.UUID
    serial_number: str | None
    brand: str | None
    model: str | None
    category: str
    status: StockItemStatus
    grade: str | None
    purchase_price: float | None
    sale_price: float | None
    audit_data: dict
    erase_cert: dict
    notes: str | None
    received_at: datetime
    sold_at: datetime | None
    model_config = {"from_attributes": True}
