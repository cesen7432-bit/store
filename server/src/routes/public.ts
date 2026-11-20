import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { config } from '../config.js'
import { z } from 'zod'
import { HttpError, optionalAuth, requireAuth } from '../auth.js'
import { categories, coupons, newsletter, products, projects, reviews, settings } from '../repo.js'
import { assertCouponAllowed, createOrder, createQuote, featured, queryProducts } from '../services.js'
import { orderSchema, productQuerySchema, quoteSchema } from '../validation.js'

export const publicRoutes = Router()

publicRoutes.get('/categories', (_req, res) => {
  res.json(categories.list())
})

publicRoutes.get('/products', (req, res) => {
  res.json(queryProducts(productQuerySchema.parse(req.query)))
})

// debe ir antes de /products/:slug
publicRoutes.get('/products/featured', (req, res) => {
  res.json(featured(typeof req.query.season === 'string' ? req.query.season : undefined))
})

publicRoutes.get('/products/:slug', (req, res) => {
  const p = products.bySlugOrId(req.params.slug)
  if (!p) throw new HttpError(404, 'Producto no encontrado')
  res.json(p)
})

publicRoutes.get('/products/:slug/related', (req, res) => {
  const p = products.bySlugOrId(req.params.slug)
  if (!p) throw new HttpError(404, 'Producto no encontrado')
  res.json(queryProducts({ category: p.category }).filter((x) => x.id !== p.id).slice(0, 4))
})

publicRoutes.get('/products/:slug/reviews', (req, res) => {
  const p = products.bySlugOrId(req.params.slug)
  if (!p) throw new HttpError(404, 'Producto no encontrado')
  res.json(reviews.activeForProduct(p.id))
})

publicRoutes.get('/projects', (_req, res) => {
  res.json(projects.list())
})

publicRoutes.get('/coupons/:code', optionalAuth, (req, res) => {
  const c = coupons.active(String(req.params.code))
  if (!c) throw new HttpError(404, 'Cupón no válido')
  if (!req.user) throw new HttpError(401, 'Ingresa a tu cuenta para usar cupones')
  assertCouponAllowed(c, req.user)
  res.json(c)
})

/** Oferta por crear cuenta (la muestra el carrito y el registro) */
publicRoutes.get('/welcome-offer', (_req, res) => {
  const code = settings.get().welcomeCoupon
  const c = code ? coupons.active(code) : null
  if (!c) throw new HttpError(404, 'Sin oferta de bienvenida')
  res.json({ code: c.code, percent: c.percent })
})

publicRoutes.get('/settings', (_req, res) => {
  res.json(settings.get())
})

// Adjuntos de cotización: carpeta temporal privada, extensiones de diseño/imagen, tamaño limitado
const QUOTE_EXT = ['.svg', '.dxf', '.ai', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.cdr', '.eps']
const quoteUpload = multer({
  dest: path.join(config.quoteFilesDir, 'tmp'),
  limits: { fileSize: config.maxQuoteFileMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    QUOTE_EXT.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new HttpError(400, 'Formato no permitido. Usa SVG, DXF, AI, PDF, CDR, EPS, PNG o JPG.')),
})
fs.mkdirSync(path.join(config.quoteFilesDir, 'tmp'), { recursive: true })
const quoteLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiadas solicitudes. Intenta más tarde.' } })

/** Cotización: JSON simple o multipart (campo "data" con el JSON + campo "file") */
publicRoutes.post('/quotes', quoteLimiter, quoteUpload.single('file'), (req, res) => {
  try {
    const body = req.file || typeof req.body?.data === 'string' ? JSON.parse(String(req.body.data ?? '{}')) : req.body
    res.status(201).json(createQuote(quoteSchema.parse(body), req.file ?? undefined))
  } catch (e) {
    if (req.file) fs.rmSync(req.file.path, { force: true }) // no dejar archivos huérfanos
    throw e
  }
})

/** Pedido: requiere cuenta (verificada por SMS). El correo del pedido es siempre el de la cuenta. */
publicRoutes.post('/orders', requireAuth, (req, res) => {
  const input = orderSchema.parse(req.body)
  input.customer.email = req.user!.email
  res.status(201).json(createOrder(input, req.user))
})

publicRoutes.post('/newsletter', (req, res) => {
  const { email } = z.object({ email: z.email('Correo inválido') }).parse(req.body)
  newsletter.add(email)
  res.status(201).json({ ok: true })
})
