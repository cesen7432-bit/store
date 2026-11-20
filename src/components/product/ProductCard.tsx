import { Check, Heart, MessageCircle, Plus, Wand2 } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import type { Product } from '../../types'
import { formatPrice, productWhatsappMessage, whatsappLink } from '../../config/store'
import { useCart } from '../../store/cart'
import { ProductArt } from '../ui/ProductArt'
import { Stars } from '../ui/misc'

/**
 * Tarjeta de producto. Animación de entrada en CSS (liviana) con retardo escalonado
 * según `index`; hover sutil (elevación + zoom de imagen).
 */
export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useCart((s) => s.add)
  const openCart = useCart((s) => s.open)
  const isFav = useCart((s) => s.favorites.includes(product.id))
  const toggleFavorite = useCart((s) => s.toggleFavorite)
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
  const onDemand = product.stock >= 999
  const soldOut = product.stock <= 0
  const lowStock = !onDemand && product.stock > 0 && product.stock <= 3

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    if (soldOut) return
    add(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1300)
    toast.success(`${product.name} agregado`, { action: { label: 'Ver carrito', onClick: openCart }, id: `add-${product.id}` })
  }

  return (
    <div className="card-in h-full" style={{ '--d': `${Math.min(index % 24, 11) * 35}ms` } as CSSProperties}>
      <Link
        to={`/producto/${product.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04]">
            <ProductArt image={product.images[0]} icon={product.icon} gradient={product.gradient} alt={product.name} iconSize={48} />
          </div>
          {soldOut && <div className="absolute inset-0 bg-black/45" />}

          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
            {soldOut ? (
              <span className="rounded bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white">Agotado</span>
            ) : (
              <>
                {discount > 0 && <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold text-black">-{discount}%</span>}
                {product.isNew && <span className="rounded bg-fg px-2 py-0.5 text-[11px] font-bold text-black">Nuevo</span>}
              </>
            )}
            {product.customizable && (
              <span className="flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white backdrop-blur">
                <Wand2 size={10} /> Personalizable
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.preventDefault()
              toggleFavorite(product.id)
            }}
            aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className={clsx(
              'absolute top-2.5 right-2.5 rounded-full bg-black/55 p-1.5 backdrop-blur transition hover:bg-black/75',
              isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100',
            )}
          >
            <Heart size={15} className={clsx('transition', isFav ? 'scale-110 fill-accent text-accent' : 'text-white')} />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{product.subcategory}</p>
          <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium text-fg transition-colors group-hover:text-primary">{product.name}</h3>
          {product.reviews > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <Stars rating={product.rating} size={11} /> ({product.reviews})
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="min-w-0">
              {product.oldPrice && <p className="text-xs text-muted line-through">{formatPrice(product.oldPrice)}</p>}
              <p className="font-display text-lg leading-none font-bold">{formatPrice(product.price)}</p>
              {lowStock && <p className="mt-1 text-[11px] font-medium text-amber-300">{product.stock === 1 ? '¡Última unidad!' : `Últimas ${product.stock} unidades`}</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  window.open(whatsappLink(productWhatsappMessage(product)), '_blank', 'noopener')
                }}
                aria-label="Consultar por WhatsApp"
                title="Consultar por WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-muted transition hover:border-[#25d366]/50 hover:text-[#25d366]"
              >
                <MessageCircle size={16} />
              </button>
              <button
                onClick={quickAdd}
                disabled={soldOut}
                aria-label={soldOut ? 'Agotado' : 'Agregar al carrito'}
                title={soldOut ? 'Agotado' : 'Agregar al carrito'}
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition active:scale-90',
                  soldOut ? 'cursor-not-allowed bg-white/5 text-muted' : added ? 'bg-emerald-500 text-black' : 'bg-primary text-black hover:brightness-110',
                )}
              >
                {added ? <Check size={17} className="pop-in" /> : <Plus size={17} />}
              </button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
