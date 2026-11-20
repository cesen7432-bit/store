/**
 * "De tu idea a la pieza": sección fija (sticky) que avanza con el scroll.
 * Una misma pieza (letrero Café Luna) pasa por diseño → cotización → corte → entrega.
 */
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { formatPrice } from '../../config/store'

const star = (cx: number, cy: number, R: number, r: number) =>
  'M' +
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 ? r : R
    return `${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`
  }).join(' L') +
  ' Z'

// Geometría de la pieza (unidades = mm aprox., placa 360×360)
const PLATE = 'M44 20 H356 Q380 20 380 44 V356 Q380 380 356 380 H44 Q20 380 20 356 V44 Q20 20 44 20 Z'
const MOON = 'M205 95 A115 115 0 1 0 300 290 A92 92 0 1 1 205 95 Z'
const STAR = star(292, 132, 34, 14)
const HOLES = [
  { cx: 50, cy: 50 },
  { cx: 350, cy: 50 },
]
const CUTS = [PLATE, MOON, STAR]
const NODES = [
  [20, 44], [44, 20], [356, 20], [380, 44], [380, 356], [356, 380], [44, 380], [20, 356],
  [205, 95], [300, 290], [292, 98], [124, 210],
]

const STEPS = [
  { t: 'Envía tu diseño', d: 'SVG, DXF, AI o PDF. ¿Solo tienes una idea o un boceto? Lo diseñamos contigo.' },
  { t: 'Cotiza al instante', d: 'Eliges material, espesor y medidas. El precio se calcula en segundos.' },
  { t: 'Cortamos con precisión', d: 'Corte y grabado láser de precisión en acrílico, MDF, madera o cuero.' },
  { t: 'Lo recibes listo', d: 'Empacado y protegido. Retiro en Loja o envío a todo el Ecuador.' },
]

const SEGMENTS: [number, number][] = [
  [0.5, 0.6],
  [0.6, 0.68],
  [0.68, 0.74],
]

