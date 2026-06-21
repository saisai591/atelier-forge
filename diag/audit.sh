#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Audit matériel sous Linux (SystemRescue ou autre live).
# Alternative à audit.ps1 : utile pour un diagnostic approfondi (SMART complet).
# Dépose un rapport .json/.txt sur le partage \\SERVEUR\deploy\audit.
#
# Usage (depuis SystemRescue, montez d'abord le partage) :
#   mount -t cifs //SERVEUR/deploy /mnt -o user=pxe,pass=pxe
#   ./audit.sh /mnt/audit
# =============================================================================
set -uo pipefail
OUT="${1:-/mnt/audit}"
mkdir -p "${OUT}"

manuf=$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null | tr -d '\n')
model=$(cat /sys/class/dmi/id/product_name 2>/dev/null | tr -d '\n')
serial=$(cat /sys/class/dmi/id/product_serial 2>/dev/null | tr -d '\n')
[[ -z "${serial}" || "${serial}" == "To Be Filled By O.E.M." ]] && serial="SN-$(date +%Y%m%d-%H%M%S)"
cpu=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ //')
cores=$(grep -c '^processor' /proc/cpuinfo)
ram_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
ram_gb=$(awk "BEGIN{printf \"%.1f\", ${ram_kb}/1024/1024}")
mac=$(ip -o link show 2>/dev/null | awk '$2!="lo:"{print $(NF-2); exit}')

threads=$(nproc 2>/dev/null || echo "${cores}")

# Batterie (portables) : usure = 1 - charge_full / charge_full_design (lecture sysfs, instantané)
bat="aucune batterie (poste fixe)"; bat_wear="null"
for b in /sys/class/power_supply/BAT*; do
    [[ -d "$b" ]] || continue
    fd=$(cat "$b/charge_full_design" 2>/dev/null || cat "$b/energy_full_design" 2>/dev/null)
    ff=$(cat "$b/charge_full" 2>/dev/null || cat "$b/energy_full" 2>/dev/null)
    if [[ -n "$fd" && -n "$ff" && "$fd" -gt 0 ]]; then
        bat_wear=$(awk "BEGIN{printf \"%.1f\", (1-${ff}/${fd})*100}")
        bat="usure ${bat_wear}% (nominale ${fd}, reelle ${ff})"
    fi
    break
done

# Barrettes RAM (dmidecode si root, lecture instantanée)
ram_modules="non lu (dmidecode requis)"
if command -v dmidecode >/dev/null 2>&1; then
    ram_modules=$(dmidecode -t memory 2>/dev/null | awk -F': ' '
        /Locator:/ && !/Bank/ {loc=$2}
        /Size:/ && $2 !~ /No Module/ {sz=$2}
        /Speed:/ && $2 ~ /MT|MHz/ {sp=$2; if(sz!=""){printf "%s=%s@%s; ",loc,sz,sp; sz=""}}')
    [[ -z "${ram_modules}" ]] && ram_modules="aucune barrette détectée"
fi

# Disques + SMART + transport (sata/nvme) + SSD/HDD (lecture rapide)
disks_json="["
first=1
for dev in $(lsblk -dno NAME,TYPE | awk '$2=="disk"{print $1}'); do
    size=$(lsblk -dno SIZE "/dev/${dev}")
    tran=$(lsblk -dno TRAN "/dev/${dev}" 2>/dev/null)        # sata / nvme / usb
    rota=$(cat "/sys/block/${dev}/queue/rotational" 2>/dev/null)
    media=$([[ "$rota" == "0" ]] && echo "SSD" || echo "HDD")
    smart_health="?"; smart_hours="?"
    if command -v smartctl >/dev/null; then
        smart_health=$(smartctl -H "/dev/${dev}" 2>/dev/null | grep -i 'overall-health' | awk -F: '{gsub(/ /,"",$2);print $2}')
        smart_hours=$(smartctl -A "/dev/${dev}" 2>/dev/null | awk '/Power_On_Hours/{print $10; exit}')
    fi
    [[ ${first} -eq 0 ]] && disks_json+=","
    disks_json+="{\"dev\":\"${dev}\",\"bus\":\"${tran:-?}\",\"media\":\"${media}\",\"taille\":\"${size}\",\"sante\":\"${smart_health:-?}\",\"heures\":\"${smart_hours:-?}\"}"
    first=0
done
disks_json+="]"

stamp="$(echo "${serial}" | tr -c 'A-Za-z0-9_-' '_')_$(date +%Y%m%d-%H%M%S)"
json="${OUT}/${stamp}.json"
cat > "${json}" <<EOF
{
  "Date": "$(date '+%Y-%m-%d %H:%M:%S')",
  "Fabricant": "${manuf}",
  "Modele": "${model}",
  "NumeroSerie": "${serial}",
  "CPU": "${cpu}",
  "CPU_Coeurs": ${cores},
  "CPU_Threads": ${threads},
  "RAM_Go": ${ram_gb},
  "RAM_Barrettes": "${ram_modules}",
  "Batterie": "${bat}",
  "Batterie_Usure_pct": ${bat_wear},
  "MAC": "${mac}",
  "Disques": ${disks_json}
}
EOF
echo "Rapport d'audit écrit : ${json}"
cat "${json}"
