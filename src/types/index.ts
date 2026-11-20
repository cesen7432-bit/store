// Modelos de dominio. Mantener alineados con los DTOs del backend.

export type CategoryId = 'electronica' | 'corte-laser' | 'proyectos'

export interface Category {
  id: CategoryId
  name: string
  description: string
  icon: string // nombre de icono de lucide (ver components/ui/Icon.tsx)
  gradient: [string, string]
  subcategories: string[]
}

export interface Product {
  id: string
  slug: string
  /** Código del inventario (clave para importar/actualizar desde Excel) */
  sku?: string
  name: string
  category: CategoryId
  subcategory: string
  shortDescription: string
  description: string
  price: number
  oldPrice?: number
  rating: number
  reviews: number
  stock: number
  tags: string[]
  /** URL de imagen real. Si no existe, se dibuja un placeholder ilustrado. */
  images: string[]
  icon: string
  gradient: [string, string]
  specs: Record<string, string>
  featured?: boolean
  isNew?: boolean
  /** Temporadas en las que este producto se destaca (ver config/seasons.ts) */
  seasons?: string[]
  customizable?: boolean
}

export interface ProjectMedia {
  url: string
  type: 'image' | 'video'
}

export interface Project {
  id: string
  title: string
  summary: string
  category: 'arduino' | 'acrilico' | 'iot' | 'robotica' | 'decoracion'
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado'
  durationDays: number
  priceFrom: number
  icon: string
  gradient: [string, string]
  highlights: string[]
  /** Fotos y videos del proyecto; el primero es la portada */
  media?: ProjectMedia[]
}

export interface CartItem {
  product: Product
  quantity: number
  note?: string
}

export interface ProductQuery {
  category?: CategoryId
  subcategory?: string
  search?: string
  sort?: 'relevancia' | 'precio-asc' | 'precio-desc' | 'rating' | 'nuevos'
  minPrice?: number
  maxPrice?: number
  season?: string
}

export interface QuoteRequest {
  name: string
  email: string
  phone: string
  type: 'corte-laser' | 'proyecto' | 'letrero'
  material?: string
  width?: number
  height?: number
  quantity?: number
  description: string
  fileName?: string
}

export interface QuoteResponse {
  id: string
  estimatedPrice: number
  estimatedDays: number
  message: string
}

export interface OrderRequest {
  customer: { name: string; email: string; phone: string; address: string; city: string }
  items: { productId: string; quantity: number; note?: string }[]
  /** La forma de pago se coordina por WhatsApp; campo opcional por compatibilidad */
  paymentMethod?: 'tarjeta' | 'transferencia' | 'deuna'
  couponCode?: string
  shippingZone: 'loja' | 'nacional'
}

export interface OrderResponse {
  orderId: string
  total: number
  status: OrderStatus
  createdAt: string
}

export interface Coupon {
  code: string
  percent: number
  description: string
  active?: boolean
  /** Solo válido en la primera compra del cliente (p. ej. bienvenida) */
  firstOrderOnly?: boolean
  /** Veces usado (solo en el panel de administración) */
  uses?: number
}

// ───────── Usuarios y autenticación ─────────
export type Role = 'admin' | 'cliente'

export interface User {
  id: string
  name: string
  email: string
  /** Celular en formato nacional (09XXXXXXXX). Es el segundo factor (2FA). */
  phone: string
  phoneVerified?: boolean
  /** AAAA-MM-DD */
  birthDate?: string
  address?: string
  city?: string
  role: Role
  createdAt: string
}

export interface AuthSession {
  token: string
  user: User
}

export interface RegisterRequest {
  name: string
  email: string
  phone: string
  /** AAAA-MM-DD */
  birthDate: string
  password: string
}

/** Respuesta de login/registro: siempre pide el código enviado al celular */
export interface TwoFactorChallenge {
  twoFactorRequired: true
  challengeId: string
  /** Celular enmascarado, p. ej. "09•••••256" */
  phoneHint: string
  /** Segundos hasta poder reenviar */
  resendIn: number
  /** Solo en desarrollo/demo: el código, para probar sin SMS/WhatsApp */
  devCode?: string
}

