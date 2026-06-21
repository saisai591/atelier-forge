#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Désinstallation. Arrête les services et retire les unités Quadlet.
# Les DONNÉES (images, audits) sous DATA_ROOT ne sont PAS supprimées, sauf --purge.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUADLET_DIR="/etc/containers/systemd"

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERREUR : lancez ce script en root." >&2
    exit 1
fi
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/config.env" 2>/dev/null || true

echo "==> Arrêt des services Atelier Forge"
for svc in forge-dnsmasq forge-nginx forge-samba forge-cups; do
    systemctl stop "${svc}.service" 2>/dev/null || true
done

echo "==> Suppression des unités Quadlet"
rm -f "${QUADLET_DIR}/forge-"*.container
systemctl daemon-reload

echo "==> Suppression des images conteneurs"
podman rmi -f localhost/forge-dnsmasq:latest localhost/forge-samba:latest \
              localhost/forge-cups:latest 2>/dev/null || true

if [[ "${1:-}" == "--purge" && -n "${DATA_ROOT:-}" ]]; then
    echo "==> --purge : suppression des données ${DATA_ROOT}"
    rm -rf "${DATA_ROOT}"
else
    echo "==> Données conservées (${DATA_ROOT:-non défini}). Utilisez --purge pour tout effacer."
fi
echo "==> Désinstallation terminée."
