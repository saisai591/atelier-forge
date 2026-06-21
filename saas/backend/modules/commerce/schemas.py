import uuid
from datetime import datetime
from pydantic import BaseModel
from .models import OrderStatus


class OrderLineCreate(BaseModel):
    stock_item_id: uuid.UUID | None = None
    description: str
    quantity: int = 1
    unit_price: float = 0.0


class OrderLineOut(BaseModel):
    id: uuid.UUID
    stock_item_id: uuid.UUID | None
    description: str
    quantity: int
    unit_price: float
    line_total: float
    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    client_id: uuid.UUID
    lines: list[OrderLineCreate] = []
    shipping_address: str | None = None
    notes: str | None = None


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    shipping_address: str | None = None
    notes: str | None = None


class ShipRequest(BaseModel):
    carrier: str
    tracking_number: str


class OrderOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    reference: str
    status: OrderStatus
    discount_rate: float
    carrier: str | None
    tracking_number: str | None
    shipping_address: str | None
    notes: str | None
    created_at: datetime
    shipped_at: datetime | None
    lines: list[OrderLineOut]
    subtotal: float
    total: float
    model_config = {"from_attributes": True}
