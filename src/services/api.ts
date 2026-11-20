/**
 * CAPA DE SERVICIOS
 * -----------------
 * Toda la UI consume `api` (nunca los datos mock directamente).
 * - mockApi: simula el backend con latencia y una base de datos en localStorage (mockDb.ts)
 * - httpApi: implementación real vía fetch; ajusta las rutas a tu backend.
 *
 * Se elige con VITE_USE_MOCK (por defecto: mock). El token de sesión se envía como
 * `Authorization: Bearer <token>` en la versión HTTP.
 */
import type {
  AdminStats,
  AnalyticsSummary,
  VisitEvent,
  AuthSession,
  TwoFactorChallenge,
  Category,
  Coupon,
  Order,
  OrderRequest,
  OrderStatus,
  Product,
  ProductImportItem,
  ProductImportResult,
  ProductQuery,
  Project,
  ProjectMedia,
  Quote,
  QuoteRequest,
  QuoteResponse,
  QuoteStatus,
  Review,
  ReviewRequest,
  ReviewStatus,
  RegisterRequest,
  Role,
  StoreSettings,
  User,
  WelcomeOffer,
} from '../types'
import { MATERIALS } from '../data/mock'
import { isFreeShipping } from '../config/store'
import { commit, db, resetDb, round, uid, type DbUser } from './mockDb'
import { compressImage } from '../utils/image'
import { withLaser, withReading } from '../store/laser'

export interface StoreApi {
  // Tienda (público)
  getCategories(): Promise<Category[]>
  getProducts(query?: ProductQuery): Promise<Product[]>
  getProduct(slug: string): Promise<Product | null>
  getFeatured(season?: string): Promise<Product[]>
  getRelated(product: Product): Promise<Product[]>
  getProjects(): Promise<Project[]>
  /** Reseñas ACTIVAS de un producto */
  getReviews(slug: string): Promise<Review[]>
  /** Mi reseña del producto y si puedo opinar (requiere sesión) */
  myReview(slug: string): Promise<{ review: Review | null; canReview: boolean }>
  createReview(slug: string, req: ReviewRequest): Promise<Review>
  validateCoupon(code: string): Promise<Coupon | null>
  /** Cupón por crear cuenta (null si no hay oferta activa) */
  getWelcomeOffer(): Promise<WelcomeOffer | null>
  /** `file`: diseño adjunto (se guarda en privado; solo lo ve el admin) */
  requestQuote(req: QuoteRequest, file?: File): Promise<QuoteResponse>
  createOrder(req: OrderRequest): Promise<Order>
  subscribe(email: string): Promise<{ ok: true }>
  getSettings(): Promise<StoreSettings>

  // Cuenta de usuario
  /** Registro/login devuelven un desafío: se envía un código al celular (2FA) */
  register(req: RegisterRequest): Promise<TwoFactorChallenge>
  login(email: string, password: string): Promise<TwoFactorChallenge>
  verify2fa(challengeId: string, code: string): Promise<AuthSession>
  resend2fa(challengeId: string): Promise<TwoFactorChallenge>
  me(): Promise<User | null>
  updateProfile(patch: Partial<Pick<User, 'name' | 'address' | 'city'>>): Promise<User>
  myOrders(): Promise<Order[]>
  myOrder(id: string): Promise<Order | null>
  /** El cliente confirma que recibió el pedido */
  confirmDelivery(id: string): Promise<Order>
  myReviews(): Promise<Review[]>

  // Administración (requiere rol admin)
  admin: {
    stats(): Promise<AdminStats>
    /** Visitas de los últimos `days` días */
    analytics(days: number): Promise<AnalyticsSummary>
    /** Recorrido de un visitante */
    visitorEvents(visitorId: string): Promise<VisitEvent[]>
    saveProduct(p: Product): Promise<Product>
    deleteProduct(id: string): Promise<void>
    /** Importación masiva desde Excel; el SKU es la clave (actualiza o crea) */
    importProducts(items: ProductImportItem[], updateExisting: boolean): Promise<ProductImportResult>
    uploadImage(file: File): Promise<string>
    /** Foto o video para proyectos */
    uploadMedia(file: File): Promise<ProjectMedia>
    /** Descarga el adjunto privado de una cotización */
    quoteFile(id: string): Promise<Blob>
    orders(): Promise<Order[]>
    updateOrderStatus(id: string, status: OrderStatus): Promise<Order>
    reviews(): Promise<Review[]>
    updateReviewStatus(id: string, status: ReviewStatus): Promise<Review>
    deleteReview(id: string): Promise<void>
    quotes(): Promise<Quote[]>
    updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote>
    saveProject(p: Project): Promise<Project>
    deleteProject(id: string): Promise<void>
    coupons(): Promise<Coupon[]>
    saveCoupon(c: Coupon): Promise<Coupon>
    deleteCoupon(code: string): Promise<void>
    users(): Promise<User[]>
    setUserRole(id: string, role: Role): Promise<User>
    saveSettings(s: StoreSettings): Promise<StoreSettings>
    /** Solo en modo demo */
    resetDemo?(): Promise<void>
  }
}

