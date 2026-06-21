#!/usr/bin/env bash
# =============================================================================
# Atelier Forge — Génère / imprime une étiquette d'inventaire à partir d'un rapport
# d'audit JSON (produit par audit.ps1 ou audit.sh).
#
# Usage :
#   ./make-label.sh <rapport.json>          # imprime selon label.env
#   ./make-label.sh <rapport.json> --html   # produit seulement un HTML imprimable
#
# Dépendances : jq (parse JSON). Pour le HTML->PDF : wkhtmltopdf (optionnel).
# Pour Zebra/ZPL : nc (netcat). Pour CUPS : lp.
# =============================================================================
set -euo pipefail

JSON="${1:?Usage: make-label.sh <rapport.json> [--html]}"
MODE="${2:-print}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -f "${JSON}" ]] || { echo "Rapport introuvable : ${JSON}" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq requis (zypper/podman)..." >&2; exit 1; }

# Charge la config d'impression si présente à côté du rapport ou du script.
for c in "$(dirname "${JSON}")/label.env" "${HERE}/label.env"; do
    # shellcheck disable=SC1090
    [[ -f "$c" ]] && source "$c" && break
done
LABEL_PRINTER_TYPE="${LABEL_PRINTER_TYPE:-none}"

FAB=$(jq -r '.Fabricant // "?"'  "${JSON}")
MOD=$(jq -r '.Modele // "?"'     "${JSON}")
SER=$(jq -r '.NumeroSerie // "?"' "${JSON}")
CPU=$(jq -r '.CPU // "?"'        "${JSON}")
RAM=$(jq -r '.RAM_Go // "?"'     "${JSON}")

# --- Génération HTML (à partir du gabarit) --------------------------------
OUT_HTML="${JSON%.json}.html"
sed -e "s|@FAB@|${FAB}|g" -e "s|@MOD@|${MOD}|g" -e "s|@SER@|${SER}|g" \
    -e "s|@CPU@|${CPU}|g" -e "s|@RAM@|${RAM}|g" \
    "${HERE}/label-template.html" > "${OUT_HTML}"
echo "Étiquette HTML : ${OUT_HTML}"

if [[ "${MODE}" == "--html" ]]; then exit 0; fi

# --- Impression selon le type d'imprimante --------------------------------
case "${LABEL_PRINTER_TYPE}" in
    zpl)
        ZPL=$(cat <<ZPLEOF
^XA
^CF0,30
^FO20,20^FD${FAB} ${MOD}^FS
^FO20,60^FDCPU: ${CPU}^FS
^FO20,95^FDRAM: ${RAM} Go^FS
^FO20,140^BY2^BCN,80,Y,N,N^FD${SER}^FS
^XZ
ZPLEOF
)
        echo "Envoi ZPL vers ${LABEL_ZPL_HOST}:${LABEL_ZPL_PORT}"
        printf '%s' "${ZPL}" | nc -w 5 "${LABEL_ZPL_HOST}" "${LABEL_ZPL_PORT}"
        ;;
    cups)
        if command -v wkhtmltopdf >/dev/null; then
            wkhtmltopdf "${OUT_HTML}" "${OUT_HTML%.html}.pdf"
            lp -d "${LABEL_CUPS_QUEUE}" "${OUT_HTML%.html}.pdf"
        else
            lp -d "${LABEL_CUPS_QUEUE}" "${OUT_HTML}"
        fi
        echo "Envoyé à la file CUPS ${LABEL_CUPS_QUEUE}."
        ;;
    *)
        echo "Aucune imprimante configurée (LABEL_PRINTER_TYPE=none)."
        echo "Étiquette disponible en HTML : ${OUT_HTML}"
        ;;
esac
