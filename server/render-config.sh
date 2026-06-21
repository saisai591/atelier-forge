#!/usr/bin/env bash
# =================================================================================
# AtelierOS — Génère les fichiers de configuration des services et les menus iPXE
# à partir de config.env. Idempotent : peut être relancé à volonté.
# =================================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# --- Chargement de la configuration ---------------------------------------
if [[ ! -f "${SCRIPT_DIR}/config.env" ]]; then
    echo "ERREUR : ${SCRIPT_DIR}/config.env introuvable." >&2
    echo "        Copiez config.env.example en config.env et adaptez-le." >&2
    exit 1
fi
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/config.env"

CONFIG_DIR="${DATA_ROOT}/config"
HTTP_PORT="${HTTP_PORT:-1950}"   # défaut si config.env ancien (compat ascendante)

echo "==> Génération des configurations dans ${CONFIG_DIR}"
mkdir -p "${CONFIG_DIR}/dnsmasq" "${CONFIG_DIR}/nginx" "${CONFIG_DIR}/samba" "${CONFIG_DIR}/cups"
mkdir -p "${TFTP_ROOT}" "${HTTP_ROOT}/boot" "${HTTP_ROOT}/winpe" "${HTTP_ROOT}/diag" \
         "${SMB_SHARE}" "${AUDIT_DIR}" "${CERT_DIR:-${SMB_SHARE}/certificates}" \
         "${SMB_SHARE}/drivers" "${SMB_SHARE}/images" "${SMB_SHARE}/iso" \
         "${SMB_SHARE}/incoming" "${SMB_SHARE}/exports" "${SMB_SHARE}/logs" \
         "${SMB_SHARE}/scripts" "${SMB_SHARE}/wipe"

# --- Arborescence stockage réseau -----------------------------------------
# Ce partage est le point de dépôt client/atelier :
#   \\SERVEUR\deploy\iso      -> ISO Windows / utilitaires
#   \\SERVEUR\deploy\images   -> WIM/ESD prêts au déploiement
#   \\SERVEUR\deploy\drivers  -> packs pilotes
#   \\SERVEUR\deploy\audit    -> retours audit + étiquettes
#   \\SERVEUR\deploy\exports  -> exports inventaire / rapports
cat > "${SMB_SHARE}/README-ATELIEROS-DEPLOY.txt" <<EOF
AtelierOS Deploy - Stockage reseau
==================================

Depuis Windows : \\\\${SERVER_IP}\\${SMB_SHARE_NAME}
Utilisateur    : ${SMB_USER}

Dossiers :
- iso/          Deposer les ISO Windows, WinPE, outils constructeurs.
- images/       Deposer les images install.wim / install.esd pretes.
- drivers/      Deposer les pilotes par marque/modele ou generiques.
- audit/        Audits rapides, etiquettes et rapports machines.
- certificates/ Certificats d'effacement signes.
- incoming/     Depot temporaire avant classement.
- exports/      Exports inventaire, rapports client, etiquettes.
- scripts/      Scripts utilises par WinPE/SystemRescue.

Conseil : garder les noms simples, sans accents, sans espaces si possible.
EOF

cat > "${SMB_SHARE}/iso/README.txt" <<EOF
Deposez ici les ISO Windows ou outils constructeur.
Exemples :
- Windows_11_24H2.iso
- Windows_10_22H2.iso
- Dell_DriverPack.iso
EOF

cat > "${SMB_SHARE}/images/README.txt" <<EOF
Deposez ici les images Windows pretes au deploiement.
Formats attendus : .wim ou .esd
Exemples :
- win11-pro-24h2.wim
- win10-pro-22h2.esd
EOF

cat > "${SMB_SHARE}/drivers/README.txt" <<EOF
Deposez ici les packs pilotes.
Structure conseillee :
- drivers/generic/network/
- drivers/generic/storage/
- drivers/dell/latitude-5420/
- drivers/hp/elitebook-840-g8/
EOF

cat > "${SMB_SHARE}/incoming/README.txt" <<EOF
Depot temporaire. Placez ici les fichiers a trier avant de les ranger dans
iso/, images/ ou drivers/.
EOF

