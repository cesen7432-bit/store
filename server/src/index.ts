import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import { ZodError } from 'zod'
import { HttpError } from './auth.js'
import { config } from './config.js'
import { analyticsRoutes, migrateAnalytics } from './analytics.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { publicRoutes } from './routes/public.js'
import { seed } from './seed.js'

await seed()
migrateAnalytics()

const app = express()
app.set('trust proxy', config.trustProxy) // detrás de Nginx: el límite de intentos ve la IP real del cliente
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '200kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
app.use('/api', analyticsRoutes, publicRoutes, authRoutes, adminRoutes)
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', immutable: true }))

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' })
})

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ message: err.issues[0]?.message ?? 'Datos inválidos', issues: err.issues })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message })
    return
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? `La imagen supera ${config.maxUploadMb} MB` : err.message })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'JSON inválido' })
    return
  }
  console.error(err)
  res.status(500).json({ message: 'Error interno del servidor' })
}
app.use(onError)

app.listen(config.port, () => {
  console.log(`API CECOM escuchando en http://localhost:${config.port}`)
})
