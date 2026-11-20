import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { LogoMark } from '../components/brand/Logo'
import { whatsappLink } from '../config/store'
import { api, IS_MOCK } from '../services/api'
import { DEMO_ACCOUNTS } from '../services/mockDb'
import { useAuth } from '../store/auth'
import { withLaser } from '../store/laser'
import type { TwoFactorChallenge } from '../types'
import { useCart } from '../store/cart'
import { useWelcomeOffer } from '../utils/useWelcomeOffer'

export const inputCls =
  'w-full rounded-md border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20'

const MIN_AGE = 13
const maxBirth = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - MIN_AGE)
  return d.toISOString().slice(0, 10)
})()

export default function Auth({ mode }: { mode: 'login' | 'registro' }) {
  const [params] = useSearchParams()
  const next = params.get('next') || ''
  const navigate = useNavigate()
  const { login, register, verify } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', phone: '', birthDate: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)
  const isLogin = mode === 'login'
  const offer = useWelcomeOffer()
  const q = next ? `?next=${encodeURIComponent(next)}` : ''

  useEffect(() => {
    setChallenge(null)
    setError('')
  }, [mode])

  // Paso 1: credenciales → se envía el código al celular
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      setChallenge(isLogin ? await login(form.email, form.password) : await register(form))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: código correcto → sesión
  const onVerified = async (code: string) => {
    const user = await withLaser(() => verify(challenge!.challengeId, code), {
      label: 'Verificando tu código…',
      done: isLogin ? '¡Bienvenido de nuevo!' : '¡Cuenta creada!',
      minMs: 700,
    })
    toast.success(isLogin ? `Hola de nuevo, ${user.name.split(' ')[0]}` : 'Cuenta creada y celular verificado. ¡Bienvenido!')
    // cuenta nueva: aplica el cupón de bienvenida si hay productos en el carrito
    if (!isLogin && offer) {
      const cart = useCart.getState()
      try {
        const c = await api.validateCoupon(offer.code)
        if (c && cart.items.length) {
          cart.setCoupon(c)
          toast.success(`Aplicamos tu ${c.percent}% de bienvenida (${c.code}) a tu carrito`)
        } else if (c) toast.info(`Tu cupón ${c.code} te da ${c.percent}% en tu primera compra`)
      } catch {
        /* no elegible: se ignora */
      }
    }
    navigate(next || (user.role === 'admin' ? '/admin' : '/cuenta'), { replace: true })
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-14">
      <div className="w-full max-w-[420px]">
        <AnimatePresence mode="wait">
          {challenge ? (
            <motion.div key="otp" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <OtpStep challenge={challenge} onBack={() => setChallenge(null)} onVerified={onVerified} onResent={setChallenge} />
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }}>
              <div className="mb-8 flex flex-col items-center text-center">
                <LogoMark className="h-10 w-auto text-fg" />
                <h1 className="mt-5 font-display text-2xl font-bold">{isLogin ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</h1>
                <p className="mt-1.5 text-sm text-muted">{isLogin ? 'Revisa tus pedidos y compra más rápido.' : 'Sigue tus pedidos y guarda tus favoritos.'}</p>
                {!isLogin && offer && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm">
                    <span className="font-bold text-primary">-{offer.percent}%</span> en tu primera compra al crear tu cuenta
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
                <div className="mb-6 grid grid-cols-2 rounded-md bg-black/30 p-1 text-sm">
                  {(
                    [
                      ['login', 'Ingresar', '/ingresar'],
                      ['registro', 'Crear cuenta', '/registro'],
                    ] as const
                  ).map(([m, label, to]) => (
                    <Link
                      key={m}
                      to={to + q}
                      replace
                      className={clsx('relative rounded py-2 text-center font-medium transition', mode === m ? 'text-fg' : 'text-muted hover:text-fg')}
                    >
                      {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded bg-white/[0.08]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                      <span className="relative">{label}</span>
                    </Link>
                  ))}
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {!isLogin && (
                    <Labeled label="Nombre completo">
                      <input required minLength={3} autoComplete="name" value={form.name} onChange={set('name')} className={inputCls} />
                    </Labeled>
                  )}
                  <Labeled label="Correo electrónico">
                    <input required type="email" autoComplete="email" placeholder="tu@correo.com" value={form.email} onChange={set('email')} className={inputCls} />
                  </Labeled>
                  {!isLogin && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Labeled label="Celular">
                        <input
                          required
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="09XXXXXXXX"
                          value={form.phone}
                          onChange={set('phone')}
                          className={inputCls}
                        />
                      </Labeled>
                      <Labeled label="Fecha de nacimiento">
                        <input required type="date" max={maxBirth} min="1915-01-01" autoComplete="bday" value={form.birthDate} onChange={set('birthDate')} className={inputCls + ' [color-scheme:dark]'} />
                      </Labeled>
                    </div>
                  )}
                  <Labeled
                    label="Contraseña"
                    aside={
                      isLogin && (
                        <a
                          href={whatsappLink('Hola CECOM, necesito ayuda para recuperar la contraseña de mi cuenta.')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted hover:text-primary"
                        >
                          ¿Olvidaste tu contraseña?
                        </a>
                      )
                    }
                  >
                    <div className="relative">
                      <input
                        required
                        type={show ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        minLength={isLogin ? undefined : 8}
                        placeholder={isLogin ? '' : 'Mínimo 8 caracteres'}
                        value={form.password}
                        onChange={set('password')}
                        className={inputCls + ' pr-11'}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-muted hover:text-fg"
                        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Labeled>

                  {!isLogin && (
                    <p className="flex items-start gap-2 text-xs text-muted">
                      <Smartphone size={14} className="mt-0.5 shrink-0 text-primary" />
                      Te enviaremos un código por SMS para verificar tu celular. Lo usarás cada vez que ingreses (verificación en dos pasos).
                    </p>
                  )}

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-md bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                      {error}
                    </motion.p>
                  )}

                  <button disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-70">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {isLogin ? 'Continuar' : 'Crear cuenta'}
                  </button>
                </form>
              </div>

              {IS_MOCK && isLogin && (
                <p className="mt-6 text-center text-xs text-muted">
                  Demo:{' '}
                  {(['admin', 'cliente'] as const).map((k, i) => (
                    <span key={k}>
                      {i > 0 && ' · '}
                      <button type="button" onClick={() => setForm({ ...form, ...DEMO_ACCOUNTS[k] })} className="underline decoration-white/20 underline-offset-2 hover:text-fg">
                        usar cuenta {k === 'admin' ? 'administrador' : 'cliente'}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Paso 2: código de 6 dígitos enviado al celular */
function OtpStep({
  challenge,
  onBack,
  onVerified,
  onResent,
}: {
  challenge: TwoFactorChallenge
  onBack: () => void
  onVerified: (code: string) => Promise<void>
  onResent: (c: TwoFactorChallenge) => void
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [wait, setWait] = useState(challenge.resendIn)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setWait(challenge.resendIn)
    setDigits(Array(6).fill(''))
    refs.current[0]?.focus()
  }, [challenge])

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const submit = async (code: string) => {
    setError('')
    setLoading(true)
    try {
      await onVerified(code)
    } catch (e) {
      setError((e as Error).message)
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const fill = (start: number, value: string) => {
    const chars = value.replace(/\D/g, '').slice(0, 6 - start).split('')
    if (!chars.length) return
    const nextDigits = [...digits]
    chars.forEach((c, k) => (nextDigits[start + k] = c))
    setDigits(nextDigits)
    const focusAt = Math.min(5, start + chars.length)
    refs.current[focusAt]?.focus()
    if (nextDigits.every(Boolean)) submit(nextDigits.join(''))
  }

  const resend = async () => {
    try {
      onResent(await api.resend2fa(challenge.challengeId))
      toast.success('Te enviamos un código nuevo')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Smartphone size={26} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Verifica que eres tú</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enviamos un código de 6 dígitos por SMS al <b className="font-mono text-fg">{challenge.phoneHint}</b>
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
        {challenge.devCode && (
          <p className="mb-5 rounded-md border border-dashed border-white/15 px-3 py-2 text-center text-xs text-muted">
            Modo desarrollo (sin SMS): tu código es <b className="font-mono text-fg">{challenge.devCode}</b>
          </p>
        )}
        <div className="flex justify-between gap-2" onPaste={(e) => (e.preventDefault(), fill(0, e.clipboardData.getData('text')))}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Dígito ${i + 1}`}
              maxLength={6}
              disabled={loading}
              onChange={(e) => {
                if (!e.target.value) {
                  const n = [...digits]
                  n[i] = ''
                  setDigits(n)
                } else fill(i, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
              }}
              className={clsx(
                'h-14 w-full min-w-0 rounded-md border bg-black/30 text-center font-mono text-2xl outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
                error ? 'border-red-500/50' : 'border-white/10',
              )}
            />
          ))}
        </div>

        {error && <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}

        <button
          onClick={() => submit(digits.join(''))}
          disabled={loading || digits.some((d) => !d)}
          className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />} Verificar
        </button>

        <div className="mt-5 flex items-center justify-between text-sm">
          <button onClick={onBack} className="flex items-center gap-1 text-muted hover:text-fg">
            <ArrowLeft size={14} /> Volver
          </button>
          {wait > 0 ? (
            <span className="text-muted">Reenviar en {wait}s</span>
          ) : (
            <button onClick={resend} className="font-medium text-primary hover:underline">
              Reenviar código
            </button>
          )}
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-muted">El código vence en 5 minutos. Nunca lo compartas con nadie.</p>
    </div>
  )
}

function Labeled({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {aside}
      </span>
      {children}
    </label>
  )
}
