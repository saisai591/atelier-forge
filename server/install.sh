#!/usr/bin/env bash
# =============================================================================
# Atelier Forge â€” Installation sur openSUSE MicroOS (Podman + Quadlet).
# Aucun paquet n'est installÃ© dans l'OS immuable : tout passe par des conteneurs.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUADLET_DIR="/etc/containers/systemd"

# --- VÃ©rifications prÃ©alables ---------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
    echo "ERREUR : lancez ce script en root (sudo ./install.sh)." >&2
    exit 1
fi
if ! command -v podman >/dev/null 2>&1; then
    echo "ERREUR : podman introuvable. Sur MicroOS il est normalement prÃ©sent." >&2
    echo "         Sinon : transactional-update pkg install podman && reboot" >&2
    exit 1
fi
if [[ ! -f "${SCRIPT_DIR}/config.env" ]]; then
    echo "ERREUR : config.env manquant. Faites :" >&2
    echo "         cp config.env.example config.env && \$EDITOR config.env" >&2
    exit 1
fi
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/config.env"
CONFIG_DIR="${DATA_ROOT}/config"
SAMBACREDS_FILE="${CONFIG_DIR}/samba/credentials.env"

# --- 0. VÃ©rifications prÃ©alables (preflight) -------------------------------
if ! "${SCRIPT_DIR}/preflight.sh" "${SCRIPT_DIR}/config.env"; then
    echo "ERREUR : configuration invalide (voir ci-dessus). Installation annulÃ©e." >&2
    exit 1
fi

echo "############################################################"
echo "# Installation Atelier Forge sur MicroOS"
echo "#   IP serveur     : ${SERVER_IP}"
echo "#   Interface      : ${PXE_INTERFACE}"
echo "#   Mode DHCP      : ${DHCP_MODE}"
echo "#   DonnÃ©es        : ${DATA_ROOT}"
echo "#   Imprimante     : ${LABEL_PRINTER_TYPE}"
echo "############################################################"

# --- 1. Construction des images Podman ------------------------------------
echo "==> Construction des images conteneurs"
podman build -t localhost/forge-dnsmasq:latest "${SCRIPT_DIR}/containers/dnsmasq"
podman build -t localhost/forge-samba:latest   "${SCRIPT_DIR}/containers/samba"
podman build -t localhost/forge-control-api:latest "${SCRIPT_DIR}/control-api"
echo "==> RÃ©cupÃ©ration de l'image nginx"
podman pull docker.io/library/nginx:stable
if [[ "${LABEL_PRINTER_TYPE}" == "cups" ]]; then
    echo "==> Construction de l'image CUPS (impression d'Ã©tiquettes, port ${CUPS_PORT:-1951})"
    podman build --build-arg CUPS_PORT="${CUPS_PORT:-1951}" \
        -t localhost/forge-cups:latest "${SCRIPT_DIR}/containers/cups"
fi

# --- 2. GÃ©nÃ©ration des configurations + menus -----------------------------
"${SCRIPT_DIR}/render-config.sh"
cat > "${SAMBACREDS_FILE}" <<EOF
SMB_USER=${SMB_USER}
SMB_PASSWORD=${SMB_PASSWORD}
EOF
chmod 600 "${SAMBACREDS_FILE}"

# --- 2b. ClÃ©s de signature des certificats d'effacement --------------------
KEYS_DIR="${KEYS_DIR:-${DATA_ROOT}/keys}"
if [[ "${SIGN_CERTS:-yes}" != "no" ]]; then
    echo "==> ClÃ©s de signature des certificats"
    mkdir -p "${KEYS_DIR}"; chmod 700 "${KEYS_DIR}"
    if [[ ! -f "${KEYS_DIR}/forge-sign.key" ]]; then
        if command -v openssl >/dev/null; then
            openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 \
                -out "${KEYS_DIR}/forge-sign.key" 2>/dev/null
            chmod 600 "${KEYS_DIR}/forge-sign.key"
            openssl pkey -in "${KEYS_DIR}/forge-sign.key" -pubout \
                -out "${KEYS_DIR}/forge-public-key.pem"
            echo "    - paire de clÃ©s crÃ©Ã©e dans ${KEYS_DIR}"
        else
            echo "    AVERTISSEMENT : openssl absent, signature dÃ©sactivÃ©e." >&2
        fi
    else
        echo "    - clÃ©s dÃ©jÃ  prÃ©sentes (conservÃ©es)."
    fi
    # Publie la clÃ© PUBLIQUE (tÃ©lÃ©chargeable pour vÃ©rification par des tiers).
    [[ -f "${KEYS_DIR}/forge-public-key.pem" ]] && \
        cp -f "${KEYS_DIR}/forge-public-key.pem" "${HTTP_ROOT}/forge-public-key.pem"

    # Installe les outils de signature + le signataire automatique (systemd).
    if [[ "${AUTO_SIGN:-yes}" == "yes" && -f "${KEYS_DIR}/forge-sign.key" ]]; then
        BIN="${DATA_ROOT}/bin"; mkdir -p "${BIN}"
        cp -f "${SCRIPT_DIR}/../wipe/make-certificate.sh" \
              "${SCRIPT_DIR}/../wipe/sign-certificate.sh" \
              "${SCRIPT_DIR}/../wipe/verify-certificate.sh" \
              "${SCRIPT_DIR}/../wipe/certificate-template.html" \
              "${SCRIPT_DIR}/sign-watch.sh" "${BIN}/"
        chmod +x "${BIN}/"*.sh
        cat > "${BIN}/sign.env" <<EOF
