# ── Stage 1: Build React frontend ──────────────────────────
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: Setup Express backend ─────────────────────────
FROM node:20-alpine AS server-build

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./

# ── Stage 3: Final image ────────────────────────────────────
FROM node:20-alpine AS final

WORKDIR /app

COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 3001

# Start server directly — let Railway handle migrations separately
CMD ["npx", "tsx", "src/server.ts"]