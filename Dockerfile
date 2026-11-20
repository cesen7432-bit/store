# ── Tienda (frontend) ──  build con Vite (subruta /store/) y servida por Nginx
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# en producción siempre usa el backend real (la API queda en /store/api)
ENV VITE_USE_MOCK=false
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/store
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/store/ >/dev/null || exit 1
