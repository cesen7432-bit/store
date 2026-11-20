/**
 * Carrusel "máquina láser": vista cenital de una cortadora CO₂ que corta/graba
 * distintos trabajos en vivo. Cada pestaña es un trabajo (Job) que usa el motor
 * LaserEngine para mover el pórtico, el cabezal y encender el haz.
 */
import { animate, AnimatePresence, motion, type AnimationPlaybackControls } from 'framer-motion'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { useSeason } from '../../context/SeasonContext'
import { LOGO_C_PATH } from '../brand/Logo'

// ───────────────────────── Motor ─────────────────────────
type Pt = { x: number; y: number }
const PARK: Pt = { x: 880, y: 120 }
const BED_MM = 600 // la cama de 840 unidades representa 600mm
const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface EngineRefs {
  rail: RefObject<SVGGElement | null>
  head: RefObject<SVGGElement | null>
  beam: RefObject<SVGGElement | null>
  sparks: RefObject<SVGGElement | null>
  hudX: RefObject<HTMLSpanElement | null>
  hudY: RefObject<HTMLSpanElement | null>
  hudStatus: RefObject<HTMLSpanElement | null>
}

class LaserEngine {
  pos: Pt = { ...PARK }
  private controls = new Set<AnimationPlaybackControls>()
  private token = 0
  private beamOnState = false
  private refs: EngineRefs
  constructor(refs: EngineRefs) {
    this.refs = refs
  }

  place({ x, y }: Pt) {
    this.pos = { x, y }
    const { rail, head, sparks, hudX, hudY } = this.refs
    rail.current?.setAttribute('transform', `translate(0 ${y})`)
    head.current?.setAttribute('transform', `translate(${x} ${y})`)
    const mm = (v: number) => Math.max(0, ((v - 80) / 840) * BED_MM).toFixed(1).padStart(5, '0')
    if (hudX.current) hudX.current.textContent = `X ${mm(x)}`
    if (hudY.current) hudY.current.textContent = `Y ${mm(y)}`
    // chispas: posiciones aleatorias alrededor del punto de corte
    if (this.beamOnState && sparks.current) {
      for (const c of Array.from(sparks.current.children)) {
        const a = Math.random() * Math.PI * 2
        const r = 6 + Math.random() * 22
        c.setAttribute('cx', String(Math.cos(a) * r))
        c.setAttribute('cy', String(Math.sin(a) * r))
        c.setAttribute('opacity', String(Math.random()))
      }
    }
  }

  beam(on: boolean, status = 'EN ESPERA') {
    this.beamOnState = on
    const { beam, hudStatus } = this.refs
    if (beam.current) beam.current.style.opacity = on ? '1' : '0'
    if (hudStatus.current) hudStatus.current.textContent = on ? status : 'MOVIENDO'
  }

  status(text: string) {
    if (this.refs.hudStatus.current) this.refs.hudStatus.current.textContent = text
  }

  /** Interpola 0→1. Si el trabajo se cancela, la promesa nunca se resuelve (el job queda detenido). */
  tween(duration: number, onUpdate: (t: number) => void, ease: 'linear' | 'easeInOut' = 'linear') {
    return new Promise<void>((resolve) => {
      if (prefersReduced()) {
        onUpdate(1)
        return resolve()
      }
      const c = animate(0, 1, {
        duration,
        ease,
        onUpdate,
        onComplete: () => {
          this.controls.delete(c)
          resolve()
        },
      })
      this.controls.add(c)
    })
  }

  wait(ms: number) {
    const tok = this.token
    return new Promise<void>((resolve) => setTimeout(() => tok === this.token && resolve(), prefersReduced() ? 0 : ms))
  }

  cancel() {
    this.token++
    this.controls.forEach((c) => c.stop())
    this.controls.clear()
    this.beam(false)
    this.status('EN ESPERA')
  }

  async moveTo(to: Pt, speed = 1800) {
    this.beam(false)
    const from = { ...this.pos }
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    await this.tween(Math.max(0.12, dist / speed), (t) => this.place({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }), 'easeInOut')
  }

  /** Recorre un <path> encendiendo el haz y dibujando la estela de corte. */
  async cut(path: SVGPathElement, map: (p: DOMPoint) => Pt, scale = 1, speed = 560, status = 'CORTANDO') {
    const len = path.getTotalLength()
    path.style.strokeDasharray = `${len}`
    path.style.strokeDashoffset = `${len}`
    await this.moveTo(map(path.getPointAtLength(0)))
    this.beam(true, status)
    await this.tween((len * scale) / speed, (t) => {
      const l = t * len
      path.style.strokeDashoffset = `${len - l}`
      this.place(map(path.getPointAtLength(l)))
    })
    this.beam(false)
  }

