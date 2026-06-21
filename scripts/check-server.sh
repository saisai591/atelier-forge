#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Vérifie l'état du serveur (services, fichiers, ports).
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../server/config.env" 2>/dev/null || {
    echo "config.env introuvable." >&2; exit 1; }

ok()   { echo "  [ OK ] $*"; }
ko()   { echo "  [FAIL] $*"; FAILS=$((FAILS+1)); }
FAILS=0

echo "== Services systemd (Quadlet) =="
for svc in forge-dnsmasq forge-nginx forge-samba; do
    if systemctl is-active --quiet "${svc}.service"; then ok "${svc} actif"
    else ko "${svc} INACTIF (journalctl -u ${svc})"; fi
done

echo "== Conteneurs Podman =="
for c in forge-dnsmasq forge-nginx forge-samba; do
    if podman ps --format '{{.Names}}' 2>/dev/null | grep -qx "${c}"; then ok "${c} lancé"
    else ko "${c} non lancé"; fi
done

echo "== Fichiers de boot =="
for f in "${TFTP_ROOT}/undionly.kpxe" "${TFTP_ROOT}/ipxe.efi" \
         "${HTTP_ROOT}/boot/menu.ipxe" "${HTTP_ROOT}/winpe/wimboot"; do
    if [[ -s "${f}" ]]; then ok "présent : ${f}"; else ko "manquant : ${f}"; fi
done
if [[ -s "${HTTP_ROOT}/winpe/media/sources/boot.wim" ]]; then
    ok "WinPE présent (boot.wim)"
else
    echo "  [INFO] WinPE non déposé : voir docs/WINPE.md"
fi

echo "== Accès HTTP (port ${HTTP_PORT:-1950}) =="
if curl -fsS "http://${SERVER_IP}:${HTTP_PORT:-1950}/boot/menu.ipxe" >/dev/null 2>&1; then
    ok "http://${SERVER_IP}:${HTTP_PORT:-1950}/boot/menu.ipxe accessible"
else
    ko "menu iPXE inaccessible via HTTP (port ${HTTP_PORT:-1950})"
fi

echo "== Effacement / certificats =="
if [[ "${SIGN_CERTS:-yes}" != "no" ]]; then
    if [[ -f "${KEYS_DIR:-${DATA_ROOT}/keys}/forge-sign.key" ]]; then ok "clé de signature présente"
    else ko "clé de signature absente (relancez install.sh)"; fi
    if curl -fsS "http://${SERVER_IP}:${HTTP_PORT:-1950}/forge-public-key.pem" >/dev/null 2>&1; then
        ok "clé publique téléchargeable (vérification des certificats)"
    else ko "clé publique non publiée via HTTP"; fi
    if [[ "${AUTO_SIGN:-yes}" == "yes" ]]; then
        if systemctl is-enabled --quiet forge-sign.path 2>/dev/null; then ok "signature automatique active"
        else echo "  [INFO] signataire automatique non activé"; fi
    fi
fi

echo ""
if [[ "${FAILS}" -eq 0 ]]; then
    echo "==> Serveur opérationnel."
else
    echo "==> ${FAILS} problème(s) détecté(s). Voir docs/DEPANNAGE.md."
    exit 1
fi
