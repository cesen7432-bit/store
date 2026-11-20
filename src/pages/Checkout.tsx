import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, MessageCircle, Truck, User as UserIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import confetti from 'canvas-confetti'
import clsx from 'clsx'
import { CouponInput, Row } from '../components/product/CartDrawer'
import { ProductArt } from '../components/ui/ProductArt'
import { formatPrice, isFreeShipping, orderWhatsappMessage, SHIPPING, SHIPPING_PENDING_LABEL, whatsappLink, type ShippingZone } from '../config/store'
import { useSeason } from '../context/SeasonContext'
import { api } from '../services/api'
import { useCart, useCartTotals } from '../store/cart'
import { useAuth } from '../store/auth'
import { withLaser } from '../store/laser'
import type { Order } from '../types'
import { useWelcomeOffer } from '../utils/useWelcomeOffer'

const inputCls =
  'w-full rounded-md border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

export default function Checkout() {
  const { items, coupon, clear } = useCart()
  const setShippingZone = useCart((s) => s.setShippingZone)
  const setCoupon = useCart((s) => s.setCoupon)
  const t = useCartTotals()
  const { season } = useSeason()
  const user = useAuth((s) => s.user)
  const [customer, setCustomer] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    city: t.zone === 'loja' ? 'Loja' : user?.city && user.city !== 'Loja' ? user.city : '',
  })
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')

  const set = (k: keyof typeof customer) => (e: React.ChangeEvent<HTMLInputElement>) => setCustomer({ ...customer, [k]: e.target.value })

  const chooseZone = (z: ShippingZone) => {
    setShippingZone(z)
    setCustomer((c) => ({ ...c, city: z === 'loja' ? 'Loja' : c.city === 'Loja' ? '' : c.city }))
  }

  /**
   * 1) Registra la orden (queda en el historial del cliente y en el panel admin)
   * 2) Abre WhatsApp con la orden completa
   * La pestaña se abre ANTES de la petición para que el navegador no la bloquee.
   */
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const waTab = window.open('', '_blank')
    try {
      const created = await withLaser(
        () =>
          api.createOrder({
        customer: { ...customer, address: reference.trim() ? `${customer.address} (Ref: ${reference.trim()})` : customer.address },
        shippingZone: t.zone,
        couponCode: coupon?.code,
            items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, note: i.note })),
          }),
        { label: 'Generando tu orden…', done: '¡Orden lista!' },
      )
      const link = whatsappLink(orderWhatsappMessage(created))
      if (waTab) waTab.location.href = link
      setOrder(created)
      clear()
      celebrate(season.particles?.symbols)
    } catch (err) {
      waTab?.close()
      const msg = (err as Error).message
      // si el problema es el cupón, se quita para que el cliente pueda confirmar sin él
      if (coupon && /cup[oó]n/i.test(msg)) {
        setCoupon(null)
        setError(`${msg}. Lo quitamos de tu pedido; revisa el total y confirma de nuevo.`)
      } else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (order) return <Success order={order} emoji={season.emoji} />

  if (items.length === 0)
    return (
      <div className="py-32 text-center">
        <p className="font-display text-3xl font-bold">Tu carrito está vacío</p>
        <Link to="/tienda" className="btn-primary mt-6 inline-block px-6 py-3">
          Ir a la tienda
        </Link>
      </div>
    )

  // Para pedir hay que tener cuenta (verificada por SMS)
  if (!user) return <AccountGate />

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Finalizar compra</h1>
        {(
          <p className="mt-2 text-sm text-muted">
            Comprando como <b className="text-fg">{user.email}</b> · el pedido quedará en{' '}
            <Link to="/cuenta" className="text-primary hover:underline">
              Mi cuenta
            </Link>
          </p>
        )}
      </div>

      <form onSubmit={submit} className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Contacto */}
          <Panel icon={<UserIcon size={18} />} title="Contacto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" className="sm:col-span-2">
                <input required autoComplete="name" value={customer.name} onChange={set('name')} className={inputCls} />
              </Field>
              <Field label="Correo electrónico">
                <input type="email" disabled value={user.email} className={inputCls} title="El pedido se asocia al correo de tu cuenta" />
              </Field>
              <Field label="Celular" hint="Te confirmamos el pedido por WhatsApp">
                <input required type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="09XXXXXXXX" value={customer.phone} onChange={set('phone')} className={inputCls} />
              </Field>
            </div>
          </Panel>

          {/* Entrega */}
          <Panel icon={<Truck size={18} />} title="Entrega a domicilio">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SHIPPING) as ShippingZone[]).map((z) => {
                const active = t.zone === z
                const free = isFreeShipping(z, t.subtotal - t.discount)
                return (
                  <button
                    type="button"
                    key={z}
                    onClick={() => chooseZone(z)}
                    className={clsx(
                      'relative rounded-lg border p-4 text-left transition',
                      active ? 'border-primary bg-primary/[0.07] ring-1 ring-primary' : 'border-white/10 hover:border-white/25',
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-semibold">{SHIPPING[z].label}</span>
                      <span className={clsx('text-sm font-semibold', free ? 'text-emerald-300' : 'text-muted')}>{free ? 'Gratis' : SHIPPING_PENDING_LABEL}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted">Gratis desde {formatPrice(SHIPPING[z].freeFrom)}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Ciudad">
                <input required disabled={t.zone === 'loja'} autoComplete="address-level2" value={customer.city} onChange={set('city')} placeholder="Ej. Quito" className={inputCls} />
              </Field>
              <Field label="Dirección" className="sm:col-span-2">
                <input required autoComplete="street-address" placeholder="Calle principal, número y calle secundaria" value={customer.address} onChange={set('address')} className={inputCls} />
              </Field>
              <Field label="Referencia" optional className="sm:col-span-3">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej. casa blanca de dos pisos, frente al parque" className={inputCls} />
              </Field>
            </div>
          </Panel>

        </div>

        {/* Resumen */}
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-xl border border-white/10 bg-surface/80 p-6 backdrop-blur">
            <h2 className="mb-4 font-display text-lg font-semibold">Tu pedido</h2>
            <ul data-lenis-prevent className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map(({ product, quantity, note }) => (
                <li key={product.id} className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
                    <ProductArt icon={product.icon} gradient={product.gradient} image={product.images[0]} iconSize={22} />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 font-medium">{product.name}</p>
                    <p className="text-xs text-muted">
                      {quantity} × {formatPrice(product.price)}
                    </p>
                    {note && <p className="truncate text-xs text-primary">✎ {note}</p>}
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(product.price * quantity)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <CouponInput />
            </div>

            <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-sm">
              <Row label="Subtotal" value={formatPrice(t.subtotal)} />
              {t.discount > 0 && <Row label={`Descuento ${coupon?.code ?? ''}`} value={`-${formatPrice(t.discount)}`} accent />}
              <Row label={`Envío · ${SHIPPING[t.zone].label}`} value={t.shippingPending ? SHIPPING_PENDING_LABEL : 'Gratis'} />
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl font-bold">{formatPrice(t.total)}</span>
            </div>
            {t.shippingPending && (
              <p className="mt-2 text-xs text-muted">
                + envío a coordinar por WhatsApp. Te faltan <b className="text-fg">{formatPrice(t.toFreeShipping)}</b> para envío gratis.
              </p>
            )}

            {error && <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}

            <button disabled={loading} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-sm disabled:opacity-70">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Generando orden…
                </>
              ) : (
                <>
                  <MessageCircle size={18} /> Confirmar pedido
                </>
              )}
            </button>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-surface/60 p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2.5 font-display text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, hint, optional, className, children }: { label: string; hint?: string; optional?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(opcional)</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Success({ order, emoji }: { order: Order; emoji: string }) {
  // el confeti no debe seguir cayendo al cambiar de página
  useEffect(
    () => () => {
      confetti.reset()
    },
    [],
  )
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg px-4 py-20 text-center">
      <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2 }}>
        <CheckCircle2 size={80} className="mx-auto text-primary" />
      </motion.div>
      <h1 className="mt-6 font-display text-4xl font-bold">¡Orden generada!</h1>
      <p className="mt-3 text-muted">Envía el mensaje que se abrió en WhatsApp para confirmar tu pedido. Te responderemos con los datos de pago y entrega {emoji}</p>
      <div className="mt-8 rounded-xl border border-white/10 bg-surface/80 p-6 text-left">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Orden de compra</span>
          <span className="font-mono text-xl font-bold text-primary">{order.id}</span>
        </div>
        <ul className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          {order.items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-4">
              <span className="text-muted">
                {i.quantity} × {i.name}
              </span>
              <span>{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-display text-lg font-bold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>
      <a
        href={whatsappLink(orderWhatsappMessage(order))}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-[#25d366] py-4 font-semibold text-white transition hover:brightness-110"
      >
        <MessageCircle size={20} /> ¿No se abrió? Enviar orden por WhatsApp
      </a>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link to={`/cuenta/pedidos/${order.id}`} className="btn-ghost px-6 py-3">
          Ver mi pedido
        </Link>
        <Link to="/tienda" className="btn-primary px-6 py-3">
          Seguir comprando
        </Link>
      </div>
    </motion.div>
  )
}

/** Confeti con los símbolos de la temporada (corazones, copos…) */
function celebrate(symbols?: string[]) {
  const colors = ['primary', 'secondary', 'accent'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(`--${v}`).trim())
  const shapes = symbols?.slice(0, 2).map((s) => confetti.shapeFromText({ text: s, scalar: 2 }))
  const fire = (x: number) => confetti({ particleCount: 80, spread: 70, origin: { x, y: 0.7 }, colors, ...(shapes ? { shapes, scalar: 2 } : {}) })
  fire(0.25)
  fire(0.75)
  setTimeout(() => fire(0.5), 300)
}

/** Sin sesión: invitación a crear cuenta o ingresar, con el resumen del carrito */
function AccountGate() {
  const { items } = useCart()
  const t = useCartTotals()
  const offer = useWelcomeOffer()
  const count = items.reduce((n, i) => n + i.quantity, 0)
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 px-4 py-14 md:px-6 lg:grid-cols-[1fr_340px]">
      <div className="card-in rounded-xl border border-white/10 bg-surface/70 p-7 sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserIcon size={22} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Crea tu cuenta para hacer tu pedido</h1>
        <p className="mt-2 text-muted">Solo toma un minuto y tu carrito se mantiene. Con tu cuenta:</p>
        <ul className="mt-5 space-y-2.5 text-sm">
          <li className="flex gap-2.5"><CheckCircle2 size={17} className="shrink-0 text-primary" /> Sigues el estado de tu pedido hasta que llegue</li>
          <li className="flex gap-2.5"><CheckCircle2 size={17} className="shrink-0 text-primary" /> Tus datos de envío quedan guardados para la próxima</li>
          {offer && (
            <li className="flex gap-2.5"><CheckCircle2 size={17} className="shrink-0 text-primary" /> <span><b className="text-primary">{offer.percent}% de descuento</b> en tu primera compra</span></li>
          )}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/registro?next=/checkout" className="btn-primary px-6 py-3 text-sm">Crear mi cuenta</Link>
          <Link to="/ingresar?next=/checkout" className="btn-ghost px-6 py-3 text-sm">Ya tengo cuenta</Link>
        </div>
      </div>

      <aside className="rounded-xl border border-white/10 bg-surface/60 p-5">
        <h2 className="mb-3 font-semibold">Tu carrito · {count} {count === 1 ? 'artículo' : 'artículos'}</h2>
        <ul data-lenis-prevent className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {items.map(({ product, quantity }) => (
            <li key={product.id} className="flex items-center gap-3 text-sm">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md">
                <ProductArt icon={product.icon} gradient={product.gradient} image={product.images[0]} iconSize={18} />
              </div>
              <span className="min-w-0 flex-1 truncate">{quantity} × {product.name}</span>
              <span className="font-medium">{formatPrice(product.price * quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-3 font-display text-lg font-bold">
          <span>Total</span>
          <span>{formatPrice(t.total)}</span>
        </div>
      </aside>
    </div>
  )
}
