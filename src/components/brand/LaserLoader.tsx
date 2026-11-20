/**
 * Loader "grabado láser": el cabezal recorre el contorno del logo CECOM.
 * - <LaserMark state="working" />: recorrido en bucle (SMIL: cabezal y estela sincronizados)
 * - <LaserMark state="done" />: la pieza queda cortada, se rellena y los pads se encienden
 * - <LaserOverlay />: capa global controlada con `withLaser()` (store/laser.ts)
 * - <PageLoader />: versión pequeña para cargas de página (aparece solo si tarda)
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useId } from 'react'
import { useLaser } from '../../store/laser'
import { LOGO_C_PATH, LOGO_PIXELS, PIXEL } from './Logo'

const DUR = '2.4s'
// placa de 1300×1300 con el logo (890×1050) centrado
const OX = 205
const OY = 125

export function LaserMark({ state = 'working', size = 180 }: { state?: 'working' | 'done'; size?: number }) {
  const id = useId().replace(/:/g, '')
  const done = state === 'done'
  return (
    <svg viewBox="0 0 1300 1300" width={size} height={size} className="overflow-visible" aria-hidden>
      <defs>
        <clipPath id={`${id}-bed`}>
          <rect width="1300" height="1300" rx="60" />
        </clipPath>
        <pattern id={`${id}-dots`} width="65" height="65" patternUnits="userSpaceOnUse">
          <circle cx="32" cy="32" r="4" fill="rgba(255,255,255,0.08)" />
        </pattern>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <g clipPath={`url(#${id}-bed)`}>
        {/* cama de la máquina */}
        <rect width="1300" height="1300" fill="#111114" />
        <rect width="1300" height="1300" fill={`url(#${id}-dots)`} />

        <g transform={`translate(${OX} ${OY})`}>
          {/* contorno a cortar (tenue) */}
          <path d={LOGO_C_PATH} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />

          {done ? (
            <>
              {/* pieza terminada */}
              <motion.path d={LOGO_C_PATH} fill="var(--text)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} />
              {LOGO_PIXELS.map((p, i) => (
                <motion.rect
                  key={i}
                  x={p.x}
                  y={p.y}
                  width={PIXEL}
                  height={PIXEL}
                  fill={i === 0 ? 'var(--text)' : 'var(--primary)'}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.1, type: 'spring', stiffness: 400, damping: 16 }}
                  style={{ transformOrigin: `${p.x + PIXEL / 2}px ${p.y + PIXEL / 2}px`, filter: i ? 'drop-shadow(0 0 30px var(--primary))' : undefined }}
                />
              ))}
            </>
          ) : (
            <>
              {/* estela de corte: se dibuja en sincronía con el cabezal */}
              <path d={LOGO_C_PATH} pathLength={1} fill="none" stroke="var(--primary)" strokeWidth="16" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset="1">
                <animate attributeName="stroke-dashoffset" values="1;0" dur={DUR} repeatCount="indefinite" />
              </path>
              <path d={LOGO_C_PATH} pathLength={1} fill="none" stroke="var(--primary)" strokeWidth="40" strokeDasharray="1" strokeDashoffset="1" opacity="0.35" filter={`url(#${id}-glow)`}>
                <animate attributeName="stroke-dashoffset" values="1;0" dur={DUR} repeatCount="indefinite" />
              </path>

              {/* pórtico + cabezal: se mueven juntos por el contorno; la barra es ancha y la recorta la placa */}
              <g>
                <animateMotion dur={DUR} repeatCount="indefinite" path={LOGO_C_PATH} />
                <rect x="-3000" y="-26" width="6000" height="52" fill="#1d1d22" />
                <rect x="-3000" y="-5" width="6000" height="10" fill="rgba(255,255,255,0.05)" />
                <rect x="-70" y="-62" width="140" height="124" rx="16" fill="#2a2a31" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                <rect x="-70" y="-62" width="140" height="22" rx="8" fill="var(--primary)" />
                <circle r="70" fill="var(--primary)" opacity="0.35" filter={`url(#${id}-glow)`} />
                <circle r="16" fill="#fff" />
                <g fill="#ffd8a8" className="laser-sparks">
                  <circle cx="34" cy="-20" r="6" />
                  <circle cx="-28" cy="26" r="5" />
                  <circle cx="22" cy="34" r="4" />
                  <circle cx="-36" cy="-14" r="4" />
                </g>
              </g>
            </>
          )}
        </g>
      </g>
      <rect width="1300" height="1300" rx="60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
    </svg>
  )
}

/** Capa global para peticiones importantes (pedido, cotización, verificación) */
export function LaserOverlay() {
  const { status, label, doneLabel } = useLaser()
  const done = status === 'done'
  return (
    <AnimatePresence>
      {status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="flex flex-col items-center"
          >
            <div className="relative">
              <LaserMark state={done ? 'done' : 'working'} size={190} />
              <AnimatePresence>
                {done && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.35, type: 'spring', stiffness: 420, damping: 14 }}
                    className="absolute -right-3 -bottom-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg shadow-emerald-500/40"
                  >
                    <Check size={22} strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={done ? 'done' : 'working'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-6 font-display text-lg font-semibold"
              >
                {done ? doneLabel : label}
              </motion.p>
            </AnimatePresence>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{done ? 'Pieza lista' : 'Cortando…'}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Carga de página: aparece solo si tarda más de un instante (evita parpadeos) */
export function PageLoader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="page-loader flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <LaserMark size={84} />
      <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{label}…</p>
    </div>
  )
}

/** Lecturas en curso: láser pequeño en la esquina (aparece solo si tarda) */
export function LaserActivity() {
  const reads = useLaser((s) => s.reads)
  const busy = useLaser((s) => s.status !== 'idle')
  return (
    <AnimatePresence>
      {reads > 0 && !busy && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className="pointer-events-none fixed bottom-5 left-5 z-[90] flex items-center gap-2.5 rounded-full border border-white/10 bg-surface/90 py-2 pr-4 pl-2 shadow-xl backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <LaserMark size={40} />
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Cargando…</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
