#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Effacement sécurisé des disques (équivalent open-source de Blancco).
#
#   À exécuter en root depuis un Linux live (SystemRescue recommandé).
#   Conforme à l'esprit de la norme NIST SP 800-88 Rev.1 (Clear / Purge) :
#     - NVMe  : nvme sanitize (Purge) puis nvme format (repli)
#     - SATA  : ATA Secure Erase via hdparm (Purge)
#     - Repli : réécriture nwipe/shred/dd (Clear)
#   Produit un CERTIFICAT d'effacement (JSON + texte) par disque.
#
#   ⚠️  DESTRUCTIF ET IRRÉVERSIBLE. Testez sur un disque de rebut avant la prod.
#   ⚠️  Certificat AUTO-ÉMIS (non accrédité par un tiers — voir docs/EFFACEMENT.md)
#
# Usage :
#   ./secure-erase.sh                 # interactif (choix du/des disques)
#   ./secure-erase.sh --device sdb    # cible un disque précis
#   ./secure-erase.sh --dry-run       # n'efface RIEN, montre ce qui serait fait
# =============================================================================
set -uo pipefail

# --- Paramètres (surchargés par label.env / variables d'environnement) ------
CERT_DIR="${CERT_DIR:-/mnt/deploy/certificates}"
ERASE_METHOD="${ERASE_METHOD:-auto}"
COMPANY_NAME="${COMPANY_NAME:-Atelier}"
COMPANY_CONTACT="${COMPANY_CONTACT:-}"
OPERATOR="${OPERATOR:-}"
DRY_RUN=0
TARGET=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --device) TARGET="$2"; shift 2 ;;
        --dry-run) DRY_RUN=1; shift ;;
        --method)  ERASE_METHOD="$2"; shift 2 ;;
        -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
        *) echo "Option inconnue : $1" >&2; exit 1 ;;
    esac
done

if [[ "${EUID}" -ne 0 ]]; then echo "Lancez ce script en root." >&2; exit 1; fi

# Charge la config si forge.env est accessible sur le partage monté.
for c in /mnt/deploy/scripts/forge.env "$(dirname "$0")/forge.env"; do
    # shellcheck disable=SC1090
    [[ -f "$c" ]] && source "$c" && break
done

mkdir -p "${CERT_DIR}" 2>/dev/null || true

