#!/usr/bin/env bash
# AtelierOS Deploy - installateur appliance moderne.
#
# Usage depuis la racine du depot:
#   sudo bash scripts/install-atelieros-appliance.sh
#
# Ce script garde l'ancien socle PXE/SMB de server/install.sh quand disponible,
# puis force l'installation du dashboard React moderne. Il est idempotent.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERREUR: lancer avec sudo/root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> AtelierOS Deploy - installation appliance moderne"
echo "Depot: ${REPO_DIR}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERREUR: python3 est requis." >&2
  exit 1
fi

if ! id aos >/dev/null 2>&1; then
  echo "==> Creation utilisateur systeme aos"
  useradd --system --create-home --shell /bin/bash aos
fi

echo "==> Installation socle PXE/SMB si disponible"
if [[ -f "${REPO_DIR}/server/install.sh" ]]; then
  (
    cd "${REPO_DIR}/server"
    bash ./install.sh
  )
else
  echo "INFO: server/install.sh absent, socle PXE ignore."
fi

echo "==> Installation / reparation dashboard moderne"
bash "${REPO_DIR}/scripts/repair-dashboard-ui.sh"

echo "==> Verification services principaux"
for svc in aos-dashboard aos-backend forge-dnsmasq forge-nginx-pxe forge-samba forge-nginx forge-samba.service; do
  if systemctl list-unit-files "${svc}.service" "${svc}" >/dev/null 2>&1; then
    systemctl --no-pager --plain is-active "${svc}" 2>/dev/null || true
  fi
done

echo "==> Verification finale"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1/" >/dev/null
fi

cat <<'EOF'

Installation terminee.

A verifier depuis un poste atelier:
- Dashboard: http://IP_DU_SERVEUR/
- Menu PXE: http://IP_DU_SERVEUR:1950/boot/menu.ipxe
- Partage: \\IP_DU_SERVEUR\deploy

Si l'interface parait ancienne ou basique:
  sudo bash scripts/repair-dashboard-ui.sh
EOF
