/**
 * Analítica propia (sin terceros): páginas vistas, productos vistos y agregados al carrito.
 * - "Quién": si el visitante tiene sesión se asocia a su cuenta; si no, es un visitante anónimo
 *   identificado solo por un id aleatorio guardado en su navegador.
 * - No se guardan IPs. No se registran administradores ni bots.
 * - Los eventos se borran solos después de ANALYTICS_RETENTION_DAYS (180 por defecto).
 */
import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import type { AnalyticsSummary, VisitEvent, VisitorSummary } from '../../src/types/index.js'
import { HttpError, optionalAuth, requireAdmin } from './auth.js'
import { db, now } from './db.js'

const RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 180)
type Row = Record<string, unknown>

export function migrateAnalytics() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visit_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id  TEXT NOT NULL,
      user_id     TEXT,
      type        TEXT NOT NULL CHECK (type IN ('page','product','cart')),
      path        TEXT NOT NULL,
      product_id  TEXT,
      referrer    TEXT,
      device      TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created ON visit_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visit_events(visitor_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_visits_product ON visit_events(product_id);
  `)
  purgeOld()
  setInterval(purgeOld, 24 * 3600_000).unref()
}

function purgeOld() {
  const limit = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()
  db.prepare('DELETE FROM visit_events WHERE created_at < ?').run(limit)
}

// ───────── Clasificación del visitante (sin guardar el user-agent completo) ─────────
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|curl|wget|python|axios|node-fetch/i
function device(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'Tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'Celular'
  return 'Computadora'
}
/** Fuente de la visita a partir del referrer (dominio), sin guardar URLs completas de terceros */
function source(ref?: string) {
  if (!ref) return null
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '')
    if (/google\./.test(host)) return 'Google'
    if (/facebook\.|fb\./.test(host)) return 'Facebook'
    if (/instagram\./.test(host)) return 'Instagram'
    if (/whatsapp\.|wa\.me/.test(host)) return 'WhatsApp'
    if (/tiktok\./.test(host)) return 'TikTok'
    if (/bing\./.test(host)) return 'Bing'
    return host.slice(0, 80)
  } catch {
    return null
  }
}

const trackSchema = z.object({
  visitorId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  type: z.enum(['page', 'product', 'cart']),
  path: z.string().max(300),
  productId: z.string().max(120).optional(),
  referrer: z.string().max(500).optional(),
})

export const analyticsRoutes = Router()

const trackLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false })

/** Registro de un evento (lo llama la tienda en cada página / producto / agregado al carrito) */
analyticsRoutes.post('/track', trackLimiter, optionalAuth, (req: Request, res) => {
  const ua = String(req.headers['user-agent'] ?? '')
  const parsed = trackSchema.safeParse(req.body)
  // nunca se responde con error: el registro no debe afectar la navegación
  if (!parsed.success || BOT.test(ua) || req.user?.role === 'admin' || req.headers.dnt === '1') return void res.status(204).end()
  const e = parsed.data
  const ownHost = req.headers.host ?? ''
  const ref = e.referrer && !e.referrer.includes(ownHost) ? source(e.referrer) : null
  db.prepare('INSERT INTO visit_events (visitor_id, user_id, type, path, product_id, referrer, device, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    e.visitorId,
    req.user?.id ?? null,
    e.type,
    e.path,
    e.productId ?? null,
    ref,
    device(ua),
    now(),
  )
  res.status(204).end()
})

// ───────── Panel de administración ─────────
const productName = (id: string) => {
  const r = db.prepare("SELECT json_extract(data, '$.name') AS n FROM products WHERE id = ?").get(id) as Row | undefined
  return r ? String(r.n) : '(producto eliminado)'
}
const productSlug = (id: string) => {
  const r = db.prepare("SELECT slug AS s FROM products WHERE id = ?").get(id) as Row | undefined
  return r?.s ? String(r.s) : null
}

analyticsRoutes.get('/admin/analytics', requireAdmin, (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const all = (sql: string, ...p: (string | number)[]) => db.prepare(sql).all(since, ...p) as Row[]
  const one = (sql: string) => db.prepare(sql).get(since) as Row

  // un visitante = visitor_id; si en algún momento tuvo sesión, se identifica con esa cuenta
  const totals = one(`SELECT COUNT(DISTINCT visitor_id) v, SUM(type='page') pv, SUM(type='product') prv, SUM(type='cart') c,
    COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN visitor_id END) idv FROM visit_events WHERE created_at >= ?`)

  const byDayRows = all(`SELECT substr(created_at,1,10) d, COUNT(DISTINCT visitor_id) v FROM visit_events WHERE created_at >= ? GROUP BY d`)
  const byDay = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const d = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    return { date: d, visitors: Number(byDayRows.find((r) => r.d === d)?.v ?? 0) }
  })

  const topProducts = all(
    `SELECT product_id id, SUM(type='product') views, COUNT(DISTINCT CASE WHEN type='product' THEN visitor_id END) visitors, SUM(type='cart') cart
     FROM visit_events WHERE created_at >= ? AND product_id IS NOT NULL GROUP BY product_id ORDER BY views DESC, cart DESC LIMIT 15`,
  ).map((r) => ({ id: String(r.id), name: productName(String(r.id)), slug: productSlug(String(r.id)), views: Number(r.views), visitors: Number(r.visitors), addedToCart: Number(r.cart) }))

  const referrers = all(
    `SELECT COALESCE(r, 'Directo') s, COUNT(*) v FROM (
       SELECT visitor_id, (SELECT referrer FROM visit_events e2 WHERE e2.visitor_id = e.visitor_id AND referrer IS NOT NULL ORDER BY id LIMIT 1) r
       FROM visit_events e WHERE created_at >= ? GROUP BY visitor_id
     ) GROUP BY s ORDER BY v DESC LIMIT 8`,
  ).map((r) => ({ source: String(r.s), visitors: Number(r.v) }))
  const devices = all(`SELECT device, COUNT(DISTINCT visitor_id) v FROM visit_events WHERE created_at >= ? GROUP BY device ORDER BY v DESC`).map((r) => ({
    device: String(r.device),
    visitors: Number(r.v),
  }))

  const visitorRows = all(
    `SELECT visitor_id, MAX(user_id) user_id, MIN(created_at) first, MAX(created_at) last, SUM(type='page') pv,
       (SELECT device FROM visit_events e2 WHERE e2.visitor_id = e.visitor_id ORDER BY id DESC LIMIT 1) device,
       (SELECT referrer FROM visit_events e3 WHERE e3.visitor_id = e.visitor_id AND referrer IS NOT NULL ORDER BY id LIMIT 1) ref
     FROM visit_events e WHERE created_at >= ? GROUP BY visitor_id ORDER BY last DESC LIMIT 60`,
  )
  const recentVisitors: VisitorSummary[] = visitorRows.map((r) => {
    const u = r.user_id ? (db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(String(r.user_id)) as Row | undefined) : undefined
    const prods = db
      .prepare(
        `SELECT product_id id, SUM(type='product') views, MAX(type='cart') cart FROM visit_events
         WHERE visitor_id = ? AND created_at >= ? AND product_id IS NOT NULL GROUP BY product_id ORDER BY MAX(id) DESC LIMIT 12`,
      )
      .all(String(r.visitor_id), since) as Row[]
    return {
      visitorId: String(r.visitor_id),
      user: u ? { id: String(u.id), name: String(u.name), email: String(u.email), phone: String(u.phone) } : null,
      firstSeen: String(r.first),
      lastSeen: String(r.last),
      pageViews: Number(r.pv),
      device: String(r.device ?? ''),
      referrer: r.ref ? String(r.ref) : undefined,
      products: prods.map((p) => ({ id: String(p.id), name: productName(String(p.id)), views: Number(p.views), addedToCart: !!p.cart })),
    }
  })

  const summary: AnalyticsSummary = {
    days,
    visitors: Number(totals.v ?? 0),
    identifiedVisitors: Number(totals.idv ?? 0),
    pageViews: Number(totals.pv ?? 0),
    productViews: Number(totals.prv ?? 0),
    addToCart: Number(totals.c ?? 0),
    byDay,
    topProducts,
    referrers,
    devices,
    recentVisitors,
  }
  res.json(summary)
})

/** Recorrido de un visitante (últimos 300 eventos) */
analyticsRoutes.get('/admin/analytics/visitors/:id', requireAdmin, (req, res) => {
  const rows = db
    .prepare('SELECT type, path, product_id, referrer, created_at FROM visit_events WHERE visitor_id = ? ORDER BY id DESC LIMIT 300')
    .all(String(req.params.id)) as Row[]
  if (!rows.length) throw new HttpError(404, 'Visitante sin actividad')
  const events: VisitEvent[] = rows.map((r) => ({
    type: r.type as VisitEvent['type'],
    path: String(r.path),
    productId: r.product_id ? String(r.product_id) : undefined,
    productName: r.product_id ? productName(String(r.product_id)) : undefined,
    referrer: r.referrer ? String(r.referrer) : undefined,
    createdAt: String(r.created_at),
  }))
  res.json(events)
})