  /** Grabado raster: zig-zag horizontal mientras el pórtico baja línea por línea. */
  async raster(r: { x: number; y: number; w: number; h: number }, onProgress: (t: number) => void, gap = 14, speed = 3800) {
    const lines = Math.ceil(r.h / gap)
    await this.moveTo({ x: r.x, y: r.y })
    this.beam(true, 'GRABANDO')
    await this.tween((lines * r.w) / speed, (t) => {
      const v = t * lines
      const i = Math.min(Math.floor(v), lines - 1)
      const f = v - i
      const x = i % 2 ? r.x + r.w - f * r.w : r.x + f * r.w
      this.place({ x, y: r.y + i * gap })
      onProgress(t)
    })
    this.beam(false)
  }
}

// ───────────────────────── Trabajos ─────────────────────────
interface JobProps {
  engine: LaserEngine
  progress: (p: number) => void
  onDone: () => void
  seasonId: string
  word: string
}

/** Ejecuta la secuencia del trabajo al montar y la cancela al desmontar */
function useJob(engine: LaserEngine, run: () => Promise<void>) {
  useEffect(() => {
    run()
    return () => engine.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

const TRAIL = { fill: 'none', stroke: 'var(--primary)', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const HIDDEN_DASH = { strokeDasharray: 100000, strokeDashoffset: 100000 }

// 1) Corte del logo en acrílico
function LogoJob({ engine, progress, onDone }: JobProps) {
  const S = 0.55
  const OX = 255
  const OY = 211
  const paths = [LOGO_C_PATH, 'M0 0h150v150h-150Z', 'M590 300h150v150h-150Z', 'M590 600h150v150h-150Z']
  const refs = useRef<(SVGPathElement | null)[]>([])
  const [done, setDone] = useState(false)
  const map = (p: DOMPoint) => ({ x: OX + p.x * S, y: OY + p.y * S })

  useJob(engine, async () => {
    for (let i = 0; i < paths.length; i++) {
      await engine.cut(refs.current[i]!, map, S)
      progress((i + 1) / (paths.length + 1))
    }
    await engine.moveTo(PARK)
    setDone(true)
    engine.status('PIEZA LISTA ✓')
    progress(1)
    await engine.wait(2800)
    onDone()
  })

  return (
    <g>
      <rect x={180} y={160} width={640} height={680} rx={8} fill="#141417" stroke="#ffffff12" />
      <text x={196} y={190} className="fill-white/25 font-mono" fontSize={16}>ACRÍLICO NEGRO 3MM</text>
      <g transform={`translate(${OX} ${OY}) scale(${S})`}>
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.6 }}>
          <path d={LOGO_C_PATH} fill="var(--text)" />
          <rect width={150} height={150} fill="var(--text)" />
          <rect x={590} y={300} width={150} height={150} fill="var(--primary)" className="led-pulse" />
          <rect x={590} y={600} width={150} height={150} fill="var(--primary)" className="led-pulse" style={{ animationDelay: '0.4s' }} />
        </motion.g>
        {paths.map((d, i) => (
          <path
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            d={d}
            {...TRAIL}
            strokeWidth={6 / S}
            style={{ ...HIDDEN_DASH, opacity: done ? 0.35 : 1, transition: 'opacity .6s' }}
          />
        ))}
      </g>
    </g>
  )
}

/** Divide una frase en 2 líneas lo más parejas posible */
function splitInTwo(text: string) {
  const w = text.split(' ')
  if (w.length < 2) return [text]
  let best = 1
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' ').length
    const b = w.slice(i).join(' ').length
    const cur = Math.max(w.slice(0, best).join(' ').length, w.slice(best).join(' ').length)
    if (Math.max(a, b) < cur) best = i
  }
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')]
}