// Token de la sesión actual (lo fija el store de autenticación)
let authToken: string | null = null
export const setAuthToken = (t: string | null) => {
  authToken = t
}
export const getAuthToken = () => authToken

// ───────────────────────── MOCK ─────────────────────────
const delay = <T,>(value: T, ms = 250 + Math.random() * 300) =>
  new Promise<T>((res) => setTimeout(() => res(structuredClone(value)), ms))
const fail = (msg: string, ms = 400) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const publicUser = ({ password: _pw, ...u }: DbUser): User => u // eslint-disable-line @typescript-eslint/no-unused-vars
const sessionUser = () => {
  const id = authToken?.startsWith('mock.') ? authToken.slice(5) : null
  return id ? db().users.find((u) => u.id === id) ?? null : null
}
const requireUser = () => {
  const u = sessionUser()
  if (!u) throw new Error('Debes iniciar sesión')
  return u
}
const requireAdmin = () => {
  const u = requireUser()
  if (u.role !== 'admin') throw new Error('No autorizado')
  return u
}
/** Ejecuta fn con latencia simulada y convierte excepciones en promesas rechazadas */
const run = <T,>(fn: () => T, ms?: number): Promise<T> => {
  try {
    return delay(fn(), ms)
  } catch (e) {
    return fail((e as Error).message)
  }
}
/** Celular de Ecuador → 09XXXXXXXX (mismo criterio que el backend) */
export function normalizeEcPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('593')) d = d.slice(3)
  if (d.length === 9 && d.startsWith('9')) d = '0' + d
  return /^09\d{8}$/.test(d) ? d : null
}

/** ¿Esta persona ya usó el cupón? (cuenta, correo o celular; pedidos cancelados no cuentan) */
const couponUsed = (code: string, userId: string, email: string, phone: string) =>
  db().orders.some(
    (o) =>
      o.status !== 'cancelado' &&
      o.couponCode === code &&
      (o.userId === userId || o.customer.email.toLowerCase() === email.toLowerCase() || normalizeEcPhone(o.customer.phone) === normalizeEcPhone(phone)),
  )

/** Mismas reglas que el backend: un uso por persona y, si aplica, solo primera compra */
function couponAllowed(c: Coupon, userId: string, email: string, phone: string) {
  if (couponUsed(c.code, userId, email, phone)) throw new Error('Ya usaste este cupón en un pedido anterior')
  const hasOrders = db().orders.some(
    (o) => o.status !== 'cancelado' && (o.userId === userId || o.customer.email.toLowerCase() === email.toLowerCase() || normalizeEcPhone(o.customer.phone) === normalizeEcPhone(phone)),
  )
  if (c.firstOrderOnly && hasOrders) throw new Error('Este cupón es solo para tu primera compra')
}

/** ¿El usuario recibió este producto? (pedido entregado) */
const purchased = (u: DbUser, productId: string) =>
  db().orders.some((o) => (o.userId === u.id || o.customer.email === u.email) && o.status === 'entregado' && o.items.some((i) => i.productId === productId))

/** Estrellas del producto = promedio de reseñas ACTIVAS */
function refreshRating(productId: string) {
  const p = db().products.find((x) => x.id === productId)
  if (!p) return
  const act = db().reviews.filter((r) => r.productId === productId && r.status === 'activa')
  p.reviews = act.length
  p.rating = act.length ? Math.round((act.reduce((s, r) => s + r.rating, 0) / act.length) * 10) / 10 : 0
}

