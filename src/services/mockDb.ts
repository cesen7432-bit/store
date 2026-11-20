/**
 * Base de datos SIMULADA para el modo mock. Vive en localStorage para que lo que
 * el administrador cree/edite se vea en la tienda. El backend real la reemplaza.
 */
import type { Category, Coupon, Order, OrderStatus, Product, Project, Quote, Review, StoreSettings, User } from '../types'
import { CATEGORIES, COUPONS, PRODUCTS, PROJECTS } from '../data/mock'
import { isFreeShipping } from '../config/store'

export type DbUser = User & { password: string } // en el backend real: hash, nunca texto plano

export interface MockDb {
  version: 1
  products: Product[]
  categories: Category[]
  projects: Project[]
  coupons: Coupon[]
  users: DbUser[]
  orders: Order[]
  quotes: Quote[]
  reviews: Review[]
  settings: StoreSettings
}

const KEY = 'cecom-mock-db-v1'

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@cecom.ec', password: 'admin123' },
  cliente: { email: 'cliente@demo.ec', password: 'cliente123' },
}

function seed(): MockDb {
  const now = Date.now()
  const day = 86_400_000
  const users: DbUser[] = [
    { id: 'u-admin', name: 'Administrador CECOM', email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password, phone: '0963657256', birthDate: '1990-01-01', phoneVerified: true, role: 'admin', createdAt: new Date(now - 90 * day).toISOString() },
    { id: 'u-demo', name: 'María Torres', email: DEMO_ACCOUNTS.cliente.email, password: DEMO_ACCOUNTS.cliente.password, phone: '0991234567', birthDate: '1996-04-12', phoneVerified: true, address: 'Av. Universitaria y 10 de Agosto', city: 'Loja', role: 'cliente', createdAt: new Date(now - 30 * day).toISOString() },
    { id: 'u-2', name: 'Carlos Jaramillo', email: 'carlos@correo.ec', password: 'x', phone: '0987001122', role: 'cliente', city: 'Cuenca', createdAt: new Date(now - 12 * day).toISOString() },
    { id: 'u-3', name: 'Andrea Ordóñez', email: 'andrea@correo.ec', password: 'x', phone: '0998003344', role: 'cliente', city: 'Quito', createdAt: new Date(now - 5 * day).toISOString() },
  ]

  // pedidos de ejemplo de los últimos 10 días (para el dashboard)
  const statuses: OrderStatus[] = ['entregado', 'entregado', 'enviado', 'en-produccion', 'pagado', 'recibido']
  const orders: Order[] = Array.from({ length: 16 }, (_, i) => {
    const prods = [PRODUCTS[(i * 3) % PRODUCTS.length], PRODUCTS[(i * 7 + 2) % PRODUCTS.length]].slice(0, (i % 2) + 1)
    const items = prods.map((p, k) => ({ productId: p.id, name: p.name, price: p.price, quantity: ((i + k) % 3) + 1 }))
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
    const u = users[1 + (i % 3)]
    const zone = (u.city ?? 'Loja') === 'Loja' ? ('loja' as const) : ('nacional' as const)
    const shipping = 0
    const shippingPending = !isFreeShipping(zone, subtotal)
    return {
      id: `CEC-${(1040 + i).toString()}`,
      userId: u.id,
      customer: { name: u.name, email: u.email, phone: u.phone ?? '0990000000', address: u.address ?? 'Centro', city: u.city ?? 'Loja' },
      items,
      shippingZone: zone,
      shippingPending,
      subtotal: round(subtotal),
      discount: 0,
      shipping,
      total: round(subtotal + shipping),
      status: statuses[Math.min(statuses.length - 1, Math.floor((16 - i) / 3))] ?? 'recibido',
      createdAt: new Date(now - (15 - i) * day * 0.65 - (i % 5) * 3_600_000).toISOString(),
    }
  }).reverse()

  const quotes: Quote[] = [
    { id: 'COT-8KD2Q1', name: 'Café Luna', email: 'hola@cafeluna.ec', phone: '0987654321', type: 'letrero', material: 'acrilico-5', width: 80, height: 40, quantity: 1, description: 'Letrero neón con el logo de la cafetería, color blanco cálido.', estimatedPrice: 50.8, estimatedDays: 6, status: 'nueva', createdAt: new Date(now - 0.3 * day).toISOString() },
    { id: 'COT-3PZ7M4', name: 'Unidad Educativa Loja', email: 'compras@uel.edu.ec', phone: '072570000', type: 'proyecto', description: '15 kits de robótica para clubes de ciencia, con capacitación.', estimatedPrice: 65, estimatedDays: 10, status: 'contactado', createdAt: new Date(now - 2 * day).toISOString() },
  ]

  return {
    version: 1,
    products: structuredClone(PRODUCTS),
    categories: structuredClone(CATEGORIES),
    projects: structuredClone(PROJECTS),
    coupons: COUPONS.map((c) => ({ ...c, active: true })),
    users,
    orders,
    quotes,
    reviews: [],
    settings: { seasonMode: 'auto', showParticles: true, showSeasonBanner: true, welcomeCoupon: 'BIENVENIDA10' },
  }
}

export const round = (n: number) => Math.round(n * 100) / 100

let cache: MockDb | null = null

export function db(): MockDb {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as MockDb) : seed()
    cache.reviews ??= [] // datos guardados antes de existir las reseñas
  } catch {
    cache = seed()
  }
  return cache
}

export function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()))
  } catch {
    throw new Error('El almacenamiento del navegador está lleno. Usa imágenes más livianas o reinicia los datos de demo.')
  }
}

export function resetDb() {
  cache = seed()
  commit()
}

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
