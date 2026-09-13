FROM node:22-alpine

COPY [ "./docker/frontend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend

# Run entirely as the image's non-root `node` user (UID/GID 1000) so all
# generated files map to the host user. Bind-mount ownership is prepared on
# the host side; nothing in this container needs root.
USER node

ENTRYPOINT [ "/entrypoint.sh" ]
