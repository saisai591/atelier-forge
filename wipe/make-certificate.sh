#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Signe (si clé dispo) puis génère un certificat d'effacement
# imprimable (HTML, + PDF si dispo) à partir d'un certificat JSON.
#
# Usage : ./make-certificate.sh <certificat.json>
# Dépendances : openssl. PDF optionnel : wkhtmltopdf. QR optionnel : qrencode.
# Variables : KEYS_DIR (clés), SIGN_CERTS=yes|no.
# =============================================================================
set -euo pipefail
JSON_IN="${1:?Usage: make-certificate.sh <certificat.json>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYS_DIR="${KEYS_DIR:-/var/lib/forge/keys}"
SIGN_CERTS="${SIGN_CERTS:-yes}"
[[ -f "${JSON_IN}" ]] || { echo "Introuvable : ${JSON_IN}" >&2; exit 1; }

# --- 1. Signature (si activée et clé présente) -----------------------------
JSON="${JSON_IN}"
SIGSTATUS="NON SIGNÉ"
if [[ "${SIGN_CERTS}" != "no" && -f "${KEYS_DIR}/forge-sign.key" && "${JSON_IN}" != *.signed.json ]]; then
    KEYS_DIR="${KEYS_DIR}" "${HERE}/sign-certificate.sh" "${JSON_IN}" >/dev/null
    JSON="${JSON_IN%.json}.signed.json"
fi

g() { grep -oP "\"$1\"\s*:\s*\"\K[^\"]*" "${JSON}" | head -1; }
[[ -n "$(g signature)" ]] && SIGSTATUS="SIGNÉ NUMÉRIQUEMENT (RSA, SHA-256)"
OUT_HTML="${JSON%.json}.html"
TOKEN="$(g signature_token)"

# --- 2. QR code (ID + série + token, pour vérification rapide) -------------
QR_TAG=""
if command -v qrencode >/dev/null; then
    qrencode -o "${JSON%.json}.qr.png" -s 4 \
        "ID=$(g certificat_id);SN=$(g disque_serie);TOKEN=${TOKEN}"
    QR_TAG="<img class='qr' src='$(basename "${JSON%.json}.qr.png")' alt='QR'>"
fi

# --- 3. Rendu HTML ---------------------------------------------------------
sed -e "s|@ID@|$(g certificat_id)|g" \
    -e "s|@NORME@|$(g norme)|g" \
    -e "s|@SOC@|$(g societe)|g" \
    -e "s|@CONTACT@|$(g contact)|g" \
    -e "s|@OP@|$(g operateur)|g" \
    -e "s|@T0@|$(g date_debut)|g" \
    -e "s|@T1@|$(g date_fin)|g" \
    -e "s|@MODELE@|$(g disque_modele)|g" \
    -e "s|@SERIE@|$(g disque_serie)|g" \
    -e "s|@TAILLE@|$(g disque_taille)|g" \
    -e "s|@METHODE@|$(g methode)|g" \
    -e "s|@VERIF@|$(g verification)|g" \
    -e "s|@RESULTAT@|$(g resultat)|g" \
    -e "s|@HOTE@|$(g machine_hote_modele) ($(g machine_hote_serie))|g" \
    -e "s|@TOKEN@|${TOKEN:-—}|g" \
    -e "s|@SIGSTATUS@|${SIGSTATUS}|g" \
    -e "s|@QR@|${QR_TAG}|g" \
    "${HERE}/certificate-template.html" > "${OUT_HTML}"
echo "Certificat HTML : ${OUT_HTML}"
[[ -n "${TOKEN}" ]] && echo "Token de vérification : ${TOKEN}"

if command -v wkhtmltopdf >/dev/null; then
    wkhtmltopdf -q "${OUT_HTML}" "${JSON%.json}.pdf" && echo "Certificat PDF  : ${JSON%.json}.pdf"
fi
