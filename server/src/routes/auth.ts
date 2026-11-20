import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { checkPassword, hashPassword, HttpError, requireAuth, signToken } from '../auth.js'
import { resendChallenge, startChallenge, verifyChallenge } from '../otp.js'
import { orders, products, publicUser, reviews, users } from '../repo.js'
import { loginSchema, profileSchema, registerSchema, resendSchema, reviewSchema, verifySchema } from '../validation.js'
import { hasPurchased } from '../services.js'

export const authRoutes = Router()

// Límite anti fuerza bruta para login/registro/2FA
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
})

// hash ficticio para que el tiempo de respuesta no revele si el correo existe
const DUMMY_HASH = bcrypt.hashSync('no-existe', 12)

/** 1) Registro → se envía el código al celular */
authRoutes.post('/auth/register', limiter, async (req, res) => {
  const data = registerSchema.parse(req.body)
  if (users.byEmail(data.email)) throw new HttpError(409, 'Ya existe una cuenta con ese correo')
  if (users.byPhone(data.phone)) throw new HttpError(409, 'Ese celular ya está registrado en otra cuenta')
  const user = users.create({
    name: data.name,
    email: data.email,
    phone: data.phone,
    birthDate: data.birthDate,
    passwordHash: await hashPassword(data.password),
  })
  res.status(201).json(await startChallenge(user, 'register'))
})

/** 1) Login con contraseña → se envía el código al celular */
authRoutes.post('/auth/login', limiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = users.byEmail(email)
  const ok = await checkPassword(password, user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos')
  res.json(await startChallenge(user, 'login'))
})

/** 2) Código correcto → sesión (JWT) */
authRoutes.post('/auth/2fa/verify', limiter, (req, res) => {
  const { challengeId, code } = verifySchema.parse(req.body)
  const user = verifyChallenge(challengeId, code)
  res.json({ token: signToken(user), user: publicUser(user) })
})

authRoutes.post('/auth/2fa/resend', limiter, async (req, res) => {
  const { challengeId } = resendSchema.parse(req.body)
  res.json(await resendChallenge(challengeId))
})

authRoutes.get('/auth/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user!))
})

authRoutes.patch('/auth/me', requireAuth, (req, res) => {
  res.json(publicUser(users.update(req.user!.id, profileSchema.parse(req.body))))
})

/** Mi reseña de un producto (para saber si ya opiné y en qué estado está) */
authRoutes.get('/products/:slug/my-review', requireAuth, (req, res) => {
  const p = products.bySlugOrId(String(req.params.slug))
  if (!p) throw new HttpError(404, 'Producto no encontrado')
  const r = reviews.byUserAndProduct(req.user!.id, p.id)
  res.json({ review: r, canReview: !r && hasPurchased(req.user!.id, req.user!.email, p.id) })
})

/** Nueva reseña: solo quien compró el producto; queda PENDIENTE hasta que el admin la active */
authRoutes.post('/products/:slug/reviews', requireAuth, limiter, (req, res) => {
  const p = products.bySlugOrId(String(req.params.slug))
  if (!p) throw new HttpError(404, 'Producto no encontrado')
  const data = reviewSchema.parse(req.body)
  if (reviews.byUserAndProduct(req.user!.id, p.id)) throw new HttpError(409, 'Ya dejaste tu opinión sobre este producto')
  if (!hasPurchased(req.user!.id, req.user!.email, p.id)) throw new HttpError(403, 'Podrás opinar cuando hayas recibido este producto')
  res.status(201).json(reviews.create({ productId: p.id, userId: req.user!.id, ...data, verified: true }))
})

authRoutes.get('/me/orders', requireAuth, (req, res) => {
  res.json(orders.byUser(req.user!.id, req.user!.email))
})

const myOrder = (req: { params: Record<string, string | string[]>; user?: { id: string; email: string } }) => {
  const o = orders.byUser(req.user!.id, req.user!.email).find((x) => x.id === String(req.params.id))
  if (!o) throw new HttpError(404, 'Pedido no encontrado')
  return o
}

authRoutes.get('/me/orders/:id', requireAuth, (req, res) => {
  res.json(myOrder(req))
})

/** El cliente confirma que recibió el pedido (solo si está "enviado") */
authRoutes.post('/me/orders/:id/confirm-delivery', requireAuth, (req, res) => {
  const o = myOrder(req)
  if (o.status === 'entregado') return void res.json(o)
  if (o.status !== 'enviado') throw new HttpError(409, 'Podrás confirmar la entrega cuando el pedido esté en camino')
  res.json(orders.setStatus(o.id, 'entregado', true))
})

/** Mis reseñas (para saber qué productos ya califiqué) */
authRoutes.get('/me/reviews', requireAuth, (req, res) => {
  res.json(reviews.byUser(req.user!.id))
})
