/** Reglas de negocio. Precios, descuentos y envío SIEMPRE se calculan aquí, nunca se confía en el cliente. */
import type { z } from 'zod'
import type { AdminStats, Coupon, Order, Product, ProductQuery, Quote, QuoteResponse } from '../../src/types/index.js'
import { isFreeShipping } from '../../src/config/store.js'
import { MATERIALS } from '../../src/data/mock.js'
import { HttpError } from './auth.js'
import { db, now, tx } from './db.js'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { coupons, orders, products, quotes, reviews, round, users, type UserRow } from './repo.js'
import type { orderSchema, quoteSchema } from './validation.js'

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function queryProducts(q: ProductQuery) {
  let list = products.all()
  if (q.category) list = list.filter((p) => p.category === q.category)
  if (q.subcategory) list = list.filter((p) => p.subcategory === q.subcategory)
  if (q.season) list = list.filter((p) => p.seasons?.includes(q.season!))
  if (q.minPrice != null) list = list.filter((p) => p.price >= q.minPrice!)
  if (q.maxPrice != null) list = list.filter((p) => p.price <= q.maxPrice!)
  if (q.search) {
    const term = normalize(q.search)
    list = list.filter((p) => normalize([p.name, p.shortDescription, p.subcategory, ...p.tags].join(' ')).includes(term))
  }
  const sorters: Record<string, (a: Product, b: Product) => number> = {
    'precio-asc': (a, b) => a.price - b.price,
    'precio-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    nuevos: (a, b) => Number(!!b.isNew) - Number(!!a.isNew),
  }
  if (q.sort && sorters[q.sort]) list.sort(sorters[q.sort])
  return list
}

export function featured(season?: string) {
  const all = products.all()
  const seasonal = season ? all.filter((p) => p.seasons?.includes(season)) : []
  const rest = all.filter((p) => p.featured && !seasonal.includes(p))
  return [...seasonal, ...rest].slice(0, 8)
}

export function createOrder(input: z.infer<typeof orderSchema>, user?: UserRow): Order {
  const userId = user?.id
  return tx(() => {
    const items = input.items.map((i) => {
      const p = products.byId(i.productId)
      if (!p) throw new HttpError(400, 'Un producto del carrito ya no está disponible')
      if (p.stock < 999) {
        if (p.stock < i.quantity) throw new HttpError(409, `Solo quedan ${p.stock} unidades de ${p.name}`)
        products.save({ ...p, stock: p.stock - i.quantity })
      }
      return { productId: p.id, name: p.name, price: p.price, quantity: i.quantity, note: i.note || undefined }
    })
    const subtotal = round(items.reduce((s, i) => s + i.price * i.quantity, 0))
    // Cupón: requiere cuenta, un solo uso por persona y, si aplica, solo primera compra
    let coupon = null
    if (input.couponCode) {
      coupon = coupons.active(input.couponCode)
      if (!coupon) throw new HttpError(400, 'El cupón ya no es válido')
      if (!user) throw new HttpError(401, 'Ingresa a tu cuenta para usar cupones')
      assertCouponAllowed(coupon, user)
      assertCouponAllowed(coupon, { id: user.id, email: input.customer.email, phone: input.customer.phone })
    }
    const discount = coupon ? round((subtotal * coupon.percent) / 100) : 0
    // envío gratis desde el mínimo de la zona; si no, el valor se coordina por WhatsApp
    const shipping = 0
    const shippingPending = !isFreeShipping(input.shippingZone, subtotal - discount)
    return orders.create({
      userId,
      customer: input.customer,
      items,
      couponCode: coupon?.code,
      shippingZone: input.shippingZone,
      subtotal,
      discount,
      shipping,
      shippingPending,
      total: round(subtotal - discount + shipping),
      status: 'recibido',
      createdAt: now(),
    })
  })
}

/** Ruta del adjunto guardado para una cotización (o null si no existe) */
export function quoteFilePath(quoteId: string) {
  const dir = config.quoteFilesDir
  if (!fs.existsSync(dir)) return null
  const name = fs.readdirSync(dir).find((f) => f.startsWith(quoteId + '.'))
  return name ? path.join(dir, name) : null
}

export function createQuote(input: z.infer<typeof quoteSchema>, upload?: { path: string; originalname: string; size: number; mimetype: string }): QuoteResponse {
  const mat = MATERIALS.find((m) => m.id === input.material)
  const area = (input.width ?? 30) * (input.height ?? 30)
  const base = input.type === 'proyecto' ? 65 : input.type === 'letrero' ? 30 : 4
  const q: Quote = {
    ...input,
    id: 'COT-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    estimatedPrice: round(base + area * (mat?.pricePerCm2 ?? 0.004) * (input.quantity ?? 1)),
    estimatedDays: input.type === 'proyecto' ? 10 : input.type === 'letrero' ? 6 : 3,
    status: 'nueva',
    createdAt: now(),
  }
  if (upload) {
    // se mueve a la carpeta privada con el id de la cotización como nombre
    fs.mkdirSync(config.quoteFilesDir, { recursive: true })
    const ext = path.extname(upload.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6)
    fs.renameSync(upload.path, path.join(config.quoteFilesDir, q.id + ext))
    q.file = { name: upload.originalname.slice(0, 160), size: upload.size, type: upload.mimetype }
    q.fileName = q.file.name
  }
  quotes.create(q)
  return {
    id: q.id,
    estimatedPrice: q.estimatedPrice,
    estimatedDays: q.estimatedDays,
    message: `¡Gracias ${input.name.split(' ')[0]}! Un asesor te contactará en menos de 24 horas.`,
  }
}

export function stats(): AdminStats {
  const all = orders.list()
  const valid = all.filter((o) => o.status !== 'cancelado')
  const d = new Date()
  const month = valid.filter((o) => {
    const c = new Date(o.createdAt)
    return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear()
  })
  const salesByDay = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() - (6 - i))
    const key = day.toISOString().slice(0, 10)
    return { date: key, total: round(valid.filter((o) => o.createdAt.slice(0, 10) === key).reduce((s, o) => s + o.total, 0)) }
  })
  return {
    salesMonth: round(month.reduce((s, o) => s + o.total, 0)),
    ordersMonth: month.length,
    pendingOrders: all.filter((o) => ['recibido', 'pagado', 'en-produccion'].includes(o.status)).length,
    newQuotes: quotes.countNew(),
    pendingReviews: reviews.countPending(),
    customers: users.countCustomers(),
    salesByDay,
    lowStock: products.all().filter((p) => p.stock < 20),
    latestOrders: all.slice(0, 6),
  }
}

/** Reglas de uso del cupón para una persona (cuenta, correo o celular) */
export function assertCouponAllowed(c: Coupon, who: { id: string; email: string; phone: string }) {
  if (coupons.usedBy(c.code, who)) throw new HttpError(409, 'Ya usaste este cupón en un pedido anterior')
  if (c.firstOrderOnly && coupons.hasOrders(who)) throw new HttpError(409, 'Este cupón es solo para tu primera compra')
}

/** Recalcula estrellas y cantidad del producto con las reseñas ACTIVAS */
export function refreshProductRating(productId: string) {
  const p = products.byId(productId)
  if (!p) return
  products.save({ ...p, ...reviews.summary(productId) })
}

/** ¿El usuario recibió este producto? (pedido entregado) → puede opinar */
export function hasPurchased(userId: string, email: string, productId: string) {
  return orders.byUser(userId, email).some((o) => o.status === 'entregado' && o.items.some((i) => i.productId === productId))
}

export const slugify = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100)

export { db }
