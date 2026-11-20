# ── API CECOM ──  (contexto de build: raíz del repo, comparte tipos/config con el frontend)
FROM node:24-alpine AS build
WORKDIR /repo/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY src/types /repo/src/types
COPY src/config /repo/src/config
COPY src/data /repo/src/data
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=4000 \
    DB_FILE=/app/data/cecom.db \
    UPLOADS_DIR=/app/uploads
WORKDIR /app
COPY --from=build /repo/server/node_modules ./node_modules
COPY --from=build /repo/server/dist ./dist
COPY server/package.json ./
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app
USER node
VOLUME ["/app/data", "/app/uploads"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/index.js"]
