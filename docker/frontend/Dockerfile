FROM node:22-alpine

COPY [ "./docker/frontend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend
ENTRYPOINT [ "/entrypoint.sh" ]