// ───────── Pedidos guardados ─────────
export type OrderStatus = 'recibido' | 'pagado' | 'en-produccion' | 'enviado' | 'entregado' | 'cancelado'

export interface Order {
  id: string
  userId?: string
  customer: OrderRequest['customer']
  items: { productId: string; name: string; price: number; quantity: number; note?: string }[]
  paymentMethod?: OrderRequest['paymentMethod']
  /** true = no alcanzó el envío gratis; el valor del envío se coordina por WhatsApp */
  shippingPending?: boolean
  couponCode?: string
  shippingZone?: 'loja' | 'nacional'
  subtotal: number
  discount: number
  shipping: number
  total: number
  status: OrderStatus
  createdAt: string
  /** Fecha en que se marcó como entregado */
  deliveredAt?: string
  /** true si fue el cliente quien confirmó que lo recibió */
  confirmedByCustomer?: boolean
}

// ───────── Cotizaciones guardadas ─────────
export type QuoteStatus = 'nueva' | 'contactado' | 'aprobada' | 'rechazada'

/** Archivo adjunto a una cotización (privado: solo lo descarga un admin) */
export interface QuoteFile {
  name: string
  size: number
  type: string
}

export interface Quote extends QuoteRequest {
  id: string
  file?: QuoteFile
  estimatedPrice: number
  estimatedDays: number
  status: QuoteStatus
  createdAt: string
}

// ───────── Configuración global (la define el administrador) ─────────
export interface StoreSettings {
  /** 'auto' o el id de una temporada para forzarla a todos los visitantes */
  seasonMode: string
  /** Partículas animadas de temporada (nieve, corazones…) */
  showParticles: boolean
  /** Mostrar la barra de anuncio de temporada */
  showSeasonBanner: boolean
  /** Código del cupón de bienvenida para cuentas nuevas ('' = sin oferta) */
  welcomeCoupon: string
}

/** Oferta pública por crear cuenta */
export interface WelcomeOffer {
  code: string
  percent: number
}

export interface AdminStats {
  salesMonth: number
  ordersMonth: number
  pendingOrders: number
  newQuotes: number
  pendingReviews: number
  customers: number
  salesByDay: { date: string; total: number }[]
  lowStock: Product[]
  latestOrders: Order[]
}

// ───────── Reseñas (moderadas por el administrador) ─────────
export type ReviewStatus = 'pendiente' | 'activa' | 'inactiva'

export interface Review {
  id: string
  productId: string
  productName: string
  userId: string
  /** Nombre corto público, p. ej. "María T." */
  authorName: string
  rating: number
  comment: string
  status: ReviewStatus
  /** El autor tiene un pedido con este producto */
  verified: boolean
  createdAt: string
}

export interface ReviewRequest {
  rating: number
  comment: string
}

// ───────── Importación de productos (Excel) ─────────
export interface ProductImportItem {
  sku: string
  name: string
  stock: number
  price: number
  category: CategoryId
  subcategory: string
}

export interface ProductImportResult {
  created: number
  updated: number
  skipped: number
}

// ───────── Analítica de visitas (propia, sin terceros) ─────────
export type VisitEventType = 'page' | 'product' | 'cart'

export interface VisitEvent {
  type: VisitEventType
  path: string
  productId?: string
  productName?: string
  referrer?: string
  createdAt: string
}

export interface VisitorSummary {
  visitorId: string
  /** null = visitante anónimo (sin sesión) */
  user: { id: string; name: string; email: string; phone: string } | null
  firstSeen: string
  lastSeen: string
  pageViews: number
  device: string
  referrer?: string
  products: { id: string; name: string; views: number; addedToCart: boolean }[]
}

export interface AnalyticsSummary {
  days: number
  visitors: number
  identifiedVisitors: number
  pageViews: number
  productViews: number
  addToCart: number
  byDay: { date: string; visitors: number }[]
  topProducts: { id: string; name: string; slug: string | null; views: number; visitors: number; addedToCart: number }[]
  referrers: { source: string; visitors: number }[]
  devices: { device: string; visitors: number }[]
  recentVisitors: VisitorSummary[]
}
