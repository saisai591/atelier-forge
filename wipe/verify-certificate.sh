#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Vérifie l'authenticité d'un certificat d'effacement signé.
#   Utilise la clé PUBLIQUE : exécutable par n'importe qui (client, auditeur).
#   Clé publique téléchargeable sur http://SERVEUR/forge-public-key.pem
#   Dépendances : openssl uniquement (pas de jq).
#
# Usage :
#   ./verify-certificate.sh <cert.signed.json>                 # clé locale
#   ./verify-certificate.sh <cert.signed.json> ma-cle-pub.pem  # clé fournie
# =============================================================================
set -euo pipefail
JSON="${1:?Usage: verify-certificate.sh <cert.signed.json> [cle-publique.pem]}"
PUB="${2:-}"
KEYS_DIR="${KEYS_DIR:-/var/lib/forge/keys}"
[[ -z "${PUB}" ]] && PUB="${KEYS_DIR}/forge-public-key.pem"

command -v openssl >/dev/null || { echo "openssl requis." >&2; exit 1; }
[[ -f "${JSON}" ]] || { echo "Introuvable : ${JSON}" >&2; exit 1; }
[[ -f "${PUB}"  ]] || { echo "Clé publique absente : ${PUB}" >&2; exit 1; }

getf() { grep -oP "\"$1\"\s*:\s*\"\K[^\"]*" "${JSON}" | head -1; }

payload="$(getf certificat_id)|$(getf disque_serie)|$(getf disque_modele)|$(getf methode)|$(getf resultat)|$(getf date_fin)"
sig="$(getf signature)"
token="$(getf signature_token)"
[[ -z "${sig}" ]] && { echo "INVALIDE : ce certificat n'est pas signé."; exit 2; }

tmp=$(mktemp)
printf '%s' "${sig}" | base64 -d > "${tmp}" 2>/dev/null || { echo "INVALIDE : signature illisible."; rm -f "${tmp}"; exit 2; }

if printf '%s' "${payload}" | openssl dgst -sha256 -verify "${PUB}" -signature "${tmp}" >/dev/null 2>&1; then
    rm -f "${tmp}"
    echo "================================================="
    echo " CERTIFICAT VALIDE  [OK]"
    echo " ID    : $(getf certificat_id)"
    echo " Serie : $(getf disque_serie)"
    echo " Token : ${token}"
    echo " La signature correspond : certificat authentique et non modifie."
    echo "================================================="
    exit 0
else
    rm -f "${tmp}"
    echo "================================================="
    echo " CERTIFICAT INVALIDE  [X]"
    echo " La signature ne correspond pas : document modifie ou mauvaise cle."
    echo "================================================="
    exit 1
fi
