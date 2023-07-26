FROM node:18-slim
ARG TAG=passAsBuildArg

ENV TIMEOUT_SEC=5
ENV PORT=21210
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0

RUN npm i -g hyper-blackbox-exporter@${TAG}

RUN useradd --create-home exporter
USER exporter

ENTRYPOINT ["hyper-blackbox-exporter"]
