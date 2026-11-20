import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useSeason } from '../../context/SeasonContext'

/** Las partículas decoran solo el inicio: en catálogo, producto y formularios distraen */
const SHOW_ON = ['/']

/** Capa de partículas (nieve, corazones, estrellas…) según la temporada activa. Solo CSS → muy liviano. */
export function SeasonalParticles() {
  const { season, effectsEnabled } = useSeason()
  const { pathname } = useLocation()
  const cfg = season.particles

  const particles = useMemo(() => {
    if (!cfg) return []
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    const count = isMobile ? Math.ceil(cfg.count / 2) : cfg.count
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      symbol: cfg.symbols[i % cfg.symbols.length],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 10 + Math.random() * 18,
      duration: cfg.motion === 'float' ? 5 + Math.random() * 6 : 10 + Math.random() * 14,
      delay: -Math.random() * 20,
      drift: (Math.random() - 0.5) * 160,
      opacity: 0.35 + Math.random() * 0.55,
    }))
  }, [cfg])

  if (!cfg || !effectsEnabled || !SHOW_ON.includes(pathname)) return null

  const anim =
    cfg.motion === 'fall'
      ? 'particle-fall'
      : cfg.motion === 'rise'
        ? 'particle-rise'
        : cfg.motion === 'float'
          ? 'particle-float'
          : 'twinkle'

  return (
    <AnimatePresence>
      <motion.div
        key={season.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute select-none"
            style={
              {
                left: `${p.left}%`,
                top: cfg.motion === 'float' ? `${p.top}%` : 0,
                fontSize: p.size,
                opacity: cfg.motion === 'rise' ? 0 : p.opacity,
                color: p.id % 3 === 0 ? 'var(--accent)' : p.id % 3 === 1 ? 'var(--primary)' : 'var(--text)',
                textShadow: '0 0 8px currentColor',
                animation: `${anim} ${p.duration}s linear ${p.delay}s infinite`,
                animationTimingFunction: cfg.motion === 'float' ? 'ease-in-out' : 'linear',
                '--drift': `${p.drift}px`,
                '--op': p.opacity,
              } as React.CSSProperties
            }
          >
            {p.symbol}
          </span>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