KEYS_DIR=${KEYS_DIR}
CERT_DIR=${CERT_DIR:-${SMB_SHARE}/certificates}
SIGN_CERTS=${SIGN_CERTS:-yes}
EOF
        sed "s|@CERT_DIR@|${CERT_DIR:-${SMB_SHARE}/certificates}|g" \
            "${SCRIPT_DIR}/systemd/forge-sign.path" > /etc/systemd/system/forge-sign.path
        sed "s|@BIN@|${BIN}|g" \
            "${SCRIPT_DIR}/systemd/forge-sign.service" > /etc/systemd/system/forge-sign.service
        echo "    - signataire automatique installÃ© (forge-sign.path)"
    fi
fi

# --- 3. TÃ©lÃ©chargement des binaires (iPXE, wimboot, memtest) ---------------
"${SCRIPT_DIR}/download-assets.sh" || \
    echo "AVERTISSEMENT : certains binaires manquent (voir ci-dessus)."

# --- 4. Installation des unitÃ©s Quadlet -----------------------------------
echo "==> Installation des unitÃ©s Quadlet dans ${QUADLET_DIR}"
mkdir -p "${QUADLET_DIR}"
install_unit() {  # install_unit <fichier.container>
    local src="${SCRIPT_DIR}/quadlet/$1"
    local dst="${QUADLET_DIR}/$1"
    sed -e "s|@TFTP_ROOT@|${TFTP_ROOT}|g" \
        -e "s|@HTTP_ROOT@|${HTTP_ROOT}|g" \
        -e "s|@SMB_SHARE@|${SMB_SHARE}|g" \
        -e "s|@DATA_ROOT@|${DATA_ROOT}|g" \
        -e "s|@CONFIG_DIR@|${CONFIG_DIR}|g" \
        -e "s|@SAMBACREDS@|${SAMBACREDS_FILE}|g" \
        "${src}" > "${dst}"
    echo "    - ${dst}"
}
install_unit forge-dnsmasq.container
install_unit forge-nginx.container
install_unit forge-samba.container
install_unit forge-control-api.container
if [[ "${LABEL_PRINTER_TYPE}" == "cups" ]]; then
    install_unit forge-cups.container
else
    rm -f "${QUADLET_DIR}/forge-cups.container"
fi

# --- 5. Pare-feu (firewalld, prÃ©sent par dÃ©faut sur MicroOS) ---------------
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    echo "==> Ouverture des ports dans le pare-feu"
    firewall-cmd --permanent --add-service=tftp        >/dev/null || true
    firewall-cmd --permanent --add-service=samba       >/dev/null || true
    firewall-cmd --permanent --add-port=67-69/udp      >/dev/null || true  # DHCP/proxyDHCP + TFTP
    firewall-cmd --permanent --add-port=137-138/udp    >/dev/null || true  # decouverte NetBIOS
    firewall-cmd --permanent --add-port=3702/udp       >/dev/null || true  # Windows WS-Discovery
    firewall-cmd --permanent --add-port=4011/udp       >/dev/null || true  # proxyDHCP (PXE)
    firewall-cmd --permanent --add-port="${HTTP_PORT:-1950}/tcp" >/dev/null || true  # HTTP iPXE/WinPE/tests
    firewall-cmd --permanent --add-port="${API_PORT:-1953}/tcp" >/dev/null || true   # API Control Center
    if [[ "${LABEL_PRINTER_TYPE}" == "cups" ]]; then
        firewall-cmd --permanent --add-port="${CUPS_PORT:-1951}/tcp" >/dev/null || true
    fi
    firewall-cmd --reload >/dev/null || true
else
    echo "AVERTISSEMENT : firewalld inactif. Ouvrez manuellement 67-69/udp, 4011/udp,"
    echo "                ${HTTP_PORT:-1950}/tcp (HTTP), 445/tcp (Samba), 137-138/udp et 3702/udp."
fi

# --- 6. DÃ©marrage des services --------------------------------------------
echo "==> Rechargement de systemd et dÃ©marrage des services"
systemctl daemon-reload
systemctl start forge-dnsmasq.service
systemctl start forge-nginx.service
systemctl start forge-samba.service
systemctl start forge-control-api.service
if [[ "${LABEL_PRINTER_TYPE}" == "cups" ]]; then
    systemctl start forge-cups.service
fi
if [[ "${AUTO_SIGN:-yes}" == "yes" && -f /etc/systemd/system/forge-sign.path ]]; then
    systemctl enable --now forge-sign.path 2>/dev/null || true
fi

echo ""
echo "############################################################"
echo "# Installation terminÃ©e."
echo "#"
echo "# VÃ©rification rapide :   ./scripts/check-server.sh"
echo "#"
echo "# ETAPES SUIVANTES :"
echo "#  1. Construire WinPE cote Windows     -> docs/WINPE.md"
echo "#     puis copier le dossier media dans ${HTTP_ROOT}/winpe/"
echo "#  2. Stockage reseau Windows          -> \\${SERVER_IP}\${SMB_SHARE_NAME}"
echo "#     Visible dans Explorateur > Reseau sous AOS-DEPLOY si la decouverte reseau Windows est active."
echo "#     ISO Windows / outils             -> ${SMB_SHARE}/iso/"
echo "#     Images WIM/ESD                   -> ${SMB_SHARE}/images/"
echo "#     Pilotes                          -> ${SMB_SHARE}/drivers/"
echo "#     Audits / etiquettes              -> ${SMB_SHARE}/audit/"
echo "#     Exports                          -> ${SMB_SHARE}/exports/"
echo "#  3. Demarrer une machine cible en reseau (F12) et choisir dans le menu."
echo "############################################################"
