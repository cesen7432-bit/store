import { motion } from 'framer-motion'
import clsx from 'clsx'

/**
 * Logo CECOM vectorizado desde public/brand/logo-cecom-original.png
 * Geometría en una grilla de 890×1050: punto superior izquierdo, "C" con esquinas
 * achaflanadas y dos pads cuadrados internos.
 */
export const LOGO_VIEWBOX = '0 0 890 1050'
export const LOGO_C_PATH = 'M440 0H890V150H520L440 230V820L520 900H890V1050H440L290 900V150Z'
export const LOGO_PIXELS = [
  { x: 0, y: 0 }, // punto
  { x: 590, y: 300 }, // pad superior
  { x: 590, y: 600 }, // pad inferior
]
export const PIXEL = 150

/** Marca estática (navbar, footer, favicon). `led` colorea los pads con el color de la temporada. */
export function LogoMark({ className, led = true, blink = false }: { className?: string; led?: boolean; blink?: boolean }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={clsx('overflow-visible', className)} aria-hidden>
      <path d={LOGO_C_PATH} fill="currentColor" />
      {LOGO_PIXELS.map((p, i) => (
        <motion.rect
          key={i}
          x={p.x}
          y={p.y}
          width={PIXEL}
          height={PIXEL}
          fill={led && i > 0 ? 'var(--primary)' : 'currentColor'}
          animate={blink ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
          transition={blink ? { duration: 0.5, delay: i * 0.12, repeat: 1 } : undefined}
        />
      ))}
    </svg>
  )
}

/** Logo que se "ensambla": pixeles que caen + la C que se revela de izquierda a derecha. */
export function LogoAssemble({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={clsx('overflow-visible', className)} aria-hidden>
      <defs>
        <clipPath id="logo-reveal">
          <motion.rect
            x={0}
            y={0}
            height={1050}
            initial={{ width: 0 }}
            animate={{ width: 890 }}
            transition={{ duration: 0.7, delay: delay + 0.15, ease: [0.65, 0, 0.35, 1] }}
          />
        </clipPath>
      </defs>
      <path d={LOGO_C_PATH} fill="currentColor" clipPath="url(#logo-reveal)" />
      {LOGO_PIXELS.map((p, i) => (
        <motion.rect
          key={i}
          x={p.x}
          y={p.y}
          width={PIXEL}
          height={PIXEL}
          fill={i > 0 ? 'var(--primary)' : 'currentColor'}
          initial={{ opacity: 0, y: -260 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.55 + i * 0.12, type: 'spring', stiffness: 380, damping: 18 }}
        />
      ))}
    </svg>
  )
}
