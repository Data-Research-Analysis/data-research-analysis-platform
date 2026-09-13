#!/bin/ash
set -e

cd /frontend

# Re-own any files left by a previous root run (stale .nuxt/.output build
# artifacts or node_modules packages). Only touched when needed, then the
# container drops to the `node` user so new files map to the host user.
find /frontend/.nuxt /frontend/.output /frontend/node_modules \
    -not -user node -exec chown node:node {} + 2>/dev/null || true

exec su node -s /bin/sh -c "
export HOME=/home/node
cd /frontend
npm install
NUXT_HOST=0.0.0.0 npm run dev
"
