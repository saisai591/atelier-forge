#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Télécharge les binaires nécessaires :
#   - chargeurs iPXE (BIOS + UEFI)  -> TFTP
#   - wimboot (démarrage de WinPE)  -> HTTP
#   - Memtest86+ (test mémoire EFI) -> HTTP/diag
# Tolérant aux erreurs réseau : signale ce qui a échoué sans tout interrompre.
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/config.env"

# Sources (modifiables si une URL change, surchargables par l'environnement) :
#   boot.ipxe.org reconstruit ses binaires « à la demande » ; structure des chemins :
#     BIOS    : /undionly.kpxe
#     UEFI x64: /x86_64-efi/ipxe.efi
#     UEFI x86: /i386-efi/ipxe.efi  (renommé ipxe32.efi localement)
IPXE_BASE="${IPXE_BASE:-https://boot.ipxe.org}"
IPXE_EFI64_URL="${IPXE_EFI64_URL:-${IPXE_BASE}/x86_64-efi/ipxe.efi}"
IPXE_EFI32_URL="${IPXE_EFI32_URL:-${IPXE_BASE}/i386-efi/ipxe.efi}"
WIMBOOT_URL="${WIMBOOT_URL:-https://github.com/ipxe/wimboot/releases/latest/download/wimboot}"
MEMTEST_VERSION="${MEMTEST_VERSION:-7.20}"
MEMTEST_ZIP_URL="${MEMTEST_ZIP_URL:-https://www.memtest.org/download/v${MEMTEST_VERSION}/mt86plus_${MEMTEST_VERSION}.binaries.zip}"

MANIFEST="${DATA_ROOT}/assets.sha256"
mkdir -p "${DATA_ROOT}" 2>/dev/null || true

# Vérifie le type d'un binaire EFI/PE (doit commencer par "MZ").
check_magic() {  # check_magic <fichier>
    case "$1" in
        *.efi|*/wimboot|*wimboot) [[ "$(head -c2 "$1" 2>/dev/null)" == "MZ" ]] || return 1 ;;
    esac
    return 0
}

# Enregistre l'empreinte sha256, ou la vérifie si déjà connue (anti-corruption).
record_or_verify() {  # record_or_verify <fichier>
    local f="$1" sum name
    command -v sha256sum >/dev/null || return 0
    sum="$(sha256sum "${f}" | awk '{print $1}')"
    name="$(basename "${f}")"
    touch "${MANIFEST}"
    local known; known="$(awk -v n="${name}" '$2==n{print $1}' "${MANIFEST}" | head -1)"
    if [[ -n "${known}" ]]; then
        if [[ "${known}" == "${sum}" ]]; then
            echo "       intégrité OK (sha256 inchangé)"
        else
            echo "       ATTENTION : sha256 différent de la version connue pour ${name} !" >&2
            echo "                   (mise à jour upstream ? ou fichier corrompu/altéré ?)" >&2
        fi
    else
        echo "${sum}  ${name}" >> "${MANIFEST}"
        echo "       sha256 enregistré : ${sum:0:16}..."
    fi
}

fetch() {  # fetch <url> <destination>
    local url="$1" dest="$2"
    echo "    -> ${url}"
    # --retry-all-errors : retente AUSSI sur 4xx (ex. 404 de boot.ipxe.org qui
    # compile le binaire « à la demande » et le sert seulement au 2e essai).
    if curl -fL --retry 5 --retry-delay 3 --retry-all-errors \
            --connect-timeout 20 -o "${dest}.part" "${url}"; then
        if [[ ! -s "${dest}.part" ]]; then
            rm -f "${dest}.part"; echo "       ÉCHEC : fichier vide" >&2; return 1
        fi
        mv "${dest}.part" "${dest}"
        if ! check_magic "${dest}"; then
            echo "       ÉCHEC : ${dest} n'est pas un binaire valide (MZ attendu)" >&2
            return 1
        fi
        echo "       OK : ${dest}"
        record_or_verify "${dest}"
        return 0
    else
        rm -f "${dest}.part"
        echo "       ÉCHEC : ${url}" >&2
        return 1
    fi
}

# Extrait un binaire iPXE depuis le paquet Alpine via Podman.
# Utilisé en fallback quand boot.ipxe.org est indisponible (MicroOS est immuable,
# pas d'install de paquet hôte possible). Le paquet Alpine ipxe fournit les binaires
# précompilés : undionly.kpxe, ipxe.efi (x64), ipxe32.efi (x86 32-bit si dispo).
fetch_ipxe_alpine() {  # fetch_ipxe_alpine <nom_fichier> <destination>
    local name="$1" dest="$2"
    command -v podman >/dev/null 2>&1 || return 1
    echo "       (fallback : extraction depuis le paquet Alpine ipxe via Podman)"
    local tmpdir; tmpdir="$(mktemp -d)"
    if podman run --rm \
            -v "${tmpdir}:/out:z" \
            docker.io/library/alpine:3.20 \
            sh -c "apk add --no-cache ipxe >/dev/null 2>&1 && \
                   cp /usr/share/ipxe/${name} /out/ 2>/dev/null" \
        && [[ -s "${tmpdir}/${name}" ]]; then
        mv "${tmpdir}/${name}" "${dest}"
        rm -rf "${tmpdir}"
        if ! check_magic "${dest}"; then
            echo "       ÉCHEC : ${dest} n'est pas un binaire valide (MZ attendu)" >&2
            return 1
        fi
        echo "       OK : ${dest} (depuis paquet Alpine)"
        record_or_verify "${dest}"
        return 0
    fi
    rm -rf "${tmpdir}"
    return 1
}