// 2) Grabado raster sobre madera
function EngraveJob({ engine, progress, onDone, word }: JobProps) {
  const clipId = useId()
  const reveal = useRef<SVGRectElement>(null)
  const R = { x: 210, y: 300, w: 580, h: 400 }
  const lines = word.length > 9 ? splitInTwo(word) : [word]
  const longest = Math.max(...lines.map((l) => l.length))
  const fontSize = Math.min(150, 560 / (longest * 0.62))
  const lineH = fontSize * 1.05
  const startY = 470 - ((lines.length - 1) * lineH) / 2

  useJob(engine, async () => {
    await engine.raster(R, (t) => {
      reveal.current?.setAttribute('height', String(t * R.h + 14))
      progress(t * 0.9)
    })
    await engine.moveTo(PARK)
    engine.status('GRABADO LISTO ✓')
    progress(1)
    await engine.wait(2800)
    onDone()
  })

  return (
    <g>
      <defs>
        <linearGradient id={`${clipId}-wood`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6a06a" />
          <stop offset="1" stopColor="#b47c48" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect ref={reveal} x={0} y={R.y - 10} width={1000} height={0} />
        </clipPath>
      </defs>
      <rect x={180} y={250} width={640} height={500} rx={10} fill={`url(#${clipId}-wood)`} />
      {[290, 340, 420, 505, 580, 660, 720].map((y, i) => (
        <path key={y} d={`M180 ${y} C 350 ${y + (i % 2 ? 18 : -14)}, 600 ${y + (i % 2 ? -16 : 12)}, 820 ${y + 4}`} stroke="#8a5a30" strokeOpacity={0.25} fill="none" strokeWidth={2} />
      ))}
      <text x={196} y={276} className="font-mono" fill="#5a3a1c" opacity={0.6} fontSize={16}>MDF 6MM · GRABADO 40%</text>
      <g clipPath={`url(#${clipId})`}>
        {lines.map((l, i) => (
          <text
            key={i}
            x={500}
            y={startY + i * lineH}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Space Grotesk, sans-serif"
            fontWeight={700}
            fontSize={fontSize}
            fill="#3a1f0b"
            style={{ filter: 'drop-shadow(0 1px 0 rgba(255,220,180,.35))' }}
          >
            {l}
          </text>
        ))}
        <text x={500} y={660} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={24} fill="#3a1f0b" letterSpacing={6}>
          CECOM · LOJA
        </text>
      </g>
    </g>
  )
}

// 3) Figura de temporada cortada y encendida como neón
const SHAPES: Record<string, string> = {
  default: 'M230 20 L80 230 H190 L150 380 L320 150 H210 L250 20 Z',
  navidad: 'M200 20 L300 150 H250 L330 260 H270 L350 360 H220 V390 H180 V360 H50 L130 260 H70 L150 150 H100 Z',
  'amor-amistad': 'M200 360 C 60 260 20 180 40 110 C 60 40 160 30 200 100 C 240 30 340 40 360 110 C 380 180 340 260 200 360 Z',
  'dia-madre': 'M200 360 C 60 260 20 180 40 110 C 60 40 160 30 200 100 C 240 30 340 40 360 110 C 380 180 340 260 200 360 Z',
  'anio-nuevo': 'M200 20 L245 145 L380 150 L272 230 L312 360 L200 285 L88 360 L128 230 L20 150 L155 145 Z',
  halloween: 'M200 90 C 90 80 40 160 50 240 C 60 330 150 370 200 350 C 250 370 340 330 350 240 C 360 160 310 80 200 90 Z M200 90 C 195 60 210 40 230 30',
}

function NeonJob({ engine, progress, onDone, seasonId }: JobProps) {
  const S = 1.25
  const OX = 250
  const OY = 245
  const d = SHAPES[seasonId] ?? SHAPES.default
  const ref = useRef<SVGPathElement>(null)
  const [lit, setLit] = useState(false)

  useJob(engine, async () => {
    await engine.cut(ref.current!, (p) => ({ x: OX + p.x * S, y: OY + p.y * S }), S, 520)
    progress(0.8)
    await engine.moveTo(PARK)
    engine.status('NEÓN ENCENDIDO ✓')
    setLit(true)
    progress(1)
    await engine.wait(3000)
    onDone()
  })

  return (
    <g>
      <rect x={200} y={200} width={600} height={600} rx={18} fill="#ffffff06" stroke="#ffffff22" />
      {[
        [230, 230],
        [770, 230],
        [230, 770],
        [770, 770],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={9} fill="none" stroke="#ffffff40" strokeWidth={3} />
      ))}
      <text x={216} y={226} className="font-mono" fill="#ffffff40" fontSize={14} dx={30}>ACRÍLICO CRISTAL 5MM</text>
      <g transform={`translate(${OX} ${OY}) scale(${S})`}>
        <path ref={ref} d={d} {...TRAIL} strokeWidth={6 / S} style={{ ...HIDDEN_DASH, opacity: lit ? 0.25 : 1 }} />
        <motion.path
          d={d}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={14 / S}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={lit ? { opacity: [0, 1, 0.3, 1, 0.6, 1] } : { opacity: 0 }}
          transition={{ duration: 0.9, times: [0, 0.2, 0.3, 0.45, 0.6, 1] }}
          style={{ filter: 'drop-shadow(0 0 6px var(--primary)) drop-shadow(0 0 22px var(--primary))' }}
        />
        <motion.path
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth={4 / S}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: lit ? 0.85 : 0 }}
          transition={{ delay: 0.5 }}
        />
      </g>
    </g>
  )
}

