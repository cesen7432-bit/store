import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { HttpError, requireAdmin } from '../auth.js'
import { config } from '../config.js'
import { coupons, newId, orders, products, projects, publicUser, quotes, reviews, settings, users } from '../repo.js'
import { quoteFilePath, refreshProductRating, slugify, stats } from '../services.js'
import { tx } from '../db.js'
import { couponSchema, orderStatusSchema, productImportSchema, productSchema, projectSchema, quoteStatusSchema, reviewStatusSchema, roleSchema, settingsSchema } from '../validation.js'

export const adminRoutes = Router()
adminRoutes.use('/admin', requireAdmin)

adminRoutes.get('/admin/stats', (_req, res) => {
  res.json(stats())
})

// ───────── Productos ─────────
function saveProduct(body: unknown, id?: string) {
  const p = productSchema.parse(body)
  if (id) {
    if (!products.byId(id)) throw new HttpError(404, 'Producto no encontrado')
    p.id = id
  } else {
    p.id = slugify(p.name) || newId('p')
    if (products.byId(p.id)) p.id = `${p.id}-${crypto.randomBytes(2).toString('hex')}`
  }
  p.slug = slugify(p.slug || p.name) || p.id
  if (products.slugTaken(p.slug, p.id)) p.slug = `${p.slug}-${crypto.randomBytes(2).toString('hex')}`
  if (p.oldPrice && p.oldPrice <= p.price) p.oldPrice = undefined
  Object.assign(p, reviews.summary(p.id)) // estrellas = reseñas activas
  return products.save(p)
}

adminRoutes.post('/admin/products', (req, res) => {
  res.status(201).json(saveProduct(req.body))
})
/**
 * Importación masiva (Excel ya leído en el navegador). El SKU es la clave:
 * si existe → se actualizan nombre, precio y stock (se conservan fotos y descripciones);
 * si no → se crea el producto.
 */
const SUB_STYLE: Record<string, { icon: string; gradient: [string, string] }> = {
  Microcontroladores: { icon: 'cpu', gradient: ['#0ea5e9', '#14b8a6'] },
  Sensores: { icon: 'scan-eye', gradient: ['#14b8a6', '#84cc16'] },
  Módulos: { icon: 'layers', gradient: ['#6366f1', '#22d3ee'] },
  Componentes: { icon: 'componente', gradient: ['#64748b', '#f59e0b'] },
  'Iluminación LED': { icon: 'lightbulb', gradient: ['#ec4899', '#22d3ee'] },
  Herramientas: { icon: 'gauge', gradient: ['#eab308', '#22c55e'] },
}

adminRoutes.post('/admin/products/import', (req, res) => {
  const { items, updateExisting } = productImportSchema.parse(req.body)
  const result = tx(() => {
    let created = 0
    let updated = 0
    let skipped = 0
    for (const it of items) {
      const existing = products.bySku(it.sku)
      if (existing) {
        if (!updateExisting) {
          skipped++
          continue
        }
        products.save({ ...existing, name: it.name, price: it.price, stock: it.stock, sku: it.sku })
        updated++
        continue
      }
      let id = slugify(it.name) || newId('p')
      if (products.byId(id)) id = `${id}-${slugify(it.sku) || crypto.randomBytes(2).toString('hex')}`
      if (products.byId(id)) id = `${id}-${crypto.randomBytes(2).toString('hex')}`
      const style = SUB_STYLE[it.subcategory] ?? SUB_STYLE.Componentes
      products.save({
        id,
        slug: id,
        sku: it.sku,
        name: it.name,
        category: it.category,
        subcategory: it.subcategory,
        shortDescription: '',
        description: '',
        price: it.price,
        rating: 0,
        reviews: 0,
        stock: it.stock,
        tags: [it.sku.toLowerCase()],
        images: [],
        icon: style.icon,
        gradient: style.gradient,
        specs: {},
      })
      created++
    }
    return { created, updated, skipped }
  })
  res.json(result)
})

adminRoutes.put('/admin/products/:id', (req, res) => {
  res.json(saveProduct(req.body, req.params.id))
})
adminRoutes.delete('/admin/products/:id', (req, res) => {
  if (!products.delete(req.params.id)) throw new HttpError(404, 'Producto no encontrado')
  res.status(204).end()
})

// ───────── Subida de imágenes ─────────
const MIME_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' }
const VIDEO_EXT: Record<string, string> = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' }
fs.mkdirSync(config.uploadsDir, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${MIME_EXT[file.mimetype] ?? VIDEO_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: Math.max(config.maxUploadMb, config.maxVideoMb) * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowVideo = req.query.video === '1'
    if (MIME_EXT[file.mimetype] || (allowVideo && VIDEO_EXT[file.mimetype])) return cb(null, true)
    cb(new HttpError(400, allowVideo ? 'Formato no permitido. Usa JPG, PNG, WebP o videos MP4, WebM o MOV.' : 'Formato no permitido. Usa JPG, PNG, WebP, GIF o AVIF.'))
  },
})