export function ProcessSection() {
  const ref = useRef<HTMLElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const paths = useRef<(SVGPathElement | null)[]>([])
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [step, setStep] = useState(0)

  const cutProgress = SEGMENTS.map(([a, b]) => useTransform(scrollYProgress, [a, b], [0, 1])) // eslint-disable-line react-hooks/rules-of-hooks
  const railH = useTransform(scrollYProgress, [0.02, 0.9], ['0%', '100%'])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setStep(Math.max(0, Math.min(3, Math.floor(v * 4.2))))
    // posiciona el punto del láser sobre el contorno que se está cortando
    const i = SEGMENTS.findIndex(([a, b]) => v >= a && v <= b)
    const el = dot.current
    if (!el) return
    if (i < 0 || !paths.current[i]) {
      el.style.opacity = '0'
      return
    }
    const p = paths.current[i]!
    const t = (v - SEGMENTS[i][0]) / (SEGMENTS[i][1] - SEGMENTS[i][0])
    const pt = p.getPointAtLength(t * p.getTotalLength())
    el.setAttribute('cx', String(pt.x))
    el.setAttribute('cy', String(pt.y))
    el.style.opacity = '1'
  })

  const designColor = '#5aa9ff'

  return (
    <section ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden py-16">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 md:px-6 lg:grid-cols-2 lg:gap-20">
          {/* Texto */}
          <div className="order-2 lg:order-1">
            <p className="mb-4 font-mono text-xs tracking-[0.18em] text-primary uppercase">Servicio de corte láser</p>
            <h2 className="font-display text-3xl leading-tight font-bold md:text-5xl">De tu idea a la pieza terminada</h2>

            <div className="relative mt-10 pl-6">
              <div className="absolute top-0 bottom-0 left-0 w-px bg-white/10" />
              <motion.div className="absolute top-0 left-0 w-px bg-primary shadow-[0_0_10px_var(--primary)]" style={{ height: railH }} />
              <ol className="space-y-7">
                {STEPS.map((s, i) => (
                  <li key={s.t} className={clsx('transition-all duration-500', i === step ? 'opacity-100' : i < step ? 'opacity-45' : 'opacity-25')}>
                    <h3 className={clsx('font-display font-semibold transition-all duration-500', i === step ? 'text-2xl' : 'text-lg')}>{s.t}</h3>
                    <AnimatePresence initial={false}>
                      {i === step && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-2 max-w-md overflow-hidden text-muted"
                        >
                          {s.d}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ol>
            </div>

            <Link to="/cotizar" className="btn-primary mt-10 inline-flex items-center gap-2 px-7 py-4">
              Cotizar mi pieza <ArrowRight size={18} />
            </Link>
          </div>

          {/* Pieza */}
          <div className="relative order-1 mx-auto w-full max-w-[520px] lg:order-2">
            <svg viewBox="-60 -70 520 540" className="w-full overflow-visible">
              {/* superficie: lienzo de diseño (cuadrícula) → material → entrega */}
              <motion.rect
                x={-40}
                y={-50}
                width={480}
                height={500}
                rx={6}
                animate={{ fill: step === 0 ? '#0f1520' : step === 3 ? 'rgba(0,0,0,0)' : '#141417', opacity: step === 3 ? 0 : 1 }}
                transition={{ duration: 0.5 }}
              />
              {step === 0 &&
                Array.from({ length: 13 }).map((_, i) => (
                  <g key={i} stroke="#5aa9ff" strokeOpacity={0.08}>
                    <line x1={-40 + i * 40} y1={-50} x2={-40 + i * 40} y2={450} />
                    <line x1={-40} y1={-50 + i * 40} x2={440} y2={-50 + i * 40} />
                  </g>
                ))}

              {/* pieza terminada (paso 4) */}
              <motion.g
                initial={false}
                animate={{ opacity: step === 3 ? 1 : 0, y: step === 3 ? -10 : 0 }}
                transition={{ duration: 0.6 }}
              >
                <path d={PLATE} fill="#16161a" stroke="#ffffff20" style={{ filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.6))' }} />
                <path d={MOON} fill="var(--primary)" style={{ filter: 'drop-shadow(0 0 18px var(--primary))' }} />
                <path d={STAR} fill="var(--secondary)" />
                <text x={200} y={360} textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight={700} fontSize={28} fill="var(--text)" letterSpacing={4}>
                  CAFÉ LUNA
                </text>
              </motion.g>

              {/* contornos: azul (diseño) → naranja (corte) */}
              <g style={{ opacity: step === 3 ? 0 : 1, transition: 'opacity .5s' }}>
                {CUTS.map((d, i) => (
                  <g key={i}>
                    <path d={d} fill="none" stroke={step < 2 ? designColor : '#ffffff22'} strokeWidth={2} style={{ transition: 'stroke .4s' }} />
                    <motion.path
                      ref={(el) => {
                        paths.current[i] = el
                      }}
                      d={d}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      style={{ pathLength: cutProgress[i], filter: 'drop-shadow(0 0 6px var(--primary))' }}
                    />
                  </g>
                ))}
                {HOLES.map((h) => (
                  <circle key={h.cx} {...h} r={8} fill="none" stroke={step < 2 ? designColor : 'var(--primary)'} strokeWidth={2} />
                ))}
                <circle ref={dot} r={6} fill="#fff" style={{ opacity: 0, filter: 'drop-shadow(0 0 8px var(--primary)) drop-shadow(0 0 3px #fff)' }} />
              </g>

              {/* Paso 1: nodos de edición + nombre de archivo */}
              <AnimatePresence>
                {step === 0 && (
                  <motion.g key="design" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {NODES.map(([x, y], i) => (
                      <motion.rect
                        key={i}
                        x={x - 5}
                        y={y - 5}
                        width={10}
                        height={10}
                        fill="#0f1520"
                        stroke={designColor}
                        strokeWidth={2}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        style={{ transformOrigin: `${x}px ${y}px` }}
                      />
                    ))}
                    <g transform="translate(-40 -50)">
                      <rect width={170} height={30} fill={designColor} />
                      <text x={12} y={20} fontFamily="JetBrains Mono, monospace" fontSize={14} fill="#06121f">
                        cafe-luna.svg
                      </text>
                    </g>
                    {/* cursor */}
                    <motion.path
                      d="M0 0 L0 22 L6 16 L11 27 L15 25 L10 14 L18 14 Z"
                      fill="#fff"
                      stroke="#000"
                      strokeWidth={1}
                      animate={{ x: [300, 210, 250, 300], y: [290, 100, 180, 290] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </motion.g>
                )}
              </AnimatePresence>

              {/* Paso 2: cotas + etiqueta de precio */}
              <AnimatePresence>
                {step === 1 && (
                  <motion.g key="quote" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <g stroke="var(--muted)" strokeWidth={1.5}>
                      <line x1={20} y1={410} x2={380} y2={410} />
                      <line x1={20} y1={400} x2={20} y2={420} />
                      <line x1={380} y1={400} x2={380} y2={420} />
                      <line x1={410} y1={20} x2={410} y2={380} />
                      <line x1={400} y1={20} x2={420} y2={20} />
                      <line x1={400} y1={380} x2={420} y2={380} />
                    </g>
                    <text x={200} y={436} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={15} fill="var(--muted)">
                      300 mm
                    </text>
                    <text x={432} y={205} fontFamily="JetBrains Mono, monospace" fontSize={15} fill="var(--muted)" transform="rotate(90 432 205)" textAnchor="middle">
                      300 mm
                    </text>
                    <motion.g initial={{ y: 10 }} animate={{ y: 0 }}>
                      <rect x={150} y={-58} width={250} height={66} fill="var(--surface)" stroke="var(--primary)" />
                      <text x={166} y={-34} fontFamily="JetBrains Mono, monospace" fontSize={13} fill="var(--muted)">
                        ACRÍLICO NEGRO 3MM · x1
                      </text>
                      <text x={166} y={-6} fontFamily="Space Grotesk, sans-serif" fontWeight={700} fontSize={24} fill="var(--text)">
                        {formatPrice(24.9)}
                      </text>
                    </motion.g>
                  </motion.g>
                )}
              </AnimatePresence>

              {/* Paso 4: etiqueta de envío */}
              <AnimatePresence>
                {step === 3 && (
                  <motion.g key="ship" initial={{ opacity: 0, x: 30, rotate: 0 }} animate={{ opacity: 1, x: 0, rotate: -4 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}>
                    <rect x={230} y={380} width={200} height={84} fill="#f4f1e8" />
                    <rect x={230} y={380} width={200} height={20} fill="var(--primary)" />
                    <text x={242} y={395} fontFamily="JetBrains Mono, monospace" fontSize={11} fill="#000" fontWeight={700}>
                      CECOM · ENVÍO
                    </text>
                    <text x={242} y={424} fontFamily="JetBrains Mono, monospace" fontSize={14} fill="#111">
                      LOJA → ECUADOR
                    </text>
                    {Array.from({ length: 22 }).map((_, i) => (
                      <rect key={i} x={242 + i * 8} y={434} width={i % 3 ? 3 : 5} height={20} fill="#111" />
                    ))}
                  </motion.g>
                )}
              </AnimatePresence>
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
