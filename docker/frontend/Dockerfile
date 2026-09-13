FROM node:22-alpine

COPY [ "./docker/frontend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend

# The entrypoint runs as root to fix bind-mount ownership (files left by a
# previous root run would otherwise block the node user), then drops to the
# image's `node` user (UID/GID 1000) so generated files map to the host user.
ENTRYPOINT [ "/entrypoint.sh" ]
