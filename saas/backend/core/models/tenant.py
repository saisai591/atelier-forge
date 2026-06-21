import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from ..database import Base


def _gen_ingest_key() -> str:
    """Clé machine-à-machine utilisée par le serveur PXE pour pousser les audits."""
    return secrets.token_hex(24)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(32), default="starter")
    # Clé d'ingestion (header X-Forge-Key) pour le pont PXE -> stock.
    ingest_key: Mapped[str] = mapped_column(String(64), default=_gen_ingest_key, index=True)
    # Configs/secrets par module (whatsapp, transporteurs…). Neutre : clé = slug module.
    integrations: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Métier libre (atelier de reconditionnement, réparation, dépôt-vente…).
    # Le noyau ne fait AUCUNE hypothèse métier : tout vient des modules activés.
    business_type: Mapped[str] = mapped_column(String(64), default="generic")
    # Branding propre à chaque tenant (nom affiché, couleur, logo).
    branding: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Identité légale du vendeur, pour les factures (raison sociale, adresse,
    # SIRET, n° TVA, IBAN, conditions de paiement…). Champs libres.
    company: Mapped[dict] = mapped_column(JSONB, default=dict)
    enabled_modules: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="tenant", lazy="noload")
    clients: Mapped[list["Client"]] = relationship("Client", back_populates="tenant", lazy="noload")
