import { BadgeCheck, Loader2, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { api } from '../../services/api'
import { useAuth } from '../../store/auth'
import type { Product } from '../../types'
import { useAsync } from '../../utils/useAsync'
import { Stars } from '../ui/misc'

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

/** Opiniones publicadas (activadas por el admin) + formulario para quien compró el producto */
export function ProductReviews({ product }: { product: Product }) {
  const user = useAuth((s) => s.user)
  const [reload, setReload] = useState(0)
  const { data: reviews } = useAsync(() => api.getReviews(product.slug), [product.slug, reload])
  const { data: mine } = useAsync(() => (user ? api.myReview(product.slug) : Promise.resolve(null)), [product.slug, user?.id, reload])

  return (
    <section className="mt-20 grid gap-10 lg:grid-cols-[320px_1fr]">
      <div>
        <h2 className="font-display text-2xl font-bold">Opiniones</h2>
        {product.reviews > 0 ? (
          <div className="mt-4 flex items-center gap-4">
            <span className="font-display text-5xl font-bold">{product.rating.toFixed(1)}</span>
            <div>
              <Stars rating={product.rating} size={16} />
              <p className="mt-1 text-sm text-muted">
                {product.reviews} {product.reviews === 1 ? 'opinión' : 'opiniones'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Este producto aún no tiene opiniones.</p>
        )}

        <div className="mt-6">
          {!user ? (
            <p className="text-sm text-muted">
              <Link to={`/ingresar?next=/producto/${product.slug}`} className="font-semibold text-primary hover:underline">
                Ingresa
              </Link>{' '}
              para opinar sobre un producto que hayas comprado.
            </p>
          ) : mine?.review ? (
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">
              {mine.review.status === 'pendiente'
                ? 'Gracias por tu opinión. Se publicará cuando nuestro equipo la revise.'
                : mine.review.status === 'activa'
                  ? 'Tu opinión está publicada. ¡Gracias!'
                  : 'Ya dejaste tu opinión sobre este producto.'}
            </p>
          ) : mine?.canReview ? (
            <ReviewForm slug={product.slug} onDone={() => setReload((r) => r + 1)} />
          ) : mine ? (
            <p className="text-sm text-muted">Podrás opinar cuando hayas recibido este producto.</p>
          ) : null}
        </div>
      </div>

      <div>
        {reviews && reviews.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {reviews.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} size={13} />
                  <span className="text-sm font-semibold">{r.authorName}</span>
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                      <BadgeCheck size={12} /> Compra verificada
                    </span>
                  )}
                  <span className="text-xs text-muted">{fmt(r.createdAt)}</span>
                </div>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-fg/90">{r.comment}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export function ReviewForm({ slug, onDone, compact }: { slug: string; onDone: () => void; compact?: boolean }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!rating) return toast.error('Elige de 1 a 5 estrellas')
    setSending(true)
    try {
      await api.createReview(slug, { rating, comment })
      toast.success('¡Gracias! Tu opinión se publicará cuando la revisemos.')
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className={clsx('space-y-3', !compact && 'rounded-lg border border-white/10 bg-surface p-4')}>
      {!compact && <p className="text-sm font-medium">¿Qué te pareció?</p>}
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} estrellas`}>
            <Star size={24} className={clsx('transition', n <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-white/20')} />
          </button>
        ))}
      </div>
      <textarea
        required
        minLength={10}
        maxLength={1000}
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Cuéntanos cómo te fue con el producto…"
        className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <button disabled={sending} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-70">
        {sending && <Loader2 size={14} className="animate-spin" />} Enviar opinión
      </button>
    </form>
  )
}
