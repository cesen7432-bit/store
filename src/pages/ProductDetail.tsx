import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Heart, MapPin, MessageCircle, Minus, Plus, ShoppingCart, Truck, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ProductCard } from '../components/product/ProductCard'
import { ProductReviews } from '../components/product/ProductReviews'
import { ProductArt } from '../components/ui/ProductArt'
import { Skeleton, Stars } from '../components/ui/misc'
import { CATEGORIES } from '../data/mock'
import { formatPrice, productWhatsappMessage, SHIPPING, STORE, whatsappLink } from '../config/store'
import { api } from '../services/api'
import { useCart } from '../store/cart'
import { useAsync } from '../utils/useAsync'
import type { Product } from '../types'
import { trackEvent } from '../utils/analytics'

export default function ProductDetail() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { data: product, loading } = useAsync(() => api.getProduct(slug), [slug])
  const { data: related } = useAsync(() => (product ? api.getRelated(product) : Promise.resolve([])), [product?.id])
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [tab, setTab] = useState<'desc' | 'specs'>('desc')
  const { add, open, favorites, toggleFavorite } = useCart()

  // analítica: producto visto
  useEffect(() => {
    if (product) trackEvent('product', `/producto/${product.slug}`, product.id)
  }, [product])

  if (loading)
    return (
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )

  if (!product)
    return (
      <div className="py-32 text-center">
        <p className="font-display text-3xl font-bold">Producto no encontrado</p>
        <Link to="/tienda" className="mt-6 inline-block text-primary underline">Volver a la tienda</Link>
      </div>
    )

  const cat = CATEGORIES.find((c) => c.id === product.category)
  const isFav = favorites.includes(product.id)
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0

  const addToCart = (buyNow = false) => {
    add(product, qty, note || undefined)
    if (buyNow) navigate('/checkout')
    else {
      toast.success('Agregado al carrito', { description: `${qty} × ${product.name}`, action: { label: 'Ver', onClick: open } })
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <nav className="mb-8 flex items-center gap-1.5 text-sm text-muted">
        <Link to="/" className="hover:text-fg">Inicio</Link>
        <ChevronRight size={14} />
        <Link to={`/tienda/${product.category}`} className="hover:text-fg">{cat?.name}</Link>
        <ChevronRight size={14} />
        <span className="truncate text-fg">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Imagen */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:sticky lg:top-24 lg:self-start">
          <Gallery key={product.id} product={product} />
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">{product.subcategory}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight font-bold md:text-5xl">{product.name}</h1>
          {product.reviews > 0 && (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted">
            <Stars rating={product.rating} /> {product.rating} · {product.reviews} reseñas
          </div>
          )}

          <div className="mt-6 flex items-end gap-4">
            <span className="font-display text-4xl font-bold">{formatPrice(product.price)}</span>
            {product.oldPrice && (
              <>
                <span className="text-lg text-muted line-through">{formatPrice(product.oldPrice)}</span>
                <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-black">-{discount}%</span>
              </>
            )}
          </div>

          <p className="mt-6 text-lg text-muted">{product.shortDescription}</p>

          <p className={clsx('mt-4 text-sm font-medium', product.stock < 20 ? 'text-amber-400' : 'text-emerald-400')}>
            {product.stock >= 999 ? '● Fabricado bajo pedido' : product.stock < 20 ? `● ¡Solo quedan ${product.stock} unidades!` : '● En stock, listo para enviar'}
          </p>

          {product.customizable && (
            <div className="mt-6">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Wand2 size={16} className="text-primary" /> Personalización
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Ej: Texto 'Sofía & Juan', tipografía cursiva, color rosa…"
                className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="glass flex items-center rounded-lg">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-4 hover:text-primary" aria-label="Menos"><Minus size={18} /></button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="p-4 hover:text-primary" aria-label="Más"><Plus size={18} /></button>
            </div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => addToCart()} className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-4">
              <ShoppingCart size={20} /> Agregar al carrito
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => toggleFavorite(product.id)}
              className="glass rounded-lg p-4"
              aria-label="Favorito"
            >
              <Heart size={20} className={isFav ? 'fill-accent text-accent' : ''} />
            </motion.button>
          </div>
          <button onClick={() => addToCart(true)} className="mt-3 w-full rounded-lg border border-white/15 py-4 font-semibold transition hover:bg-white/5">
            Comprar ahora
          </button>
          <a
            href={whatsappLink(productWhatsappMessage(product, qty, note || undefined))}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full py-4 flex items-center justify-center gap-2 rounded-lg bg-[#25d366] font-semibold text-white shadow-lg shadow-[#25d366]/25 transition hover:brightness-110"
          >
            <MessageCircle size={20} /> Pedir o consultar por WhatsApp
          </a>
          <p className="mt-2 text-center text-xs text-muted">
            ¿Prefieres llamar? <a href={`tel:+${STORE.whatsapp}`} className="text-primary hover:underline">{STORE.phoneDisplay}</a>
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="glass flex items-center gap-3 rounded-lg p-4"><Truck size={20} className="shrink-0 text-primary" /> Envío gratis en Loja desde {formatPrice(SHIPPING.loja.freeFrom)}</div>
            <div className="glass flex items-center gap-3 rounded-lg p-4"><MapPin size={20} className="shrink-0 text-primary" /> Envío gratis a todo Ecuador desde {formatPrice(SHIPPING.nacional.freeFrom)}</div>
          </div>

          {/* Tabs */}
          <div className="mt-10">
            <div className="flex gap-6 border-b border-white/10">
              {(['desc', 'specs'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={clsx('relative pb-3 font-semibold transition', tab === t ? 'text-fg' : 'text-muted')}>
                  {t === 'desc' ? 'Descripción' : 'Especificaciones'}
                  {tab === t && <motion.span layoutId="tab-line" className="absolute right-0 -bottom-px left-0 h-0.5 bg-primary" />}
                </button>
              ))}
            </div>
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-6">
              {tab === 'desc' ? (
                <p className="leading-relaxed text-muted">{product.description}</p>
              ) : (
                <dl className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                  {Object.entries(product.specs).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm odd:bg-white/[0.02]">
                      <dt className="font-medium text-muted">{k}</dt>
                      <dd className="col-span-2">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>

      <ProductReviews product={product} />

      {related && related.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 font-display text-3xl font-bold">También te puede gustar</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </div>
  )
}

/** Galería: solo muestra miniaturas si hay más de una foto real; al tocar una cambia la principal */
function Gallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0)
  const images = product.images.filter(Boolean)
  return (
    <div>
      <div className="group relative aspect-square overflow-hidden rounded-xl border border-white/10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
          >
            <ProductArt image={images[active]} icon={product.icon} gradient={product.gradient} iconSize={120} alt={product.name} />
          </motion.div>
        </AnimatePresence>
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2.5">
          {images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={clsx(
                'aspect-square overflow-hidden rounded-lg border-2 transition',
                i === active ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <ProductArt image={src} icon={product.icon} gradient={product.gradient} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