// 4) Fresado de pistas en PCB + LEDs
const TRACES = [
  'M240 300 H380 L470 390 V430',
  'M760 300 H640 L550 390 V430',
  'M240 500 H450',
  'M760 500 H570',
  'M240 700 H380 L470 610 V570',
  'M760 700 H640 L550 610 V570',
]
const PADS: Pt[] = [
  { x: 240, y: 300 },
  { x: 760, y: 300 },
  { x: 240, y: 500 },
  { x: 760, y: 500 },
  { x: 240, y: 700 },
  { x: 760, y: 700 },
]

function PcbJob({ engine, progress, onDone }: JobProps) {
  const refs = useRef<(SVGPathElement | null)[]>([])
  const [done, setDone] = useState(false)

  useJob(engine, async () => {
    for (let i = 0; i < TRACES.length; i++) {
      await engine.cut(refs.current[i]!, (p) => ({ x: p.x, y: p.y }), 1, 620, 'FRESANDO PISTAS')
      progress((i + 1) / (TRACES.length + 1))
    }
    await engine.moveTo(PARK)
    engine.status('PCB LISTA ✓')
    setDone(true)
    progress(1)
    await engine.wait(3000)
    onDone()
  })

  return (
    <g>
      <rect x={180} y={220} width={640} height={560} rx={14} fill="#0e2a1e" stroke="#2c6b4c" strokeWidth={2} />
      <text x={200} y={250} className="font-mono" fill="#4fae7f" opacity={0.6} fontSize={15}>CECOM-PROTO v1.0</text>
      {/* chip */}
      <rect x={450} y={430} width={120} height={140} rx={6} fill="#111" stroke="#333" />
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i} fill="#9aa0a6">
          <rect x={462 + i * 27} y={422} width={10} height={8} />
          <rect x={462 + i * 27} y={570} width={10} height={8} />
        </g>
      ))}
      <text x={510} y={505} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize={16} fill="#777">
        ESP32
      </text>
      {TRACES.map((d, i) => (
        <path
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          d={d}
          {...TRAIL}
          stroke={done ? '#d9a44a' : 'var(--primary)'}
          strokeWidth={10}
          style={{ ...HIDDEN_DASH, transition: 'stroke .6s' }}
        />
      ))}
      {PADS.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={18} fill={done ? '#d9a44a' : '#1d3b2d'} style={{ transition: 'fill .6s' }} />
          {done && (
            <circle
              cx={p.x}
              cy={p.y}
              r={9}
              fill="var(--primary)"
              className="led-chase"
              style={{ animationDelay: `${i * 0.15}s`, filter: 'drop-shadow(0 0 8px var(--primary))' }}
            />
          )}
        </g>
      ))}
    </g>
  )
}

// ───────────────────────── Carrusel ─────────────────────────
const JOBS = [
  { id: 'corte', tab: 'Acrílico', swatch: '#1b1b1f', Component: LogoJob },
  { id: 'grabado', tab: 'Madera', swatch: '#c48d57', Component: EngraveJob },
  { id: 'neon', tab: 'Neón', swatch: 'rgba(255,255,255,.18)', Component: NeonJob },
  { id: 'pcb', tab: 'PCB', swatch: '#1f5a3f', Component: PcbJob },
]

const ENGRAVE_WORDS: Record<string, string> = {
  default: 'TU IDEA AQUÍ',
  navidad: 'FELIZ NAVIDAD',
  'anio-nuevo': 'FELIZ 2027',
  'amor-amistad': 'TE QUIERO',
  halloween: 'BOO!',
  'dia-madre': 'TE AMO MAMÁ',
}