/** Fotos (productos/proyectos) y, con ?video=1, videos de proyectos */
adminRoutes.post('/admin/uploads', upload.single('file'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No se recibió ningún archivo')
  const isVideo = !!VIDEO_EXT[req.file.mimetype]
  const max = (isVideo ? config.maxVideoMb : config.maxUploadMb) * 1024 * 1024
  if (req.file.size > max) {
    fs.rmSync(req.file.path, { force: true })
    throw new HttpError(400, `El archivo supera ${isVideo ? config.maxVideoMb : config.maxUploadMb} MB`)
  }
  res.status(201).json({ url: `/uploads/${path.basename(req.file.filename)}`, type: isVideo ? 'video' : 'image' })
})

/** Descarga del adjunto de una cotización (solo admin; nunca se sirve como página) */
adminRoutes.get('/admin/quotes/:id/file', (req, res) => {
  const q = quotes.list().find((x) => x.id === req.params.id)
  const stored = q?.file && quoteFilePath(q.id)
  if (!q?.file || !stored) throw new HttpError(404, 'La cotización no tiene archivo')
  res.setHeader('Content-Type', q.file.type || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(q.file.name)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
  res.sendFile(stored)
})

// ───────── Pedidos y cotizaciones ─────────
adminRoutes.get('/admin/orders', (_req, res) => {
  res.json(orders.list())
})
adminRoutes.patch('/admin/orders/:id', (req, res) => {
  const o = orders.setStatus(req.params.id, orderStatusSchema.parse(req.body).status)
  if (!o) throw new HttpError(404, 'Pedido no encontrado')
  res.json(o)
})
adminRoutes.get('/admin/quotes', (_req, res) => {
  res.json(quotes.list())
})
adminRoutes.patch('/admin/quotes/:id', (req, res) => {
  const q = quotes.setStatus(req.params.id, quoteStatusSchema.parse(req.body).status)
  if (!q) throw new HttpError(404, 'Cotización no encontrada')
  res.json(q)
})

// ───────── Reseñas (moderación) ─────────
adminRoutes.get('/admin/reviews', (_req, res) => {
  res.json(reviews.list())
})
adminRoutes.patch('/admin/reviews/:id', (req, res) => {
  const r = reviews.byId(req.params.id)
  if (!r) throw new HttpError(404, 'Reseña no encontrada')
  reviews.setStatus(r.id, reviewStatusSchema.parse(req.body).status)
  refreshProductRating(r.productId)
  res.json(reviews.byId(r.id))
})
adminRoutes.delete('/admin/reviews/:id', (req, res) => {
  const r = reviews.byId(req.params.id)
  if (!r) throw new HttpError(404, 'Reseña no encontrada')
  reviews.delete(r.id)
  refreshProductRating(r.productId)
  res.status(204).end()
})

// ───────── Proyectos ─────────
adminRoutes.post('/admin/projects', (req, res) => {
  const p = projectSchema.parse(req.body)
  res.status(201).json(projects.save({ ...p, id: newId('pr') }))
})
adminRoutes.put('/admin/projects/:id', (req, res) => {
  if (!projects.exists(req.params.id)) throw new HttpError(404, 'Proyecto no encontrado')
  res.json(projects.save({ ...projectSchema.parse(req.body), id: req.params.id }))
})
adminRoutes.delete('/admin/projects/:id', (req, res) => {
  if (!projects.delete(req.params.id)) throw new HttpError(404, 'Proyecto no encontrado')
  res.status(204).end()
})

// ───────── Cupones ─────────
adminRoutes.get('/admin/coupons', (_req, res) => {
  const uses = coupons.usage()
  res.json(coupons.list().map((c) => ({ ...c, uses: uses[c.code] ?? 0 })))
})
adminRoutes.put('/admin/coupons/:code', (req, res) => {
  res.json(coupons.save(couponSchema.parse({ ...req.body, code: req.params.code })))
})
adminRoutes.delete('/admin/coupons/:code', (req, res) => {
  if (!coupons.delete(req.params.code.toUpperCase())) throw new HttpError(404, 'Cupón no encontrado')
  res.status(204).end()
})

// ───────── Usuarios ─────────
adminRoutes.get('/admin/users', (_req, res) => {
  res.json(users.list())
})
adminRoutes.patch('/admin/users/:id', (req, res) => {
  const { role } = roleSchema.parse(req.body)
  if (req.params.id === req.user!.id && role !== 'admin') throw new HttpError(400, 'No puedes quitarte tu propio rol de administrador')
  if (!users.byId(req.params.id)) throw new HttpError(404, 'Usuario no encontrado')
  users.setRole(req.params.id, role)
  res.json(publicUser(users.byId(req.params.id)!))
})

// ───────── Configuración ─────────
adminRoutes.put('/admin/settings', (req, res) => {
  res.json(settings.save(settingsSchema.parse(req.body)))
})
