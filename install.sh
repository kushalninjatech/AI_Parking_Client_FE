#!/usr/bin/env bash
# Install / refresh AI Parking FE systemd service for this device.
#
# Renders the unit template from ./systemd/ with device-specific values
# (install dir, run user, npm path) and installs it into
# /etc/systemd/system/.
#
# Usage:
#   sudo ./install.sh
#
# Overrides:
#   RUN_USER=<user>    service runtime user (defaults to invoking user)
#   NPM_BIN=<path>     path to npm (defaults to autodetect)
#   SKIP_NPM_INSTALL=1 skip 'npm install' step

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SCRIPT_DIR}"
SYSTEMD_DIR="/etc/systemd/system"
TEMPLATE_DIR="${SCRIPT_DIR}/systemd"

if [[ "$EUID" -ne 0 ]]; then
    echo "This script must be run as root (use sudo)." >&2
    exit 1
fi

RUN_USER="${RUN_USER:-${SUDO_USER:-}}"
if [[ -z "${RUN_USER}" || "${RUN_USER}" == "root" ]]; then
    echo "Cannot determine a non-root run user. Invoke via 'sudo ./install.sh' from your user shell, or set RUN_USER=<user>." >&2
    exit 1
fi
RUN_GROUP="$(id -gn "${RUN_USER}")"

NPM_BIN="${NPM_BIN:-$(sudo -u "${RUN_USER}" bash -lc 'command -v npm || true')}"
if [[ -z "${NPM_BIN}" || ! -x "${NPM_BIN}" ]]; then
    echo "npm not found for user ${RUN_USER}. Install Node.js or set NPM_BIN=<path>." >&2
    exit 1
fi

echo ">> install_dir = ${INSTALL_DIR}"
echo ">> run_user    = ${RUN_USER} (${RUN_GROUP})"
echo ">> npm         = ${NPM_BIN}"

if [[ "${SKIP_NPM_INSTALL:-0}" != "1" ]]; then
    echo ">> npm install"
    sudo -u "${RUN_USER}" bash -lc "cd '${INSTALL_DIR}' && '${NPM_BIN}' install"
fi

render() {
    local src="$1" dst="$2"
    sed \
        -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
        -e "s|__RUN_USER__|${RUN_USER}|g" \
        -e "s|__RUN_GROUP__|${RUN_GROUP}|g" \
        -e "s|__NPM__|${NPM_BIN}|g" \
        "${src}" > "${dst}"
    chmod 0644 "${dst}"
}

echo ">> rendering unit to ${SYSTEMD_DIR}"
render "${TEMPLATE_DIR}/ai-parking-fe.service" "${SYSTEMD_DIR}/ai-parking-fe.service"

systemctl daemon-reload
systemctl enable ai-parking-fe.service
systemctl restart ai-parking-fe.service

sleep 2
systemctl status --no-pager ai-parking-fe.service | head -12
echo ">> done"
