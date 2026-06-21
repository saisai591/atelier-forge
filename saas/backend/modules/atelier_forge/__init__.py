"""Pont Atelier Forge : ingestion des audits matÃ©riels et certificats d'effacement
produits par le systÃ¨me PXE, vers le module stock.

Authentification machine-Ã -machine par clÃ© d'ingestion (header X-Forge-Key) :
le serveur PXE n'est pas un utilisateur connectÃ©.
"""
import os
import json
import re
import shutil
import socket
import subprocess
import threading
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from fastapi import APIRouter, Body, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.dependencies import get_current_user
from core.database import get_db
from core.models import Tenant, User
from ..registry import ModuleRegistry, ModuleManifest, NavItem
from ..stock.models import StockItem, StockItemStatus
from .schemas import (
    ForgeIngestRequest,
    ForgeIngestResponse,
    ForgePxeAsset,
    ForgePxeClient,
    ForgePxeConfig,
    ForgePxeConfigUpdate,
    ForgeNetworkResyncResponse,
    ForgeNetworkDiagnosticResponse,
    ForgeSystemReportResponse,
    ForgePxeServiceCheck,
    ForgePxeStatus,
    ForgePxeAuditSummary,
    ForgePxeAuditPruneRequest,
    ForgePxeAuditPruneResponse,
    ForgeDriverPack,
    ForgeDriverPackCreate,
    ForgeDeploymentProfile,
    ForgeDeploymentProfileCreate,
    ForgeDriverExtractResponse,
    ForgeMediaUploadResponse,
    ForgeDriverPrepareRequest,
    ForgeDriverPrepareResponse,
    ForgeMediaStatusResponse,
    ForgeServerMediaFile,
    ForgeServerMediaDeleteResponse,
    ForgeServerMediaListResponse,
    ForgeUnattendProfile,
    ForgeUnattendProfileCreate,
    ForgeWimImage,
    ForgeWimImageCreate,
    ForgeWimBuildRequest,
    ForgeWimBuildFromPathRequest,
    ForgeWimBuildResponse,
    ForgeWimBuildListResponse,
    ForgeWimBuildSummary,
    ForgeWimRecipe,
    ForgeWimRecipeCreate,
    ForgeRemoteActionRequest,
    ForgeRemoteActionResponse,
    ForgeAgentHeartbeatRequest,
    ForgeAgentHeartbeatResponse,
    ForgeApplianceBackup,
    ForgeApplianceBackupListResponse,
    ForgeApplianceBackupResponse,
    ForgeApplianceRestoreRequest,
    ForgeApplianceRestoreResponse,
    ForgeUsbKitListResponse,
    ForgeUsbKitCreateRequest,
    ForgeUsbKitResponse,
)
from .grading import normalize_audit, compute_grade

router = APIRouter(prefix="/forge", tags=["atelier_forge"])
agent_router = APIRouter(prefix="/agent", tags=["atelier_agent"])
LIVE_CLIENTS: dict[str, dict] = {}
AGENT_COMMANDS: dict[str, list[dict]] = {}
PXE_CONFIG_PATH = Path(os.getenv("FORGE_PXE_CONFIG_PATH", "/app/data/pxe-config.json"))
WIM_RECIPES_PATH = Path(os.getenv("FORGE_WIM_RECIPES_PATH", "/app/data/wim-recipes.json"))
WIM_IMAGES_PATH = Path(os.getenv("FORGE_WIM_IMAGES_PATH", "/app/data/wim-images.json"))
DRIVER_PACKS_PATH = Path(os.getenv("FORGE_DRIVER_PACKS_PATH", "/app/data/driver-packs.json"))
UNATTEND_PROFILES_PATH = Path(os.getenv("FORGE_UNATTEND_PROFILES_PATH", "/app/data/unattend-profiles.json"))
DEPLOYMENT_PROFILES_PATH = Path(os.getenv("FORGE_DEPLOYMENT_PROFILES_PATH", "/app/data/deployment-profiles.json"))
PXE_AUDIT_DIR = Path(os.getenv("FORGE_PXE_AUDIT_DIR", "/app/audit"))
DRIVER_STORE_DIR = Path(os.getenv("FORGE_DRIVER_STORE_DIR", "/app/data/drivers"))
DRIVER_SHARE_DIR = Path(os.getenv("FORGE_DRIVER_SHARE_DIR", ""))
DEPLOY_SHARE_DIR = Path(os.getenv("FORGE_DEPLOY_SHARE_DIR", "/app/deploy"))
HP_DRIVERPACK_MATRIX_URL = "https://ftp.hp.com/pub/caps-softpaq/cmit/HP_Driverpack_Matrix_x64.html"
BACKUP_DIR = DEPLOY_SHARE_DIR / "exports" / "aos-backups"
USB_KIT_DIR = DEPLOY_SHARE_DIR / "exports" / "aos-usb-kits"
LOCAL_VENTOY_SOURCE_DIR = Path(os.getenv("FORGE_LOCAL_VENTOY_SOURCE_DIR", "/app/assets/ventoy"))


async def _tenant_from_key(x_forge_key: str, db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.ingest_key == x_forge_key))
    tenant = result.scalar_one_or_none()
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=401, detail="Cle d'ingestion invalide")
    return tenant


def _pick(data: dict, *keys: str) -> str | None:
    for key in keys:
        value = data.get(key)
        if value not in (None, "", "?"):
            return str(value)
    return None


def _backup_summary(path: Path) -> ForgeApplianceBackup:
    info = path.stat()
    return ForgeApplianceBackup(
        filename=path.name,
        path=str(path),
        size=info.st_size,
        size_mb=round(info.st_size / (1024 ** 2), 2),
        created_at=datetime.fromtimestamp(info.st_mtime, tz=timezone.utc).isoformat(),
    )


def _zip_if_exists(archive: zipfile.ZipFile, source: Path, arcname: str, included: list[str]) -> None:
    if source.exists() and source.is_file():
        archive.write(source, arcname)
        included.append(arcname)


def _restore_zip_member(archive: zipfile.ZipFile, member: str, destination: Path, restored: list[str], skipped: list[str], dry_run: bool) -> None:
    if member not in archive.namelist():
        skipped.append(f"{member}: absent")
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    if dry_run:
        restored.append(f"{member} -> {destination}")
        return
    destination.write_bytes(archive.read(member))
    restored.append(f"{member} -> {destination}")


def _restore_audit_members(archive: zipfile.ZipFile, restored: list[str], skipped: list[str], dry_run: bool) -> None:
    audit_members = [name for name in archive.namelist() if name.startswith("audit/") and name.endswith(".json") and "/" not in name.removeprefix("audit/")]
    if not audit_members:
        skipped.append("audit/*.json: absent")
        return
    PXE_AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    for member in audit_members[:250]:
        target = PXE_AUDIT_DIR / Path(member).name
        if dry_run:
            restored.append(f"{member} -> {target}")
        else:
            target.write_bytes(archive.read(member))
            restored.append(f"{member} -> {target}")


def _default_pxe_config() -> ForgePxeConfig:
    server_ip = os.getenv("FORGE_PXE_SERVER_IP", "192.168.1.57")
    http_port = int(os.getenv("FORGE_PXE_HTTP_PORT", "1950"))
    return ForgePxeConfig(
        server_ip=server_ip,
        server_url=os.getenv("FORGE_PXE_SERVER_URL", f"http://{server_ip}:{http_port}"),
        smb_share=os.getenv("FORGE_PXE_SMB_SHARE", rf"\\{server_ip}\deploy"),
        mode=os.getenv("FORGE_PXE_DHCP_MODE", "proxy DHCP"),
        tftp_port=int(os.getenv("FORGE_PXE_TFTP_PORT", "69")),
        http_port=http_port,
        dhcp_proxy_port=int(os.getenv("FORGE_PXE_DHCP_PROXY_PORT", "4011")),
        winpe_ready=os.getenv("FORGE_WINPE_READY", "false").lower() in {"1", "true", "yes", "on"},
    )


