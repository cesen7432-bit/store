import { z } from 'zod'
import { normalizeEcPhone } from './otp.js'

const text = (max: number) => z.string().trim().max(max)
const req = (max: number, msg = 'Campo obligatorio') => z.string().trim().min(1, msg).max(max)

export const phoneSchema = z
  .string()
  .transform((v) => normalizeEcPhone(v))
  .refine((v): v is string => v !== null, 'Ingresa un celular válido de Ecuador (09XXXXXXXX)')
  .transform((v) => v as string)

const MIN_AGE = 13
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida')
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z')
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false
    const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000)
    return age >= MIN_AGE && age <= 110
  }, `Debes tener al menos ${MIN_AGE} años`)

export const registerSchema = z.object({
  name: req(80).min(3, 'Escribe tu nombre completo'),
  email: z.email('Correo inválido').max(120).transform((v) => v.toLowerCase()),
  phone: phoneSchema,
  birthDate: birthDateSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
})

export const loginSchema = z.object({
  email: z.email('Correo inválido').transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
})

export const verifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
})
export const resendSchema = z.object({ challengeId: z.uuid() })

export const profileSchema = z.object({
  name: req(80).optional(),
  address: text(200).optional(),
  city: text(80).optional(),
})

export const orderSchema = z.object({
  customer: z.object({
    name: req(80),
    email: z.email('Correo inválido'),
    phone: phoneSchema,
    address: req(200, 'La dirección es obligatoria'),
    city: req(80, 'La ciudad es obligatoria'),
  }),
  items: z
    .array(z.object({ productId: req(120), quantity: z.number().int().min(1).max(99), note: text(300).optional() }))
    .min(1, 'El carrito está vacío')
    .max(50),
  couponCode: text(40).optional(),
  shippingZone: z.enum(['loja', 'nacional']),
})

export const quoteSchema = z.object({
  name: req(80),
  email: z.email('Correo inválido'),
  phone: req(30),
  type: z.enum(['corte-laser', 'proyecto', 'letrero']),
  material: text(40).optional(),
  width: z.number().min(1).max(500).optional(),
  height: z.number().min(1).max(500).optional(),
  quantity: z.number().int().min(1).max(10_000).optional(),
  description: req(2000),
  fileName: text(200).optional(),
})

const gradient = z.tuple([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.string().regex(/^#[0-9a-fA-F]{6}$/)])

export const productSchema = z.object({
  id: z.string().max(120).default(''),
  slug: z.string().max(140).default(''),
  sku: z.string().trim().max(60).optional(),
  name: req(140),
  category: z.enum(['electronica', 'corte-laser', 'proyectos']),
  subcategory: req(80),
  shortDescription: text(240).default(''),
  description: text(5000).default(''),
  price: z.number().positive('El precio debe ser mayor a 0').max(100_000),
  oldPrice: z.number().positive().max(100_000).optional(),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).max(999),
  tags: z.array(text(40)).max(30).default([]),
  // solo URLs (las imágenes se suben con /admin/uploads); evita guardar data: URIs gigantes
  images: z.array(z.string().max(2048).refine((u) => u.startsWith('/uploads/') || /^https?:\/\//.test(u), 'URL de imagen inválida')).max(12).default([]),
  icon: text(40).default('package'),
  gradient: gradient.default(['#ff5b23', '#ffa53d']),
  specs: z.record(text(60), text(200)).default({}),
  featured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  seasons: z.array(text(40)).max(10).optional(),
  customizable: z.boolean().optional(),
})

export const productImportSchema = z.object({
  updateExisting: z.boolean().default(true),
  items: z
    .array(
      z.object({
        sku: req(60, 'Falta el SKU'),
        name: req(140, 'Falta el nombre'),
        stock: z.number().int().min(0).max(100_000),
        price: z.number().positive('El precio debe ser mayor a 0').max(100_000),
        category: z.enum(['electronica', 'corte-laser', 'proyectos']),
        subcategory: req(80),
      }),
    )
    .min(1, 'No hay filas para importar')
    .max(5000),
})

export const projectSchema = z.object({
  id: z.string().max(120).default(''),
  title: req(140),
  summary: text(1000).default(''),
  category: z.enum(['arduino', 'acrilico', 'iot', 'robotica', 'decoracion']),
  difficulty: z.enum(['Básico', 'Intermedio', 'Avanzado']),
  durationDays: z.number().int().min(1).max(365),
  priceFrom: z.number().min(0).max(1_000_000),
  icon: text(40).default('sparkles'),
  gradient: gradient.default(['#ff5b23', '#ffa53d']),
  highlights: z.array(text(80)).max(10).default([]),
  media: z
    .array(z.object({ url: z.string().max(300).refine((u) => u.startsWith('/uploads/'), 'Archivo inválido'), type: z.enum(['image', 'video']) }))
    .max(20)
    .default([]),
})

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Código: 3–30 letras, números, - o _'),
  percent: z.number().int().min(1).max(90),
  description: text(140).default(''),
  active: z.boolean().default(true),
  firstOrderOnly: z.boolean().default(false),
})

export const settingsSchema = z.object({
  seasonMode: req(40),
  showParticles: z.boolean(),
  showSeasonBanner: z.boolean(),
  welcomeCoupon: z.string().trim().toUpperCase().max(30).default(''),
})

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Elige de 1 a 5 estrellas').max(5),
  comment: z.string().trim().min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)').max(1000),
})
export const reviewStatusSchema = z.object({ status: z.enum(['pendiente', 'activa', 'inactiva']) })

export const orderStatusSchema = z.object({ status: z.enum(['recibido', 'pagado', 'en-produccion', 'enviado', 'entregado', 'cancelado']) })
export const quoteStatusSchema = z.object({ status: z.enum(['nueva', 'contactado', 'aprobada', 'rechazada']) })
export const roleSchema = z.object({ role: z.enum(['admin', 'cliente']) })

export const productQuerySchema = z.object({
  category: z.enum(['electronica', 'corte-laser', 'proyectos']).optional(),
  subcategory: text(80).optional(),
  search: text(80).optional(),
  sort: z.enum(['relevancia', 'precio-asc', 'precio-desc', 'rating', 'nuevos']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  season: text(40).optional(),
})
