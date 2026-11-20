import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// destino del backend en desarrollo (por defecto :4000)
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const api = env.API_PROXY_TARGET ?? 'http://localhost:4000'
// /store/api/... → backend /api/...
const toBackend = { target: api, rewrite: (p: string) => p.replace(/^\/store/, '') }

export default defineConfig({
  // la tienda se publica en https://apps-cecom.cloud/store/
  base: '/store/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/store/api': toBackend,
      '/store/uploads': toBackend,
    },
  },
})
