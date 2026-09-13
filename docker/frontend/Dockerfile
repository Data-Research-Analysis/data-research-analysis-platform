FROM node:22-alpine

COPY [ "./docker/frontend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend

# Run as the image's `node` user (UID/GID 1000) so files written into the
# bind-mounted /frontend tree (e.g. .nuxt) map to the host user instead of root.
USER node

ENTRYPOINT [ "/entrypoint.sh" ]