chmod -R ug+rwX "${SMB_SHARE}" 2>/dev/null || true
chmod 0777 "${AUDIT_DIR}" 2>/dev/null || true
chmod 0777 \
    "${SMB_SHARE}/iso" \
    "${SMB_SHARE}/images" \
    "${SMB_SHARE}/drivers" \
    "${SMB_SHARE}/incoming" \
    "${SMB_SHARE}/exports" \
    "${SMB_SHARE}/logs" \
    "${CERT_DIR:-${SMB_SHARE}/certificates}" 2>/dev/null || true

# --- dnsmasq ---------------------------------------------------------------
DNSMASQ_CONF="${CONFIG_DIR}/dnsmasq/forge.conf"
{
    echo "# AtelierOS dnsmasq — généré automatiquement. Ne pas éditer à la main."
    echo "# Régénéré par render-config.sh à partir de config.env."
    echo "port=0                 # Désactive le serveur DNS (la box garde le DNS)."
    echo "log-dhcp"
    echo "interface=${PXE_INTERFACE}"
    echo "enable-tftp"
    echo "tftp-root=/srv/tftp"
    echo "tftp-no-fail"
    echo ""
    if [[ "${DHCP_MODE}" == "proxy" ]]; then
        echo "# --- Mode proxyDHCP : n'attribue PAS d'IP, cohabite avec la box. ---"
        echo "dhcp-range=${SUBNET},proxy"
    else
        echo "# --- Mode standalone : ce serveur attribue les IP (réseau isolé !). ---"
        echo "dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},${DHCP_NETMASK},12h"
        echo "dhcp-option=option:router,${DHCP_GATEWAY}"
        echo "dhcp-option=option:dns-server,${DHCP_DNS}"
    fi
    echo ""
    echo "# --- Détection de l'architecture du client (option 93) ---"
    echo "dhcp-match=set:bios,option:client-arch,0       # BIOS x86 (PXE legacy)"
    echo "dhcp-match=set:efi32,option:client-arch,6      # UEFI x86 32 bits"
    echo "dhcp-match=set:efix64,option:client-arch,7     # UEFI x64"
    echo "dhcp-match=set:efix64,option:client-arch,9     # UEFI x64 (EBC)"
    echo ""
    echo "# Détecte si iPXE est déjà chargé (il s'annonce via l'option 175)."
    echo "dhcp-match=set:ipxe,175"
    echo ""
    echo "# 1er chargement (ROM PXE) -> binaire iPXE par TFTP selon l'archi :"
    echo "dhcp-boot=tag:bios,tag:!ipxe,undionly.kpxe"
    echo "dhcp-boot=tag:efi32,tag:!ipxe,ipxe32.efi"
    echo "dhcp-boot=tag:efix64,tag:!ipxe,ipxe.efi"
    echo ""
    echo "# 2e chargement (iPXE en cours) -> menu via HTTP (rapide & fiable) :"
    echo "dhcp-boot=tag:ipxe,http://${SERVER_IP}:${HTTP_PORT}/boot/menu.ipxe"
    echo ""
    echo 'pxe-prompt="AtelierOS Deploy - Reconditionnement",1'
} > "${DNSMASQ_CONF}"
echo "    - dnsmasq : ${DNSMASQ_CONF} (mode ${DHCP_MODE})"

