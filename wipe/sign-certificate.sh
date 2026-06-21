#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Signe numériquement un certificat d'effacement (JSON).
#   À exécuter SUR LE SERVEUR (la clé privée n'y quitte jamais l'hôte).
#   Produit <cert>.signed.json contenant la signature + un token vérifiable.
#
# La signature porte sur une chaîne canonique déterministe (indépendante du
# formatage JSON) : certificat infalsifiable, vérifiable par verify-certificate.sh.
# Dépendances : openssl uniquement (pas de jq).
#
# Usage : KEYS_DIR=/var/lib/forge/keys ./sign-certificate.sh <cert.json>
# =============================================================================
set -euo pipefail
JSON="${1:?Usage: sign-certificate.sh <cert.json>}"
KEYS_DIR="${KEYS_DIR:-/var/lib/forge/keys}"
PRIV="${KEYS_DIR}/forge-sign.key"

command -v openssl >/dev/null || { echo "openssl requis." >&2; exit 1; }
[[ -f "${JSON}" ]] || { echo "Introuvable : ${JSON}" >&2; exit 1; }
[[ -f "${PRIV}" ]] || { echo "Clé privée absente : ${PRIV} (lancez install.sh)" >&2; exit 1; }

# Extrait la valeur d'un champ JSON plat "cle": "valeur".
getf() { grep -oP "\"$1\"\s*:\s*\"\K[^\"]*" "${JSON}" | head -1; }

payload="$(getf certificat_id)|$(getf disque_serie)|$(getf disque_modele)|$(getf methode)|$(getf resultat)|$(getf date_fin)"
payload_escaped="$(printf '%s' "${payload}" | sed 's/"/\\"/g')"

sig=$(printf '%s' "${payload}" | openssl dgst -sha256 -sign "${PRIV}" | base64 | tr -d '\n')
token=$(printf '%s' "${sig}" | sha256sum | cut -c1-24 | tr 'a-f' 'A-F')

# Réécrit le JSON en ajoutant les champs de signature avant l'accolade finale.
content=$(cat "${JSON}")
content="${content%\}}"                 # retire la dernière }
content="${content%$'\n'}"              # retire le saut de ligne final
OUT="${JSON%.json}.signed.json"
printf '%s,\n  "signature_payload": "%s",\n  "signature": "%s",\n  "signature_token": "%s",\n  "public_key": "forge-public-key.pem"\n}\n' \
    "${content}" "${payload_escaped}" "${sig}" "${token}" > "${OUT}"

echo "Certificat signé : ${OUT}"
echo "Token de vérification : ${token}"