// Desafíos 2FA simulados (en memoria). En modo demo el código se muestra en pantalla.
const challenges = new Map<string, { userId: string; code: string }>()
function mockChallenge(u: DbUser): TwoFactorChallenge {
  const challengeId = crypto.randomUUID()
  const code = String(Math.floor(100000 + Math.random() * 900000))
  challenges.set(challengeId, { userId: u.id, code })
  return { twoFactorRequired: true, challengeId, phoneHint: u.phone.slice(0, 2) + '•••••' + u.phone.slice(-3), resendIn: 30, devCode: code }
}

const slugify = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const mockApi: StoreApi = {
  getCategories: () => delay(db().categories, 120),

  getProducts(q = {}) {
    let list = [...db().products]
    if (q.category) list = list.filter((p) => p.category === q.category)
    if (q.subcategory) list = list.filter((p) => p.subcategory === q.subcategory)
    if (q.season) list = list.filter((p) => p.seasons?.includes(q.season!))
    if (q.minPrice != null) list = list.filter((p) => p.price >= q.minPrice!)
    if (q.maxPrice != null) list = list.filter((p) => p.price <= q.maxPrice!)
    if (q.search) {
      const term = normalize(q.search)
      list = list.filter((p) => normalize([p.name, p.shortDescription, p.subcategory, ...p.tags].join(' ')).includes(term))
    }
    switch (q.sort) {
      case 'precio-asc':
        list.sort((a, b) => a.price - b.price)
        break
      case 'precio-desc':
        list.sort((a, b) => b.price - a.price)
        break
      case 'rating':
        list.sort((a, b) => b.rating - a.rating)
        break
      case 'nuevos':
        list.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew))
        break
    }
    return delay(list)
  },

  getProduct: (slug) => delay(db().products.find((p) => p.slug === slug || p.id === slug) ?? null),

  getFeatured(season) {
    const all = db().products
    const seasonal = season ? all.filter((p) => p.seasons?.includes(season)) : []
    const featured = all.filter((p) => p.featured && !seasonal.includes(p))
    return delay([...seasonal, ...featured].slice(0, 8))
  },

  getRelated: (product) => delay(db().products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)),

  getProjects: () => delay(db().projects),

  getReviews: (slug) => {
    const p = db().products.find((x) => x.slug === slug || x.id === slug)
    return delay(db().reviews.filter((r) => r.productId === p?.id && r.status === 'activa'))
  },

  myReview: (slug) =>
    run(() => {
      const u = requireUser()
      const p = db().products.find((x) => x.slug === slug || x.id === slug)
      const review = db().reviews.find((r) => r.productId === p?.id && r.userId === u.id) ?? null
      return { review, canReview: !review && !!p && purchased(u, p.id) }
    }),

  createReview: (slug, req) =>
    run(() => {
      const u = requireUser()
      const d = db()
      const p = d.products.find((x) => x.slug === slug || x.id === slug)
      if (!p) throw new Error('Producto no encontrado')
      if (d.reviews.some((r) => r.productId === p.id && r.userId === u.id)) throw new Error('Ya dejaste tu opinión sobre este producto')
      if (!purchased(u, p.id)) throw new Error('Podrás opinar cuando hayas recibido este producto')
      if (req.comment.trim().length < 10) throw new Error('Cuéntanos un poco más (mínimo 10 caracteres)')
      const [first, ...rest] = u.name.trim().split(/\s+/)
      const review: Review = {
        id: uid('rv'),
        productId: p.id,
        productName: p.name,
        userId: u.id,
        authorName: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
        rating: req.rating,
        comment: req.comment.trim(),
        status: 'pendiente',
        verified: true,
        createdAt: new Date().toISOString(),
      }
      d.reviews.unshift(review)
      commit()
      return review
    }),

  validateCoupon: (code) =>
    run(() => {
      const c = db().coupons.find((x) => x.active !== false && x.code === code.trim().toUpperCase())
      if (!c) return null
      const u = sessionUser()
      if (!u) throw new Error('Ingresa a tu cuenta para usar cupones')
      couponAllowed(c, u.id, u.email, u.phone)
      return c
    }, 400),

  getWelcomeOffer: () => {
    const code = db().settings.welcomeCoupon
    const c = code ? db().coupons.find((x) => x.code === code && x.active !== false) : undefined
    return delay(c ? { code: c.code, percent: c.percent } : null, 100)
  },

  requestQuote: (req, file) =>
    run(() => {
      const mat = MATERIALS.find((m) => m.id === req.material)
      const area = (req.width ?? 30) * (req.height ?? 30)
      const base = req.type === 'proyecto' ? 65 : req.type === 'letrero' ? 30 : 4
      const quote: Quote = {
        ...req,
        id: 'COT-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        estimatedPrice: round(base + area * (mat?.pricePerCm2 ?? 0.004) * (req.quantity ?? 1)),
        estimatedDays: req.type === 'proyecto' ? 10 : req.type === 'letrero' ? 6 : 3,
        status: 'nueva',
        createdAt: new Date().toISOString(),
        ...(file ? { file: { name: file.name, size: file.size, type: file.type }, fileName: file.name } : {}),
      }
      db().quotes.unshift(quote)
      commit()
      return {
        id: quote.id,
        estimatedPrice: quote.estimatedPrice,
        estimatedDays: quote.estimatedDays,
        message: `¡Gracias ${req.name.split(' ')[0]}! Un asesor te contactará en menos de 24 horas.`,
      }
    }, 1000),

  createOrder: (req) =>
    run(() => {
      const u = requireUser()
      req = { ...req, customer: { ...req.customer, email: u.email } }
      const d = db()
      const items = req.items.map((i) => {
        const p = d.products.find((x) => x.id === i.productId)
        if (!p) throw new Error('Producto no disponible')
        if (p.stock < 999) p.stock = Math.max(0, p.stock - i.quantity)
        return { productId: p.id, name: p.name, price: p.price, quantity: i.quantity, note: i.note }
      })
      const subtotal = round(items.reduce((s, i) => s + i.price * i.quantity, 0))
      const coupon = req.couponCode ? d.coupons.find((c) => c.code === req.couponCode && c.active !== false) : undefined
      if (req.couponCode && !coupon) throw new Error('El cupón ya no es válido. Quítalo del carrito para continuar.')
      if (coupon) {
        const u = sessionUser()
        if (!u) throw new Error('Ingresa a tu cuenta para usar cupones')
        couponAllowed(coupon, u.id, u.email, u.phone)
        couponAllowed(coupon, u.id, req.customer.email, req.customer.phone)
      }
      const discount = coupon ? round((subtotal * coupon.percent) / 100) : 0
      const shipping = 0
      const shippingPending = !isFreeShipping(req.shippingZone ?? 'nacional', subtotal - discount)
      const order: Order = {
        id: 'CEC-' + (1100 + d.orders.length),
        userId: sessionUser()?.id,
        customer: req.customer,
        items,
        couponCode: coupon?.code,
        shippingZone: req.shippingZone,
        subtotal,
        discount,
        shipping,
        shippingPending,
        total: round(subtotal - discount + shipping),
        status: 'recibido',
        createdAt: new Date().toISOString(),
      }
      d.orders.unshift(order)
      commit()
      return order
    }, 1200),

  subscribe: () => delay({ ok: true as const }, 500),

  getSettings: () => delay(db().settings, 0),

  // ── Cuenta ──
  register: (req) =>
    run(() => {
      const d = db()
      const email = req.email.trim().toLowerCase()
      if (d.users.some((u) => u.email === email)) throw new Error('Ya existe una cuenta con ese correo')
      if (req.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres')
      const phone = normalizeEcPhone(req.phone)
      if (!phone) throw new Error('Ingresa un celular válido de Ecuador (09XXXXXXXX)')
      if (d.users.some((u) => u.phone === phone)) throw new Error('Ese celular ya está registrado en otra cuenta')
      const user: DbUser = { id: uid('u'), name: req.name.trim(), email, phone, birthDate: req.birthDate, password: req.password, role: 'cliente', createdAt: new Date().toISOString() }
      d.users.push(user)
      commit()
      return mockChallenge(user)
    }, 700),

  login: (email, password) =>
    run(() => {
      const u = db().users.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
      if (!u) throw new Error('Correo o contraseña incorrectos')
      return mockChallenge(u)
    }, 600),

  verify2fa: (challengeId, code) =>
    run(() => {
      const c = challenges.get(challengeId)
      if (!c) throw new Error('El código ya no es válido. Vuelve a iniciar sesión.')
      if (c.code !== code) throw new Error('Código incorrecto')
      challenges.delete(challengeId)
      const u = db().users.find((x) => x.id === c.userId)!
      u.phoneVerified = true
      commit()
      return { token: 'mock.' + u.id, user: publicUser(u) }
    }, 500),

  resend2fa: (challengeId) =>
    run(() => {
      const c = challenges.get(challengeId)
      if (!c) throw new Error('El código ya no es válido. Vuelve a iniciar sesión.')
      challenges.delete(challengeId)
      return mockChallenge(db().users.find((x) => x.id === c.userId)!)
    }, 500),

  me: () => delay(sessionUser() ? publicUser(sessionUser()!) : null, 100),

  updateProfile: (patch) =>
    run(() => {
      const u = requireUser()
      Object.assign(u, patch)
      commit()
      return publicUser(u)
    }),

  myOrders: () =>
    run(() => {
      const u = requireUser()
      return db().orders.filter((o) => o.userId === u.id || o.customer.email === u.email)
    }),

  myOrder: (id) =>
    run(() => {
      const u = requireUser()
      return db().orders.find((o) => o.id === id && (o.userId === u.id || o.customer.email === u.email)) ?? null
    }),

  confirmDelivery: (id) =>
    run(() => {
      const u = requireUser()
      const o = db().orders.find((x) => x.id === id && (x.userId === u.id || x.customer.email === u.email))
      if (!o) throw new Error('Pedido no encontrado')
      if (o.status !== 'enviado' && o.status !== 'entregado') throw new Error('Podrás confirmar la entrega cuando el pedido esté en camino')
      if (o.status === 'enviado') {
        o.status = 'entregado'
        o.deliveredAt = new Date().toISOString()
        o.confirmedByCustomer = true
        commit()
      }
      return o
    }),

  myReviews: () => run(() => db().reviews.filter((r) => r.userId === requireUser().id)),

  // ── Administración ──
  admin: {
    stats: () =>
      run(() => {
        requireAdmin()
        const d = db()
        const now = new Date()
        const valid = d.orders.filter((o) => o.status !== 'cancelado')
        const month = valid.filter((o) => {
          const c = new Date(o.createdAt)
          return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
        })
        const salesByDay = Array.from({ length: 7 }, (_, i) => {
          const day = new Date(now)
          day.setDate(now.getDate() - (6 - i))
          const key = day.toISOString().slice(0, 10)
          const total = valid.filter((o) => o.createdAt.slice(0, 10) === key).reduce((s, o) => s + o.total, 0)
          return { date: key, total: round(total) }
        })
        return {
          salesMonth: round(month.reduce((s, o) => s + o.total, 0)),
          ordersMonth: month.length,
          pendingOrders: d.orders.filter((o) => ['recibido', 'pagado', 'en-produccion'].includes(o.status)).length,
          newQuotes: d.quotes.filter((q) => q.status === 'nueva').length,
          pendingReviews: d.reviews.filter((r) => r.status === 'pendiente').length,
          customers: d.users.filter((u) => u.role === 'cliente').length,
          salesByDay,
          lowStock: d.products.filter((p) => p.stock < 20),
          latestOrders: d.orders.slice(0, 6),
        }
      }),

    analytics: (days) =>
      run(() => {
        requireAdmin()
        return { days, visitors: 0, identifiedVisitors: 0, pageViews: 0, productViews: 0, addToCart: 0, byDay: [], topProducts: [], referrers: [], devices: [], recentVisitors: [] }
      }),

    visitorEvents: () => run(() => (requireAdmin(), [] as VisitEvent[])),

    saveProduct: (p) =>
      run(() => {
        requireAdmin()
        const d = db()
        const product: Product = { ...p, slug: p.slug || slugify(p.name) }
        if (!product.id) {
          product.id = slugify(p.name) || uid('p')
          if (d.products.some((x) => x.id === product.id)) product.id = uid(product.id)
          product.slug = product.slug || product.id
          d.products.unshift(product)
        } else {
          const i = d.products.findIndex((x) => x.id === p.id)
          if (i < 0) throw new Error('Producto no encontrado')
          d.products[i] = product
          refreshRating(product.id)
        }
        commit()
        return product
      }),

    deleteProduct: (id) =>
      run(() => {
        requireAdmin()
        db().products = db().products.filter((p) => p.id !== id)
        commit()
      }),

    importProducts: (items, updateExisting) =>
      run(() => {
        requireAdmin()
        const d = db()
        let created = 0
        let updated = 0
        let skipped = 0
        for (const it of items) {
          const ex = d.products.find((p) => p.sku?.toUpperCase() === it.sku.toUpperCase())
          if (ex) {
            if (!updateExisting) {
              skipped++
              continue
            }
            Object.assign(ex, { name: it.name, price: it.price, stock: it.stock })
            updated++
            continue
          }
          let id = slugify(it.name) || uid('p')
          if (d.products.some((p) => p.id === id)) id = `${id}-${slugify(it.sku)}`
          d.products.push({ id, slug: id, sku: it.sku, name: it.name, category: it.category, subcategory: it.subcategory, shortDescription: '', description: '', price: it.price, rating: 0, reviews: 0, stock: it.stock, tags: [it.sku.toLowerCase()], images: [], icon: 'cpu', gradient: ['#64748b', '#f59e0b'], specs: {} })
          created++
        }
        commit()
        return { created, updated, skipped }
      }, 800),

    async uploadImage(file) {
      requireAdmin()
      return compressImage(file)
    },

    async uploadMedia(file) {
      requireAdmin()
      // modo demo: los videos solo viven en esta pestaña (no caben en el almacenamiento del navegador)
      if (file.type.startsWith('video/')) return { url: URL.createObjectURL(file), type: 'video' as const }
      return { url: await compressImage(file), type: 'image' as const }
    },

    quoteFile: () => fail('En el modo demo los archivos adjuntos no se guardan'),

    orders: () => run(() => (requireAdmin(), db().orders)),

    updateOrderStatus: (id, status) =>
      run(() => {
        requireAdmin()
        const o = db().orders.find((x) => x.id === id)
        if (!o) throw new Error('Pedido no encontrado')
        o.status = status
        if (status === 'entregado') o.deliveredAt ??= new Date().toISOString()
        commit()
        return o
      }),

    reviews: () => run(() => (requireAdmin(), db().reviews)),

    updateReviewStatus: (id, status) =>
      run(() => {
        requireAdmin()
        const r = db().reviews.find((x) => x.id === id)
        if (!r) throw new Error('Reseña no encontrada')
        r.status = status
        refreshRating(r.productId)
        commit()
        return r
      }),

    deleteReview: (id) =>
      run(() => {
        requireAdmin()
        const r = db().reviews.find((x) => x.id === id)
        db().reviews = db().reviews.filter((x) => x.id !== id)
        if (r) refreshRating(r.productId)
        commit()
      }),

    quotes: () => run(() => (requireAdmin(), db().quotes)),

    updateQuoteStatus: (id, status) =>
      run(() => {
        requireAdmin()
        const q = db().quotes.find((x) => x.id === id)
        if (!q) throw new Error('Cotización no encontrada')
        q.status = status
        commit()
        return q
      }),

    saveProject: (p) =>
      run(() => {
        requireAdmin()
        const d = db()
        if (!p.id) {
          const created = { ...p, id: uid('pr') }
          d.projects.unshift(created)
          commit()
          return created
        }
        const i = d.projects.findIndex((x) => x.id === p.id)
        d.projects[i] = p
        commit()
        return p
      }),

    deleteProject: (id) =>
      run(() => {
        requireAdmin()
        db().projects = db().projects.filter((p) => p.id !== id)
        commit()
      }),

    coupons: () =>
      run(() => {
        requireAdmin()
        const live = db().orders.filter((o) => o.status !== 'cancelado')
        return db().coupons.map((c) => ({ ...c, uses: live.filter((o) => o.couponCode === c.code).length }))
      }),

    saveCoupon: (c) =>
      run(() => {
        requireAdmin()
        const d = db()
        const coupon = { ...c, code: c.code.trim().toUpperCase() }
        const i = d.coupons.findIndex((x) => x.code === coupon.code)
        if (i >= 0) d.coupons[i] = coupon
        else d.coupons.unshift(coupon)
        commit()
        return coupon
      }),

    deleteCoupon: (code) =>
      run(() => {
        requireAdmin()
        db().coupons = db().coupons.filter((c) => c.code !== code)
        commit()
      }),

    users: () => run(() => (requireAdmin(), db().users.map(publicUser))),

    setUserRole: (id, role) =>
      run(() => {
        const me = requireAdmin()
        if (me.id === id && role !== 'admin') throw new Error('No puedes quitarte tu propio rol de administrador')
        const u = db().users.find((x) => x.id === id)
        if (!u) throw new Error('Usuario no encontrado')
        u.role = role
        commit()
        return publicUser(u)
      }),

    saveSettings: (s) =>
      run(() => {
        requireAdmin()
        db().settings = s
        commit()
        return s
      }),

    resetDemo: () =>
      run(() => {
        resetDb()
      }),
  },
}

