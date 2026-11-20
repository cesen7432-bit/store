import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSeason } from '../../context/SeasonContext'
import { api } from '../../services/api'
import { useAuth } from '../../store/auth'

/**
 * Anuncio de temporada. Solo se muestra si el cupón existe y está activo
 * (si el admin lo desactiva, el banner desaparece en vez de anunciar algo que no funciona).
 */
export function SeasonBanner() {
  const { season, settings } = useSeason()
  const user = useAuth((s) => s.user)
  const banner = season.banner
  const [hidden, setHidden] = useState<string | null>(null)
  const [valid, setValid] = useState(false)
  const [copied, setCopied] = useState(false)

  // ¿el cupón existe y está activo? (404 = no; 401/409 = existe pero depende del cliente)
  useEffect(() => {
    if (!banner) return
    let alive = true
    setValid(false)
    api
      .validateCoupon(banner.coupon)
      .then((c) => alive && setValid(!!c))
      .catch(() => alive && setValid(true))
    return () => {
      alive = false
    }
  }, [banner])

  const show = settings.showSeasonBanner && banner && valid && hidden !== season.id

  const copy = () => {
    if (!banner) return
    navigator.clipboard?.writeText(banner.coupon).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
    if (!user) toast.info(`Cupón ${banner.coupon} copiado`, { description: 'Ingresa a tu cuenta para aplicarlo en el carrito.', id: 'banner-coupon' })
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={season.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="relative z-50 overflow-hidden border-b border-white/10 bg-[#0d0d0f]"
        >
          {/* brillo del color de la temporada */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: 'radial-gradient(60% 140% at 50% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%)' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3"
            style={{ background: 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 18%, transparent), transparent)' }}
            animate={{ x: ['-40%', '340%'] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)' }} />

          <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-2.5 py-2 pr-10 pl-3 text-sm sm:gap-4 sm:px-12">
            <span className="text-base" aria-hidden>
              {season.emoji}
            </span>
            <p className="truncate text-fg/90">
              <span className="hidden font-semibold text-fg sm:inline">{banner.title}</span>
              <span className="mx-2 hidden text-white/25 sm:inline">·</span>
              <span className="font-display text-base font-bold text-primary">{banner.percent}%</span>
              <span className="hidden sm:inline"> de descuento en tu pedido</span>
              <span className="sm:hidden"> de descuento</span>
            </p>
            <button
              onClick={copy}
              title="Copiar cupón"
              className="group flex shrink-0 items-center gap-2 rounded-md border border-dashed border-primary/60 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-fg transition hover:border-primary hover:bg-primary/20"
            >
              {banner.coupon}
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-muted transition group-hover:text-fg" />}
              <span className="sr-only">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
            {copied && (
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="hidden text-xs text-emerald-400 md:inline">
                ¡Copiado!
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setHidden(season.id)}
            aria-label="Cerrar anuncio"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
