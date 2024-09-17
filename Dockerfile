FROM node:20-slim

RUN useradd -u 8225 --create-home hyper-blackbox-exporter

ENV TIMEOUT_SEC=5
ENV PORT=21210
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0

COPY package-lock.json /home/seeder/package-lock.json
COPY node_modules /home/seeder/node_modules
COPY package.json /home/seeder/package.json
COPY run.js /home/seeder/run.js
COPY index.js /home/seeder/index.js
COPY LICENSE /home/seeder/LICENSE
COPY NOTICE /home/seeder/NOTICE

USER hyper-blackbox-exporter

WORKDIR /home/hyper-blackbox-exporter/
ENTRYPOINT ["node", "home/hyper-blackbox-exporter/run.js"]
