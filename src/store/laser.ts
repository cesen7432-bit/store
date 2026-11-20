import { create } from 'zustand'

/**
 * Loader láser global.
 * - Escrituras (guardar/enviar): capa completa con el corte y "pieza lista" al terminar (<LaserOverlay />).
 * - Lecturas: láser pequeño en la esquina si la carga tarda (<LaserActivity />).
 * Todas las llamadas a `api` pasan por `track()` (ver services/api.ts).
 */
interface LaserState {
  status: 'idle' | 'working' | 'done'
  label: string
  doneLabel: string
  /** lecturas en curso */
  reads: number
}

export const useLaser = create<LaserState>(() => ({ status: 'idle', label: '', doneLabel: '', reads: 0 }))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface LaserOpts {
  label: string
  done: string
  /** tiempo mínimo de la animación de corte (ms) */
  minMs?: number
  /** cuánto se muestra la "pieza lista" (ms) */
  doneMs?: number
}

/** Envuelve una petición con la capa láser completa. Si ya hay una activa, no la duplica. */
export async function withLaser<T>(fn: () => Promise<T>, opts: LaserOpts): Promise<T> {
  if (useLaser.getState().status !== 'idle') return fn()
  useLaser.setState({ status: 'working', label: opts.label, doneLabel: opts.done })
  try {
    // tiempo mínimo para que la animación se lea (no se siente como un parpadeo)
    const [result] = await Promise.all([fn(), sleep(reduced() ? 0 : (opts.minMs ?? 900))])
    useLaser.setState({ status: 'done' })
    await sleep(reduced() ? 300 : (opts.doneMs ?? 1150))
    return result
  } finally {
    useLaser.setState({ status: 'idle' })
  }
}

/** Lectura: solo cuenta como "cargando" (indicador pequeño) */
export async function withReading<T>(fn: () => Promise<T>): Promise<T> {
  useLaser.setState((s) => ({ reads: s.reads + 1 }))
  try {
    return await fn()
  } finally {
    useLaser.setState((s) => ({ reads: Math.max(0, s.reads - 1) }))
  }
}