// ───────────────────────── HTTP (backend real) ─────────────────────────
// la API vive junto a la tienda: /store/api (se puede cambiar con VITE_API_URL)
const BASE_URL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`
export const API_BASE = BASE_URL

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  const res = await fetch(BASE_URL + path, { ...init, headers })
  if (res.status === 404) return null as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `Error ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const qs = (q: object) => {
  const params = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => v != null && v !== '' && params.set(k, String(v)))
  const s = params.toString()
  return s ? `?${s}` : ''
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body) })
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) })
const del = { method: 'DELETE' }

const httpApi: StoreApi = {
  getCategories: () => http('/categories'),
  getProducts: (q = {}) => http(`/products${qs(q)}`),
  getProduct: (slug) => http(`/products/${slug}`),
  getFeatured: (season) => http(`/products/featured${qs({ season })}`),
  getRelated: (product) => http(`/products/${product.slug}/related`),
  getProjects: () => http('/projects'),
  getReviews: (slug) => http(`/products/${slug}/reviews`),
  myReview: (slug) => http(`/products/${slug}/my-review`),
  createReview: (slug, req) => http(`/products/${slug}/reviews`, post(req)),
  validateCoupon: (code) => http(`/coupons/${encodeURIComponent(code)}`),
  getWelcomeOffer: () => http('/welcome-offer'),
  requestQuote: (req, file) => {
    if (!file) return http('/quotes', post(req))
    const fd = new FormData()
    fd.append('data', JSON.stringify(req))
    fd.append('file', file)
    return http('/quotes', { method: 'POST', body: fd })
  },
  createOrder: (req) => http('/orders', post(req)),
  subscribe: (email) => http('/newsletter', post({ email })),
  getSettings: () => http('/settings'),

  register: (req) => http('/auth/register', post(req)),
  login: (email, password) => http('/auth/login', post({ email, password })),
  verify2fa: (challengeId, code) => http('/auth/2fa/verify', post({ challengeId, code })),
  resend2fa: (challengeId) => http('/auth/2fa/resend', post({ challengeId })),
  me: () => http('/auth/me'),
  updateProfile: (p) => http('/auth/me', patch(p)),
  myOrders: () => http('/me/orders'),
  myOrder: (id) => http(`/me/orders/${id}`),
  confirmDelivery: (id) => http(`/me/orders/${id}/confirm-delivery`, { method: 'POST' }),
  myReviews: () => http('/me/reviews'),

  admin: {
    stats: () => http('/admin/stats'),
    analytics: (days) => http(`/admin/analytics?days=${days}`),
    visitorEvents: (id) => http(`/admin/analytics/visitors/${encodeURIComponent(id)}`),
    saveProduct: (p) => (p.id ? http(`/admin/products/${p.id}`, put(p)) : http('/admin/products', post(p))),
    deleteProduct: (id) => http(`/admin/products/${id}`, del),
    importProducts: (items, updateExisting) => http('/admin/products/import', post({ items, updateExisting })),
    async uploadImage(file) {
      const fd = new FormData()
      fd.append('file', file)
      const r = await http<{ url: string }>('/admin/uploads', { method: 'POST', body: fd })
      return r.url
    },
    async uploadMedia(file) {
      const fd = new FormData()
      fd.append('file', file)
      return http<ProjectMedia>('/admin/uploads?video=1', { method: 'POST', body: fd })
    },
    async quoteFile(id) {
      const res = await fetch(`${BASE_URL}/admin/quotes/${encodeURIComponent(id)}/file`, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} })
      if (!res.ok) throw new Error(res.status === 404 ? 'Archivo no encontrado' : `Error ${res.status}`)
      return res.blob()
    },
    orders: () => http('/admin/orders'),
    updateOrderStatus: (id, status) => http(`/admin/orders/${id}`, patch({ status })),
    reviews: () => http('/admin/reviews'),
    updateReviewStatus: (id, status) => http(`/admin/reviews/${id}`, patch({ status })),
    deleteReview: (id) => http(`/admin/reviews/${id}`, del),
    quotes: () => http('/admin/quotes'),
    updateQuoteStatus: (id, status) => http(`/admin/quotes/${id}`, patch({ status })),
    saveProject: (p) => (p.id ? http(`/admin/projects/${p.id}`, put(p)) : http('/admin/projects', post(p))),
    deleteProject: (id) => http(`/admin/projects/${id}`, del),
    coupons: () => http('/admin/coupons'),
    saveCoupon: (c) => http(`/admin/coupons/${encodeURIComponent(c.code)}`, put(c)),
    deleteCoupon: (code) => http(`/admin/coupons/${encodeURIComponent(code)}`, del),
    users: () => http('/admin/users'),
    setUserRole: (id, role) => http(`/admin/users/${id}`, patch({ role })),
    saveSettings: (s) => http('/admin/settings', put(s)),
  },
}

