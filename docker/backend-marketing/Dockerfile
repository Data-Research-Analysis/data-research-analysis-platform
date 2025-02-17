FROM node:20-alpine3.19

COPY [ "./docker/backend-marketing/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /backend-marketing
ENTRYPOINT [ "/entrypoint.sh" ]
