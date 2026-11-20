/**
 * Verificación en dos pasos por celular.
 * Proveedores (OTP_PROVIDER):
 *  - sms      → SMS Gateway propio de CECOM (apps-cecom.cloud/gw-sms). Por defecto si hay SMS_APP_ID.
 *  - console  → imprime el código en la consola (desarrollo). Fuera de producción también lo devuelve al frontend.
 *  - whatsapp → WhatsApp Cloud API (Meta) con una plantilla de autenticación aprobada.
 *  - twilio   → SMS vía Twilio.
 */
import crypto from 'node:crypto'
import type { TwoFactorChallenge } from '../../src/types/index.js'
import { HttpError } from './auth.js'
import { config } from './config.js'
import { db } from './db.js'
import { users, type UserRow } from './repo.js'

const TTL_MS = 5 * 60_000
const RESEND_MS = 60_000
const MAX_ATTEMPTS = 5
const provider = (process.env.OTP_PROVIDER || (process.env.SMS_APP_ID ? 'sms' : 'console')) as 'console' | 'sms' | 'whatsapp' | 'twilio'

if (config.isProd && provider === 'console') {
  console.warn('⚠️  OTP_PROVIDER=console en producción: los códigos 2FA solo se imprimen en el log. Configura OTP_PROVIDER=sms con SMS_APP_ID y SMS_APP_SECRET.')
}

// ───────── Celulares de Ecuador ─────────
/** Normaliza a formato nacional 09XXXXXXXX. Acepta 09…, 9…, +5939…, 5939… */
export function normalizeEcPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('593')) d = d.slice(3)
  if (d.length === 9 && d.startsWith('9')) d = '0' + d
  return /^09\d{8}$/.test(d) ? d : null
}
const toE164 = (national: string) => '+593' + national.slice(1)
export const maskPhone = (national: string) => national.slice(0, 2) + '•'.repeat(5) + national.slice(-3)

// ───────── Envío ─────────
async function send(phoneNational: string, code: string) {
  const to = toE164(phoneNational)
  const text = `Tu código de verificación CECOM es ${code}. Vence en 5 minutos. No lo compartas con nadie.`

  if (provider === 'console') {
    console.log(`[2FA] ${to} → ${code}`)
    return
  }

  if (provider === 'sms') {
    // SMS Gateway CECOM: siempre responde HTTP 200; solo `code === 1` significa aceptado
    const base = (process.env.SMS_BASE_URL || 'https://apps-cecom.cloud/gw-sms').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/sms/send`, {
      method: 'POST',
      headers: {
        'X-App-Id': process.env.SMS_APP_ID ?? '',
        'X-App-Secret': process.env.SMS_APP_SECRET ?? '',
        'Content-Type': 'application/json',
      },
      // sin tildes: el SMS se mantiene en codificación GSM (160 caracteres por mensaje)
      body: JSON.stringify({ to, message: `${code} es tu codigo CECOM. Vence en 5 min. No lo compartas con nadie.`, priority: 'high' }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await res.json().catch(() => null)) as { code?: number; message?: string; detail?: string } | null
    if (!body || body.code !== 1) throw new Error(`SMS Gateway: ${body?.message ?? body?.detail ?? `respuesta inválida (HTTP ${res.status})`}`)
    return
  }

  if (provider === 'whatsapp') {
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v21.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.slice(1),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_OTP_TEMPLATE ?? 'codigo_verificacion',
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? 'es' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    })
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`)
    return
  }

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: text }),
    })
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`)
  }
}

// ───────── Desafíos ─────────
const hashCode = (challengeId: string, code: string) => crypto.createHmac('sha256', config.jwtSecret).update(`${challengeId}:${code}`).digest('hex')
const newCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

interface ChallengeRow {
  id: string
  user_id: string
  purpose: 'login' | 'register'
  code_hash: string
  expires_at: number
  attempts: number
  last_sent_at: number
  consumed: number
}

async function deliver(phone: string, code: string) {
  try {
    await send(phone, code)
  } catch (e) {
    console.error('[2FA] error enviando código:', (e as Error).message)
    throw new HttpError(502, 'No pudimos enviar el código a tu celular. Intenta de nuevo en un momento.')
  }
}

const response = (id: string, user: UserRow, code: string): TwoFactorChallenge => ({
  twoFactorRequired: true,
  challengeId: id,
  phoneHint: maskPhone(user.phone),
  resendIn: RESEND_MS / 1000,
  ...(provider === 'console' && !config.isProd ? { devCode: code } : {}),
})

export async function startChallenge(user: UserRow, purpose: 'login' | 'register'): Promise<TwoFactorChallenge> {
  // invalida códigos anteriores del usuario
  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE user_id = ? AND consumed = 0').run(user.id)
  const id = crypto.randomUUID()
  const code = newCode()
  const t = Date.now()
  db.prepare('INSERT INTO otp_challenges (id, user_id, purpose, code_hash, expires_at, last_sent_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    user.id,
    purpose,
    hashCode(id, code),
    t + TTL_MS,
    t,
  )
  await deliver(user.phone, code)
  return response(id, user, code)
}

function load(challengeId: string) {
  const c = db.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId) as unknown as ChallengeRow | undefined
  if (!c || c.consumed) throw new HttpError(400, 'El código ya no es válido. Vuelve a iniciar sesión.')
  return c
}

export async function resendChallenge(challengeId: string): Promise<TwoFactorChallenge> {
  const c = load(challengeId)
  const wait = c.last_sent_at + RESEND_MS - Date.now()
  if (wait > 0) throw new HttpError(429, `Espera ${Math.ceil(wait / 1000)} segundos para reenviar el código.`)
  const user = users.byId(c.user_id)!
  const code = newCode()
  const t = Date.now()
  db.prepare('UPDATE otp_challenges SET code_hash = ?, expires_at = ?, attempts = 0, last_sent_at = ? WHERE id = ?').run(hashCode(c.id, code), t + TTL_MS, t, c.id)
  await deliver(user.phone, code)
  return response(c.id, user, code)
}

/** Valida el código. Devuelve el usuario si es correcto. */
export function verifyChallenge(challengeId: string, code: string): UserRow {
  const c = load(challengeId)
  if (Date.now() > c.expires_at) throw new HttpError(400, 'El código venció. Solicita uno nuevo.')
  if (c.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Demasiados intentos. Solicita un código nuevo.')

  const expected = Buffer.from(c.code_hash, 'hex')
  const given = Buffer.from(hashCode(c.id, code.replace(/\D/g, '')), 'hex')
  if (!crypto.timingSafeEqual(expected, given)) {
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(c.id)
    const left = MAX_ATTEMPTS - c.attempts - 1
    throw new HttpError(400, left > 0 ? `Código incorrecto. Te quedan ${left} intentos.` : 'Código incorrecto. Solicita uno nuevo.')
  }

  db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').run(c.id)
  users.markPhoneVerified(c.user_id)
  return users.byId(c.user_id)!
}