export const IS_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
// ───────────────────────── Loader láser para TODAS las peticiones ─────────────────────────
type Write = [label: string, done: string, fast?: boolean]
/** Escrituras → capa completa con el corte láser. `fast` = versión rápida (panel de administración). */
const WRITES: Record<string, Write> = {
  createOrder: ['Generando tu orden…', '¡Orden lista!'],
  requestQuote: ['Enviando tu cotización…', '¡Cotización enviada!'],
  subscribe: ['Suscribiendo…', '¡Listo!'],
  register: ['Creando tu cuenta…', 'Te enviamos un código'],
  login: ['Verificando tus datos…', 'Te enviamos un código'],
  verify2fa: ['Verificando tu código…', '¡Listo!'],
  resend2fa: ['Enviando un código nuevo…', 'Código enviado'],
  updateProfile: ['Guardando tus datos…', 'Datos guardados'],
  confirmDelivery: ['Confirmando la entrega…', '¡Gracias por confirmar!'],
  createReview: ['Enviando tu opinión…', '¡Gracias por opinar!'],
  'admin.saveProduct': ['Guardando producto…', 'Producto guardado', true],
  'admin.deleteProduct': ['Eliminando producto…', 'Producto eliminado', true],
  'admin.importProducts': ['Importando productos…', 'Importación lista'],
  'admin.uploadImage': ['Subiendo foto…', 'Foto subida', true],
  'admin.uploadMedia': ['Subiendo archivo…', 'Archivo subido', true],
  'admin.updateOrderStatus': ['Actualizando pedido…', 'Pedido actualizado', true],
  'admin.updateQuoteStatus': ['Actualizando cotización…', 'Cotización actualizada', true],
  'admin.updateReviewStatus': ['Actualizando reseña…', 'Reseña actualizada', true],
  'admin.deleteReview': ['Eliminando reseña…', 'Reseña eliminada', true],
  'admin.saveProject': ['Guardando proyecto…', 'Proyecto guardado', true],
  'admin.deleteProject': ['Eliminando proyecto…', 'Proyecto eliminado', true],
  'admin.saveCoupon': ['Guardando cupón…', 'Cupón guardado', true],
  'admin.deleteCoupon': ['Eliminando cupón…', 'Cupón eliminado', true],
  'admin.setUserRole': ['Actualizando rol…', 'Rol actualizado', true],
  'admin.saveSettings': ['Guardando configuración…', 'Configuración guardada', true],
  'admin.resetDemo': ['Restaurando datos…', 'Datos restaurados'],
}
/** Comprobaciones internas: sin indicador */
const SILENT = new Set(['getSettings', 'getWelcomeOffer', 'me', 'validateCoupon'])

function track(name: string, fn: () => Promise<unknown>) {
  if (SILENT.has(name)) return fn()
  const w = WRITES[name]
  if (w) return withLaser(fn, { label: w[0], done: w[1], ...(w[2] ? { minMs: 450, doneMs: 650 } : {}) })
  return withReading(fn)
}

/** Envuelve cada método (incluido `api.admin.*`) con el loader */
function withLoaders<T extends object>(obj: T, prefix = ''): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'function') out[k] = (...args: unknown[]) => track(prefix + k, () => (v as (...a: unknown[]) => Promise<unknown>)(...args))
    else if (v && typeof v === 'object') out[k] = withLoaders(v as object, `${prefix}${k}.`)
    else out[k] = v
  }
  return out as T
}

export const api: StoreApi = withLoaders(IS_MOCK ? mockApi : httpApi)
