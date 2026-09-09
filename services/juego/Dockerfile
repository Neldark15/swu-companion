FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run preparar-motor
RUN mkdir -p /datos && chown -R node:node /datos /app
USER node
ENV NODE_ENV=production JUEGO_HOST=0.0.0.0 JUEGO_PORT=3001 JUEGO_DATOS=/datos/salas.sqlite
VOLUME ["/datos"]
EXPOSE 3001
CMD ["node", "servidor.mjs"]
