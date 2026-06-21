#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Suite de tests anti-régression (tout le projet).
#   Sans root, sans podman : vérifie syntaxe, génération de config, compatibilité
#   ascendante du config.env, et la chaîne signature -> vérification.
#   Utilisée par le CI GitHub Actions et par le hook SessionStart.
#
# Usage : bash tests/run-tests.sh
# Sortie : 0 si tout passe, 1 si au moins un test échoue.
# =============================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0; FAIL=0
ok()   { echo "  [ OK ] $*"; PASS=$((PASS+1)); }
ko()   { echo "  [FAIL] $*"; FAIL=$((FAIL+1)); }
sec()  { echo; echo "== $* =="; }

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

# ---------------------------------------------------------------------------
sec "1. Syntaxe de tous les scripts shell (bash -n)"
while IFS= read -r f; do
    if bash -n "$f" 2>/dev/null; then ok "bash -n $(basename "$f")"; else ko "syntaxe : $f"; fi
done < <(find "${REPO}" -name '*.sh' -not -path '*/.git/*')

# ---------------------------------------------------------------------------
sec "2. shellcheck (si disponible)"
if command -v shellcheck >/dev/null; then
    while IFS= read -r f; do
        if shellcheck -S error "$f" >/dev/null 2>&1; then ok "shellcheck $(basename "$f")"
        else ko "shellcheck (erreurs) : $f"; shellcheck -S error "$f" || true; fi
    done < <(find "${REPO}" -name '*.sh' -not -path '*/.git/*')
else
    echo "  [INFO] shellcheck absent, étape ignorée (installé en CI)."
fi

# ---------------------------------------------------------------------------
sec "3. config.env.example se source sans variable non définie (set -u)"
if ( set -u; # shellcheck disable=SC1091
     source "${REPO}/server/config.env.example"; \
     : "${SERVER_IP}${ERASE_METHOD}${SIGN_CERTS}${KEYS_DIR}${LABEL_PRINTER_TYPE}" ) 2>/dev/null; then
    ok "config.env.example complet"
else
    ko "config.env.example : variable manquante sous set -u"
fi

# ---------------------------------------------------------------------------
sec "4. render-config.sh : compatibilité ASCENDANTE (ancien config.env)"
# Copie isolée du repo + ancien config.env (SANS les variables récentes).
WORK="${TMP}/repo"; mkdir -p "${WORK}"
cp -r "${REPO}/server" "${REPO}/boot" "${REPO}/modules" "${REPO}/winpe" \
      "${REPO}/labels" "${REPO}/wipe" "${REPO}/webtests" "${WORK}/"
DATA="${TMP}/data"
cat > "${WORK}/server/config.env" <<EOF
SERVER_IP="192.168.1.10"
PXE_INTERFACE="eth0"
SUBNET="192.168.1.0"
DHCP_MODE="proxy"
DHCP_RANGE_START="192.168.1.100"
DHCP_RANGE_END="192.168.1.200"
DHCP_GATEWAY="192.168.1.1"
DHCP_DNS="192.168.1.1"
DHCP_NETMASK="255.255.255.0"
DATA_ROOT="${DATA}"
TFTP_ROOT="${DATA}/tftp"
HTTP_ROOT="${DATA}/http"
SMB_SHARE="${DATA}/deploy"
AUDIT_DIR="${DATA}/deploy/audit"
SMB_SHARE_NAME="deploy"
SMB_USER="pxe"
SMB_PASSWORD="pxe"
LABEL_PRINTER_TYPE="none"
LABEL_ZPL_HOST="192.168.1.50"
LABEL_ZPL_PORT="9100"
LABEL_CUPS_QUEUE="EtiquettesAtelier"
EOF
if bash "${WORK}/server/render-config.sh" >/dev/null 2>&1; then
    ok "render-config.sh (ancien config.env, mode proxy)"
else
    ko "render-config.sh échoue avec un ancien config.env (RÉGRESSION)"
fi

# Vérifie les sorties attendues
[[ -s "${DATA}/http/boot/menu.ipxe" ]] && ok "menu.ipxe généré" || ko "menu.ipxe absent"
[[ -s "${DATA}/config/dnsmasq/forge.conf" ]] && ok "dnsmasq généré" || ko "dnsmasq absent"
[[ -s "${DATA}/config/nginx/forge.conf" ]] && ok "nginx généré" || ko "nginx absent"
[[ -s "${DATA}/config/samba/smb.conf" ]] && ok "samba généré" || ko "samba absent"
grep -q 'proxy' "${DATA}/config/dnsmasq/forge.conf" && ok "dnsmasq en mode proxy" || ko "mode proxy manquant"
grep -q 'item wipe' "${DATA}/http/boot/menu.ipxe" && ok "entrée effacement dans le menu" || ko "entrée wipe manquante"
[[ -s "${DATA}/http/tests/index.html" ]] && ok "console de test web déployée" || ko "console de test web absente"

