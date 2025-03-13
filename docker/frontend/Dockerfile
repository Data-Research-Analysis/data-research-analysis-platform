FROM node:20-alpine3.19

COPY [ "./docker/frontend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend
ENTRYPOINT [ "/entrypoint.sh" ]
