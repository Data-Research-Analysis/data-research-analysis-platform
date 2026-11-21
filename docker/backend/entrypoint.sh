#!/bin/bash
set -e
cd /backend

APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"

# The backend tree is a bind mount owned by the host. When the container starts
# as root, align its ownership with the runtime user and then drop privileges.
# This keeps the tree writable after a deploy recreates files as root, without
# requiring a manual chown on the host.
if [ "$(id -u)" = "0" ] && [ "${APP_UID}" != "0" ]; then
    needs_chown=0
    for path in /backend /backend/package-lock.json /backend/private /backend/backend /backend/backend/private/backups /backend/public; do
        if [ -e "${path}" ] && [ "$(stat -c '%u:%g' "${path}")" != "${APP_UID}:${APP_GID}" ]; then
            needs_chown=1
            break
        fi
    done

    if [ "${needs_chown}" = "1" ]; then
        echo "Aligning /backend ownership with ${APP_UID}:${APP_GID}"
        chown -R "${APP_UID}:${APP_GID}" /backend
    fi

    exec gosu appuser "$0" "$@"
fi

export HOME=/home/appuser

# Ensure the uploads/pdf directory exists for the app
mkdir -p public/uploads/pdfs

npm install
npm run dev
exec bash