export function LaserStage() {
  const { season } = useSeason()
  const [index, setIndex] = useState(0)
  const patternId = useId()

  const rail = useRef<SVGGElement>(null)
  const head = useRef<SVGGElement>(null)
  const beam = useRef<SVGGElement>(null)
  const sparks = useRef<SVGGElement>(null)
  const hudX = useRef<HTMLSpanElement>(null)
  const hudY = useRef<HTMLSpanElement>(null)
  const hudStatus = useRef<HTMLSpanElement>(null)
  const bars = useRef<(HTMLSpanElement | null)[]>([])

  const engine = useMemo(() => new LaserEngine({ rail, head, beam, sparks, hudX, hudY, hudStatus }), [])

  useEffect(() => engine.place(engine.pos), [engine])

  const go = (i: number) => {
    bars.current.forEach((b) => b && (b.style.width = '0%'))
    setIndex((i + JOBS.length) % JOBS.length)
  }
  const progress = (p: number) => {
    const b = bars.current[index]
    if (b) b.style.width = `${Math.round(p * 100)}%`
  }

  const Job = JOBS[index].Component

  return (
    <div className="relative">
      <div className="chamfer-lg relative overflow-hidden border border-white/10 bg-[#0b0b0d] shadow-2xl shadow-black/60">
        {/* Barra superior tipo panel de máquina */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 font-mono text-[11px] tracking-wider text-muted">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-primary" />
            </span>
            <span ref={hudStatus} className="text-fg">EN ESPERA</span>
          </span>
          <span className="hidden sm:inline">CECOM · LÁSER</span>
          <span className="tabular-nums">
            <span ref={hudX}>X 000.0</span> · <span ref={hudY}>Y 000.0</span>
          </span>
        </div>

        <svg viewBox="0 0 1000 1000" className="block aspect-square w-full">
          <defs>
            <pattern id={`${patternId}-dots`} width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="1.6" fill="#ffffff14" />
            </pattern>
          </defs>
          {/* cama tipo panal + reglas */}
          <rect x={80} y={80} width={840} height={840} fill={`url(#${patternId}-dots)`} />
          <rect x={80} y={80} width={840} height={840} fill="none" stroke="#ffffff10" />
          {Array.from({ length: 31 }).map((_, i) => {
            const p = 80 + i * 28
            const big = i % 5 === 0
            return (
              <g key={i} stroke="#ffffff30" strokeWidth={1.5}>
                <line x1={p} y1={62} x2={p} y2={big ? 44 : 54} />
                <line x1={62} y1={p} x2={big ? 44 : 54} y2={p} />
                {big && i % 10 === 0 && (
                  <text x={p + 4} y={40} fill="#ffffff40" stroke="none" fontSize={13} fontFamily="JetBrains Mono, monospace">
                    {i * 20}
                  </text>
                )}
              </g>
            )
          })}
          {/* rieles laterales */}
          <rect x={940} y={70} width={16} height={880} rx={4} fill="#17171b" />
          <rect x={20} y={70} width={16} height={880} rx={4} fill="#17171b" />

          {/* trabajo actual */}
          <AnimatePresence mode="wait">
            <motion.g
              key={`${index}-${season.id}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.35 }}
              style={{ transformOrigin: '500px 500px' }}
            >
              <Job engine={engine} progress={progress} onDone={() => go(index + 1)} seasonId={season.id} word={ENGRAVE_WORDS[season.id] ?? ENGRAVE_WORDS.default} />
            </motion.g>
          </AnimatePresence>

          {/* pórtico (eje Y) */}
          <g ref={rail}>
            <rect x={14} y={-15} width={948} height={30} rx={5} fill="#1d1d22" stroke="#ffffff14" />
            <rect x={14} y={-3} width={948} height={6} fill="#ffffff08" />
          </g>
          {/* cabezal (eje X) */}
          <g ref={head}>
            <rect x={-38} y={-32} width={76} height={64} rx={8} fill="#2a2a31" stroke="#ffffff22" />
            <rect x={-38} y={-32} width={76} height={10} rx={4} fill="var(--primary)" opacity={0.85} />
            <circle r={13} fill="#0d0d10" stroke="#ffffff30" />
            <g ref={beam} style={{ opacity: 0, transition: 'opacity .08s' }}>
              <circle r={30} fill="var(--primary)" opacity={0.28} style={{ filter: 'blur(8px)' }} />
              <circle r={7} fill="#fff" style={{ filter: 'drop-shadow(0 0 6px var(--primary))' }} />
              <g ref={sparks} fill="#ffd8a8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <circle key={i} r={2.4} />
                ))}
              </g>
            </g>
          </g>
        </svg>

      </div>

      {/* Selector de material (pestañas del carrusel) */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" role="tablist">
        {JOBS.map((j, i) => (
          <button
            key={j.id}
            role="tab"
            aria-selected={i === index}
            onClick={() => go(i)}
            className={clsx('group relative flex items-center gap-2 pb-2 text-sm transition', i === index ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            <span
              className={clsx('h-3.5 w-3.5 border transition', i === index ? 'border-primary' : 'border-white/20')}
              style={{ background: j.swatch }}
            />
            {j.tab}
            <span className="absolute right-0 bottom-0 left-0 h-px bg-white/10">
              <span
                ref={(el) => {
                  bars.current[i] = el
                }}
                className="block h-full bg-primary transition-[width] duration-300"
                style={{ width: 0 }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
