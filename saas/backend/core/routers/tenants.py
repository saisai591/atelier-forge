from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Tenant, User
from ..models.user import UserRole
from ..schemas import TenantCreate, TenantOut, IngestKeyOut
from ..security import hash_password
from ..dependencies import get_current_user, require_roles
from ..models.tenant import _gen_ingest_key

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/", response_model=TenantOut, status_code=201)
async def create_tenant(payload: TenantCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Tenant).where(Tenant.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug déjà utilisé")

    tenant = Tenant(
        slug=payload.slug,
        name=payload.name,
        plan=payload.plan,
        business_type=payload.business_type,
        branding=payload.branding,
        enabled_modules=payload.enabled_modules,
    )
    db.add(tenant)
    await db.flush()

    admin = User(
        tenant_id=tenant.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        hashed_password=hash_password(payload.admin_password),
        role=UserRole.admin,
    )
    db.add(admin)
    await db.flush()
    await db.refresh(tenant)
    return tenant


@router.get("/me", response_model=TenantOut)
async def get_my_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    return result.scalar_one()


@router.patch("/me/modules")
async def update_modules(
    modules: list[str],
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()
    tenant.enabled_modules = modules
    return {"enabled_modules": tenant.enabled_modules}


@router.get("/me/ingest-key", response_model=IngestKeyOut)
async def get_ingest_key(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Clé que le serveur PXE doit fournir (header X-Forge-Key) pour pousser des audits."""
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    return IngestKeyOut(ingest_key=result.scalar_one().ingest_key)


@router.post("/me/ingest-key/rotate", response_model=IngestKeyOut)
async def rotate_ingest_key(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Régénère la clé d'ingestion (révoque l'ancienne immédiatement)."""
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()
    tenant.ingest_key = _gen_ingest_key()
    return IngestKeyOut(ingest_key=tenant.ingest_key)


@router.patch("/me/company")
async def set_company(
    company: dict,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Identité légale du vendeur (raison sociale, adresse, SIRET, TVA, IBAN…)."""
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()
    tenant.company = {**(tenant.company or {}), **company}
    return {"company": tenant.company}


@router.get("/me/integrations")
async def list_integrations(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """État des intégrations SANS exposer les secrets (token masqué)."""
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()
    out = {}
    for slug, cfg in (tenant.integrations or {}).items():
        cfg = cfg or {}
        out[slug] = {
            "configured": True,
            "provider": cfg.get("provider"),
            # On expose la présence des champs sensibles, pas leur valeur.
            "has_token": bool(cfg.get("token")),
            "phone_id": cfg.get("phone_id"),
        }
    return out


@router.put("/me/integrations/{module_slug}")
async def set_integration(
    module_slug: str,
    config: dict,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Enregistre la config d'un module (ex: whatsapp -> token, phone_id)."""
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one()
    merged = dict(tenant.integrations or {})
    merged[module_slug] = config
    tenant.integrations = merged
    return {"module": module_slug, "configured": True}