# Menu modulaire : assemblage des modules + en-têtes de section + corps
grep -q 'item winpe' "${DATA}/http/boot/menu.ipxe" && ok "module winpe assemblé" || ko "module winpe absent"
grep -q '== Système ==' "${DATA}/http/boot/menu.ipxe" && ok "en-tête de section généré" || ko "section non générée"
grep -q '^:wipe' "${DATA}/http/boot/menu.ipxe" && ok "corps de module inséré (:wipe)" || ko "corps de module manquant"
grep -q '^#!ipxe' "${DATA}/http/boot/menu.ipxe" && ok "menu commence par #!ipxe" || ko "shebang iPXE manquant"
# Un module désactivé (enabled: no) ne doit PAS apparaître
DISMOD="${WORK}/modules/99-zztest.ipxe"
printf '# item: zztest  Test désactivé\n# enabled: no\n:zztest\nshell\n' > "${DISMOD}"
bash "${WORK}/server/render-config.sh" >/dev/null 2>&1
grep -q 'zztest' "${DATA}/http/boot/menu.ipxe" && ko "module désactivé apparaît (bug)" || ok "module désactivé bien exclu"
rm -f "${DISMOD}"

# Aucun jeton de template laissé dans les sorties
if grep -rIlE '__SERVER_IP__|__HTTP_PORT__|@CERT_DIR@|@BIN@|@SMB_USER@' "${DATA}/http" "${DATA}/config" 2>/dev/null | grep -q .; then
    ko "jeton de template non substitué dans les sorties"
else
    ok "aucun jeton de template résiduel"
fi
# Port HTTP (1950 par défaut) propagé dans le menu, nginx et dnsmasq
grep -q 'http://192.168.1.10:1950' "${DATA}/http/boot/menu.ipxe" && ok "menu iPXE pointe sur le port 1950" || ko "port HTTP absent du menu"
grep -q 'listen 1950' "${DATA}/config/nginx/forge.conf" && ok "nginx écoute sur 1950" || ko "nginx pas sur 1950"
grep -q ':1950/boot/menu.ipxe' "${DATA}/config/dnsmasq/forge.conf" && ok "dnsmasq chaîne sur le port 1950" || ko "dnsmasq port HTTP absent"

# ---------------------------------------------------------------------------
sec "5. render-config.sh : mode standalone"
sed -i 's/DHCP_MODE="proxy"/DHCP_MODE="standalone"/' "${WORK}/server/config.env"
if bash "${WORK}/server/render-config.sh" >/dev/null 2>&1 && \
   grep -q 'dhcp-range=192.168.1.100,192.168.1.200' "${DATA}/config/dnsmasq/forge.conf"; then
    ok "render-config.sh (mode standalone)"
else
    ko "mode standalone cassé"
fi

# ---------------------------------------------------------------------------
sec "6. Signature -> vérification des certificats (bout en bout)"
if command -v openssl >/dev/null; then
    KD="${TMP}/keys"; mkdir -p "${KD}"
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${KD}/forge-sign.key" 2>/dev/null
    openssl pkey -in "${KD}/forge-sign.key" -pubout -out "${KD}/forge-public-key.pem" 2>/dev/null
    cat > "${TMP}/c.json" <<'JSON'
{
  "certificat_id": "FORGE-TEST-0001",
  "disque_serie": "SN-TEST-123",
  "disque_modele": "TEST SSD",
  "methode": "ATA Secure Erase",
  "resultat": "SUCCÈS",
  "date_fin": "2026-06-18 12:00:00"
}
JSON
    KEYS_DIR="${KD}" bash "${REPO}/wipe/sign-certificate.sh" "${TMP}/c.json" >/dev/null 2>&1
    if [[ -f "${TMP}/c.signed.json" ]]; then ok "signature produite"
    else ko "signature non produite"; fi

    if KEYS_DIR="${KD}" bash "${REPO}/wipe/verify-certificate.sh" "${TMP}/c.signed.json" >/dev/null 2>&1; then
        ok "certificat authentique -> VALIDE"
    else
        ko "certificat authentique rejeté (RÉGRESSION signature)"
    fi

    sed 's/SN-TEST-123/SN-FALSIFIE/' "${TMP}/c.signed.json" > "${TMP}/c.tampered.json"
    if KEYS_DIR="${KD}" bash "${REPO}/wipe/verify-certificate.sh" "${TMP}/c.tampered.json" >/dev/null 2>&1; then
        ko "certificat FALSIFIÉ accepté (FAILLE !)"
    else
        ok "certificat falsifié -> INVALIDE"
    fi
else
    echo "  [INFO] openssl absent, tests de signature ignorés."
fi

# ---------------------------------------------------------------------------
sec "7. preflight.sh : validation de la configuration"
if bash "${REPO}/server/preflight.sh" "${REPO}/server/config.env.example" >/dev/null 2>&1; then
    ok "preflight accepte config.env.example"
else
    ko "preflight rejette config.env.example (RÉGRESSION)"
fi
# Cas négatif : une IP serveur invalide doit être refusée.
BADCONF="${TMP}/bad.env"
sed 's/SERVER_IP="192.168.1.10"/SERVER_IP="999.999.0.1"/' \
    "${REPO}/server/config.env.example" > "${BADCONF}"
if bash "${REPO}/server/preflight.sh" "${BADCONF}" >/dev/null 2>&1; then
    ko "preflight accepte une IP invalide (validation cassée)"
else
    ok "preflight refuse une IP serveur invalide"
fi

# ---------------------------------------------------------------------------
echo
echo "==================================================="
echo "  Résultat : ${PASS} réussis, ${FAIL} échoués"
echo "==================================================="
[[ "${FAIL}" -eq 0 ]] || exit 1
