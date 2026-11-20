import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { formatPrice, SHIPPING, SHIPPING_PENDING_LABEL, type ShippingZone } from '../../config/store'
import { api } from '../../services/api'
import { useCart, useCartTotals } from '../../store/cart'
import { useAuth } from '../../store/auth'
import { ProductArt } from '../ui/ProductArt'
import { useWelcomeOffer } from '../../utils/useWelcomeOffer'

export function CouponInput() {
  const coupon = useCart((s) => s.coupon)
  const setCoupon = useCart((s) => s.setCoupon)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const user = useAuth((s) => s.user)
  const close = useCart((s) => s.close)
  const offer = useWelcomeOffer()

  // El cupón guardado en el carrito se revalida: sin sesión o si ya no aplica, se quita.
  useEffect(() => {
    if (!coupon) return
    if (!user) {
      setCoupon(null)
      toast.info(`Ingresa a tu cuenta para usar el cupón ${coupon.code}`, { id: `coupon-${coupon.code}` })
      return
    }
    let alive = true
    api
      .validateCoupon(coupon.code)
      .then((c) => {
        if (alive && !c) {
          setCoupon(null)
          toast.error(`El cupón ${coupon.code} ya no es válido`, { id: `coupon-${coupon.code}` })
        }
      })
      .catch((e) => {
        if (!alive) return
        setCoupon(null)
        toast.error(`${coupon.code}: ${(e as Error).message}`, { id: `coupon-${coupon.code}` })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, coupon?.code])

  const apply = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const c = await api.validateCoupon(code)
      if (c) {
        setCoupon(c)
        toast.success(`Cupón aplicado: ${c.description}`)
        setCode('')
      } else toast.error('Cupón no válido')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (coupon)
    return (
      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-primary">
          <Tag size={14} /> {coupon.code} (-{coupon.percent}%)
        </span>
        <button onClick={() => setCoupon(null)} className="text-muted hover:text-fg">
          <X size={14} />
        </button>
      </div>
    )

  if (!user)
    return offer ? (
      <Link
        to="/registro?next=/checkout"
        onClick={close}
        className="group flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/[0.08] px-3.5 py-3 transition hover:bg-primary/[0.14]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary font-display text-sm font-bold text-black">
          -{offer.percent}%
        </span>
        <span className="min-w-0 text-sm leading-snug">
          <span className="block font-semibold">Crea tu cuenta y ahorra {offer.percent}%</span>
          <span className="block text-xs text-muted">Descuento en tu primera compra · se aplica solo</span>
        </span>
      </Link>
    ) : (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2.5 text-sm text-muted">
        <Tag size={14} />
        <span>
          ¿Tienes un cupón?{' '}
          <Link to="/ingresar?next=/checkout" onClick={close} className="font-semibold text-primary hover:underline">
            Ingresa
          </Link>{' '}
          para usarlo.
        </span>
      </p>
    )

  return (
    <div className="flex gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        placeholder="Código de descuento"
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm uppercase outline-none focus:border-primary"
      />
      <button
        onClick={apply}
        disabled={loading}
        className="rounded-xl border border-white/10 px-4 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
      >
        {loading ? '…' : 'Aplicar'}
      </button>
    </div>
  )
}

export function CartDrawer() {
  const { items, isOpen, close, setQuantity, remove } = useCart()
  const setShippingZone = useCart((s) => s.setShippingZone)
  const t = useCartTotals()
  const progress = t.subtotal === 0 ? 0 : Math.min(100, ((t.subtotal - t.discount) / (t.subtotal - t.discount + t.toFreeShipping)) * 100)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 z-[61] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-surface"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <ShoppingBag size={20} className="text-primary" /> Tu carrito
              </h2>
              <button onClick={close} className="rounded-full p-2 hover:bg-white/5" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
                  <ShoppingBag size={64} className="text-primary/60" />
                </motion.div>
                <p className="text-muted">Tu carrito está vacío… ¡hora de crear algo!</p>
                <Link to="/tienda" onClick={close} className="btn-primary rounded-xl px-5 py-2.5">
                  Explorar tienda
                </Link>
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-muted uppercase">
                    <Truck size={14} /> ¿Dónde recibes tu pedido?
                  </p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {(Object.keys(SHIPPING) as ShippingZone[]).map((z) => (
                      <button
                        key={z}
                        onClick={() => setShippingZone(z)}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-left transition',
                          t.zone === z ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/25',
                        )}
                      >
                        <span className={clsx('block text-sm font-semibold', t.zone === z && 'text-primary')}>{SHIPPING[z].label}</span>
                        <span className="block text-[11px] text-muted">Gratis desde {formatPrice(SHIPPING[z].freeFrom)}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-xs text-muted">
                    {t.toFreeShipping > 0 ? (
                      <>Te faltan <b className="text-fg">{formatPrice(t.toFreeShipping)}</b> para envío gratis en {SHIPPING[t.zone].label}. Si no, el valor del envío se coordina por WhatsApp.</>
                    ) : (
                      <b className="text-primary">¡Tienes envío gratis a domicilio! 🎉</b>
                    )}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <ul data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto p-5">
                  <AnimatePresence initial={false}>
                    {items.map(({ product, quantity }) => (
                      <motion.li
                        key={product.id}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0 }}
                        className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3"
                      >
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                          <ProductArt image={product.images[0]} icon={product.icon} gradient={product.gradient} iconSize={30} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link to={`/producto/${product.slug}`} onClick={close} className="truncate text-sm font-semibold hover:text-primary">
                            {product.name}
                          </Link>
                          <p className="text-sm text-muted">{formatPrice(product.price)}</p>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center rounded-lg border border-white/10">
                              <button onClick={() => setQuantity(product.id, quantity - 1)} className="p-1.5 hover:text-primary" aria-label="Menos">
                                <Minus size={14} />
                              </button>
                              <span className="w-7 text-center text-sm">{quantity}</span>
                              <button onClick={() => setQuantity(product.id, quantity + 1)} className="p-1.5 hover:text-primary" aria-label="Más">
                                <Plus size={14} />
                              </button>
                            </div>
                            <button onClick={() => remove(product.id)} className="text-muted hover:text-red-400" aria-label="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="space-y-3 border-t border-white/10 p-5">
                  <CouponInput />
                  <div className="space-y-1 text-sm">
                    <Row label="Subtotal" value={formatPrice(t.subtotal)} />
                    {t.discount > 0 && <Row label="Descuento" value={`-${formatPrice(t.discount)}`} accent />}
                    <Row label={`Envío · ${SHIPPING[t.zone].label}`} value={t.shippingPending ? SHIPPING_PENDING_LABEL : 'Gratis'} />
                  </div>
                  <div className="flex justify-between font-display text-xl font-bold">
                    <span>Total</span>
                    <span>{formatPrice(t.total)}</span>
                  </div>
                  <Link to="/checkout" onClick={close} className="btn-primary block rounded-lg py-3.5 text-center">
                    Hacer pedido
                  </Link>
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                    <MessageCircle size={13} className="text-[#25d366]" /> Se genera tu orden y se envía por WhatsApp
                  </p>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={accent ? 'font-semibold text-primary' : ''}>{value}</span>
    </div>
  )
}