# Décompresse un .zip vers un dossier. Utilise `unzip` s'il est présent sur l'hôte,
# sinon se rabat sur un conteneur Podman jetable : MicroOS « Container Host » n'a
# pas `unzip` d'origine et l'OS est immuable (pas d'install de paquet à la volée).
extract_zip() {  # extract_zip <fichier.zip> <dossier_destination>
    local zip="$1" dest="$2"
    if command -v unzip >/dev/null 2>&1; then
        unzip -o "${zip}" -d "${dest}" >/dev/null 2>&1 && return 0
    fi
    if command -v podman >/dev/null 2>&1; then
        echo "       (unzip absent sur l'hôte -> décompression via conteneur Podman)"
        podman run --rm \
            -v "${zip}:/in.zip:ro,z" -v "${dest}:/out:z" \
            docker.io/library/alpine:3.20 \
            sh -c 'apk add --no-cache unzip >/dev/null 2>&1 && unzip -o /in.zip -d /out >/dev/null 2>&1' \
            && return 0
    fi
    return 1
}

mkdir -p "${TFTP_ROOT}" "${HTTP_ROOT}/winpe" "${HTTP_ROOT}/diag"
ERRORS=0

echo "==> Chargeurs iPXE (TFTP)"
# Indispensables : BIOS (undionly.kpxe) et UEFI x64 (ipxe.efi) couvrent
# la quasi-totalité du parc. Fallback sur le paquet Alpine si boot.ipxe.org échoue.
fetch "${IPXE_BASE}/undionly.kpxe" "${TFTP_ROOT}/undionly.kpxe" \
    || fetch_ipxe_alpine "undionly.kpxe" "${TFTP_ROOT}/undionly.kpxe" \
    || ERRORS=$((ERRORS+1))
fetch "${IPXE_EFI64_URL}" "${TFTP_ROOT}/ipxe.efi" \
    || fetch_ipxe_alpine "ipxe.efi" "${TFTP_ROOT}/ipxe.efi" \
    || ERRORS=$((ERRORS+1))
# UEFI 32 bits : best-effort. Matériel très rare -> non bloquant si absent.
if ! fetch "${IPXE_EFI32_URL}" "${TFTP_ROOT}/ipxe32.efi" \
        && ! fetch_ipxe_alpine "ipxe32.efi" "${TFTP_ROOT}/ipxe32.efi"; then
    echo "       (ignoré : UEFI 32 bits indisponible/rare — non bloquant)"
fi

cat > "${TFTP_ROOT}/autoexec.ipxe" <<EOF
#!ipxe
dhcp || goto retry
chain http://${SERVER_IP}:${HTTP_PORT}/boot/menu.ipxe || goto retry
:retry
sleep 2
goto start
:start
chain http://${SERVER_IP}:${HTTP_PORT}/boot/menu.ipxe || shell
EOF
chmod 0644 "${TFTP_ROOT}/autoexec.ipxe"
echo "       OK : ${TFTP_ROOT}/autoexec.ipxe"

echo "==> wimboot (démarrage de WinPE par le réseau)"
fetch "${WIMBOOT_URL}" "${HTTP_ROOT}/winpe/wimboot" || ERRORS=$((ERRORS+1))

echo "==> Memtest86+ (${MEMTEST_VERSION})"
TMPZIP="$(mktemp -u)/mt.zip"
mkdir -p "$(dirname "${TMPZIP}")"
if fetch "${MEMTEST_ZIP_URL}" "${TMPZIP}"; then
    TMPD="$(mktemp -d)"
    if extract_zip "${TMPZIP}" "${TMPD}"; then
        # Récupère l'application EFI 64 bits (nom variable selon les versions).
        EFI_BIN="$(find "${TMPD}" -iname '*64*.efi' | head -n1)"
        if [[ -n "${EFI_BIN}" ]]; then
            cp "${EFI_BIN}" "${HTTP_ROOT}/diag/memtest.efi"
            echo "       OK : ${HTTP_ROOT}/diag/memtest.efi"
        else
            echo "       ÉCHEC : binaire EFI introuvable dans l'archive Memtest." >&2
            ERRORS=$((ERRORS+1))
        fi
    else
        echo "       ÉCHEC : décompression Memtest (ni unzip hôte, ni Podman ?)." >&2
        ERRORS=$((ERRORS+1))
    fi
    rm -rf "${TMPD}" "$(dirname "${TMPZIP}")"
else
    ERRORS=$((ERRORS+1))
fi

echo ""
if [[ "${ERRORS}" -eq 0 ]]; then
    echo "==> Tous les binaires ont été récupérés."
else
    echo "==> ${ERRORS} téléchargement(s) en échec. Vérifiez l'accès Internet"
    echo "    du serveur, puis relancez : ./download-assets.sh"
    echo "    (Les URL sont en haut de ce script si une version a changé.)"
fi