# --- nginx -----------------------------------------------------------------
cat > "${CONFIG_DIR}/nginx/forge.conf" <<'NGINX'
# AtelierOS nginx — sert les menus iPXE, WinPE (wimboot) et les outils de diag.
server {
    listen __HTTP_PORT__ default_server;
    listen [::]:__HTTP_PORT__ default_server;
    server_name _;
    root /usr/share/nginx/html;

    # Gros fichiers (.wim) : transfert efficace.
    sendfile on;
    tcp_nopush on;
    autoindex on;

    # Les scripts iPXE doivent être servis en texte brut.
    location ~ \.ipxe$ {
        default_type text/plain;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    # Audits produits par les machines PXE (lecture seule).
    location /audit/ {
        alias /srv/deploy/audit/;
        autoindex on;
        default_type application/json;
        add_header Cache-Control "no-store";
    }
}
NGINX
sed -i "s/__HTTP_PORT__/${HTTP_PORT}/g" "${CONFIG_DIR}/nginx/forge.conf"
echo "    - nginx   : ${CONFIG_DIR}/nginx/forge.conf (port ${HTTP_PORT})"

# --- Samba -----------------------------------------------------------------
cat > "${CONFIG_DIR}/samba/smb.conf" <<SAMBA
# AtelierOS Samba — généré automatiquement.
[global]
   workgroup = WORKGROUP
   netbios name = AOS-DEPLOY
   server string = AtelierOS Deploy
   security = user
   map to guest = never
   server min protocol = SMB2
   log level = 1
   smb ports = 445 139
   local master = yes
   preferred master = yes
   os level = 65
   name resolve order = bcast host

[${SMB_SHARE_NAME}]
   comment = Images Windows, pilotes et rapports d'audit
   path = /srv/deploy
   browseable = yes
   read only = no
   valid users = ${SMB_USER}
   force user = ${SMB_USER}
   create mask = 0664
   directory mask = 0775
SAMBA
echo "    - samba   : ${CONFIG_DIR}/samba/smb.conf"

# --- Menu iPXE MODULAIRE ---------------------------------------------------
# Assemblé à partir de fragments + des modules activés dans modules/ :
#   menu.head + (items) + menu.choose + (corps des modules) + menu.tail
# Ajouter une entrée = déposer un fichier modules/NN-xxx.ipxe (voir modules/00-exemple).
MENU_TMP="$(mktemp)"
cat "${REPO_DIR}/boot/menu.head.ipxe" > "${MENU_TMP}"

# Liste des modules activés (triés par nom de fichier).
mods=()
for m in "${REPO_DIR}"/modules/*.ipxe; do
    [[ -e "$m" ]] || continue
    en="$(grep -m1 '^# enabled:' "$m" | sed 's/^# enabled:[[:space:]]*//')"
    [[ "$(printf '%s' "${en}" | tr 'A-Z' 'a-z')" == "no" ]] && continue
    mods+=("$m")
done

# 1) Entrées de menu (avec en-têtes de section)
prev_section=""
for m in "${mods[@]}"; do
    section="$(grep -m1 '^# section:' "$m" | sed 's/^# section:[[:space:]]*//')"
    item="$(grep -m1 '^# item:' "$m" | sed 's/^# item:[[:space:]]*//')"
    if [[ -n "${section}" && "${section}" != "${prev_section}" ]]; then
        printf 'item --gap -- == %s ==\n' "${section}" >> "${MENU_TMP}"
        prev_section="${section}"
    fi
    [[ -n "${item}" ]] && printf 'item %s\n' "${item}" >> "${MENU_TMP}"
done

# 2) Sélecteur
cat "${REPO_DIR}/boot/menu.choose.ipxe" >> "${MENU_TMP}"

# 3) Corps des modules (sans les lignes de métadonnées)
for m in "${mods[@]}"; do
    grep -v '^# \(section\|item\|enabled\):' "$m" >> "${MENU_TMP}"
    echo >> "${MENU_TMP}"
done

# 4) Pied + substitution des jetons
cat "${REPO_DIR}/boot/menu.tail.ipxe" >> "${MENU_TMP}"
sed -e "s|__SERVER_IP__|${SERVER_IP}|g" \
    -e "s|__HTTP_PORT__|${HTTP_PORT}|g" \
    -e "s|__SMB_USER__|${SMB_USER}|g" \
    -e "s|__SMB_PASSWORD__|${SMB_PASSWORD}|g" "${MENU_TMP}" \
    > "${HTTP_ROOT}/boot/menu.ipxe"
rm -f "${MENU_TMP}"
echo "    - menu    : ${HTTP_ROOT}/boot/menu.ipxe (${#mods[@]} modules activés)"

# --- Console de test web -> HTTP (servie par nginx sur http://SERVEUR/tests/) -
mkdir -p "${HTTP_ROOT}/tests"
cp -f "${REPO_DIR}/webtests/"* "${HTTP_ROOT}/tests/" 2>/dev/null || true
echo "    - console de test web : http://${SERVER_IP}:${HTTP_PORT}/tests/"

# --- App technicien simple -> HTTP -----------------------------------------
mkdir -p "${HTTP_ROOT}/tech"
cp -f "${REPO_DIR}/webtech/"* "${HTTP_ROOT}/tech/" 2>/dev/null || true
echo "    - app technicien : http://${SERVER_IP}:${HTTP_PORT}/tech/"

# --- Control Center technicien -> HTTP -------------------------------------
mkdir -p "${HTTP_ROOT}/control"
cp -f "${REPO_DIR}/webcontrol/"* "${HTTP_ROOT}/control/" 2>/dev/null || true
echo "    - control center : http://${SERVER_IP}:${HTTP_PORT}/control/"

# --- Scripts technicien WinPE -> partage Samba -----------------------------
# (Stockés sur le partage : modifiables sans reconstruire l'image WinPE.)
cp -f "${REPO_DIR}/winpe/scripts/"* "${SMB_SHARE}/scripts/" 2>/dev/null || true
echo "    - scripts WinPE copiés dans ${SMB_SHARE}/scripts/"

# --- Agent live SystemRescue -> HTTP ---------------------------------------
# Exécuté via ar_source=... au boot du module diagnostic.
mkdir -p "${HTTP_ROOT}/agent"
cp -f "${REPO_DIR}/server/agent/"* "${HTTP_ROOT}/agent/" 2>/dev/null || true
chmod +x "${HTTP_ROOT}/agent"/autorun* 2>/dev/null || true
echo "    - agent SystemRescue : http://${SERVER_IP}:${HTTP_PORT}/agent/autorun"

# Outils de génération d'étiquette côté partage (utile en mode CUPS).
mkdir -p "${SMB_SHARE}/scripts/labels"
cp -f "${REPO_DIR}/labels/"* "${SMB_SHARE}/scripts/labels/" 2>/dev/null || true

# --- label.env : config d'impression lue par l'audit WinPE -----------------
cat > "${SMB_SHARE}/scripts/label.env" <<LBL
# Généré par render-config.sh — lu par winpe/scripts/audit.ps1.
LABEL_PRINTER_TYPE=${LABEL_PRINTER_TYPE}
LABEL_ZPL_HOST=${LABEL_ZPL_HOST}
LABEL_ZPL_PORT=${LABEL_ZPL_PORT}
LABEL_CUPS_QUEUE=${LABEL_CUPS_QUEUE}
LBL
echo "    - label.env : ${SMB_SHARE}/scripts/label.env (${LABEL_PRINTER_TYPE})"

# --- Module d'effacement -> partage Samba ----------------------------------
cp -f "${REPO_DIR}/wipe/"* "${SMB_SHARE}/wipe/" 2>/dev/null || true
echo "    - scripts d'effacement copiés dans ${SMB_SHARE}/wipe/"

# forge.env : config lue par secure-erase.sh (Linux/SystemRescue).
# CERT_DIR est ici le chemin VU DEPUIS LE LIVE (partage monté sur /mnt/deploy).
cat > "${SMB_SHARE}/scripts/forge.env" <<ENV
# Généré par render-config.sh — lu par wipe/secure-erase.sh.
ERASE_METHOD=${ERASE_METHOD:-auto}
CERT_DIR=/mnt/deploy/certificates
COMPANY_NAME=${COMPANY_NAME:-Atelier}
COMPANY_CONTACT=${COMPANY_CONTACT:-}
ENV

# company.env : coordonnées société lues par winpe/scripts/wipe.ps1.
cat > "${SMB_SHARE}/scripts/company.env" <<CENV
COMPANY_NAME=${COMPANY_NAME:-Atelier}
COMPANY_CONTACT=${COMPANY_CONTACT:-}
CENV
echo "    - config effacement : forge.env / company.env"

echo "==> Configurations générées."
