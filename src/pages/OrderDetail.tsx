import { motion } from 'framer-motion'
import { ArrowLeft, Check, Loader2, MapPin, MessageCircle, PackageCheck, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ReviewForm } from '../components/product/ProductReviews'
import { ORDER_FLOW, ORDER_STATUS, OrderBadge } from '../components/ui/OrderStatus'
import { ProductArt } from '../components/ui/ProductArt'
import { Skeleton, Stars } from '../components/ui/misc'
import { formatPrice, SHIPPING, whatsappLink } from '../config/store'
import { api } from '../services/api'
import { useAuth } from '../store/auth'
import type { Order, Review } from '../types'
import { useAsync } from '../utils/useAsync'
import { fmtDate } from './Account'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const user = useAuth((s) => s.user)
  const [reload, setReload] = useState(0)
  const { data: order, loading } = useAsync(() => (user ? api.myOrder(id) : Promise.resolve(null)), [id, user?.id, reload])
  const { data: products } = useAsync(() => api.getProducts(), [])
  const { data: myReviews } = useAsync(() => (user ? api.myReviews() : Promise.resolve([] as Review[])), [user?.id, reload])

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products])
  const reviewByProduct = useMemo(() => new Map((myReviews ?? []).map((r) => [r.productId, r])), [myReviews])

  if (!user) return <Navigate to={`/ingresar?next=/cuenta/pedidos/${id}`} replace />
  if (loading)
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12 md:px-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  if (!order)
    return (
      <div className="py-32 text-center">
        <p className="font-display text-2xl font-bold">Pedido no encontrado</p>
        <Link to="/cuenta?tab=pedidos" className="mt-4 inline-block text-primary hover:underline">Volver a mis pedidos</Link>
      </div>
    )

  const delivered = order.status === 'entregado'
  const count = order.items.reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <Link to="/cuenta?tab=pedidos" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-bold text-primary">{order.id}</h1>
            <OrderBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Realizado el {fmtDate(order.createdAt)} · {count} {count === 1 ? 'artículo' : 'artículos'}
          </p>
        </div>
        <a
          href={whatsappLink(`Hola CECOM, tengo una consulta sobre mi pedido ${order.id}.`)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-muted transition hover:border-[#25d366]/50 hover:text-[#25d366]"
        >
          <MessageCircle size={16} /> ¿Dudas con tu pedido?
        </a>
      </div>

      <Timeline order={order} />

      {order.status === 'enviado' && <ConfirmDelivery order={order} onDone={() => setReload((r) => r + 1)} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Productos */}
        <section className="rounded-xl border border-white/10 bg-surface/60">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-semibold">Productos</h2>
            {delivered && <span className="text-xs text-muted">Califica lo que recibiste (opcional)</span>}
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {order.items.map((i) => {
              const p = productById.get(i.productId)
              return (
                <OrderItem
                  key={i.productId}
                  item={i}
                  image={p?.images[0]}
                  icon={p?.icon ?? 'package'}
                  gradient={p?.gradient ?? ['#333333', '#555555']}
                  slug={p?.slug}
                  canReview={delivered && !!p}
                  review={reviewByProduct.get(i.productId)}
                  onReviewed={() => setReload((r) => r + 1)}
                />
              )
            })}
          </ul>
        </section>

        {/* Resumen y entrega */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-surface/60 p-5 text-sm">
            <h2 className="mb-3 font-semibold">Resumen</h2>
            <dl className="space-y-1.5">
              <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              {order.discount > 0 && (
                <div className="flex justify-between text-primary"><dt>Descuento {order.couponCode}</dt><dd>-{formatPrice(order.discount)}</dd></div>
              )}
              <div className="flex justify-between text-muted">
                <dt>Envío</dt>
                <dd>{order.shippingPending ? 'Por coordinar' : order.shipping ? formatPrice(order.shipping) : 'Gratis'}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 font-display text-lg font-bold"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface/60 p-5 text-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><MapPin size={15} className="text-primary" /> Entrega a domicilio</h2>
            <p>{order.customer.name}</p>
            <p className="text-muted">{order.customer.address}</p>
            <p className="text-muted">{order.customer.city} · {SHIPPING[order.shippingZone ?? 'nacional'].label}</p>
            <p className="mt-2 text-muted">{order.customer.phone}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Línea de tiempo con nombres de cada etapa */
function Timeline({ order }: { order: Order }) {
  if (order.status === 'cancelado')
    return <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Este pedido fue cancelado.</p>
  const idx = ORDER_FLOW.indexOf(order.status)
  return (
    <ol className="mt-8 grid grid-cols-5 gap-1">
      {ORDER_FLOW.map((s, i) => {
        const Icon = ORDER_STATUS[s].icon
        const done = i <= idx
        return (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={clsx('absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2', i <= idx ? 'bg-primary' : 'bg-white/10')} />}
            <span
              className={clsx(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border',
                done ? 'border-primary bg-primary text-black' : 'border-white/15 bg-bg text-muted',
                i === idx && 'ring-4 ring-primary/20',
              )}
            >
              {i < idx ? <Check size={15} /> : <Icon size={14} />}
            </span>
            <span className={clsx('mt-2 text-[11px] leading-tight sm:text-xs', done ? 'text-fg' : 'text-muted')}>{ORDER_STATUS[s].label}</span>
            {s === 'entregado' && order.deliveredAt && <span className="text-[10px] text-muted">{fmtDate(order.deliveredAt)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** Tarjeta para que el cliente confirme que recibió el pedido */
function ConfirmDelivery({ order, onDone }: { order: Order; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await api.confirmDelivery(order.id)
      toast.success('¡Gracias por confirmar! Si quieres, califica tus productos abajo.')
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-primary/40 bg-primary/[0.07] p-5"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <PackageCheck size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">¿Recibiste tu pedido?</p>
        <p className="text-sm text-muted">Confírmalo para cerrar el pedido. Luego podrás calificar tus productos.</p>
      </div>
      <button onClick={confirm} disabled={busy} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-70">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Sí, lo recibí
      </button>
    </motion.div>
  )
}

function OrderItem({
  item,
  image,
  icon,
  gradient,
  slug,
  canReview,
  review,
  onReviewed,
}: {
  item: Order['items'][number]
  image?: string
  icon: string
  gradient: [string, string]
  slug?: string
  canReview: boolean
  review?: Review
  onReviewed: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="px-5 py-4">
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md">
          <ProductArt image={image} icon={icon} gradient={gradient} iconSize={24} />
        </div>
        <div className="min-w-0 flex-1">
          {slug ? (
            <Link to={`/producto/${slug}`} className="font-medium hover:text-primary">{item.name}</Link>
          ) : (
            <p className="font-medium">{item.name}</p>
          )}
          <p className="text-sm text-muted">
            {item.quantity} × {formatPrice(item.price)}
          </p>
          {item.note && <p className="mt-0.5 text-xs text-primary">✎ {item.note}</p>}
        </div>
        <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
      </div>

      {canReview && (
        <div className="mt-3 pl-20">
          {review ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Stars rating={review.rating} size={12} />
              {review.status === 'pendiente' ? 'Tu opinión está en revisión' : review.status === 'activa' ? 'Tu opinión está publicada' : 'Gracias por tu opinión'}
            </div>
          ) : open ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <ReviewForm
                slug={slug!}
                compact
                onDone={() => {
                  setOpen(false)
                  onReviewed()
                }}
              />
            </div>
          ) : (
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Star size={14} /> Calificar producto
            </button>
          )}
        </div>
      )}
    </li>
  )
}
