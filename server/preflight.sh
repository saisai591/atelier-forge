#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Vérifications préalables (preflight) de config.env.
#   Détecte les erreurs de configuration AVANT l'installation, pour éviter
#   un serveur mal configuré. Appelé automatiquement par install.sh.
#
# Usage : ./preflight.sh [chemin/config.env]
# Sortie : 0 si OK (warnings tolérés), 1 si une erreur CRITIQUE est trouvée.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${1:-${SCRIPT_DIR}/config.env}"
ERR=0

err()  { echo "  [ERREUR] $*"; ERR=$((ERR+1)); }
warn() { echo "  [ATTENTION] $*"; }
ok()   { echo "  [ OK ] $*"; }

is_ipv4() {
    local ip="$1" o
    [[ "$ip" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
    for o in "${BASH_REMATCH[@]:1}"; do [[ "$o" -le 255 ]] || return 1; done
    return 0
}

echo "== Vérifications préalables (config: ${CONF}) =="
if [[ ! -f "${CONF}" ]]; then
    err "config.env introuvable (cp config.env.example config.env)"
    exit 1
fi
# shellcheck disable=SC1090
source "${CONF}"

# --- Critères CRITIQUES (purs, testables) ----------------------------------
if is_ipv4 "${SERVER_IP:-}"; then ok "SERVER_IP valide (${SERVER_IP})"
else err "SERVER_IP invalide : '${SERVER_IP:-}' (attendu : ex. 192.168.1.10)"; fi

case "${DHCP_MODE:-}" in
    proxy|standalone) ok "DHCP_MODE = ${DHCP_MODE}" ;;
    *) err "DHCP_MODE invalide : '${DHCP_MODE:-}' (proxy ou standalone)" ;;
esac

if [[ "${DHCP_MODE:-}" == "standalone" ]]; then
    is_ipv4 "${DHCP_RANGE_START:-}" || err "DHCP_RANGE_START invalide"
    is_ipv4 "${DHCP_RANGE_END:-}"   || err "DHCP_RANGE_END invalide"
fi

case "${ERASE_METHOD:-auto}" in
    auto|nvme-sanitize|ata-secure|crypto|overwrite) ok "ERASE_METHOD = ${ERASE_METHOD:-auto}" ;;
    *) err "ERASE_METHOD invalide : '${ERASE_METHOD}'" ;;
esac

case "${LABEL_PRINTER_TYPE:-none}" in
    none|zpl|cups) ok "LABEL_PRINTER_TYPE = ${LABEL_PRINTER_TYPE:-none}" ;;
    *) err "LABEL_PRINTER_TYPE invalide : '${LABEL_PRINTER_TYPE}' (none|zpl|cups)" ;;
esac

# Ports configurables (HTTP/CUPS). Les ports PXE (67/69/4011) et SMB (445)
# sont imposés par la norme et ne sont pas vérifiés ici.
for p in "${HTTP_PORT:-1950}" "${CUPS_PORT:-1951}"; do
    if [[ "${p}" =~ ^[0-9]+$ && "${p}" -ge 1 && "${p}" -le 65535 ]]; then :
    else err "port invalide : '${p}' (1-65535)"; fi
done
if [[ "${HTTP_PORT:-1950}" =~ ^[0-9]+$ && "${HTTP_PORT:-1950}" -ne 67 && "${HTTP_PORT:-1950}" -ne 69 && "${HTTP_PORT:-1950}" -ne 445 && "${HTTP_PORT:-1950}" -ne 4011 ]]; then
    ok "HTTP_PORT = ${HTTP_PORT:-1950}"
else
    err "HTTP_PORT=${HTTP_PORT:-1950} entre en conflit avec un port PXE/SMB réservé."
fi

# --- Critères d'ENVIRONNEMENT (avertissements, dépendent de la machine) -----
if command -v ip >/dev/null 2>&1; then
    if ip -brief link show "${PXE_INTERFACE:-}" >/dev/null 2>&1; then
        ok "interface réseau ${PXE_INTERFACE} présente"
    else
        warn "interface '${PXE_INTERFACE:-}' introuvable (vérifiez : ip -brief address)"
    fi
fi

if [[ "${SIGN_CERTS:-yes}" != "no" ]] && ! command -v openssl >/dev/null 2>&1; then
    warn "openssl absent : la signature des certificats sera désactivée."
fi

# Espace disque sur le point de montage des données (>= 10 Go conseillé).
if [[ -n "${DATA_ROOT:-}" ]]; then
    base="${DATA_ROOT}"; while [[ ! -d "${base}" && "${base}" != "/" ]]; do base="$(dirname "${base}")"; done
    if command -v df >/dev/null 2>&1; then
        avail_kb=$(df -Pk "${base}" 2>/dev/null | awk 'NR==2{print $4}')
        if [[ -n "${avail_kb:-}" && "${avail_kb}" -lt 10485760 ]]; then
            warn "moins de 10 Go libres sous ${base} (images Windows volumineuses)."
        else
            ok "espace disque suffisant sous ${base}"
        fi
    fi
fi

echo
if [[ "${ERR}" -eq 0 ]]; then
    echo "==> Vérifications préalables : OK"
    exit 0
else
    echo "==> ${ERR} erreur(s) critique(s) : corrigez config.env avant d'installer."
    exit 1
fi
