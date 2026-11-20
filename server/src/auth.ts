import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.js'
import { users, type UserRow } from './repo.js'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export const signToken = (u: UserRow) => jwt.sign({ sub: u.id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserRow
  }
}

function readUser(req: Request) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return undefined
  try {
    const payload = jwt.verify(h.slice(7), config.jwtSecret) as { sub: string }
    return users.byId(payload.sub) ?? undefined
  } catch {
    return undefined
  }
}

/** Adjunta el usuario si hay token válido (no obliga a iniciar sesión) */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req)
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req)
  if (!req.user) throw new HttpError(401, 'Debes iniciar sesión')
  next()
}

/** El rol se lee de la base de datos en cada petición: quitar el rol surte efecto inmediato */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req)
  if (!req.user) throw new HttpError(401, 'Debes iniciar sesión')
  if (req.user.role !== 'admin') throw new HttpError(403, 'No autorizado')
  next()
}
