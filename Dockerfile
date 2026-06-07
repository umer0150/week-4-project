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


# ── Stage 3: Final production image ────────────────────────
FROM node:20-alpine AS final

WORKDIR /app

# Copy server with node_modules
COPY --from=server-build /app/server ./server

# Copy React build into client/dist folder
# (Express will serve from here)
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 3001

# Run DB migrations then start server

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/server.ts"]
