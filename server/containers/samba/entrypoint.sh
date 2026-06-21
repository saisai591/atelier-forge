#!/bin/bash
set -euo pipefail

: "${SMB_USER:=pxe}"
: "${SMB_PASSWORD:=pxe}"
: "${WSDD_HOSTNAME:=AOS-DEPLOY}"
: "${WSDD_WORKGROUP:=WORKGROUP}"

if ! id "${SMB_USER}" >/dev/null 2>&1; then
    adduser -D -H -s /sbin/nologin "${SMB_USER}"
fi

printf '%s\n%s\n' "${SMB_PASSWORD}" "${SMB_PASSWORD}" | smbpasswd -a -s "${SMB_USER}"
smbpasswd -e "${SMB_USER}"

echo "[samba] user '${SMB_USER}' ready - starting nmbd/wsdd/smbd"

if command -v nmbd >/dev/null 2>&1; then
    nmbd --foreground --no-process-group --debug-stdout &
fi

python3 /usr/local/bin/wsdd-lite.py \
    --hostname "${WSDD_HOSTNAME}" \
    --workgroup "${WSDD_WORKGROUP}" &

exec smbd --foreground --no-process-group --debug-stdout
