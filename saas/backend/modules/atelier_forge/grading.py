"""Normalisation des audits PXE (Linux audit.sh / WinPE audit.ps1) et calcul de grade.

Le pont est TOLÃ‰RANT : les deux scripts d'audit ne produisent pas exactement les
mÃªmes clÃ©s. On extrait les champs clÃ©s quel que soit le format, et on conserve
l'audit brut tel quel dans `audit_data`.
"""
from typing import Any


def _first(d: dict[str, Any], *keys: str) -> Any:
    """Renvoie la premiÃ¨re clÃ© prÃ©sente et non vide parmi `keys`."""
    for k in keys:
        v = d.get(k)
        if v not in (None, "", "?"):
            return v
    return None


def normalize_audit(audit: dict[str, Any]) -> dict[str, Any]:
    """Extrait les champs normalisÃ©s depuis un audit Linux OU WinPE."""
    serial = _first(audit, "NumeroSerie", "Serial", "SerialNumber", "serial", "serial_number")
    brand = _first(audit, "Fabricant", "Marque", "Manufacturer", "brand")
    model = _first(audit, "Modele", "Model", "model")
    battery_wear = _first(audit, "Batterie_Usure_pct", "Batterie_Usure", "battery_wear")

    disks = audit.get("Disques") or audit.get("Disks") or audit.get("disks") or []
    if isinstance(disks, dict):  # WinPE peut sÃ©rialiser un seul disque en objet
        disks = [disks]

    return {
        "serial_number": str(serial) if serial is not None else None,
        "brand": str(brand) if brand is not None else None,
        "model": str(model) if model is not None else None,
        "battery_wear": _to_float(battery_wear),
        "disks": disks,
        "cpu": audit.get("cpu") or _first(audit, "CPU"),
        "ram": audit.get("ram") or _first(audit, "RAM_Go"),
        "network": audit.get("network") or [],
        "tpm": audit.get("tpm") or {},
    }


def _to_float(v: Any) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _disk_is_healthy(disk: dict[str, Any]) -> bool:
    """SantÃ© du disque, tolÃ©rante aux libellÃ©s Linux (PASSED) et WinPE (Healthy)."""
    health = str(_first(disk, "sante", "Sante", "Sante_SMART", "Health", "HealthStatus", "smart") or "").lower()
    if not health or health == "?":
        return True  # inconnu : ne pÃ©nalise pas
    return any(token in health for token in ("passed", "ok", "healthy", "bon"))


def compute_grade(normalized: dict[str, Any]) -> str:
    """Grade commercial A/B/C/D Ã  partir de l'usure batterie et de la santÃ© disque.

    - A : impeccable           - C : usure marquÃ©e / 1 dÃ©faut
    - B : bon, usure lÃ©gÃ¨re    - D : dÃ©faut matÃ©riel (disque non sain)
    """
    score = 0  # 0 = parfait ; plus c'est haut, plus c'est dÃ©gradÃ©

    wear = normalized.get("battery_wear")
    if wear is not None:
        if wear > 50:
            score += 3
        elif wear > 30:
            score += 2
        elif wear > 15:
            score += 1

    disks = normalized.get("disks") or []
    if any(not _disk_is_healthy(d) for d in disks if isinstance(d, dict)):
        score += 3  # disque non sain : dÃ©classe fortement

    if score == 0:
        return "A"
    if score == 1:
        return "B"
    if score <= 3:
        return "C"
    return "D"
