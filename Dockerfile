FROM node:18-slim
ARG TAG=passAsBuildArg

ENV TIMEOUT_SEC=5
ENV PORT=8080
ENV DHT_PORT=48200
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0
ENV DHT_HOST=0.0.0.0

RUN npm i -g hyper-blackbox-exporter@${TAG}

RUN useradd --create-home exporter
USER exporter

ENTRYPOINT ["hyper-blackbox-exporter"]
