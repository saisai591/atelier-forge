#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Signe automatiquement les nouveaux certificats d'effacement.
# Déclenché par l'unité systemd forge-sign.path quand CERT_DIR change.
# Installé dans ${DATA_ROOT}/bin par install.sh (avec sign.env à côté).
# =============================================================================
set -uo pipefail
BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${BIN}/sign.env"   # KEYS_DIR, CERT_DIR, SIGN_CERTS

shopt -s nullglob
for j in "${CERT_DIR}"/*.json; do
    case "$j" in *.signed.json) continue ;; esac
    [[ -f "${j%.json}.signed.json" ]] && continue     # déjà signé
    echo "Signature du certificat : $j"
    KEYS_DIR="${KEYS_DIR}" SIGN_CERTS="${SIGN_CERTS:-yes}" "${BIN}/make-certificate.sh" "$j" || true
done
