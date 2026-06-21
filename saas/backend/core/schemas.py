import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr
from .models.user import UserRole
from .models.client import ClientType


# --- Auth ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- User ---

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.technician


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Tenant ---

class TenantCreate(BaseModel):
    slug: str
    name: str
    plan: str = "starter"
    business_type: str = "generic"
    branding: dict = {}
    enabled_modules: list[str] = []
    admin_email: EmailStr
    admin_password: str
    admin_full_name: str


class TenantOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    plan: str
    business_type: str
    branding: dict
    company: dict
    enabled_modules: list[str]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class IngestKeyOut(BaseModel):
    ingest_key: str


# --- Client ---

class ClientCreate(BaseModel):
    type: ClientType
    company_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    whatsapp: str | None = None
    address: dict = {}
    tax_number: str | None = None
    discount_rate: float = 0.0
    notes: str | None = None


class ClientUpdate(BaseModel):
    company_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    whatsapp: str | None = None
    address: dict | None = None
    tax_number: str | None = None
    discount_rate: float | None = None
    notes: str | None = None
    is_active: bool | None = None


class ClientOut(BaseModel):
    id: uuid.UUID
    type: ClientType
    company_name: str | None
    first_name: str | None
    last_name: str | None
    email: str
    phone: str | None
    whatsapp: str | None
    address: dict
    tax_number: str | None
    discount_rate: float
    notes: str | None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}
