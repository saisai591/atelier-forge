#!/usr/bin/env bash
# AtelierOS Deploy - repare / redeploie l'interface React moderne.
#
# Usage depuis la racine du depot:
#   sudo bash scripts/repair-dashboard-ui.sh
#
# Objectif:
# - compiler saas/frontend;
# - installer le build dans /opt/aos-dashboard;
# - installer spa_server.py;
# - creer/reparer le service systemd aos-dashboard;
# - verifier que le dashboard HTTP repond.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERREUR: lancer avec sudo/root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${REPO_DIR}/saas/frontend"
DIST_DIR="${FRONTEND_DIR}/dist"
SPA_SERVER_SRC="${REPO_DIR}/scripts/aos-dashboard-spa-server.py"
TARGET_DIR="${AOS_DASHBOARD_DIR:-/opt/aos-dashboard}"
SERVICE_FILE="/etc/systemd/system/aos-dashboard.service"
SERVICE_USER="${AOS_DASHBOARD_USER:-aos}"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "ERREUR: frontend introuvable: ${FRONTEND_DIR}" >&2
  exit 1
fi
if [[ ! -f "${SPA_SERVER_SRC}" ]]; then
  echo "ERREUR: spa_server source introuvable: ${SPA_SERVER_SRC}" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERREUR: npm est requis pour compiler l'interface React." >&2
  echo "Installe Node.js/npm puis relance ce script." >&2
  exit 1
fi

echo "==> Build frontend React"
(
  cd "${FRONTEND_DIR}"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build
)

test -f "${DIST_DIR}/index.html"
test -d "${DIST_DIR}/assets"

echo "==> Installation dashboard dans ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
if [[ -d "${TARGET_DIR}" ]]; then
  cp -a "${TARGET_DIR}" "${TARGET_DIR}.bak-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
fi
find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "${DIST_DIR}/." "${TARGET_DIR}/"
cp "${SPA_SERVER_SRC}" "${TARGET_DIR}/spa_server.py"

if id "${SERVICE_USER}" >/dev/null 2>&1; then
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${TARGET_DIR}"
else
  chown -R root:root "${TARGET_DIR}"
fi

echo "==> Service systemd aos-dashboard"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=AtelierOS Deploy Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${TARGET_DIR}
ExecStart=/usr/bin/python3 ${TARGET_DIR}/spa_server.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable aos-dashboard >/dev/null
systemctl restart aos-dashboard

echo "==> Verification"
sleep 2
systemctl --no-pager --plain is-active aos-dashboard
test -f "${TARGET_DIR}/index.html"
test -d "${TARGET_DIR}/assets"
test -f "${TARGET_DIR}/spa_server.py"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1/" >/dev/null
  echo "Dashboard HTTP OK: http://$(hostname -I 2>/dev/null | awk '{print $1}')/"
else
  echo "curl absent: service installe, verification HTTP manuelle requise."
fi

echo "==> Interface moderne AtelierOS redeployee."