# --- Disques à PROTÉGER (système live, partage) ----------------------------
protected_disks() {
    local mp dev base
    for mp in / /run/archiso/bootmnt /run/archiso/cowspace /boot /mnt; do
        dev=$(findmnt -no SOURCE --target "$mp" 2>/dev/null) || continue
        [[ "$dev" == //* || "$dev" == *:* ]] && continue   # ignore CIFS/NFS
        base=$(lsblk -no PKNAME "$dev" 2>/dev/null | head -1)
        [[ -z "$base" ]] && base=$(basename "$dev" | sed 's/[0-9]*$//')
        [[ -n "$base" ]] && echo "$base"
    done | sort -u
}
mapfile -t PROTECTED < <(protected_disks)
is_protected() { local d; for d in "${PROTECTED[@]}"; do [[ "$1" == "$d" ]] && return 0; done; return 1; }

# --- Sélection des disques cibles ------------------------------------------
all_disks() { lsblk -dno NAME,TYPE | awk '$2=="disk"{print $1}'; }

echo "=== Atelier Forge — Effacement sécurisé ==="
echo "Disques détectés (les disques système sont protégés) :"
printf '%-8s %-26s %-22s %-8s %s\n' "DISQUE" "MODELE" "SERIE" "TAILLE" "ETAT"
for d in $(all_disks); do
    flag=""; is_protected "$d" && flag=" <== PROTÉGÉ (système)"
    printf '%-8s %-26.26s %-22.22s %-8s %s\n' \
        "$d" "$(lsblk -dno MODEL /dev/$d)" "$(lsblk -dno SERIAL /dev/$d)" \
        "$(lsblk -dno SIZE /dev/$d)" "$flag"
done
echo

if [[ -z "${TARGET}" ]]; then
    read -rp "Disque(s) à effacer (ex: sdb ou 'sdb sdc'), ou 'all' : " TARGET
fi
if [[ "${TARGET}" == "all" ]]; then
    TARGET="$(for d in $(all_disks); do is_protected "$d" || echo "$d"; done)"
fi
[[ -z "${TARGET}" ]] && { echo "Aucun disque sélectionné."; exit 1; }

if [[ -z "${OPERATOR}" ]]; then read -rp "Nom de l'opérateur : " OPERATOR; fi

echo
echo "*****************************************************************"
echo "*  ATTENTION : effacement IRRÉVERSIBLE des disques : ${TARGET}"
echo "*  Méthode : ${ERASE_METHOD}   (dry-run=${DRY_RUN})"
echo "*****************************************************************"
read -rp "Tapez EFFACER en majuscules pour confirmer : " CONF
[[ "${CONF}" == "EFFACER" ]] || { echo "Annulé."; exit 1; }

# --- Outils de bas niveau ---------------------------------------------------
run() { if [[ "${DRY_RUN}" -eq 1 ]]; then echo "  [dry-run] $*"; return 0; else echo "  + $*"; "$@"; fi; }

verify_zero() {  # echantillonne le début/fin du disque -> "OK" si tout à zéro
    local dev="$1" res="non vérifié"
    if [[ "${DRY_RUN}" -eq 1 ]]; then echo "non vérifié (dry-run)"; return; fi
    local nz1 nz2
    nz1=$(dd if="$dev" bs=1M count=16 2>/dev/null | tr -d '\0' | wc -c)
    nz2=$(dd if="$dev" bs=1M count=16 skip=$(( $(blockdev --getsz "$dev")/2048 - 16 )) 2>/dev/null | tr -d '\0' | wc -c)
    if [[ "$nz1" -eq 0 && "$nz2" -eq 0 ]]; then res="OK (échantillons à zéro)"; else res="données résiduelles détectées"; fi
    echo "$res"
}

erase_nvme() {  # $1=dev
    local dev="$1"
    echo "  Méthode NVMe Sanitize/Format (Purge)"
    if run nvme sanitize "$dev" -a 2; then
        echo "  Attente de fin du sanitize..."
        if [[ "${DRY_RUN}" -eq 0 ]]; then
            for _ in $(seq 1 600); do
                nvme sanitize-log "$dev" 2>/dev/null | grep -qi 'completed' && break
                sleep 5
            done
        fi
        METHOD_USED="NVMe Sanitize (block erase)"; VERIF="$(verify_zero "$dev")"; return 0
    fi
    if run nvme format "$dev" --ses=1 --force; then
        METHOD_USED="NVMe Format (user-data erase, SES=1)"; VERIF="$(verify_zero "$dev")"; return 0
    fi
    return 1
}

erase_ata() {  # $1=dev
    local dev="$1" pass="forgeErase"
    echo "  Méthode ATA Secure Erase (Purge)"
    if hdparm -I "$dev" 2>/dev/null | grep -qi 'frozen' && \
       ! hdparm -I "$dev" 2>/dev/null | grep -qi 'not[[:space:]]*frozen'; then
        echo "  Disque 'frozen' (verrouillé par le BIOS) : Secure Erase impossible."
        return 1
    fi
    hdparm -I "$dev" 2>/dev/null | grep -qi 'supported.*enhanced erase' && local enh="-enhanced" || local enh=""
    run hdparm --user-master u --security-set-pass "$pass" "$dev" || return 1
    if run hdparm --user-master u --security-erase${enh:+-enhanced} "$pass" "$dev"; then
        METHOD_USED="ATA Secure Erase${enh:+ (enhanced)}"; VERIF="$(verify_zero "$dev")"; return 0
    fi
    return 1
}

erase_crypto() {  # $1=dev  (Cryptographic Erase = destruction de la clé)
    local dev="$1"
    echo "  Méthode Crypto Erase (destruction de la clé de chiffrement)"
    if [[ "$dev" == /dev/nvme* ]]; then
        if run nvme format "$dev" --ses=2 --force; then
            METHOD_USED="NVMe Crypto Erase (SES=2, destruction de la clé)"
            VERIF="effacement cryptographique (clé détruite par le contrôleur)"
            return 0
        fi
    else
        # SED / Opal SATA : l'effacement renouvelle la clé interne.
        if hdparm -I "$dev" 2>/dev/null | grep -qi 'supported.*enhanced erase'; then
            if run hdparm --user-master u --security-set-pass forgeErase "$dev" && \
               run hdparm --user-master u --security-erase-enhanced forgeErase "$dev"; then
                METHOD_USED="ATA Enhanced Erase (renouvellement de clé SED)"
                VERIF="effacement cryptographique (clé renouvelée)"
                return 0
            fi
        fi
    fi
    return 1
}

erase_overwrite() {  # $1=dev  (repli logiciel, Clear)
    local dev="$1"
    echo "  Méthode réécriture logicielle (Clear, 1 passe de zéros)"
    if command -v nwipe >/dev/null; then
        run nwipe --nogui --autonuke --method=zero --verify=last "$dev"
        METHOD_USED="Réécriture nwipe (zéros, 1 passe)"
    elif command -v shred >/dev/null; then
        run shred -v -n 1 -z "$dev"
        METHOD_USED="Réécriture shred (zéros, 1 passe)"
    else
        run dd if=/dev/zero of="$dev" bs=4M status=progress
        METHOD_USED="Réécriture dd (zéros, 1 passe)"
    fi
    VERIF="$(verify_zero "$dev")"
}

# --- Écriture du certificat -------------------------------------------------
write_certificate() {  # $1=dev $2=result $3=t0 $4=t1
    local dev="$1" result="$2" t0="$3" t1="$4"
    local d; d="$(basename "$dev")"
    local model serial size hostmodel hostserial certid
    model=$(lsblk -dno MODEL "$dev" | xargs); serial=$(lsblk -dno SERIAL "$dev" | xargs)
    size=$(lsblk -dno SIZE "$dev")
    [[ -z "$serial" ]] && serial="N/A"
    hostmodel=$(cat /sys/class/dmi/id/product_name 2>/dev/null | xargs)
    hostserial=$(cat /sys/class/dmi/id/product_serial 2>/dev/null | xargs)
    certid="FORGE-$(date +%Y%m%d-%H%M%S)-$(echo "$serial" | tr -c 'A-Za-z0-9' '_' | cut -c1-12)"
    local json="${CERT_DIR}/${certid}.json"
    local txt="${CERT_DIR}/${certid}.txt"

    cat > "${json}" <<EOF
{
  "certificat_id": "${certid}",
  "norme": "NIST SP 800-88 Rev.1",
  "societe": "${COMPANY_NAME}",
  "contact": "${COMPANY_CONTACT}",
  "operateur": "${OPERATOR}",
  "date_debut": "${t0}",
  "date_fin": "${t1}",
  "disque_modele": "${model}",
  "disque_serie": "${serial}",
  "disque_taille": "${size}",
  "methode": "${METHOD_USED:-?}",
  "verification": "${VERIF:-non vérifié}",
  "resultat": "${result}",
  "machine_hote_modele": "${hostmodel}",
  "machine_hote_serie": "${hostserial}",
  "outil": "Atelier Forge secure-erase.sh"
}
EOF
    {
        echo "============== CERTIFICAT D'EFFACEMENT DE DONNÉES =============="
        echo "ID certificat : ${certid}"
        echo "Société       : ${COMPANY_NAME}    ${COMPANY_CONTACT}"
        echo "Opérateur     : ${OPERATOR}"
        echo "Norme         : NIST SP 800-88 Rev.1"
        echo "---------------------------------------------------------------"
        echo "Disque        : ${model}"
        echo "N. de série   : ${serial}"
        echo "Capacité      : ${size}"
        echo "Méthode       : ${METHOD_USED:-?}"
        echo "Début / Fin   : ${t0}  ->  ${t1}"
        echo "Vérification  : ${VERIF:-non vérifié}"
        echo "RÉSULTAT      : ${result}"
        echo "Machine hôte  : ${hostmodel} (${hostserial})"
        echo "==============================================================="
    } > "${txt}"
    echo
    echo "  Certificat : ${txt}"
    cat "${txt}"
}

# --- Boucle d'effacement ----------------------------------------------------
for d in ${TARGET}; do
    dev="/dev/${d}"
    [[ -b "$dev" ]] || { echo "!! ${dev} n'est pas un disque, ignoré."; continue; }
    if is_protected "$d"; then echo "!! ${d} est protégé (système), ignoré."; continue; fi

    echo; echo ">>> Effacement de ${dev}"
    METHOD_USED=""; VERIF=""
    t0="$(date '+%Y-%m-%d %H:%M:%S')"
    ok=1

    case "${ERASE_METHOD}" in
        nvme-sanitize) [[ "$d" == nvme* ]] && erase_nvme "$dev" || ok=0 ;;
        ata-secure)    erase_ata "$dev" || ok=0 ;;
        crypto)        erase_crypto "$dev" || { echo "  -> crypto non supporté, repli"; erase_overwrite "$dev"; } ;;
        overwrite)     erase_overwrite "$dev" ;;
        auto|*)
            if [[ "$d" == nvme* ]]; then
                erase_nvme "$dev" || { echo "  -> repli réécriture"; erase_overwrite "$dev"; }
            else
                erase_ata "$dev"  || { echo "  -> repli réécriture"; erase_overwrite "$dev"; }
            fi
            ;;
    esac

    t1="$(date '+%Y-%m-%d %H:%M:%S')"
    if [[ "${DRY_RUN}" -eq 1 ]]; then
        echo "  [dry-run] aucun effacement réel, pas de certificat."
        continue
    fi
    if [[ "$ok" -eq 0 || -z "${METHOD_USED}" ]]; then
        write_certificate "$dev" "ÉCHEC" "$t0" "$t1"
    elif [[ "${VERIF}" == *"résiduelles"* ]]; then
        write_certificate "$dev" "À VÉRIFIER (données résiduelles)" "$t0" "$t1"
    else
        write_certificate "$dev" "SUCCÈS" "$t0" "$t1"
    fi
done

echo; echo "=== Effacement terminé. Certificats dans ${CERT_DIR} ==="
