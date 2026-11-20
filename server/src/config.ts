import path from 'node:path'
import crypto from 'node:crypto'

const isProd = process.env.NODE_ENV === 'production'

function jwtSecret() {
  const s = process.env.JWT_SECRET
  if (s && s.length >= 32) return s
  if (isProd) throw new Error('JWT_SECRET es obligatorio en producción (mínimo 32 caracteres)')
  return 'dev-secret-cambia-esto-en-produccion-0123456789'
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  /** Proxies delante del backend (Nginx del servidor + del contenedor = 2) */
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  jwtSecret: jwtSecret(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as `${number}d`,
  dbFile: path.resolve(process.env.DB_FILE ?? 'data/cecom.db'),
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? 'uploads'),
  /** Orígenes permitidos para CORS (separados por coma). En Docker el frontend va por el mismo dominio. */
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
  /** Administrador inicial: se crea solo si no existe ningún admin */
  adminEmail: (process.env.ADMIN_EMAIL ?? 'steven.r.cesen@hotmail.com').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? (isProd ? crypto.randomBytes(9).toString('base64url') : 'admin123'),
  adminName: process.env.ADMIN_NAME ?? 'Administrador CECOM',
  /** Celular del admin inicial (2FA) */
  adminPhone: process.env.ADMIN_PHONE ?? '0963657256',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
  /** Videos de proyectos */
  maxVideoMb: Number(process.env.MAX_VIDEO_MB ?? 60),
  /** Archivos adjuntos de cotizaciones: carpeta PRIVADA (no se sirve en /uploads) */
  quoteFilesDir: path.resolve(process.env.QUOTE_FILES_DIR ?? path.join(path.dirname(path.resolve(process.env.DB_FILE ?? 'data/cecom.db')), 'quote-files')),
  maxQuoteFileMb: Number(process.env.MAX_QUOTE_FILE_MB ?? 20),
}
