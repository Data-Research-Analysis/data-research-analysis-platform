FROM node:20-alpine3.19
RUN apk add python3 make g++

COPY [ "./docker/frontend-marketing/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

ENV TZ=America/Denver

EXPOSE 3000

WORKDIR /frontend-marketing
ENTRYPOINT [ "/entrypoint.sh" ]
