/** Acceso a datos: convierte filas SQLite ⇄ modelos del dominio (los mismos tipos del frontend). */
import crypto from 'node:crypto'
import type { Category, Coupon, Order, OrderStatus, Product, Project, Quote, QuoteStatus, Review, ReviewStatus, Role, StoreSettings, User } from '../../src/types/index.js'
import { db, json, now } from './db.js'

export const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('base64url')}`
export const round = (n: number) => Math.round(n * 100) / 100
type Row = Record<string, unknown>

// ───────── Usuarios ─────────
export interface UserRow extends User {
  password_hash: string
}
const toUser = (r: Row): UserRow => ({
  id: String(r.id),
  name: String(r.name),
  email: String(r.email),
  phone: String(r.phone ?? ''),
  phoneVerified: !!r.phone_verified,
  birthDate: (r.birth_date as string) ?? undefined,
  address: (r.address as string) ?? undefined,
  city: (r.city as string) ?? undefined,
  role: r.role as Role,
  createdAt: String(r.created_at),
  password_hash: String(r.password_hash),
})
export const publicUser = ({ password_hash: _h, ...u }: UserRow): User => u // eslint-disable-line @typescript-eslint/no-unused-vars

export const users = {
  byId: (id: string) => {
    const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
    return r ? toUser(r) : null
  },
  byEmail: (email: string) => {
    const r = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as Row | undefined
    return r ? toUser(r) : null
  },
  byPhone: (phone: string) => {
    const r = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as Row | undefined
    return r ? toUser(r) : null
  },
  list: () => (db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Row[]).map(toUser).map(publicUser),
  countAdmins: () => Number((db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as Row).n),
  countCustomers: () => Number((db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'cliente'").get() as Row).n),
  create(u: { name: string; email: string; phone: string; birthDate?: string; role?: Role; passwordHash: string; phoneVerified?: boolean }) {
    const id = newId('u')
    db.prepare(
      'INSERT INTO users (id, name, email, phone, phone_verified, birth_date, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, u.name, u.email.toLowerCase(), u.phone, u.phoneVerified ? 1 : 0, u.birthDate ?? null, u.role ?? 'cliente', u.passwordHash, now())
    return users.byId(id)!
  },
  markPhoneVerified: (id: string) => db.prepare('UPDATE users SET phone_verified = 1 WHERE id = ?').run(id),
  update(id: string, p: Partial<Pick<User, 'name' | 'phone' | 'address' | 'city'>>) {
    const cur = users.byId(id)!
    db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, city = ? WHERE id = ?').run(
      p.name ?? cur.name,
      cur.phone, // el celular no se cambia aquí: es el factor de 2FA
      p.address ?? cur.address ?? null,
      p.city ?? cur.city ?? null,
      id,
    )
    return users.byId(id)!
  },
  setRole: (id: string, role: Role) => db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id),
  setPassword: (id: string, hash: string) => db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id),
}

// ───────── Categorías ─────────
export const categories = {
  list: () => (db.prepare('SELECT data FROM categories ORDER BY position').all() as Row[]).map((r) => json<Category>(r.data)),
  upsert: (c: Category, position: number) =>
    db.prepare('INSERT INTO categories (id, position, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET position = excluded.position, data = excluded.data').run(
      c.id,
      position,
      JSON.stringify(c),
    ),
}

// ───────── Productos ─────────
export const products = {
  all: () => (db.prepare('SELECT data FROM products ORDER BY created_at DESC').all() as Row[]).map((r) => json<Product>(r.data)),
  bySlugOrId: (key: string) => {
    const r = db.prepare('SELECT data FROM products WHERE slug = ? OR id = ?').get(key, key) as Row | undefined
    return r ? json<Product>(r.data) : null
  },
  byId: (id: string) => {
    const r = db.prepare('SELECT data FROM products WHERE id = ?').get(id) as Row | undefined
    return r ? json<Product>(r.data) : null
  },
  bySku: (sku: string) => {
    const r = db.prepare("SELECT data FROM products WHERE upper(json_extract(data, '$.sku')) = upper(?)").get(sku) as Row | undefined
    return r ? json<Product>(r.data) : null
  },
  slugTaken: (slug: string, exceptId?: string) => !!db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, exceptId ?? ''),
  save(p: Product, createdAt = now()) {
    db.prepare(
      `INSERT INTO products (id, slug, category, subcategory, price, stock, featured, is_new, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, category = excluded.category, subcategory = excluded.subcategory,
         price = excluded.price, stock = excluded.stock, featured = excluded.featured, is_new = excluded.is_new, data = excluded.data`,
    ).run(p.id, p.slug, p.category, p.subcategory, p.price, p.stock, p.featured ? 1 : 0, p.isNew ? 1 : 0, createdAt, JSON.stringify(p))
    return p
  },
  delete: (id: string) => db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0,
  count: () => Number((db.prepare('SELECT COUNT(*) AS n FROM products').get() as Row).n),
}

// ───────── Proyectos ─────────
export const projects = {
  list: () => (db.prepare('SELECT data FROM projects ORDER BY created_at DESC').all() as Row[]).map((r) => json<Project>(r.data)),
  save(p: Project, createdAt = now()) {
    db.prepare('INSERT INTO projects (id, created_at, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(p.id, createdAt, JSON.stringify(p))
    return p
  },
  exists: (id: string) => !!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id),
  delete: (id: string) => db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0,
}

// ───────── Cupones ─────────
const toCoupon = (r: Row): Coupon => ({ code: String(r.code), percent: Number(r.percent), description: String(r.description), active: !!r.active, firstOrderOnly: !!r.first_order_only })
export const coupons = {
  list: () => (db.prepare('SELECT * FROM coupons ORDER BY code').all() as Row[]).map(toCoupon),
  active: (code: string) => {
    const r = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code.trim().toUpperCase()) as Row | undefined
    return r ? toCoupon(r) : null
  },
  save(c: Coupon) {
    db.prepare(
      `INSERT INTO coupons (code, percent, description, active, first_order_only) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, description = excluded.description, active = excluded.active, first_order_only = excluded.first_order_only`,
    ).run(c.code, c.percent, c.description, c.active === false ? 0 : 1, c.firstOrderOnly ? 1 : 0)
    return c
  },
  delete: (code: string) => db.prepare('DELETE FROM coupons WHERE code = ?').run(code).changes > 0,
  /** ¿Esta persona ya usó el cupón? (por cuenta, correo o celular; los pedidos cancelados no cuentan) */
  usedBy: (code: string, u: { id: string; email: string; phone: string }) =>
    !!db
      .prepare(
        `SELECT 1 FROM orders WHERE status != 'cancelado' AND json_extract(data, '$.couponCode') = ?
           AND (user_id = ? OR email = ? OR json_extract(data, '$.customer.phone') = ?) LIMIT 1`,
      )
      .get(code, u.id, u.email.toLowerCase(), u.phone),
  /** ¿La persona ya tiene algún pedido (no cancelado)? → para cupones de primera compra */
  hasOrders: (u: { id: string; email: string; phone: string }) =>
    !!db
      .prepare(
        `SELECT 1 FROM orders WHERE status != 'cancelado'
           AND (user_id = ? OR email = ? OR json_extract(data, '$.customer.phone') = ?) LIMIT 1`,
      )
      .get(u.id, u.email.toLowerCase(), u.phone),
  /** Veces que se usó cada cupón (pedidos no cancelados) */
  usage: () =>
    Object.fromEntries(
      (
        db
          .prepare(
            `SELECT json_extract(data, '$.couponCode') AS code, COUNT(*) AS n FROM orders
             WHERE status != 'cancelado' AND json_extract(data, '$.couponCode') IS NOT NULL GROUP BY code`,
          )
          .all() as Row[]
      ).map((r) => [String(r.code), Number(r.n)]),
    ) as Record<string, number>,
}

// ───────── Pedidos ─────────
export const orders = {
  list: () => (db.prepare('SELECT data FROM orders ORDER BY seq DESC').all() as Row[]).map((r) => json<Order>(r.data)),
  byUser: (userId: string, email: string) =>
    (db.prepare('SELECT data FROM orders WHERE user_id = ? OR email = ? ORDER BY seq DESC').all(userId, email) as Row[]).map((r) => json<Order>(r.data)),
  byId: (id: string) => {
    const r = db.prepare('SELECT data FROM orders WHERE id = ?').get(id) as Row | undefined
    return r ? json<Order>(r.data) : null
  },
  /** Inserta y asigna el número correlativo CEC-xxxx */
  create(o: Omit<Order, 'id'>) {
    const res = db
      .prepare('INSERT INTO orders (user_id, email, status, total, created_at, data) VALUES (?, ?, ?, ?, ?, ?)')
      .run(o.userId ?? null, o.customer.email.toLowerCase(), o.status, o.total, o.createdAt, '{}')
    const order: Order = { ...o, id: `CEC-${1000 + Number(res.lastInsertRowid)}` }
    db.prepare('UPDATE orders SET id = ?, data = ? WHERE seq = ?').run(order.id, JSON.stringify(order), res.lastInsertRowid)
    return order
  },
  setStatus(id: string, status: OrderStatus, byCustomer = false) {
    const o = orders.byId(id)
    if (!o) return null
    o.status = status
    if (status === 'entregado') {
      o.deliveredAt ??= now()
      if (byCustomer) o.confirmedByCustomer = true
    }
    db.prepare('UPDATE orders SET status = ?, data = ? WHERE id = ?').run(status, JSON.stringify(o), id)
    return o
  },
}

// ───────── Cotizaciones ─────────
export const quotes = {
  list: () => (db.prepare('SELECT data FROM quotes ORDER BY created_at DESC').all() as Row[]).map((r) => json<Quote>(r.data)),
  create(q: Quote) {
    db.prepare('INSERT INTO quotes (id, status, created_at, data) VALUES (?, ?, ?, ?)').run(q.id, q.status, q.createdAt, JSON.stringify(q))
    return q
  },
  setStatus(id: string, status: QuoteStatus) {
    const r = db.prepare('SELECT data FROM quotes WHERE id = ?').get(id) as Row | undefined
    if (!r) return null
    const q = { ...json<Quote>(r.data), status }
    db.prepare('UPDATE quotes SET status = ?, data = ? WHERE id = ?').run(status, JSON.stringify(q), id)
    return q
  },
  countNew: () => Number((db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE status = 'nueva'").get() as Row).n),
}

// ───────── Configuración ─────────
export const DEFAULT_SETTINGS: StoreSettings = { seasonMode: 'auto', showParticles: true, showSeasonBanner: true, welcomeCoupon: 'BIENVENIDA10' }
export const settings = {
  get(): StoreSettings {
    const r = db.prepare("SELECT value FROM settings WHERE key = 'store'").get() as Row | undefined
    return r ? { ...DEFAULT_SETTINGS, ...json<StoreSettings>(r.value) } : DEFAULT_SETTINGS
  },
  save(s: StoreSettings) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('store', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s))
    return s
  },
}

// ───────── Reseñas ─────────
/** "María Torres" → "María T." */
export const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first
}
const REVIEW_SELECT = `SELECT r.*, u.name AS user_name, json_extract(p.data, '$.name') AS product_name
  FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id`
const toReview = (r: Row): Review => ({
  id: String(r.id),
  productId: String(r.product_id),
  productName: String(r.product_name ?? ''),
  userId: String(r.user_id),
  authorName: shortName(String(r.user_name ?? 'Cliente')),
  rating: Number(r.rating),
  comment: String(r.comment),
  status: r.status as ReviewStatus,
  verified: !!r.verified,
  createdAt: String(r.created_at),
})
export const reviews = {
  list: () => (db.prepare(`${REVIEW_SELECT} ORDER BY r.created_at DESC`).all() as Row[]).map(toReview),
  byUser: (userId: string) => (db.prepare(`${REVIEW_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(userId) as Row[]).map(toReview),
  activeForProduct: (productId: string) =>
    (db.prepare(`${REVIEW_SELECT} WHERE r.product_id = ? AND r.status = 'activa' ORDER BY r.created_at DESC`).all(productId) as Row[]).map(toReview),
  byUserAndProduct: (userId: string, productId: string) => {
    const r = db.prepare(`${REVIEW_SELECT} WHERE r.user_id = ? AND r.product_id = ?`).get(userId, productId) as Row | undefined
    return r ? toReview(r) : null
  },
  byId: (id: string) => {
    const r = db.prepare(`${REVIEW_SELECT} WHERE r.id = ?`).get(id) as Row | undefined
    return r ? toReview(r) : null
  },
  create(r: { productId: string; userId: string; rating: number; comment: string; verified: boolean }) {
    const id = newId('rv')
    db.prepare('INSERT INTO reviews (id, product_id, user_id, rating, comment, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      r.productId,
      r.userId,
      r.rating,
      r.comment,
      r.verified ? 1 : 0,
      now(),
    )
    return reviews.byId(id)!
  },
  setStatus: (id: string, status: ReviewStatus) => db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id).changes > 0,
  delete: (id: string) => db.prepare('DELETE FROM reviews WHERE id = ?').run(id).changes > 0,
  countPending: () => Number((db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pendiente'").get() as Row).n),
  /** Promedio y cantidad SOLO de reseñas activas */
  summary: (productId: string) => {
    const r = db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE product_id = ? AND status = 'activa'").get(productId) as Row
    return { reviews: Number(r.n), rating: r.n ? Math.round(Number(r.avg) * 10) / 10 : 0 }
  },
}

export const newsletter = {
  add: (email: string) => db.prepare('INSERT OR IGNORE INTO newsletter (email, created_at) VALUES (?, ?)').run(email.toLowerCase(), now()),
}