def _read_pxe_config() -> ForgePxeConfig:
    if not PXE_CONFIG_PATH.exists():
        return _default_pxe_config()
    try:
        return ForgePxeConfig.model_validate(json.loads(PXE_CONFIG_PATH.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return _default_pxe_config()


def _write_pxe_config(config: ForgePxeConfig) -> None:
    PXE_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    PXE_CONFIG_PATH.write_text(config.model_dump_json(indent=2), encoding="utf-8")


def _detect_lan_ip() -> str:
    try:
        route = subprocess.check_output(["ip", "-4", "route", "get", "1.1.1.1"], text=True, timeout=3)
        match = re.search(r"\bsrc\s+(\d+\.\d+\.\d+\.\d+)", route)
        if match:
            return match.group(1)
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        addresses = subprocess.check_output(["hostname", "-I"], text=True, timeout=3).split()
        for address in addresses:
            if re.match(r"^\d+\.\d+\.\d+\.\d+$", address) and not address.startswith("127."):
                return address
    except (OSError, subprocess.SubprocessError):
        pass
    return _read_pxe_config().server_ip


def _restart_services(service_names: list[str]) -> list[str]:
    restarted: list[str] = []
    for service in service_names:
        try:
            subprocess.run(["systemctl", "restart", service], check=True, timeout=20)
            restarted.append(service)
        except (OSError, subprocess.SubprocessError):
            continue
    return restarted


def _read_wim_recipes() -> list[ForgeWimRecipe]:
    if not WIM_RECIPES_PATH.exists():
        return []
    try:
        data = json.loads(WIM_RECIPES_PATH.read_text(encoding="utf-8"))
        return [ForgeWimRecipe.model_validate(item) for item in data]
    except (OSError, ValueError):
        return []


def _write_wim_recipes(recipes: list[ForgeWimRecipe]) -> None:
    WIM_RECIPES_PATH.parent.mkdir(parents=True, exist_ok=True)
    WIM_RECIPES_PATH.write_text(
        json.dumps([recipe.model_dump(mode="json") for recipe in recipes], indent=2),
        encoding="utf-8",
    )


def _read_wim_images() -> list[ForgeWimImage]:
    if not WIM_IMAGES_PATH.exists():
        return []
    try:
        data = json.loads(WIM_IMAGES_PATH.read_text(encoding="utf-8"))
        return [ForgeWimImage.model_validate(item) for item in data]
    except (OSError, ValueError):
        return []


def _deploy_share_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None
    value = path_value.replace("/", "\\")
    marker = "\\deploy\\"
    if marker in value.lower():
        suffix = value.lower().split(marker, 1)[1]
        original_suffix = value.split("\\deploy\\", 1)[1] if "\\deploy\\" in value else suffix
        return DEPLOY_SHARE_DIR / Path(*[part for part in original_suffix.split("\\") if part])
    return None


def _with_wim_file_status(images: list[ForgeWimImage]) -> list[ForgeWimImage]:
    checked: list[ForgeWimImage] = []
    for image in images:
        local_path = _deploy_share_path(image.path)
        if local_path and not local_path.exists():
            checked.append(image.model_copy(update={"status": "missing"}))
        elif local_path and local_path.exists():
            checked.append(image.model_copy(update={"status": "ready"}))
        else:
            checked.append(image)
    return checked


def _write_wim_images(images: list[ForgeWimImage]) -> None:
    WIM_IMAGES_PATH.parent.mkdir(parents=True, exist_ok=True)
    WIM_IMAGES_PATH.write_text(
        json.dumps([image.model_dump(mode="json") for image in images], indent=2),
        encoding="utf-8",
    )


def _read_driver_packs() -> list[ForgeDriverPack]:
    if not DRIVER_PACKS_PATH.exists():
        return []
    try:
        data = json.loads(DRIVER_PACKS_PATH.read_text(encoding="utf-8"))
        return [ForgeDriverPack.model_validate(item) for item in data]
    except (OSError, ValueError):
        return []


def _write_driver_packs(packs: list[ForgeDriverPack]) -> None:
    DRIVER_PACKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DRIVER_PACKS_PATH.write_text(
        json.dumps([pack.model_dump(mode="json") for pack in packs], indent=2),
        encoding="utf-8",
    )


def _driver_pack_key(pack: ForgeDriverPack | ForgeDriverPackCreate) -> str:
    return "|".join([
        (pack.vendor or "").strip().lower(),
        (pack.model_family or "").strip().lower(),
        (pack.category or "").strip().lower(),
        (pack.path or "").strip().lower().replace("/", "\\"),
        (pack.architecture or "").strip().lower(),
        (pack.windows_version or "").strip().lower(),
    ])


def _dedupe_driver_packs(packs: list[ForgeDriverPack]) -> list[ForgeDriverPack]:
    seen: set[str] = set()
    deduped: list[ForgeDriverPack] = []
    for pack in packs:
        key = _driver_pack_key(pack)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(pack)
    return deduped


def _read_unattend_profiles() -> list[ForgeUnattendProfile]:
    if not UNATTEND_PROFILES_PATH.exists():
        return []
    try:
        data = json.loads(UNATTEND_PROFILES_PATH.read_text(encoding="utf-8"))
        return [ForgeUnattendProfile.model_validate(item) for item in data]
    except (OSError, ValueError):
        return []


def _write_unattend_profiles(profiles: list[ForgeUnattendProfile]) -> None:
    UNATTEND_PROFILES_PATH.parent.mkdir(parents=True, exist_ok=True)
    UNATTEND_PROFILES_PATH.write_text(
        json.dumps([profile.model_dump(mode="json") for profile in profiles], indent=2),
        encoding="utf-8",
    )


def _read_deployment_profiles() -> list[ForgeDeploymentProfile]:
    if not DEPLOYMENT_PROFILES_PATH.exists():
        return []
    try:
        data = json.loads(DEPLOYMENT_PROFILES_PATH.read_text(encoding="utf-8"))
        return [ForgeDeploymentProfile.model_validate(item) for item in data]
    except (OSError, ValueError):
        return []


def _write_deployment_profiles(profiles: list[ForgeDeploymentProfile]) -> None:
    DEPLOYMENT_PROFILES_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEPLOYMENT_PROFILES_PATH.write_text(
        json.dumps([profile.model_dump(mode="json") for profile in profiles], indent=2),
        encoding="utf-8",
    )


def _hydrate_deployment_profile(profile: ForgeDeploymentProfile) -> ForgeDeploymentProfile:
    images = {image.id: image for image in _read_wim_images()}
    unattends = {item.id: item for item in _read_unattend_profiles()}
    packs = {pack.id: pack for pack in _read_driver_packs()}
    image = images.get(profile.image_id)
    unattend = unattends.get(profile.unattend_profile_id or "")
    return profile.model_copy(update={
        "image_name": image.name if image else None,
        "unattend_name": unattend.name if unattend else None,
        "driver_pack_names": [packs[pack_id].name for pack_id in profile.driver_pack_ids if pack_id in packs],
    })


def _validate_deployment_profile_payload(payload: ForgeDeploymentProfileCreate) -> None:
    if payload.deployment_mode not in {"standard", "marketplace", "custom"}:
        raise HTTPException(status_code=400, detail="Mode deploiement invalide")
    if not any(image.id == payload.image_id for image in _read_wim_images()):
        raise HTTPException(status_code=400, detail="Image WIM introuvable")
    if payload.unattend_profile_id and not any(profile.id == payload.unattend_profile_id for profile in _read_unattend_profiles()):
        raise HTTPException(status_code=400, detail="Profil Unattend introuvable")
    pack_ids = {pack.id for pack in _read_driver_packs()}
    missing_packs = [pack_id for pack_id in payload.driver_pack_ids if pack_id not in pack_ids]
    if missing_packs:
        raise HTTPException(status_code=400, detail=f"Pack pilote introuvable: {', '.join(missing_packs)}")


def _audit_summary_from_label(path: Path) -> ForgePxeAuditSummary | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        stat = path.stat()
    except (OSError, ValueError):
        return None

    serial = data.get("serial_number") or (data.get("machine") or {}).get("serial_number")
    brand = data.get("brand") or (data.get("machine") or {}).get("brand")
    model = data.get("model") or (data.get("machine") or {}).get("model")
    identifier = str(serial or data.get("mac") or path.stem.replace(".label", ""))

    def optional_int(value):
        if value in (None, ""):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    return ForgePxeAuditSummary(
        id=identifier,
        filename=path.name,
        created_at=data.get("created_at"),
        updated_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        serial_number=serial,
        brand=brand,
        model=model,
        cpu=data.get("cpu"),
        ram=data.get("ram"),
        ram_mb=optional_int(data.get("ram_mb")),
        main_disk=data.get("main_disk"),
        battery_status=data.get("battery_status"),
        grade_proposed=data.get("grade_proposed"),
        ip=data.get("ip"),
        mac=data.get("mac"),
        usb_ports_detected=optional_int(data.get("usb_ports_detected")),
        disks=data.get("disks") or [],
        battery=data.get("battery") or [],
        label_lines=data.get("label_lines") or [],
        raw=data,
    )


def _merge_pxe_label(existing: dict, incoming: dict) -> dict:
    merged = dict(existing)
    for key, value in incoming.items():
        if value in (None, "", [], {}):
            continue
        if key == "workshop_tests" and isinstance(value, dict):
            previous = merged.get("workshop_tests")
            merged[key] = {**(previous if isinstance(previous, dict) else {}), **value}
            continue
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            nested = dict(merged[key])
            nested.update({nested_key: nested_value for nested_key, nested_value in value.items() if nested_value not in (None, "", [], {})})
            merged[key] = nested
            continue
        merged[key] = value
    return merged


def _read_pxe_audits(limit: int = 20) -> list[ForgePxeAuditSummary]:
    if not PXE_AUDIT_DIR.exists():
        return []
    audits: list[ForgePxeAuditSummary] = []
    paths = sorted(
        PXE_AUDIT_DIR.glob("*.label.json"),
        key=lambda path: path.stat().st_mtime if path.exists() else 0,
        reverse=True,
    )
    seen: set[str] = set()
    for path in paths:
        if path.name == "latest-label.json":
            continue
        summary = _audit_summary_from_label(path)
        if not summary or summary.id in seen:
            continue
        audits.append(summary)
        seen.add(summary.id)
        if len(audits) >= limit:
            break

    if not audits:
        latest = PXE_AUDIT_DIR / "latest-label.json"
        summary = _audit_summary_from_label(latest) if latest.exists() else None
        if summary:
            audits.append(summary)
    return audits


def _find_pxe_audit(audit_id: str) -> ForgePxeAuditSummary | None:
    needle = audit_id.strip()
    if not needle:
        return None
    return next((item for item in _read_pxe_audits(100) if item.id == needle or item.filename == needle), None)


def _delete_pxe_audit_files(audit: ForgePxeAuditSummary, dry_run: bool = False) -> list[str]:
    candidates = {PXE_AUDIT_DIR / audit.filename}
    if audit.filename.endswith(".label.json"):
        candidates.add(PXE_AUDIT_DIR / audit.filename.replace(".label.json", ".json"))
    if audit.serial_number:
        candidates.add(PXE_AUDIT_DIR / f"{audit.serial_number}.label.json")
        candidates.add(PXE_AUDIT_DIR / f"{audit.serial_number}.json")

    deleted: list[str] = []
    for path in candidates:
        try:
            resolved = path.resolve()
            if PXE_AUDIT_DIR.resolve() not in resolved.parents:
                continue
            if resolved.name in {"latest-label.json", "latest.json"}:
                continue
            if resolved.exists() and resolved.is_file():
                deleted.append(resolved.name)
                if not dry_run:
                    resolved.unlink()
        except OSError:
            continue
    return sorted(set(deleted))


def _xml_escape(value: str | None) -> str:
    return (value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _safe_path_part(value: str | None, fallback: str = "unknown") -> str:
    cleaned = "".join(char if char.isalnum() or char in {"-", "_", "."} else "-" for char in (value or "").strip())
    cleaned = "-".join(part for part in cleaned.split("-") if part)
    return cleaned[:80] or fallback


def _safe_filename(value: str | None, fallback: str = "upload.bin") -> str:
    name = Path(value or fallback).name
    cleaned = "".join(char if char.isalnum() or char in {"-", "_", ".", " "} else "-" for char in name).strip()
    cleaned = re.sub(r"\s+", "-", cleaned)
    return cleaned[:140] or fallback


def _find_wim_image(image_id: str) -> ForgeWimImage | None:
    return next((image for image in _with_wim_file_status(_read_wim_images()) if image.id == image_id), None)


def _read_wim_builds(limit: int = 50) -> list[ForgeWimBuildSummary]:
    root = DEPLOY_SHARE_DIR / "images" / "wim-builds"
    if not root.exists():
        return []
    config = _read_pxe_config()
    smb_base = config.smb_share.rstrip("\\/")
    builds: list[ForgeWimBuildSummary] = []
    for manifest_path in sorted(root.glob("*/manifest.json"), key=lambda path: path.stat().st_mtime if path.exists() else 0, reverse=True):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            folder = manifest_path.parent
            relative_folder = folder.relative_to(DEPLOY_SHARE_DIR)
            relative_smb = str(relative_folder).replace("/", "\\")
            smb_folder = rf"{smb_base}\{relative_smb}"
            source = manifest.get("source_image") if isinstance(manifest.get("source_image"), dict) else {}
            builds.append(ForgeWimBuildSummary(
                id=str(manifest.get("id") or folder.name),
                reference=str(manifest.get("reference") or folder.name),
                version=str(manifest.get("version") or "-"),
                source_name=str(source.get("name") or manifest.get("source_name") or "-"),
                server_path=str(folder),
                smb_path=smb_folder,
                output_smb_path=str(manifest.get("output_smb_path") or ""),
                status=str(manifest.get("status") or "queued"),
                progress=int(manifest.get("progress") or 0),
                log_path=str(manifest.get("log_path") or ""),
                manifest_path=str(manifest_path),
                script_path=str(folder / "create-wim.ps1"),
                created_at=str(manifest.get("created_at") or datetime.fromtimestamp(manifest_path.stat().st_mtime, tz=timezone.utc).isoformat()),
            ))
        except (OSError, ValueError):
            continue
        if len(builds) >= limit:
            break
    return builds


def _media_destination(filename: str, kind: str | None = None) -> tuple[str, Path]:
    suffix = Path(filename).suffix.lower()
    resolved = (kind or "").lower().strip()
    if not resolved:
        if suffix == ".iso":
            resolved = "iso"
        elif suffix in {".wim", ".esd"}:
            resolved = "image"
        else:
            raise HTTPException(status_code=400, detail="Format accepte: .iso, .wim ou .esd")
    if resolved not in {"iso", "image"}:
        raise HTTPException(status_code=400, detail="Type media invalide")
    if resolved == "iso" and suffix != ".iso":
        raise HTTPException(status_code=400, detail="Un media ISO doit finir par .iso")
    if resolved == "image" and suffix not in {".wim", ".esd"}:
        raise HTTPException(status_code=400, detail="Une image Windows doit finir par .wim ou .esd")
    folder = "iso" if resolved == "iso" else "images"
    return resolved, DEPLOY_SHARE_DIR / folder / filename


def _list_server_media_files(config: ForgePxeConfig) -> list[ForgeServerMediaFile]:
    smb_base = config.smb_share.rstrip("\\/")
    folders = {
        "iso": ("iso", {".iso"}),
        "images": ("image", {".wim", ".esd"}),
        "incoming": ("incoming", {".iso", ".wim", ".esd"}),
    }
    files: list[ForgeServerMediaFile] = []
    for folder, (kind, suffixes) in folders.items():
        root = DEPLOY_SHARE_DIR / folder
        if not root.exists():
            continue
        for path in sorted(root.iterdir(), key=lambda item: item.stat().st_mtime if item.exists() else 0, reverse=True):
            if not path.is_file() or path.name.endswith(".upload") or path.suffix.lower() not in suffixes:
                continue
            info = path.stat()
            files.append(
                ForgeServerMediaFile(
                    filename=path.name,
                    kind=kind,
                    folder=folder,
                    server_path=str(path),
                    smb_path=rf"{smb_base}\{folder}\{path.name}",
                    size=info.st_size,
                    size_gb=round(info.st_size / (1024 ** 3), 2),
                    modified_at=datetime.fromtimestamp(info.st_mtime, tz=timezone.utc).isoformat(),
                )
            )
    return files


def _manifest_update(manifest_path: Path, data: dict) -> None:
    current = {}
    if manifest_path.exists():
        try:
            current = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            current = {}
    current.update(data)
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")


def _append_to_log(log_path: Path, message: str) -> None:
    timestamp = datetime.now(timezone.utc).isoformat()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _safelist_to_smb_path(share_root: str, relative_path: str) -> str:
    smb_base = share_root.rstrip("\\/")
    if relative_path.startswith("\\"):
        relative_path = relative_path[1:]
    return rf"{smb_base}\{relative_path.replace('/', '\\')}"


def _register_built_wim_if_ready(
    build_id: str,
    output_wim: Path,
    source_image: ForgeWimImage,
) -> ForgeWimImage | None:
    if not output_wim.exists():
        return None
    images = _read_wim_images()
    config = _read_pxe_config()
    smb_relative = str(output_wim.relative_to(DEPLOY_SHARE_DIR)).replace("/", "\\")
    smb_path = _safelist_to_smb_path(config.smb_share, smb_relative)
    version = source_image.version
    size_gb = round(output_wim.stat().st_size / (1024 ** 3), 2)
    duplicate = next((image for image in images if image.path.lower() == smb_path.lower()), None)
    if duplicate:
        duplicate = duplicate.model_copy(update={"status": "ready", "notes": (duplicate.notes or "") + f" | build {build_id} termine"})
        _write_wim_images([duplicate if image.id == duplicate.id else image for image in images])
        return duplicate

    image = ForgeWimImage(
        name=source_image.name,
        version=version,
        architecture=source_image.architecture,
        path=smb_path,
        size_gb=size_gb,
        source="build",
        notes=f"Genere automatiquement par {build_id} depuis {Path(source_image.path).name if source_image.path else source_image.name}",
        id=build_id.replace("wim-build-", "img-"),
        status="ready",
        is_default=not any(item.is_default for item in images),
        created_at=datetime.now(timezone.utc),
    )
    _write_wim_images([image, *images])
    return image


def _run_wim_build_job(
    build_id: str,
    folder: Path,
    source_image: ForgeWimImage,
    output_wim_path: Path,
    source_path: str,
) -> None:
    manifest_path = folder / "manifest.json"
    log_path = folder / "build.log"
    _append_to_log(log_path, "Demarrage de la procedure WIM.")
    _manifest_update(manifest_path, {
        "status": "running",
        "progress": 5,
        "message": "Lancement de la generation.",
        "log_path": str(log_path),
    })

    try:
        source_local = _deploy_share_path(source_image.path) or Path(source_path)
        source_kind = source_local.suffix.lower()
        if source_kind not in {".wim", ".esd"}:
            _append_to_log(log_path, f"Source non prise en charge directement: {source_kind}. Script seulement.")
            script = folder / "create-wim.ps1"
            if not script.exists():
                script.write_text(
                    "\n".join([
                        "$ErrorActionPreference = 'Stop'",
                        "$WorkDir = Join-Path $env:TEMP 'aos-wim-build'",
                        "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
                        "Write-Host 'AOS Deploy - conversion WIM manuelle'"
                    ]),
                    encoding="utf-8",
                )
            _manifest_update(manifest_path, {"status": "failed", "progress": 30, "message": "Source ISO: generer puis executer create-wim.ps1 sur Windows."})
            return

        source_size = source_local.stat().st_size if source_local.exists() else 0
        if not source_size:
            raise FileNotFoundError(f"Source introuvable: {source_local}")
        output_wim_path.parent.mkdir(parents=True, exist_ok=True)
        _append_to_log(log_path, f"Copie source vers {output_wim_path.name}")
        _manifest_update(manifest_path, {"status": "running", "progress": 30})
        shutil.copy2(source_local, output_wim_path)
        _append_to_log(log_path, "Copie terminee.")
        _manifest_update(manifest_path, {"status": "completed", "progress": 90, "message": "Copie reussie. Image enregistre."})
        time.sleep(0.2)
        _manifest_update(manifest_path, {"status": "completed", "progress": 100})
        created = _register_built_wim_if_ready(build_id, output_wim_path, source_image)
        if created:
            _manifest_update(manifest_path, {"auto_registered_image_id": created.id})
        return
    except Exception as error:
        error_msg = str(error)
        _append_to_log(log_path, f"Erreur: {error_msg}")
        _manifest_update(manifest_path, {"status": "failed", "message": error_msg})


def _start_wim_build_job(
    build_id: str,
    folder: Path,
    source_image: ForgeWimImage,
    output_wim_name: str,
    source_path: str,
) -> tuple[Path, Path]:
    output_dir = folder / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_wim = output_dir / output_wim_name
    script_path = folder / "create-wim.ps1"
    manifest_path = folder / "manifest.json"
    log_path = folder / "build.log"

    script_payload = "\n".join([
        "$ErrorActionPreference = 'Stop'",
        f"$SourceImage = '{source_path}'",
        f"$OutputImage = '{output_wim}'",
        "$WorkDir = Join-Path $env:TEMP 'aos-wim-build'",
        "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
        "Write-Host 'AOS Deploy - creation WIM'",
        "if (-Not (Test-Path $SourceImage)) { throw \"Source introuvable: $SourceImage\" }",
        "if (-Not (Test-Path (Split-Path -Parent $OutputImage))) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputImage) | Out-Null }",
        "Copy-Item -Path $SourceImage -Destination $OutputImage -Force",
        "Write-Host ('Output: ' + $OutputImage)",
    ])
    script_path.write_text(script_payload, encoding="utf-8")

    _manifest_update(
        manifest_path,
        {
            "status": "queued",
            "progress": 0,
            "output_local_path": str(output_wim),
            "output_wim": output_wim.name,
            "log_path": str(log_path),
            "message": "Procedure WIM en attente.",
            "script_path": str(script_path),
            "source_path": source_path,
        },
    )
    threading.Thread(
        target=_run_wim_build_job,
        args=(build_id, folder, source_image, output_wim, source_path),
        daemon=True,
    ).start()
    return output_wim, script_path


def _build_request_payload(
    image: ForgeWimImage,
    output_name: str,
    source_path: str,
    payload: ForgeWimBuildRequest,
    reference: str,
    version: str,
) -> ForgeWimBuildResponse:
    config = _read_pxe_config()
    smb_base = config.smb_share.rstrip("\\/")
    folder_name = f"{reference}-{version}"
    folder = DEPLOY_SHARE_DIR / "images" / "wim-builds" / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    output_wim = folder / "output" / output_name
    output_smb_path = rf"{smb_base}\images\wim-builds\{folder_name}\{output_name}"
    manifest_path = folder / "manifest.json"
    script_path = folder / "create-wim.ps1"
    build_id = datetime.now(timezone.utc).strftime("wim-build-%Y%m%d%H%M%S")
    manifest = {
        "id": build_id,
        "reference": reference,
        "version": version,
        "source_image": image.model_dump(mode="json"),
        "source_path": source_path,
        "output_wim": output_name,
        "output_smb_path": output_smb_path,
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    _start_wim_build_job(
        build_id=build_id,
        folder=folder,
        source_image=image,
        output_wim_name=output_name,
        source_path=source_path,
    )
    return ForgeWimBuildResponse(
        id=manifest["id"],
        reference=reference,
        version=version,
        source_image=image,
        source_path=source_path,
        server_path=str(folder),
        smb_path=rf"{smb_base}\images\wim-builds\{folder_name}",
        output_wim=output_name,
        output_smb_path=output_smb_path,
        manifest_path=str(manifest_path),
        script_path=str(script_path),
        status="queued",
        progress=0,
        log_path=str(folder / "build.log"),
        message="Procedure WIM lancee en tache de fond.",
    )

def _plain_text_from_html(value: str) -> str:
    text = re.sub(r"<script\b.*?</script>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_lookup(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _download_file(url: str, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = destination.with_suffix(destination.suffix + ".download")
    request = Request(url, headers={"User-Agent": "AOS-Deploy/5 driver-sync"})
    total = 0
    with urlopen(request, timeout=90) as response, tmp_path.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            handle.write(chunk)
    tmp_path.replace(destination)
    return total


def _find_hp_driverpack(model: str) -> dict | None:
    model_key = _normalize_lookup(model)
    if not model_key:
        return None

    request = Request(HP_DRIVERPACK_MATRIX_URL, headers={"User-Agent": "AOS-Deploy/5 driver-sync"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="ignore")

    rows = re.findall(r"<tr\b.*?</tr>", html, flags=re.IGNORECASE | re.DOTALL)
    for row in rows:
        row_text = _plain_text_from_html(row)
        if model_key not in _normalize_lookup(row_text):
            continue
        links = re.findall(r'href=["\']([^"\']*sp\d+\.exe)["\']', row, flags=re.IGNORECASE)
        if not links:
            continue
        url = links[0]
        if url.startswith("/"):
            url = f"https://ftp.hp.com{url}"
        elif url.startswith(".."):
            url = f"https://ftp.hp.com/pub/caps-softpaq/cmit/{url}"
        elif not url.startswith("http"):
            url = f"https://ftp.hp.com/pub/caps-softpaq/cmit/{url}"
        filename = url.rstrip("/").split("/")[-1]
        return {
            "vendor": "HP",
            "model_row": row_text[:240],
            "url": url,
            "filename": filename,
            "source": HP_DRIVERPACK_MATRIX_URL,
        }
    return None


def _sync_driver_share(local_dir: Path, vendor_part: str, model_part: str, windows_part: str, arch: str) -> Path | None:
    if not str(DRIVER_SHARE_DIR):
        return None
    target_dir = DRIVER_SHARE_DIR / vendor_part / model_part / windows_part / arch
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(local_dir, target_dir, dirs_exist_ok=True)
    return target_dir


def _driver_local_dir(pack: ForgeDriverPack) -> Path:
    return DRIVER_STORE_DIR / _safe_path_part(pack.vendor) / _safe_path_part(pack.model_family) / pack.windows_version.replace(" ", "-") / pack.architecture


def _extract_driver_pack_files(pack: ForgeDriverPack) -> dict:
    local_dir = _driver_local_dir(pack)
    softpaq_dir = local_dir / "SoftPaqs"
    executables = sorted(softpaq_dir.glob("*.exe"), key=lambda path: path.stat().st_size if path.exists() else 0, reverse=True)
    if not executables:
        raise HTTPException(status_code=404, detail="Aucun SoftPaq .exe trouve pour ce pack")

    extractor = shutil.which("7z") or shutil.which("7zz")
    if not extractor:
        raise HTTPException(status_code=500, detail="Outil 7z absent du backend")

    extracted_dir = local_dir / "Extracted"
    extracted_dir.mkdir(parents=True, exist_ok=True)
    command = [extractor, "x", str(executables[0]), f"-o{extracted_dir}", "-y"]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=900)
    if completed.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Extraction impossible: {(completed.stderr or completed.stdout)[-600:]}",
        )

    inf_count = sum(1 for _ in extracted_dir.rglob("*.inf"))
    status = "extracted" if inf_count else "downloaded"
    manifest_path = local_dir / "driverpack-manifest.json"
    manifest = {}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except ValueError:
            manifest = {}
    manifest.update({
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extracted_path": str(extracted_dir),
        "inf_count": inf_count,
        "extract_source": str(executables[0]),
    })
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    _sync_driver_share(local_dir, _safe_path_part(pack.vendor), _safe_path_part(pack.model_family), pack.windows_version.replace(" ", "-"), pack.architecture)
    return {"path": extracted_dir, "inf_count": inf_count, "status": status}


def _download_manufacturer_drivers(
    audit: ForgePxeAuditSummary,
    local_dir: Path,
    vendor_part: str,
    model_part: str,
    windows_part: str,
    arch: str,
) -> dict:
    brand = (audit.brand or "").lower()
    if "hp" not in brand and "hewlett" not in brand:
        return {
            "status": "prepared",
            "message": "Pack prepare. Telechargement automatique non disponible pour cette marque.",
            "notes": f"Depot local: {local_dir}",
        }

    driverpack = _find_hp_driverpack(audit.model or "")
    if not driverpack:
        return {
            "status": "prepared",
            "message": "Pack prepare. Aucun pack HP officiel trouve automatiquement pour ce modele.",
            "notes": f"Recherche HP sans resultat pour {audit.model}. Depot local: {local_dir}",
        }

    softpaq_dir = local_dir / "SoftPaqs"
    softpaq_path = softpaq_dir / driverpack["filename"]
    if not softpaq_path.exists() or softpaq_path.stat().st_size == 0:
        _download_file(driverpack["url"], softpaq_path)

    manifest = {
        "vendor": "HP",
        "model": audit.model,
        "serial_number": audit.serial_number,
        "windows_version": windows_part.replace("-", " "),
        "architecture": arch,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "source": driverpack["source"],
        "softpaq_url": driverpack["url"],
        "softpaq_file": str(softpaq_path),
        "softpaq_size": softpaq_path.stat().st_size,
        "model_match": driverpack["model_row"],
    }
    (local_dir / "driverpack-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (local_dir / "README.txt").write_text(
        "\n".join([
            "AOS Deploy driver pack",
            f"Machine: {audit.brand} {audit.model}",
            f"Serial source: {audit.serial_number or '-'}",
            f"Audit source: {audit.filename}",
            f"Constructeur: HP Driver Pack Matrix",
            f"SoftPaq: {driverpack['filename']}",
            "Extraire le SoftPaq pour obtenir les .inf avant injection Windows si necessaire.",
        ]) + "\n",
        encoding="utf-8",
    )
    share_target = _sync_driver_share(local_dir, vendor_part, model_part, windows_part, arch)
    notes = f"HP SoftPaq {driverpack['filename']} telecharge. Depot local: {local_dir}"
    if share_target:
        notes += f" | Depot partage: {share_target}"
    return {
        "status": "downloaded",
        "message": f"Pack HP telecharge automatiquement: {driverpack['filename']}.",
        "notes": notes,
    }


def _matching_driver_pack(audit: ForgePxeAuditSummary, packs: list[ForgeDriverPack]) -> ForgeDriverPack | None:
    brand = (audit.brand or "").strip().lower()
    model = (audit.model or "").strip().lower()
    for pack in packs:
        if pack.source_audit_id == audit.id:
            return pack
        if brand and model and pack.vendor.strip().lower() == brand and pack.model_family.strip().lower() == model:
            return pack
    return None


def _generate_unattend_xml(profile: ForgeUnattendProfile) -> str:
    product_key = ""
    if profile.product_key:
        product_key = f"""
                <ProductKey>
                    <Key>{_xml_escape(profile.product_key)}</Key>
                    <WillShowUI>OnError</WillShowUI>
                </ProductKey>"""
    auto_logon = ""
    if profile.auto_logon:
        auto_logon = f"""
            <AutoLogon>
                <Password>
                    <Value>{_xml_escape(profile.admin_password)}</Value>
                    <PlainText>true</PlainText>
                </Password>
                <Username>{_xml_escape(profile.admin_username)}</Username>
                <Enabled>true</Enabled>
                <LogonCount>1</LogonCount>
            </AutoLogon>"""
    first_logon = ""
    if profile.run_first_logon_command:
        first_logon = f"""
            <FirstLogonCommands>
                <SynchronousCommand wcm:action="add">
                    <Order>1</Order>
                    <Description>AOS Deploy first logon command</Description>
                    <CommandLine>{_xml_escape(profile.run_first_logon_command)}</CommandLine>
                </SynchronousCommand>
            </FirstLogonCommands>"""
    user_accounts = ""
    if profile.create_local_account:
        user_accounts = f"""
            <UserAccounts>
                <LocalAccounts>
                    <LocalAccount wcm:action="add">
                        <Password>
                            <Value>{_xml_escape(profile.admin_password)}</Value>
                            <PlainText>true</PlainText>
                        </Password>
                        <Name>{_xml_escape(profile.admin_username)}</Name>
                        <Group>Administrators</Group>
                    </LocalAccount>
                </LocalAccounts>
            </UserAccounts>"""
    rdp_command = ""
    if profile.enable_rdp:
        rdp_command = """
                <SynchronousCommand wcm:action="add">
                    <Order>10</Order>
                    <Description>Enable RDP</Description>
                    <CommandLine>cmd /c reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f</CommandLine>
                </SynchronousCommand>"""
    hide_oobe = "true" if profile.skip_oobe else "false"
    return f'''<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
    <settings pass="windowsPE">
        <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <SetupUILanguage>
                <UILanguage>{_xml_escape(profile.locale)}</UILanguage>
            </SetupUILanguage>
            <InputLocale>{_xml_escape(profile.keyboard)}</InputLocale>
            <SystemLocale>{_xml_escape(profile.locale)}</SystemLocale>
            <UILanguage>{_xml_escape(profile.locale)}</UILanguage>
            <UserLocale>{_xml_escape(profile.locale)}</UserLocale>
        </component>
        <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <UserData>
                <AcceptEula>{"true" if profile.accept_eula else "false"}</AcceptEula>
                <FullName>{_xml_escape(profile.admin_username)}</FullName>
                <Organization>{_xml_escape(profile.organization)}</Organization>{product_key}
            </UserData>
        </component>
    </settings>
    <settings pass="specialize">
        <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <ComputerName>{_xml_escape(profile.computer_name)}</ComputerName>
            <RegisteredOrganization>{_xml_escape(profile.organization)}</RegisteredOrganization>
            <TimeZone>{_xml_escape(profile.timezone)}</TimeZone>
        </component>
        <component name="Microsoft-Windows-Deployment" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <RunSynchronous>{rdp_command}
            </RunSynchronous>
        </component>
    </settings>
    <settings pass="oobeSystem">
        <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
            <InputLocale>{_xml_escape(profile.keyboard)}</InputLocale>
            <SystemLocale>{_xml_escape(profile.locale)}</SystemLocale>
            <UILanguage>{_xml_escape(profile.locale)}</UILanguage>
            <UserLocale>{_xml_escape(profile.locale)}</UserLocale>
        </component>
        <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">{auto_logon}
            <OOBE>
                <HideEULAPage>{hide_oobe}</HideEULAPage>
                <HideLocalAccountScreen>{hide_oobe}</HideLocalAccountScreen>
                <HideOEMRegistrationScreen>{hide_oobe}</HideOEMRegistrationScreen>
                <HideOnlineAccountScreens>{hide_oobe}</HideOnlineAccountScreens>
                <HideWirelessSetupInOOBE>{hide_oobe}</HideWirelessSetupInOOBE>
                <ProtectYourPC>3</ProtectYourPC>
            </OOBE>
            {user_accounts}{first_logon}
        </component>
    </settings>
</unattend>
'''


def _generate_wim_script(recipe: ForgeWimRecipe) -> str:
    driver_block = (
        f'dism /Image:"$MountDir" /Add-Driver /Driver:"{recipe.driver_path}" /Recurse /ForceUnsigned\n'
        if recipe.include_drivers
        else 'Write-Host "Injection pilotes desactivee pour ce profil."\n'
    )
    dotnet_block = (
        'dism /Image:"$MountDir" /Enable-Feature /FeatureName:NetFx3 /All /LimitAccess\n'
        if recipe.enable_dotnet35
        else 'Write-Host ".NET 3.5 non active pour ce profil."\n'
    )
    powershell_block = (
        'dism /Image:"$MountDir" /Enable-Feature /FeatureName:MicrosoftWindowsPowerShellV2 /All\n'
        if recipe.enable_powershell
        else 'Write-Host "PowerShell additionnel non modifie."\n'
    )
    cleanup_block = (
        'dism /Image:"$MountDir" /Cleanup-Image /StartComponentCleanup /ResetBase\n'
        if recipe.cleanup_image
        else 'Write-Host "Nettoyage image desactive pour ce profil."\n'
    )
    return f'''# AOS Deploy V5 - Createur WIM
# Profil: {recipe.name}
# Genere le: {recipe.created_at.isoformat()}
# Prerequis: Windows ADK + privileges administrateur.

$ErrorActionPreference = "Stop"
$IsoPath = "{recipe.windows_iso_path}"
$WorkDir = "{recipe.work_dir}"
$MountDir = Join-Path $WorkDir "mount"
$SourceWim = Join-Path $WorkDir "sources\\install.wim"
$OutputWim = "{recipe.output_wim_path}"
$ImageIndex = {recipe.image_index}

New-Item -ItemType Directory -Force -Path $WorkDir, $MountDir, (Split-Path $OutputWim) | Out-Null

Write-Host "Montage ISO Windows..."
$Disk = Mount-DiskImage -ImagePath $IsoPath -PassThru
$DriveLetter = ($Disk | Get-Volume).DriveLetter
$IsoRoot = "$DriveLetter`:"

try {{
    $InstallWim = Join-Path $IsoRoot "sources\\install.wim"
    $InstallEsd = Join-Path $IsoRoot "sources\\install.esd"

    if (Test-Path $InstallWim) {{
        Copy-Item $InstallWim $SourceWim -Force
    }} elseif (Test-Path $InstallEsd) {{
        dism /Export-Image /SourceImageFile:$InstallEsd /SourceIndex:$ImageIndex /DestinationImageFile:$SourceWim /Compress:max /CheckIntegrity
        $ImageIndex = 1
    }} else {{
        throw "Aucun install.wim/install.esd trouve dans l ISO."
    }}

    Write-Host "Montage image Windows index $ImageIndex..."
    dism /Mount-Image /ImageFile:$SourceWim /Index:$ImageIndex /MountDir:$MountDir

    Write-Host "Personnalisation image..."
{driver_block.rstrip()}
{dotnet_block.rstrip()}
{powershell_block.rstrip()}
{cleanup_block.rstrip()}

    Write-Host "Commit image..."
    dism /Unmount-Image /MountDir:$MountDir /Commit

    Write-Host "Export WIM final..."
    dism /Export-Image /SourceImageFile:$SourceWim /SourceIndex:1 /DestinationImageFile:$OutputWim /Compress:max /CheckIntegrity

    Write-Host "WIM pret: $OutputWim"
}} catch {{
    Write-Error $_
    dism /Unmount-Image /MountDir:$MountDir /Discard
    exit 1
}} finally {{
    Dismount-DiskImage -ImagePath $IsoPath
}}
'''


def _pxe_asset_status(config: ForgePxeConfig) -> list[ForgePxeAsset]:
    base_url = config.server_url
    menu_url = f"{base_url}/boot/menu.ipxe"
    systemrescue_url = f"{base_url}/diag/sysresc/vmlinuz"
    memtest_url = f"{base_url}/diag/memtest.efi"
    winpe_url = f"{base_url}/winpe/media/sources/boot.wim"
    menu_ready = _http_url_ok(menu_url)
    systemrescue_ready = _http_url_ok(systemrescue_url)
    memtest_ready = _http_url_ok(memtest_url)
    winpe_asset_ready = _http_url_ok(winpe_url)
    return [
        ForgePxeAsset(
            key="menu",
            label="Menu iPXE",
            status="ready" if menu_ready else "missing",
            detail="Menu HTTP disponible pour les clients UEFI/PXE." if menu_ready else "Menu iPXE non joignable par HTTP.",
            url=menu_url,
        ),
        ForgePxeAsset(
            key="systemrescue",
            label="Diagnostic SystemRescue",
            status="ready" if systemrescue_ready else "missing",
            detail="Kernel SystemRescue joignable." if systemrescue_ready else "SystemRescue absent: deposer kernel/initrd/airootfs dans diag/sysresc.",
            url=systemrescue_url,
        ),
        ForgePxeAsset(
            key="memtest",
            label="Memtest UEFI",
            status="ready" if memtest_ready else "missing",
            detail="Binaire memtest.efi present cote HTTP." if memtest_ready else "Binaire memtest.efi absent cote HTTP.",
            url=memtest_url,
        ),
        ForgePxeAsset(
            key="winpe",
            label="WinPE deploiement Windows",
            status="ready" if winpe_asset_ready else "missing",
            detail="WinPE boot.wim joignable." if winpe_asset_ready else "A generer depuis ADK/WinPE puis deposer dans winpe/media.",
            url=winpe_url if winpe_asset_ready else None,
        ),
    ]


def _tcp_port_open(host: str, port: int, timeout: float = 0.6) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _http_url_ok(url: str, timeout: float = 1.0) -> bool:
    try:
        request = Request(url, method="HEAD")
        with urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 500
    except (OSError, URLError, ValueError):
        return False


def _pxe_service_checks(config: ForgePxeConfig) -> list[ForgePxeServiceCheck]:
    checks = [
        (
            "pxe-http",
            "HTTP PXE",
            f"{config.server_url}/boot/menu.ipxe",
            _http_url_ok(f"{config.server_url}/boot/menu.ipxe"),
        ),
        (
            "smb",
            "Partage SMB",
            f"{config.server_ip}:445",
            _tcp_port_open(config.server_ip, 445),
        ),
        (
            "api",
            "Backend API",
            f"{config.server_ip}:8000",
            _tcp_port_open(config.server_ip, 8000),
        ),
    ]
    return [
        ForgePxeServiceCheck(
            key=key,
            label=label,
            status="online" if online else "offline",
            detail="Service joignable depuis le backend." if online else "Service non joignable par controle reseau.",
            endpoint=endpoint,
        )
        for key, label, endpoint, online in checks
    ]


def _network_diagnostic(config: ForgePxeConfig) -> ForgeNetworkDiagnosticResponse:
    detected_ip = _detect_lan_ip()
    services = _pxe_service_checks(config)
    deploy_dirs = {
        "audit": (DEPLOY_SHARE_DIR / "audit").is_dir(),
        "drivers": (DEPLOY_SHARE_DIR / "drivers").is_dir(),
        "exports": (DEPLOY_SHARE_DIR / "exports").is_dir(),
        "images": (DEPLOY_SHARE_DIR / "images").is_dir(),
        "incoming": (DEPLOY_SHARE_DIR / "incoming").is_dir(),
        "iso": (DEPLOY_SHARE_DIR / "iso").is_dir(),
    }
    offline = [service.label for service in services if service.status != "online"]
    missing_dirs = [name for name, exists in deploy_dirs.items() if not exists]
    if detected_ip != config.server_ip:
        recommendation = "IP changee: lancer Regenerer reseau pour resynchroniser HTTP PXE, SMB et dashboard."
    elif offline:
        recommendation = f"Services a verifier: {', '.join(offline)}."
    elif missing_dirs:
        recommendation = f"Dossiers deploy manquants: {', '.join(missing_dirs)}."
    else:
        recommendation = "Reseau coherent. Tester un client PXE reel puis verifier le retour Audit."
    return ForgeNetworkDiagnosticResponse(
        configured_ip=config.server_ip,
        detected_ip=detected_ip,
        ip_matches=detected_ip == config.server_ip,
        server_url=config.server_url,
        smb_share=config.smb_share,
        deploy_dirs=deploy_dirs,
        services=services,
        recommendation=recommendation,
        message="Diagnostic reseau calcule sans modifier la configuration.",
    )


def _windows_url_file(url: str) -> str:
    return "\n".join([
        "[InternetShortcut]",
        f"URL={url}",
        "IconIndex=0",
        "",
    ])


def _usb_profile_label(profile: str) -> str:
    return {
        "audit": "Audit rapide",
        "deployment": "Deploiement Windows",
        "complete": "Multitool complet",
    }.get(profile, "Multitool complet")


def _normalize_usb_profile(profile: str | None) -> str:
    value = (profile or "complete").strip().lower()
    if value in {"audit", "deployment", "complete"}:
        return value
    return "complete"


def _usb_readme(config: ForgePxeConfig, profile: str = "complete") -> str:
    dashboard_url = config.server_url.replace(":1950", "")
    profile_label = _usb_profile_label(profile)
    return "\n".join([
        "AOS Deploy V5 - Cle USB Multitool bootable",
        f"Profil: {profile_label}",
        "",
        "Objectif",
        "- Fournir une cle Multitool de secours pour demarrer, auditer et deployer meme si le reseau client est instable.",
        "- Garder une structure simple pour un technicien non confirme.",
        "",
        "Adresses",
        f"- Dashboard: {dashboard_url}",
        f"- Serveur PXE/tests: {config.server_url}",
        f"- Partage reseau: {config.smb_share}",
        "",
        "Structure",
        "- AOS-USB/boot: ISO de boot reseau ou WinPE secours.",
        "- AOS-USB/images: ISO, WIM ou ESD a deposer si besoin.",
        "- AOS-USB/drivers: packs drivers par marque/modele.",
        "- AOS-USB/tools: outils audit hors-ligne.",
        "- AOS-USB/logs: notes et retours intervention.",
        "- AOS-USB/profils: consignes specifiques au profil choisi.",
        "",
        "Preparation rapide",
        "1. Extraire ce ZIP sur le poste atelier.",
        "2. Lancer UTILITAIRE-CREER-CLE-BOOTABLE.bat en administrateur.",
        "3. Installer Ventoy sur la cle USB depuis l'assistant.",
        "4. Choisir la cle dans la liste numerotee ou saisir sa lettre.",
        "5. Taper OUI pour confirmer la copie vers la cle choisie.",
        "6. Copier les ISO utiles dans AOS-USB/images.",
        "7. Copier les drivers utiles dans AOS-USB/drivers.",
        "8. Tester le boot de la cle sur un PC reel avant livraison.",
        "",
        "Utilisation",
        "1. Demarrer le PC sur la cle USB.",
        "2. Choisir l'ISO iPXE/WinPE ou l'ISO Windows selon le cas.",
        "3. Si le reseau est disponible, ouvrir le dashboard AOS.",
        "4. Lancer Audit rapide ou Deploiement depuis l'interface.",
        "5. Si le reseau est indisponible, stocker les informations dans AOS-USB/logs puis resynchroniser plus tard.",
        "",
    ])


def _usb_bootable_script(config: ForgePxeConfig) -> str:
    dashboard_url = config.server_url.replace(":1950", "")
    return rf'''# AOS Deploy V5 - utilitaire creation cle USB Multitool bootable
# A executer depuis le dossier extrait du kit ZIP.
param(
  [string]$UsbDrive = "",
  [switch]$SkipVentoy
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$aosFolder = Join-Path $root "AOS-USB"
$aosDiskExe = Join-Path $root "ventoy\AOS DISK.exe"
$ventoyExe = Join-Path $root "ventoy\Ventoy2Disk.exe"

Write-Host "AOS Deploy V5 - creation cle USB Multitool bootable" -ForegroundColor Cyan
Write-Host "Dashboard: {dashboard_url}"
Write-Host "Serveur tests/PXE: {config.server_url}"
Write-Host ""
Write-Host "ATTENTION: Ventoy formate la cle USB choisie. Verifie bien le disque avant validation." -ForegroundColor Yellow
Write-Host "Objectif: obtenir une cle bootable avec menu Ventoy + dossier AOS-USB Multitool." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $aosFolder)) {{
  throw "Dossier AOS-USB introuvable. Extraire le ZIP complet avant execution."
}}

if (-not $SkipVentoy) {{
  if (Test-Path $aosDiskExe) {{
    Write-Host "Lancement de AOS DISK. Choisis la bonne cle USB puis clique Installer." -ForegroundColor Yellow
    Start-Process -FilePath $aosDiskExe -Wait
  }} elseif (Test-Path $ventoyExe) {{
    Write-Host "Lancement de Ventoy. Choisis la bonne cle USB puis clique Installer." -ForegroundColor Yellow
    Start-Process -FilePath $ventoyExe -Wait
  }} else {{
    Write-Host "AOS DISK/Ventoy n'est pas inclus dans ce kit." -ForegroundColor Yellow
    Write-Host "Ajoute AOS DISK.exe ou Ventoy2Disk.exe dans un dossier 'ventoy' a cote de ce script, puis relance."
    Write-Host "Page officielle: https://www.ventoy.net/en/download.html"
    Start-Process "https://www.ventoy.net/en/download.html"
  }}
}}

if (-not $UsbDrive) {{
  Write-Host ""
  $volumes = @(Get-Volume | Where-Object {{ $_.DriveLetter -and ($_.DriveType -eq 'Removable' -or $_.FileSystemLabel -match 'Ventoy|AOS') }} | Sort-Object DriveLetter)
  if ($volumes.Count -eq 0) {{
    Write-Host "Aucune cle USB evidente detectee. Branche la cle ou saisis la lettre manuellement." -ForegroundColor Yellow
    $UsbDrive = Read-Host "Lettre de la cle Ventoy/AOS (ex: E)"
  }} else {{
    Write-Host "Cles detectees:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $volumes.Count; $i++) {{
      $v = $volumes[$i]
      $sizeGb = [math]::Round(($v.Size / 1GB), 1)
      $freeGb = [math]::Round(($v.SizeRemaining / 1GB), 1)
      Write-Host ("[{0}] {1}:  Label='{2}'  FS={3}  Libre={4}GB/{5}GB" -f ($i + 1), $v.DriveLetter, $v.FileSystemLabel, $v.FileSystem, $freeGb, $sizeGb)
    }}
    $choice = Read-Host "Numero de la cle a preparer, ou lettre manuelle (ex: E)"
    if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $volumes.Count) {{
      $UsbDrive = $volumes[[int]$choice - 1].DriveLetter
    }} else {{
      $UsbDrive = $choice
    }}
  }}
}}

$UsbDrive = $UsbDrive.Trim().TrimEnd(":")
if (-not $UsbDrive) {{ throw "Aucune lettre de lecteur fournie." }}
$targetRoot = "$UsbDrive`:\"
if (-not (Test-Path $targetRoot)) {{ throw "Lecteur $targetRoot introuvable." }}

$confirm = Read-Host "Confirmer la copie vers $targetRoot ? Tape OUI"
if ($confirm -ne "OUI") {{ throw "Operation annulee par securite." }}

$targetAos = Join-Path $targetRoot "AOS-USB"
Write-Host "Copie de AOS-USB vers $targetAos ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $targetAos | Out-Null
Copy-Item -Path (Join-Path $aosFolder "*") -Destination $targetAos -Recurse -Force

$urlFile = Join-Path $targetRoot "AOS Dashboard.url"
@"
[InternetShortcut]
URL={dashboard_url}
"@ | Set-Content -Encoding ASCII -Path $urlFile

$logDir = Join-Path $targetAos "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("creation-cle-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")
$checks = @(
  (Join-Path $targetAos "README.txt"),
  (Join-Path $targetAos "manifest.json"),
  (Join-Path $targetRoot "AOS Dashboard.url")
)
$missing = @($checks | Where-Object {{ -not (Test-Path $_) }})
@(
  "AOS Deploy V5 - creation cle USB Multitool",
  "Date: $(Get-Date -Format s)",
  "Lecteur: $targetRoot",
  "Dashboard: {dashboard_url}",
  "Serveur: {config.server_url}",
  "Dossier: $targetAos",
  "Controle fichiers manquants: $($missing.Count)"
) | Set-Content -Encoding UTF8 -Path $logFile

if ($missing.Count -gt 0) {{
  Write-Host "Attention: certains fichiers sont manquants:" -ForegroundColor Yellow
  $missing | ForEach-Object {{ Write-Host " - $_" -ForegroundColor Yellow }}
}} else {{
  Write-Host "Verification OK: fichiers essentiels presents." -ForegroundColor Green
}}

Write-Host ""
Write-Host "Cle preparee. Teste maintenant un demarrage sur un PC reel." -ForegroundColor Green
Write-Host "Dossier copie: $targetAos"
Write-Host "Raccourci dashboard: $urlFile"
Write-Host "Journal: $logFile"
'''


def _usb_bootable_batch() -> str:
    return "\r\n".join([
        "@echo off",
        "setlocal",
        "cd /d %~dp0",
        "powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0UTILITAIRE-CREER-CLE-BOOTABLE.ps1\"",
        "pause",
        "",
    ])


def _usb_profile_instructions(profile: str) -> str:
    if profile == "audit":
        return "\n".join([
            "Profil Audit rapide",
            "",
            "Usage:",
            "- Demarrer un PC pour collecter marque, modele, serie, CPU, RAM, disque, batterie.",
            "- Utiliser ensuite les tests atelier clavier, pixels, USB, camera, micro.",
            "- Remonter le resultat dans l'onglet Audit AOS.",
            "",
            "A privilegier pour: tri atelier, etiquettes, controle rapide avant revente.",
            "",
        ])
    if profile == "deployment":
        return "\n".join([
            "Profil Deploiement Windows",
            "",
            "Usage:",
            "- Stocker ici les ISO/WIM/ESD Windows utiles.",
            "- Associer drivers et Unattend depuis AOS Deploy.",
            "- Utiliser la cle comme secours quand le PXE reseau n'est pas disponible.",
            "",
            "A privilegier pour: installation Windows, reinstallation atelier, secours client.",
            "",
        ])
    return "\n".join([
        "Profil Multitool complet",
        "",
        "Usage:",
        "- Audit rapide.",
        "- Tests atelier.",
        "- Depot ISO/WIM/ESD.",
        "- Depot drivers.",
        "- Secours reseau/PXE.",
        "",
        "A privilegier pour: technicien itinerant ou atelier multi-marques.",
        "",
    ])


def _create_usb_kit_archive(config: ForgePxeConfig, profile: str = "complete") -> ForgeUsbKitResponse:
    profile = _normalize_usb_profile(profile)
    USB_KIT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"aos-usb-kit-{profile}-{stamp}.zip"
    archive_path = USB_KIT_DIR / filename
    included: list[str] = []
    dashboard_url = config.server_url.replace(":1950", "")
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "server_ip": config.server_ip,
        "server_url": config.server_url,
        "dashboard_url": dashboard_url,
        "smb_share": config.smb_share,
        "profile": profile,
        "profile_label": _usb_profile_label(profile),
        "target": "Ventoy USB root",
        "note": "Extraire ce ZIP a la racine de la cle USB apres installation Ventoy.",
    }
    files = {
        "UTILITAIRE-CREER-CLE-BOOTABLE.bat": _usb_bootable_batch(),
        "UTILITAIRE-CREER-CLE-BOOTABLE.ps1": _usb_bootable_script(config),
        "AOS-USB/README.txt": _usb_readme(config, profile),
        "AOS-USB/manifest.json": json.dumps(manifest, indent=2, ensure_ascii=False),
        f"AOS-USB/profils/{profile}.txt": _usb_profile_instructions(profile),
        "AOS-USB/boot/DEPOSER-ISO-IPXE-OU-WINPE-ICI.txt": "Copier ici ipxe.iso, winpe.iso ou un ISO de secours.\n",
        "AOS-USB/images/DEPOSER-ISO-WIM-ESD-ICI.txt": "Copier ici les ISO Windows, install.wim ou install.esd utiles.\n",
        "AOS-USB/drivers/DEPOSER-PACKS-DRIVERS-ICI.txt": "Copier ici les packs drivers extraits par marque/modele.\n",
        "AOS-USB/tools/README-OUTILS.txt": "Ajouter ici les outils audit hors-ligne valides par l'atelier.\n",
        "AOS-USB/logs/README-LOGS.txt": "Placer ici les notes d'intervention si le reseau est indisponible.\n",
        "AOS-USB/raccourcis/AOS Dashboard.url": _windows_url_file(dashboard_url),
        "AOS-USB/raccourcis/AOS Tests PXE.url": _windows_url_file(f"{config.server_url.rstrip('/')}/tests/"),
        "AOS-USB/raccourcis/AOS Boot Menu.url": _windows_url_file(f"{config.server_url.rstrip('/')}/boot/menu.ipxe"),
    }
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for arcname, content in files.items():
            archive.writestr(arcname, content)
            included.append(arcname)
        if LOCAL_VENTOY_SOURCE_DIR.exists() and LOCAL_VENTOY_SOURCE_DIR.is_dir():
            for source in LOCAL_VENTOY_SOURCE_DIR.rglob("*"):
                if source.is_file():
                    relative = str(source.relative_to(LOCAL_VENTOY_SOURCE_DIR)).replace("\\", "/")
                    arcname = f"ventoy/{relative}"
                    archive.write(source, arcname)
                    included.append(arcname)
        else:
            archive.writestr("ventoy/DEPOSER-AOS-DISK-OU-VENTOY-ICI.txt", "Copier ici AOS DISK.exe ou les fichiers Ventoy avant de lancer l'utilitaire.\n")
            included.append("ventoy/DEPOSER-AOS-DISK-OU-VENTOY-ICI.txt")
    info = archive_path.stat()
    smb_base = config.smb_share.rstrip("\\")
    return ForgeUsbKitResponse(
        filename=filename,
        profile=profile,
        path=str(archive_path),
        smb_path=rf"{smb_base}\exports\aos-usb-kits\{filename}",
        size=info.st_size,
        size_mb=round(info.st_size / (1024 ** 2), 2),
        included=included,
        message="Kit USB autonome genere. Installer Ventoy sur la cle puis extraire ce ZIP a la racine.",
    )


def _usb_kit_summary(path: Path, config: ForgePxeConfig) -> ForgeUsbKitResponse:
    info = path.stat()
    smb_base = config.smb_share.rstrip("\\")
    included: list[str] = []
    try:
        with zipfile.ZipFile(path) as archive:
            included = archive.namelist()
            try:
                manifest = json.loads(archive.read("AOS-USB/manifest.json").decode("utf-8"))
                profile = _normalize_usb_profile(str(manifest.get("profile") or "complete"))
            except (KeyError, json.JSONDecodeError, UnicodeDecodeError):
                profile = "complete"
    except zipfile.BadZipFile:
        included = []
        profile = "complete"
    return ForgeUsbKitResponse(
        filename=path.name,
        profile=profile,
        path=str(path),
        smb_path=rf"{smb_base}\exports\aos-usb-kits\{path.name}",
        size=info.st_size,
        size_mb=round(info.st_size / (1024 ** 2), 2),
        included=included,
        message="Kit USB autonome disponible.",
    )


def _stock_to_pxe_client(item: StockItem) -> ForgePxeClient:
    audit = item.audit_data or {}
    certificate = item.erase_cert or {}
    hostname = _pick(audit, "Hostname", "hostname", "ComputerName", "Nom")
    ip = _pick(audit, "IP", "ip", "IPv4", "Adresse_IP")
    mac = _pick(audit, "MAC", "mac", "MacAddress", "Adresse_MAC")
    boot_mode = _pick(audit, "BootMode", "boot_mode", "Firmware", "UEFI")
    last_seen = _pick(audit, "timestamp", "Timestamp", "date", "Date") or item.received_at.isoformat()
    state = "effacement certifie" if certificate else "diagnostic termine" if audit else "en attente"
    capabilities = ["audit", "pxe"]
    if certificate:
        capabilities.append("erase_certificate")
    return ForgePxeClient(
        id=str(item.id),
        stock_item_id=item.id,
        hostname=hostname,
        ip=ip,
        mac=mac,
        serial_number=item.serial_number,
        brand=item.brand,
        model=item.model,
        state=state,
        boot_mode=boot_mode,
        current_task=None,
        progress=100 if audit else None,
        last_seen=last_seen,
        remote_url=None,
        notes=item.notes,
        capabilities=capabilities,
    )


def _heartbeat_to_pxe_client(data: dict) -> ForgePxeClient:
    payload = data["payload"]
    return ForgePxeClient(
        id=payload.client_id,
        stock_item_id=None,
        hostname=payload.hostname,
        ip=payload.ip,
        mac=payload.mac,
        serial_number=payload.serial_number,
        brand=payload.brand,
        model=payload.model,
        state=payload.state,
        boot_mode=payload.boot_mode,
        current_task=payload.current_task,
        progress=payload.progress,
        last_seen=data["last_seen"],
        remote_url=payload.remote_url,
        notes="Agent live SystemRescue",
        capabilities=payload.capabilities,
    )


@router.post("/ingest", response_model=ForgeIngestResponse, status_code=201)
async def ingest(
    payload: ForgeIngestRequest,
    x_forge_key: str = Header(..., alias="X-Forge-Key"),
    db: AsyncSession = Depends(get_db),
):
    """CrÃ©e ou met Ã  jour une machine dans le stock Ã  partir d'un audit PXE.

    Idempotent sur (tenant, numÃ©ro de sÃ©rie) : un rÃ©-audit de la mÃªme machine
    met Ã  jour sa fiche au lieu d'en crÃ©er une nouvelle.
    """
    tenant = await _tenant_from_key(x_forge_key, db)

    norm = normalize_audit(payload.audit)
    grade = compute_grade(norm) if payload.audit else None
    serial = norm.get("serial_number")

    # Upsert par numÃ©ro de sÃ©rie (si prÃ©sent).
    item: StockItem | None = None
    if serial:
        existing = await db.execute(
            select(StockItem).where(
                StockItem.tenant_id == tenant.id,
                StockItem.serial_number == serial,
            )
        )
        item = existing.scalar_one_or_none()

    created = item is None
    if item is None:
        item = StockItem(tenant_id=tenant.id, status=StockItemStatus.in_diagnosis)
        db.add(item)

    # Champs normalisÃ©s (ne pas Ã©craser avec du vide).
    if serial:
        item.serial_number = serial
    if norm.get("brand"):
        item.brand = norm["brand"]
    if norm.get("model"):
        item.model = norm["model"]
    if grade:
        item.grade = grade
    if payload.audit:
        item.audit_data = payload.audit
    if payload.certificate:
        item.erase_cert = payload.certificate

    await db.flush()
    await db.refresh(item)

    return ForgeIngestResponse(
        stock_item_id=item.id,
        serial_number=item.serial_number,
        grade=item.grade,
        created=created,
        has_certificate=bool(payload.certificate),
    )


@router.get("/pxe/status", response_model=ForgePxeStatus)
async def pxe_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Vue opÃ©rateur du serveur PXE et des postes connus par les audits."""
    config = _read_pxe_config()
    result = await db.execute(
        select(StockItem)
        .where(StockItem.tenant_id == current_user.tenant_id)
        .order_by(StockItem.received_at.desc())
        .limit(50)
    )
    clients = [_stock_to_pxe_client(item) for item in result.scalars().all()]
    seen = {client.mac or client.serial_number or client.id for client in clients}
    for data in LIVE_CLIENTS.values():
        if str(data["tenant_id"]) not in {str(current_user.tenant_id), "local-control"}:
            continue
        live_client = _heartbeat_to_pxe_client(data)
        live_key = live_client.mac or live_client.serial_number or live_client.id
        if live_key in seen:
            continue
        clients.insert(0, live_client)
        seen.add(live_key)
    service_checks = _pxe_service_checks(config)
    return ForgePxeStatus(
        server_ip=config.server_ip,
        server_url=config.server_url,
        smb_share=config.smb_share,
        mode=config.mode,
        diagnostic="OK - base PXE reseau active, WinPE pret si boot.wim present",
        assets=_pxe_asset_status(config),
        services=service_checks,
        clients=clients,
    )


@router.get("/pxe/audits", response_model=list[ForgePxeAuditSummary])
async def list_pxe_audits(
    limit: int = 20,
):
    """Derniers retours d'audit PXE generes par SystemRescue."""
    return _read_pxe_audits(max(1, min(limit, 100)))


@router.delete("/pxe/audits/{audit_id}", status_code=204)
async def delete_pxe_audit(
    audit_id: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime un retour d'audit PXE et ses fichiers associes."""
    _ = current_user
    audit = _find_pxe_audit(audit_id)
    if audit is None:
        raise HTTPException(status_code=404, detail="Audit PXE introuvable")

    deleted = _delete_pxe_audit_files(audit)
    if deleted:
        remaining = _read_pxe_audits(1)
        latest_label = PXE_AUDIT_DIR / "latest-label.json"
        latest_raw = PXE_AUDIT_DIR / "latest.json"
        if remaining:
            source = PXE_AUDIT_DIR / remaining[0].filename
            try:
                latest_label.write_text(source.read_text(encoding="utf-8-sig"), encoding="utf-8")
            except OSError:
                pass
        else:
            latest_label.unlink(missing_ok=True)
            latest_raw.unlink(missing_ok=True)


@router.post("/pxe/audits/prune", response_model=ForgePxeAuditPruneResponse)
async def prune_pxe_audits(
    payload: ForgePxeAuditPruneRequest,
    current_user: User = Depends(get_current_user),
):
    """Nettoie les anciens retours d'audit en gardant les derniers N."""
    _ = current_user
    keep_latest = max(1, min(payload.keep_latest, 500))
    audits = _read_pxe_audits(500)
    candidates = audits[keep_latest:]
    deleted_files: list[str] = []
    for audit in candidates:
        deleted_files.extend(_delete_pxe_audit_files(audit, dry_run=payload.dry_run))

    if not payload.dry_run:
        remaining = _read_pxe_audits(1)
        latest_label = PXE_AUDIT_DIR / "latest-label.json"
        latest_raw = PXE_AUDIT_DIR / "latest.json"
        if remaining:
            source = PXE_AUDIT_DIR / remaining[0].filename
            if source.exists():
                latest_label.write_text(source.read_text(encoding="utf-8-sig"), encoding="utf-8")
            raw_source = PXE_AUDIT_DIR / remaining[0].filename.replace(".label.json", ".json")
            if raw_source.exists():
                latest_raw.write_text(raw_source.read_text(encoding="utf-8-sig"), encoding="utf-8")

    action = "Simulation nettoyage" if payload.dry_run else "Nettoyage applique"
    return ForgePxeAuditPruneResponse(
        dry_run=payload.dry_run,
        keep_latest=keep_latest,
        candidates=len(candidates),
        deleted_files=sorted(set(deleted_files)),
        message=f"{action}: {len(candidates)} audit(s) ancien(s), {len(set(deleted_files))} fichier(s) concerne(s).",
    )


@router.post("/pxe/audits/upload", response_model=ForgePxeAuditSummary)
async def upload_pxe_audit(
    payload: dict = Body(...),
):
    """Recoit un audit PXE depuis le live client quand le depot SMB echoue."""
    label = payload.get("label") if isinstance(payload.get("label"), dict) else payload
    audit = payload.get("audit") if isinstance(payload.get("audit"), dict) else {}
    serial = label.get("serial_number") or (label.get("machine") or {}).get("serial_number")
    safe = str(serial or label.get("mac") or audit.get("mac") or audit.get("hostname") or "pc")
    safe = safe.replace("/", "-").replace("\\", "-").replace(":", "").strip() or "pc"
    PXE_AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    label_path = PXE_AUDIT_DIR / f"{safe}.label.json"
    raw_path = PXE_AUDIT_DIR / f"{safe}.json"
    if label_path.exists():
        try:
            existing_label = json.loads(label_path.read_text(encoding="utf-8-sig"))
            label = _merge_pxe_label(existing_label, label)
        except (OSError, ValueError):
            pass
    label_path.write_text(json.dumps(label, indent=2, ensure_ascii=False), encoding="utf-8")
    (PXE_AUDIT_DIR / "latest-label.json").write_text(json.dumps(label, indent=2, ensure_ascii=False), encoding="utf-8")
    if audit:
        if raw_path.exists():
            try:
                existing_audit = json.loads(raw_path.read_text(encoding="utf-8-sig"))
                audit = _merge_pxe_label(existing_audit, audit)
            except (OSError, ValueError):
                pass
        raw_path.write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")
        (PXE_AUDIT_DIR / "latest.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")
    summary = _audit_summary_from_label(label_path)
    if not summary:
        raise HTTPException(status_code=400, detail="Audit PXE invalide")
    return summary


@router.post("/pxe/audits/{audit_id}/prepare-drivers", response_model=ForgeDriverPrepareResponse)
async def prepare_audit_drivers(
    audit_id: str,
    payload: ForgeDriverPrepareRequest,
    current_user: User = Depends(get_current_user),
):
    """Prepare un emplacement drivers reutilisable a partir d'une machine auditee."""
    _ = current_user
    audit = next((item for item in _read_pxe_audits(100) if item.id == audit_id or item.filename == audit_id), None)
    if audit is None:
        raise HTTPException(status_code=404, detail="Audit PXE introuvable")
    if not audit.brand or not audit.model:
        raise HTTPException(status_code=400, detail="Marque et modele requis pour preparer les pilotes")
    if payload.category not in {"storage", "network", "chipset", "graphics", "other"}:
        raise HTTPException(status_code=400, detail="Categorie pilote invalide")

    packs = _read_driver_packs()
    existing = _matching_driver_pack(audit, packs)
    vendor_part = _safe_path_part(audit.brand)
    model_part = _safe_path_part(audit.model)
    windows_part = payload.windows_version.replace(" ", "-")
    local_dir = DRIVER_STORE_DIR / vendor_part / model_part / windows_part / payload.architecture
    local_dir.mkdir(parents=True, exist_ok=True)
    readme = local_dir / "README.txt"
    if not readme.exists():
        readme.write_text(
            "\n".join([
                "AOS Deploy driver pack",
                f"Machine: {audit.brand} {audit.model}",
                f"Serial source: {audit.serial_number or '-'}",
                f"Audit source: {audit.filename}",
                "Deposer ici les drivers constructeur extraits (.inf) avant injection deploiement.",
            ]) + "\n",
            encoding="utf-8",
        )

    config = _read_pxe_config()
    smb_base = config.smb_share.rstrip("\\/")
    smb_path = rf"{smb_base}\drivers\{vendor_part}\{model_part}\{windows_part}\{payload.architecture}"
    download_result = _download_manufacturer_drivers(
        audit,
        local_dir,
        vendor_part,
        model_part,
        windows_part,
        payload.architecture,
    )
    if existing:
        updated = existing.model_copy(update={
            "category": payload.category,
            "path": smb_path,
            "architecture": payload.architecture,
            "windows_version": payload.windows_version,
            "critical": payload.category in {"storage", "network", "chipset"},
            "notes": payload.notes or download_result["notes"],
            "status": download_result["status"],
        })
        _write_driver_packs([updated if pack.id == existing.id else pack for pack in packs])
        return ForgeDriverPrepareResponse(
            pack=updated,
            created=False,
            driver_store_path=str(local_dir),
            smb_path=smb_path,
            message=download_result["message"],
        )

    pack = ForgeDriverPack(
        name=f"{audit.brand} {audit.model} - drivers",
        vendor=audit.brand,
        model_family=audit.model,
        category=payload.category,
        path=smb_path,
        architecture=payload.architecture,
        windows_version=payload.windows_version,
        critical=payload.category in {"storage", "network", "chipset"},
        notes=payload.notes or download_result["notes"],
        source_audit_id=audit.id,
        id=datetime.now(timezone.utc).strftime("drv-%Y%m%d%H%M%S"),
        status=download_result["status"],
        created_at=datetime.now(timezone.utc),
    )
    _write_driver_packs([pack, *packs])
    return ForgeDriverPrepareResponse(
        pack=pack,
        created=True,
        driver_store_path=str(local_dir),
        smb_path=smb_path,
        message=download_result["message"],
    )


@router.get("/pxe/config", response_model=ForgePxeConfig)
async def get_pxe_config(
    current_user: User = Depends(get_current_user),
):
    """Configuration PXE editable par l'interface operateur."""
    _ = current_user
    return _read_pxe_config()


@router.patch("/pxe/config", response_model=ForgePxeConfig)
async def update_pxe_config(
    payload: ForgePxeConfigUpdate,
    current_user: User = Depends(get_current_user),
):
    """Sauvegarde la configuration PXE sans redeployer le backend."""
    _ = current_user
    current = _read_pxe_config()
    data = current.model_dump()
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            data[key] = value
    config = ForgePxeConfig.model_validate(data)
    if config.mode not in {"proxy DHCP", "standalone DHCP"}:
        raise HTTPException(status_code=400, detail="Mode DHCP invalide")
    for field in ("tftp_port", "http_port", "dhcp_proxy_port"):
        value = getattr(config, field)
        if value < 1 or value > 65535:
            raise HTTPException(status_code=400, detail=f"{field} invalide")
    _write_pxe_config(config)
    return config


@router.get("/pxe/network/diagnostic", response_model=ForgeNetworkDiagnosticResponse)
async def get_pxe_network_diagnostic(
    current_user: User = Depends(get_current_user),
):
    """Diagnostic reseau lecture seule avant toute regeneration."""
    _ = current_user
    return _network_diagnostic(_read_pxe_config())


@router.get("/pxe/system-report", response_model=ForgeSystemReportResponse)
async def get_pxe_system_report(
    current_user: User = Depends(get_current_user),
):
    """Rapport support client exportable sans acces SSH."""
    _ = current_user
    config = _read_pxe_config()
    network = _network_diagnostic(config)
    media = _list_server_media_files(config)
    backups = [
        path
        for path in BACKUP_DIR.glob("aos-backup-*.zip")
        if path.is_file()
    ] if BACKUP_DIR.exists() else []
    recommendations: list[str] = [network.recommendation]
    if not _read_wim_images():
        recommendations.append("Declarer une image WIM/ESD ou importer une ISO Windows.")
    if not any(image.is_default for image in _read_wim_images()):
        recommendations.append("Definir une image Windows par defaut avant deploiement.")
    if not _read_unattend_profiles():
        recommendations.append("Creer au moins un profil Unattend.")
    if not backups:
        recommendations.append("Creer une sauvegarde appliance initiale.")
    return ForgeSystemReportResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        pxe_config=config,
        network=network,
        media_total=len(media),
        wim_images_total=len(_read_wim_images()),
        wim_recipes_total=len(_read_wim_recipes()),
        wim_builds_total=len(_read_wim_builds()),
        driver_packs_total=len(_read_driver_packs()),
        unattend_profiles_total=len(_read_unattend_profiles()),
        audits_total_visible=len(_read_pxe_audits(500)),
        backups_total=len(backups),
        recommendations=recommendations,
        message="Rapport systeme AOS Deploy genere.",
    )


@router.post("/pxe/network/resync", response_model=ForgeNetworkResyncResponse)
async def resync_pxe_network(
    current_user: User = Depends(get_current_user),
):
    """Redetecte l'IP LAN et relance les services reseau AOS apres changement de switch/reseau."""
    _ = current_user
    current = _read_pxe_config()
    server_ip = _detect_lan_ip()
    config = current.model_copy(update={
        "server_ip": server_ip,
        "server_url": f"http://{server_ip}:{current.http_port}",
        "smb_share": rf"\\{server_ip}\deploy",
    })
    _write_pxe_config(config)
    restarted = _restart_services([
        "forge-nginx-pxe.service",
        "forge-dnsmasq.service",
        "forge-samba.service",
        "aos-dashboard.service",
    ])
    return ForgeNetworkResyncResponse(
        server_ip=config.server_ip,
        server_url=config.server_url,
        smb_share=config.smb_share,
        restarted_services=restarted,
        message=f"Reseau resynchronise sur {config.server_ip}",
    )


@router.get("/pxe/wim-recipes", response_model=list[ForgeWimRecipe])
async def list_wim_recipes(
    current_user: User = Depends(get_current_user),
):
    """Liste les profils de creation WIM sauvegardes."""
    _ = current_user
    return _read_wim_recipes()


@router.post("/pxe/wim-recipes", response_model=ForgeWimRecipe, status_code=201)
async def create_wim_recipe(
    payload: ForgeWimRecipeCreate,
    current_user: User = Depends(get_current_user),
):
    """Cree un profil WIM et conserve le script DISM generable."""
    _ = current_user
    if payload.image_index < 1:
        raise HTTPException(status_code=400, detail="Index image invalide")
    recipe = ForgeWimRecipe(
        **payload.model_dump(),
        id=datetime.now(timezone.utc).strftime("wim-%Y%m%d%H%M%S"),
        created_at=datetime.now(timezone.utc),
    )
    recipes = [recipe, *_read_wim_recipes()]
    _write_wim_recipes(recipes[:25])
    return recipe


@router.get("/pxe/wim-recipes/{recipe_id}/script", response_class=PlainTextResponse)
async def get_wim_recipe_script(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retourne le script PowerShell/ADK a executer sur le poste client."""
    _ = current_user
    for recipe in _read_wim_recipes():
        if recipe.id == recipe_id:
            return PlainTextResponse(
                _generate_wim_script(recipe),
                media_type="text/plain; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{recipe.id}.ps1"'},
            )
    raise HTTPException(status_code=404, detail="Profil WIM introuvable")


@router.get("/pxe/wim-images", response_model=list[ForgeWimImage])
async def list_wim_images(
    current_user: User = Depends(get_current_user),
):
    """Liste les images Windows declarees dans AOS Deploy."""
    _ = current_user
    return _with_wim_file_status(_read_wim_images())


@router.get("/pxe/wim-builds", response_model=ForgeWimBuildListResponse)
async def list_wim_builds(
    current_user: User = Depends(get_current_user),
):
    """Liste les procedures WIM preparees sur le serveur."""
    _ = current_user
    builds = _read_wim_builds()
    return ForgeWimBuildListResponse(
        builds=builds,
        total=len(builds),
        message=f"{len(builds)} procedure(s) WIM preparee(s).",
    )


@router.post("/pxe/wim-images", response_model=ForgeWimImage, status_code=201)
async def create_wim_image(
    payload: ForgeWimImageCreate,
    current_user: User = Depends(get_current_user),
):
    """Declare une image WIM existante pour les deploiements."""
    _ = current_user
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Nom image requis")
    if not payload.path.strip().lower().endswith((".wim", ".esd")):
        raise HTTPException(status_code=400, detail="Chemin image .wim ou .esd requis")
    images = _read_wim_images()
    image = ForgeWimImage(
        **payload.model_dump(),
        id=datetime.now(timezone.utc).strftime("img-%Y%m%d%H%M%S"),
        status="registered",
        is_default=len(images) == 0,
        created_at=datetime.now(timezone.utc),
    )
    _write_wim_images([image, *images])
    return image


@router.post("/pxe/wim-images/{image_id}/build-wim", response_model=ForgeWimBuildResponse)
async def build_wim_from_image(
    image_id: str,
    payload: ForgeWimBuildRequest,
    current_user: User = Depends(get_current_user),
):
    """Lance une generation WIM en tache de fond depuis une image declaree."""
    _ = current_user
    image = _find_wim_image(image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image WIM introuvable")

    reference = _safe_path_part(payload.reference or f"{image.name}-{image.version}", "wim")
    version = _safe_path_part(payload.version or image.version, "version")
    source_path = image.path
    output_name = f"{reference}-{version}.wim"
    return _build_request_payload(
        image=image,
        output_name=output_name,
        source_path=source_path,
        payload=payload,
        reference=reference,
        version=version,
    )


@router.post("/pxe/media/build-wim", response_model=ForgeWimBuildResponse)
async def build_wim_from_media(
    payload: ForgeWimBuildFromPathRequest,
    current_user: User = Depends(get_current_user),
):
    """Lance une generation WIM en tache de fond directement depuis un fichier media."""
    _ = current_user
    source_path = payload.source_path.strip()
    if not source_path:
        raise HTTPException(status_code=400, detail="Le chemin source est requis")
    source_suffix = Path(source_path).suffix.lower()
    if source_suffix not in {".iso", ".wim", ".esd"}:
        raise HTTPException(status_code=400, detail="Le chemin source doit pointer vers un .iso, .wim ou .esd")

    source_name = Path(source_path).stem.replace(".iso", "")
    reference = _safe_path_part(payload.reference or source_name, "wim")
    version = _safe_path_part(payload.version or "01", "version")
    output_name = f"{reference}-{version}.wim"

    source_image = ForgeWimImage(
        name=source_name,
        version=version,
        architecture="x64",
        path=source_path,
        size_gb=None,
        source="media",
        notes="Source ISO/WIM du serveur",
        id=f"tmp-media-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        status="source",
        is_default=False,
        created_at=datetime.now(timezone.utc),
    )
    return _build_request_payload(
        image=source_image,
        output_name=output_name,
        source_path=source_path,
        payload=payload,
        reference=reference,
        version=version,
    )


@router.post("/pxe/media/upload", response_model=ForgeMediaUploadResponse)
async def upload_pxe_media(
    file: UploadFile = File(...),
    kind: str | None = Form(default=None),
    name: str | None = Form(default=None),
    version: str = Form(default="24H2"),
    architecture: str = Form(default="x64"),
    overwrite: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
):
    """Recoit un ISO/WIM/ESD depuis le navigateur et le depose dans le partage PXE."""
    _ = current_user
    safe_name = _safe_filename(file.filename)
    resolved_kind, destination = _media_destination(safe_name, kind)
    if destination.exists() and not overwrite:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{safe_name} existe déjà dans {destination.parent}. "
                "Activez le remplacement pour lancer l envoi."
            ),
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = destination.with_suffix(destination.suffix + ".upload")
    size = 0
    try:
        with tmp_path.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                handle.write(chunk)
        tmp_path.replace(destination)
    finally:
        await file.close()
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    config = _read_pxe_config()
    smb_base = config.smb_share.rstrip("\\/")
    folder = "iso" if resolved_kind == "iso" else "images"
    smb_path = rf"{smb_base}\{folder}\{safe_name}"
    image: ForgeWimImage | None = None
    if resolved_kind == "image":
        images = _read_wim_images()
        image = ForgeWimImage(
            name=name.strip() if name and name.strip() else Path(safe_name).stem,
            version=version,
            architecture=architecture,
            path=smb_path,
            size_gb=round(size / (1024 ** 3), 2),
            source="upload",
            notes="Importe depuis l'onglet Parcourir.",
            id=datetime.now(timezone.utc).strftime("img-%Y%m%d%H%M%S"),
            status="ready",
            is_default=not any(item.is_default for item in images),
            created_at=datetime.now(timezone.utc),
        )
        _write_wim_images([image, *images])

    return ForgeMediaUploadResponse(
        kind=resolved_kind,
        filename=safe_name,
        size=size,
        path=str(destination),
        smb_path=smb_path,
        image=image,
        message=f"{safe_name} envoye dans {smb_path}",
    )


@router.get("/pxe/media/status", response_model=ForgeMediaStatusResponse)
async def get_media_status(
    filename: str,
    kind: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """Vérifie si le fichier existe déjà dans le dépôt PXE."""
    _ = current_user
    safe_name = _safe_filename(filename)
    resolved_kind, destination = _media_destination(safe_name, kind)
    if not destination.exists():
        return ForgeMediaStatusResponse(
            filename=safe_name,
            kind=resolved_kind,
            destination=str(destination),
            exists=False,
            size=None,
            modified_at=None,
            message=f"{safe_name} n'existe pas encore dans {destination.parent.name}.",
        )

    info = destination.stat()
    return ForgeMediaStatusResponse(
        filename=safe_name,
        kind=resolved_kind,
        destination=str(destination),
        exists=True,
        size=info.st_size,
        modified_at=datetime.fromtimestamp(info.st_mtime, tz=timezone.utc).isoformat(),
        message=f"{safe_name} existe déjà dans {destination.parent.name}.",
    )


@router.get("/pxe/media/files", response_model=ForgeServerMediaListResponse)
async def list_pxe_media_files(
    current_user: User = Depends(get_current_user),
):
    """Liste les ISO/WIM/ESD deja presents dans le stockage serveur."""
    _ = current_user
    config = _read_pxe_config()
    files = _list_server_media_files(config)
    return ForgeServerMediaListResponse(
        files=files,
        total=len(files),
        message=f"{len(files)} media(s) detecte(s) sur le serveur.",
    )


@router.delete("/pxe/media/files/{folder}/{filename}", response_model=ForgeServerMediaDeleteResponse)
async def delete_pxe_media_file(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime un ISO/WIM/ESD du stockage serveur, uniquement dans les dossiers media autorises."""
    _ = current_user
    allowed = {
        "iso": ("iso", {".iso"}),
        "images": ("image", {".wim", ".esd"}),
        "incoming": ("incoming", {".iso", ".wim", ".esd"}),
    }
    if folder not in allowed:
        raise HTTPException(status_code=400, detail="Dossier media invalide")
    safe_name = _safe_filename(filename)
    kind, suffixes = allowed[folder]
    path = DEPLOY_SHARE_DIR / folder / safe_name
    if path.suffix.lower() not in suffixes:
        raise HTTPException(status_code=400, detail="Extension media invalide")
    try:
        resolved_path = path.resolve()
        resolved_root = (DEPLOY_SHARE_DIR / folder).resolve()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fichier media introuvable") from None
    if resolved_root not in resolved_path.parents:
        raise HTTPException(status_code=400, detail="Chemin media refuse")
    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Fichier media introuvable")
    resolved_path.unlink()
    return ForgeServerMediaDeleteResponse(
        deleted=True,
        filename=safe_name,
        kind=kind,
        folder=folder,
        message=f"{safe_name} supprime de {folder}.",
    )


@router.get("/pxe/backups", response_model=ForgeApplianceBackupListResponse)
async def list_appliance_backups(
    current_user: User = Depends(get_current_user),
):
    """Liste les sauvegardes appliance disponibles dans le partage exports."""
    _ = current_user
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backups = [
        _backup_summary(path)
        for path in sorted(BACKUP_DIR.glob("aos-backup-*.zip"), key=lambda item: item.stat().st_mtime, reverse=True)
        if path.is_file()
    ]
    return ForgeApplianceBackupListResponse(
        backups=backups,
        total=len(backups),
        message=f"{len(backups)} sauvegarde(s) disponible(s).",
    )


@router.post("/pxe/backups", response_model=ForgeApplianceBackupResponse)
async def create_appliance_backup(
    current_user: User = Depends(get_current_user),
):
    """Cree une archive de sauvegarde portable pour l'appliance AOS Deploy."""
    _ = current_user
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"aos-backup-{stamp}.zip"
    included: list[str] = []
    with zipfile.ZipFile(backup_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        _zip_if_exists(archive, PXE_CONFIG_PATH, "data/pxe-config.json", included)
        _zip_if_exists(archive, WIM_RECIPES_PATH, "data/wim-recipes.json", included)
        _zip_if_exists(archive, WIM_IMAGES_PATH, "data/wim-images.json", included)
        _zip_if_exists(archive, DRIVER_PACKS_PATH, "data/driver-packs.json", included)
        _zip_if_exists(archive, UNATTEND_PROFILES_PATH, "data/unattend-profiles.json", included)
        for audit_path in sorted(PXE_AUDIT_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:250]:
            if audit_path.is_file():
                archive.write(audit_path, f"audit/{audit_path.name}")
                included.append(f"audit/{audit_path.name}")
        manifest = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "server_ip": _read_pxe_config().server_ip,
            "included_count": len(included),
            "included": included,
            "restore_note": "Restauration automatique a finaliser. Archive exploitable manuellement.",
        }
        archive.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        included.append("manifest.json")
    return ForgeApplianceBackupResponse(
        backup=_backup_summary(backup_path),
        included=included,
        message=f"Sauvegarde creee: {backup_path.name}",
    )


@router.post("/pxe/backups/{filename}/restore", response_model=ForgeApplianceRestoreResponse)
async def restore_appliance_backup(
    filename: str,
    payload: ForgeApplianceRestoreRequest,
    current_user: User = Depends(get_current_user),
):
    """Prepare ou applique une restauration appliance depuis une archive AOS."""
    _ = current_user
    safe_name = _safe_filename(filename, "backup.zip")
    if not safe_name.startswith("aos-backup-") or Path(safe_name).suffix.lower() != ".zip":
        raise HTTPException(status_code=400, detail="Archive de sauvegarde invalide")
    backup_path = BACKUP_DIR / safe_name
    try:
        resolved_backup = backup_path.resolve()
        resolved_root = BACKUP_DIR.resolve()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable") from None
    if resolved_root not in resolved_backup.parents or not resolved_backup.exists() or not resolved_backup.is_file():
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")

    restored: list[str] = []
    skipped: list[str] = []
    try:
        with zipfile.ZipFile(resolved_backup) as archive:
            if payload.restore_config:
                _restore_zip_member(archive, "data/pxe-config.json", PXE_CONFIG_PATH, restored, skipped, payload.dry_run)
            else:
                skipped.append("data/pxe-config.json: option desactivee")

            if payload.restore_profiles:
                _restore_zip_member(archive, "data/wim-recipes.json", WIM_RECIPES_PATH, restored, skipped, payload.dry_run)
                _restore_zip_member(archive, "data/wim-images.json", WIM_IMAGES_PATH, restored, skipped, payload.dry_run)
                _restore_zip_member(archive, "data/driver-packs.json", DRIVER_PACKS_PATH, restored, skipped, payload.dry_run)
                _restore_zip_member(archive, "data/unattend-profiles.json", UNATTEND_PROFILES_PATH, restored, skipped, payload.dry_run)
            else:
                skipped.append("profils: option desactivee")

            if payload.restore_audits:
                _restore_audit_members(archive, restored, skipped, payload.dry_run)
            else:
                skipped.append("audit/*.json: option desactivee")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Archive ZIP invalide") from None

    action = "Simulation restauration" if payload.dry_run else "Restauration appliquee"
    return ForgeApplianceRestoreResponse(
        backup=_backup_summary(resolved_backup),
        dry_run=payload.dry_run,
        restored=restored,
        skipped=skipped,
        message=f"{action}: {len(restored)} element(s) traite(s), {len(skipped)} ignore(s). Redemarrer les services seulement apres verification.",
    )


@router.post("/pxe/usb-kit", response_model=ForgeUsbKitResponse)
async def create_usb_kit(
    payload: ForgeUsbKitCreateRequest = Body(default_factory=ForgeUsbKitCreateRequest),
    current_user: User = Depends(get_current_user),
):
    """Genere un ZIP de preparation pour une cle USB atelier autonome."""
    _ = current_user
    config = _read_pxe_config()
    return _create_usb_kit_archive(config, payload.profile)


@router.get("/pxe/usb-kit", response_model=ForgeUsbKitListResponse)
async def list_usb_kits(
    current_user: User = Depends(get_current_user),
):
    """Liste les kits USB atelier deja generes."""
    _ = current_user
    config = _read_pxe_config()
    USB_KIT_DIR.mkdir(parents=True, exist_ok=True)
    kits = [
        _usb_kit_summary(path, config)
        for path in sorted(USB_KIT_DIR.glob("aos-usb-kit-*.zip"), key=lambda item: item.stat().st_mtime, reverse=True)
        if path.is_file()
    ]
    return ForgeUsbKitListResponse(
        kits=kits,
        total=len(kits),
        message=f"{len(kits)} kit(s) USB disponible(s).",
    )


@router.get("/pxe/usb-kit/{filename}/download")
async def download_usb_kit(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Telecharge une archive de cle USB atelier generee par AOS."""
    _ = current_user
    safe_name = _safe_filename(filename, "aos-usb-kit.zip")
    if not safe_name.startswith("aos-usb-kit-") or Path(safe_name).suffix.lower() != ".zip":
        raise HTTPException(status_code=400, detail="Archive USB invalide")
    kit_path = USB_KIT_DIR / safe_name
    try:
        resolved_path = kit_path.resolve()
        resolved_root = USB_KIT_DIR.resolve()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Kit USB introuvable") from None
    if resolved_root not in resolved_path.parents or not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Kit USB introuvable")
    return FileResponse(
        resolved_path,
        media_type="application/zip",
        filename=safe_name,
    )


@router.post("/pxe/wim-images/{image_id}/default", response_model=ForgeWimImage)
async def set_default_wim_image(
    image_id: str,
    current_user: User = Depends(get_current_user),
):
    """Definit l'image Windows par defaut pour les prochains deploiements."""
    _ = current_user
    images = _read_wim_images()
    selected: ForgeWimImage | None = None
    for image in images:
        image.is_default = image.id == image_id
        if image.is_default:
            selected = image
    if selected is None:
        raise HTTPException(status_code=404, detail="Image WIM introuvable")
    _write_wim_images(images)
    return selected


@router.delete("/pxe/wim-images/{image_id}", status_code=204)
async def delete_wim_image(
    image_id: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime une declaration d'image, sans effacer le fichier WIM physique."""
    _ = current_user
    images = _read_wim_images()
    remaining = [image for image in images if image.id != image_id]
    if len(remaining) == len(images):
        raise HTTPException(status_code=404, detail="Image WIM introuvable")
    if remaining and not any(image.is_default for image in remaining):
        remaining[0].is_default = True
    _write_wim_images(remaining)
    return None


@router.get("/pxe/driver-packs", response_model=list[ForgeDriverPack])
async def list_driver_packs(
    current_user: User = Depends(get_current_user),
):
    """Liste les packs pilotes connus par AOS Deploy."""
    _ = current_user
    return _dedupe_driver_packs(_read_driver_packs())


@router.post("/pxe/driver-packs", response_model=ForgeDriverPack, status_code=201)
async def create_driver_pack(
    payload: ForgeDriverPackCreate,
    current_user: User = Depends(get_current_user),
):
    """Declare un pack de pilotes utilisable par WinPE ou post-install."""
    _ = current_user
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Nom pack requis")
    if not payload.path.strip():
        raise HTTPException(status_code=400, detail="Chemin pack requis")
    if payload.category not in {"storage", "network", "chipset", "graphics", "other"}:
        raise HTTPException(status_code=400, detail="Categorie pilote invalide")
    packs = _read_driver_packs()
    existing = next((item for item in packs if _driver_pack_key(item) == _driver_pack_key(payload)), None)
    if existing:
        updated = existing.model_copy(update={**payload.model_dump(), "status": existing.status or "registered"})
        _write_driver_packs([updated if item.id == existing.id else item for item in packs])
        return updated
    pack = ForgeDriverPack(
        **payload.model_dump(),
        id=datetime.now(timezone.utc).strftime("drv-%Y%m%d%H%M%S"),
        status="registered",
        created_at=datetime.now(timezone.utc),
    )
    packs = [pack, *packs]
    _write_driver_packs(packs)
    return pack


@router.post("/pxe/driver-packs/{pack_id}/extract", response_model=ForgeDriverExtractResponse)
async def extract_driver_pack(
    pack_id: str,
    current_user: User = Depends(get_current_user),
):
    """Extrait un pack constructeur telecharge pour obtenir les drivers .inf injectables."""
    _ = current_user
    packs = _read_driver_packs()
    pack = next((item for item in packs if item.id == pack_id), None)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack pilote introuvable")

    result = _extract_driver_pack_files(pack)
    updated = pack.model_copy(update={
        "status": result["status"],
        "notes": f"{pack.notes or ''} | Extraction: {result['inf_count']} fichiers .inf".strip(" |"),
    })
    _write_driver_packs([updated if item.id == pack_id else item for item in packs])
    return ForgeDriverExtractResponse(
        pack=updated,
        extracted_path=str(result["path"]),
        inf_count=result["inf_count"],
        message=f"Extraction terminee: {result['inf_count']} fichiers .inf detectes.",
    )


@router.delete("/pxe/driver-packs/{pack_id}", status_code=204)
async def delete_driver_pack(
    pack_id: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime une declaration de pack, sans effacer les fichiers physiques."""
    _ = current_user
    packs = _read_driver_packs()
    remaining = [pack for pack in packs if pack.id != pack_id]
    if len(remaining) == len(packs):
        raise HTTPException(status_code=404, detail="Pack pilote introuvable")
    _write_driver_packs(remaining)
    return None


@router.get("/pxe/unattend-profiles", response_model=list[ForgeUnattendProfile])
async def list_unattend_profiles(
    current_user: User = Depends(get_current_user),
):
    """Liste les profils Unattend Windows."""
    _ = current_user
    return _read_unattend_profiles()


@router.post("/pxe/unattend-profiles", response_model=ForgeUnattendProfile, status_code=201)
async def create_unattend_profile(
    payload: ForgeUnattendProfileCreate,
    current_user: User = Depends(get_current_user),
):
    """Cree un profil autounattend.xml generable."""
    _ = current_user
    if payload.deployment_mode not in {"standard", "marketplace"}:
        raise HTTPException(status_code=400, detail="Mode deploiement invalide")
    if payload.auto_logon and not payload.create_local_account:
        raise HTTPException(status_code=400, detail="Auto-logon impossible sans compte local")
    profiles = _read_unattend_profiles()
    profile = ForgeUnattendProfile(
        **payload.model_dump(),
        id=datetime.now(timezone.utc).strftime("unattend-%Y%m%d%H%M%S"),
        is_default=len(profiles) == 0,
        created_at=datetime.now(timezone.utc),
    )
    _write_unattend_profiles([profile, *profiles])
    return profile


@router.post("/pxe/unattend-profiles/{profile_id}/default", response_model=ForgeUnattendProfile)
async def set_default_unattend_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Definit le profil Unattend par defaut."""
    _ = current_user
    profiles = _read_unattend_profiles()
    selected: ForgeUnattendProfile | None = None
    for profile in profiles:
        profile.is_default = profile.id == profile_id
        if profile.is_default:
            selected = profile
    if selected is None:
        raise HTTPException(status_code=404, detail="Profil Unattend introuvable")
    _write_unattend_profiles(profiles)
    return selected


@router.get("/pxe/unattend-profiles/{profile_id}/xml", response_class=PlainTextResponse)
async def get_unattend_profile_xml(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Retourne le fichier autounattend.xml du profil."""
    _ = current_user
    for profile in _read_unattend_profiles():
        if profile.id == profile_id:
            return PlainTextResponse(
                _generate_unattend_xml(profile),
                media_type="application/xml; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{profile.id}-autounattend.xml"'},
            )
    raise HTTPException(status_code=404, detail="Profil Unattend introuvable")


@router.delete("/pxe/unattend-profiles/{profile_id}", status_code=204)
async def delete_unattend_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime un profil Unattend."""
    _ = current_user
    profiles = _read_unattend_profiles()
    remaining = [profile for profile in profiles if profile.id != profile_id]
    if len(remaining) == len(profiles):
        raise HTTPException(status_code=404, detail="Profil Unattend introuvable")
    if remaining and not any(profile.is_default for profile in remaining):
        remaining[0].is_default = True
    _write_unattend_profiles(remaining)
    return None


@router.get("/pxe/deployment-profiles", response_model=list[ForgeDeploymentProfile])
async def list_deployment_profiles(
    current_user: User = Depends(get_current_user),
):
    """Liste les profils complets image + Unattend + drivers."""
    _ = current_user
    return [_hydrate_deployment_profile(profile) for profile in _read_deployment_profiles()]


@router.post("/pxe/deployment-profiles", response_model=ForgeDeploymentProfile, status_code=201)
async def create_deployment_profile(
    payload: ForgeDeploymentProfileCreate,
    current_user: User = Depends(get_current_user),
):
    """Cree un profil de deploiement reutilisable."""
    _ = current_user
    _validate_deployment_profile_payload(payload)
    profiles = _read_deployment_profiles()
    normalized_name = payload.name.strip().lower()
    if any(profile.name.strip().lower() == normalized_name for profile in profiles):
        raise HTTPException(status_code=409, detail="Un profil de deploiement porte deja ce nom")
    profile = ForgeDeploymentProfile(
        **payload.model_dump(),
        id=datetime.now(timezone.utc).strftime("deploy-%Y%m%d%H%M%S"),
        is_default=len(profiles) == 0,
        created_at=datetime.now(timezone.utc),
    )
    _write_deployment_profiles([profile, *profiles])
    return _hydrate_deployment_profile(profile)


@router.post("/pxe/deployment-profiles/{profile_id}/default", response_model=ForgeDeploymentProfile)
async def set_default_deployment_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Definit le profil de deploiement par defaut."""
    _ = current_user
    profiles = _read_deployment_profiles()
    selected: ForgeDeploymentProfile | None = None
    for profile in profiles:
        profile.is_default = profile.id == profile_id
        if profile.is_default:
            selected = profile
    if selected is None:
        raise HTTPException(status_code=404, detail="Profil de deploiement introuvable")
    _write_deployment_profiles(profiles)
    return _hydrate_deployment_profile(selected)


@router.delete("/pxe/deployment-profiles/{profile_id}", status_code=204)
async def delete_deployment_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
):
    """Supprime un profil de deploiement."""
    _ = current_user
    profiles = _read_deployment_profiles()
    remaining = [profile for profile in profiles if profile.id != profile_id]
    if len(remaining) == len(profiles):
        raise HTTPException(status_code=404, detail="Profil de deploiement introuvable")
    if remaining and not any(profile.is_default for profile in remaining):
        remaining[0].is_default = True
    _write_deployment_profiles(remaining)
    return None


@router.post("/agent/heartbeat", response_model=ForgeAgentHeartbeatResponse)
async def agent_heartbeat(
    payload: ForgeAgentHeartbeatRequest,
    x_forge_key: str = Header(..., alias="X-Forge-Key"),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _tenant_from_key(x_forge_key, db)
    LIVE_CLIENTS[payload.client_id] = {
        "tenant_id": tenant.id,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
    return ForgeAgentHeartbeatResponse(
        accepted=True,
        client_id=payload.client_id,
        message="Heartbeat agent recu",
    )


@agent_router.post("/heartbeat", response_model=ForgeAgentHeartbeatResponse)
async def public_agent_heartbeat(
    payload: ForgeAgentHeartbeatRequest,
):
    """Compatibilite agent PXE controle local sans cle d'ingestion."""
    LIVE_CLIENTS[payload.client_id] = {
        "tenant_id": "local-control",
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
    return ForgeAgentHeartbeatResponse(
        accepted=True,
        client_id=payload.client_id,
        message="Heartbeat control agent recu",
    )


@agent_router.get("/{client_id}/commands")
async def public_agent_commands(client_id: str):
    """Retourne les commandes en attente pour un agent PXE."""
    return AGENT_COMMANDS.pop(client_id, [])


@agent_router.post("/{client_id}/result")
async def public_agent_result(client_id: str, payload: dict = Body(default_factory=dict)):
    """Reçoit le resultat d'une commande agent PXE."""
    LIVE_CLIENTS.setdefault(client_id, {
        "tenant_id": "local-control",
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "payload": ForgeAgentHeartbeatRequest(client_id=client_id, state="live"),
    })
    LIVE_CLIENTS[client_id]["last_seen"] = datetime.now(timezone.utc).isoformat()
    LIVE_CLIENTS[client_id]["last_result"] = payload
    return {"accepted": True, "client_id": client_id}


@router.post("/pxe/actions", response_model=ForgeRemoteActionResponse)
async def pxe_action(
    payload: ForgeRemoteActionRequest,
    current_user: User = Depends(get_current_user),
):
    """PrÃ©pare une action distante.

    Le contrÃ´le effectif nÃ©cessite un agent cÃ´tÃ© WinPE/SystemRescue qui viendra
    rÃ©cupÃ©rer ces ordres ou ouvrir un canal VNC/RustDesk/SSH.
    """
    allowed = {"diag_express", "start_ssh", "open_tests", "reboot", "poweroff", "boot_diag", "boot_winpe", "wipe", "remote_shell", "remote_view"}
    if payload.action not in allowed:
        raise HTTPException(status_code=400, detail="Action PXE inconnue")
    AGENT_COMMANDS.setdefault(payload.client_id, []).append({
        "id": datetime.now(timezone.utc).strftime("cmd-%Y%m%d%H%M%S%f"),
        "action": payload.action,
        "target": payload.target,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return ForgeRemoteActionResponse(
        accepted=True,
        client_id=payload.client_id,
        action=payload.action,
        delivery="queued",
        message=(
            f"Action '{payload.action}' preparee par {current_user.email}. "
            "Elle sera lue par l'agent PXE au prochain polling."
        ),
    )


ModuleRegistry.register(ModuleManifest(
    slug="atelier_forge",
    name="Pont Atelier Forge (PXE)",
    version="1.0.0",
    description="Ingestion des audits materiels, certificats d'effacement et supervision PXE",
    router=router,
    nav_items=[NavItem(label="Controle PXE", path="/pxe", icon="monitor")],
    required_roles=["admin", "technician"],
))

ModuleRegistry.register(ModuleManifest(
    slug="atelier_agent_control",
    name="Agent PXE Control",
    version="1.0.0",
    description="Routes locales de compatibilite pour heartbeat et commandes agent PXE",
    router=agent_router,
    nav_items=[],
    required_roles=["admin", "technician"],
))

