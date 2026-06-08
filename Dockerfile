# ── Stage 1: Build React frontend ──────────────────────────
FROM node:20-alpine AS client-build

WORKDIR /app/client

# Accept build args for Vite
ARG VITE_TLDRAW_LICENSE_KEY
ARG VITE_SERVER_URL

# Make them available to Vite during build
ENV VITE_TLDRAW_LICENSE_KEY=$VITE_TLDRAW_LICENSE_KEY
ENV VITE_SERVER_URL=$VITE_SERVER_URL

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

RUN npm install -g tsx

WORKDIR /app
COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 3001

CMD ["sh", "-c", "tsx src/db/migrate.ts && tsx src/server.ts"]