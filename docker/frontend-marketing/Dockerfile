FROM node:20-alpine3.19

COPY [ "./docker/frontend-marketing/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

WORKDIR /frontend-marketing
ENTRYPOINT [ "/entrypoint.sh" ]
