/**
 * TEMAS DE TEMPORADA
 * ------------------
 * Cada temporada define colores, partículas animadas, banner y textos del hero.
 * Para agregar una nueva (ej. "dia-padre"), copia un bloque y ajusta:
 *   - `active`: rango de fechas (mes 1-12) en que se activa automáticamente.
 *   - `palette`: colores (se inyectan como variables CSS).
 *   - `particles`: caracteres/emoji que caen o flotan sobre la página.
 *
 * El tema puede forzarse con VITE_SEASON en .env o desde el selector en el footer.
 */

export type ParticleMotion = 'fall' | 'rise' | 'float' | 'burst'

export interface DateRange {
  from: { month: number; day: number }
  to: { month: number; day: number }
}

export interface SeasonTheme {
  id: string
  name: string
  emoji: string
  active?: DateRange[]
  palette: {
    primary: string
    secondary: string
    accent: string
    bg: string
    surface: string
    text: string
    muted: string
  }
  particles?: {
    symbols: string[]
    motion: ParticleMotion
    count: number
  }
  /** Anuncio superior. `percent` debe coincidir con el cupón (el descuento aplica a todo el pedido). */
  banner?: { title: string; percent: number; coupon: string }
  hero: {
    eyebrow: string
    title: string
    highlight: string
    subtitle: string
  }
}

export const SEASONS: SeasonTheme[] = [
  {
    id: 'default',
    name: 'CECOM (por defecto)',
    emoji: '⚡',
    palette: {
      primary: '#ff5b23',
      secondary: '#ffa53d',
      accent: '#f4f4f0',
      bg: '#0a0a0b',
      surface: '#121214',
      text: '#f4f4f0',
      muted: '#8d8d96',
    },
    hero: {
      eyebrow: '',
      title: 'Convierte tus ideas en',
      highlight: 'circuitos que brillan',
      subtitle:
        'Componentes, cortes láser de precisión y proyectos llave en mano. Desde un LED hasta tu letrero de neón personalizado.',
    },
  },
  {
    id: 'navidad',
    name: 'Navidad',
    emoji: '🎄',
    active: [{ from: { month: 11, day: 15 }, to: { month: 12, day: 26 } }],
    palette: {
      primary: '#ef3b36',
      secondary: '#f6c14b',
      accent: '#4cc47a',
      bg: '#0a0b0a',
      surface: '#121513',
      text: '#f6f4ee',
      muted: '#8f958f',
    },
    particles: { symbols: ['❄', '❅', '❆', '•'], motion: 'fall', count: 45 },
    banner: { title: 'Navidad CECOM', percent: 20, coupon: 'NAVIDAD20' },
    hero: {
      eyebrow: 'Temporada navideña 🎄',
      title: 'Esta Navidad regala algo',
      highlight: 'hecho con luz',
      subtitle:
        'Adornos en acrílico grabados, árboles LED programables y kits Arduino para los pequeños inventores de la casa.',
    },
  },
  {
    id: 'anio-nuevo',
    name: 'Año Nuevo',
    emoji: '🎆',
    active: [{ from: { month: 12, day: 27 }, to: { month: 1, day: 6 } }],
    palette: {
      primary: '#f5c542',
      secondary: '#ffe39a',
      accent: '#f4f4f0',
      bg: '#09090a',
      surface: '#131313',
      text: '#f8f6ef',
      muted: '#9a978d',
    },
    particles: { symbols: ['✦', '✧', '★', '·'], motion: 'float', count: 40 },
    banner: { title: 'Año nuevo, proyectos nuevos', percent: 15, coupon: 'NUEVO15' },
    hero: {
      eyebrow: 'Feliz Año Nuevo ✨',
      title: 'Empieza el año',
      highlight: 'construyendo algo nuevo',
      subtitle: 'Tus propósitos merecen las mejores herramientas. Kits, sensores y cortes a medida.',
    },
  },
  {
    id: 'amor-amistad',
    name: 'Amor y Amistad',
    emoji: '💘',
    active: [
      { from: { month: 2, day: 1 }, to: { month: 2, day: 15 } },
    ],
    palette: {
      primary: '#ff3d6e',
      secondary: '#ff8fab',
      accent: '#ffd1dc',
      bg: '#0c090a',
      surface: '#161113',
      text: '#fbf3f5',
      muted: '#a3929a',
    },
    particles: { symbols: ['❤', '♥', '💕', '♡'], motion: 'rise', count: 30 },
    banner: { title: 'Amor y Amistad', percent: 15, coupon: 'AMOR15' },
    hero: {
      eyebrow: 'Mes del Amor y la Amistad 💘',
      title: 'Dilo con luz,',
      highlight: 'dilo en acrílico',
      subtitle: 'Letreros neón con su nombre, lámparas grabadas con fotos y cajas personalizadas en corte láser.',
    },
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    active: [{ from: { month: 10, day: 15 }, to: { month: 11, day: 1 } }],
    palette: {
      primary: '#ff7a1a',
      secondary: '#ffb347',
      accent: '#a78bfa',
      bg: '#0a0909',
      surface: '#151212',
      text: '#f7f1ea',
      muted: '#9c948c',
    },
    particles: { symbols: ['🦇', '🎃', '👻', '🕸'], motion: 'float', count: 18 },
    banner: { title: 'Halloween', percent: 25, coupon: 'BOO25' },
    hero: {
      eyebrow: 'Temporada de Halloween 🎃',
      title: 'Crea sustos',
      highlight: 'controlados por Arduino',
      subtitle: 'Calabazas con LEDs, sensores de movimiento y decoraciones en MDF cortadas con láser.',
    },
  },
  {
    id: 'dia-madre',
    name: 'Día de la Madre',
    emoji: '🌸',
    active: [{ from: { month: 5, day: 1 }, to: { month: 5, day: 31 } }],
    palette: {
      primary: '#e45bd6',
      secondary: '#ff9ec4',
      accent: '#fde68a',
      bg: '#0c090c',
      surface: '#171117',
      text: '#fbf3fa',
      muted: '#a596a5',
    },
    particles: { symbols: ['🌸', '✿', '❀', '🌷'], motion: 'fall', count: 25 },
    banner: { title: 'Mes de la Madre', percent: 15, coupon: 'MAMA15' },
    hero: {
      eyebrow: 'Mes de la Madre 🌸',
      title: 'Un regalo único',
      highlight: 'grabado para ella',
      subtitle: 'Lámparas LED con su foto, joyeros en MDF y letreros personalizados hechos a mano y a láser.',
    },
  },
]

export const DEFAULT_SEASON_ID = 'default'

function inRange(date: Date, r: DateRange) {
  const v = (date.getMonth() + 1) * 100 + date.getDate()
  const from = r.from.month * 100 + r.from.day
  const to = r.to.month * 100 + r.to.day
  // rangos que cruzan fin de año (ej. 27 dic → 6 ene)
  return from <= to ? v >= from && v <= to : v >= from || v <= to
}

/** Devuelve la temporada activa para una fecha dada. */
export function seasonForDate(date = new Date()): SeasonTheme {
  return SEASONS.find((s) => s.active?.some((r) => inRange(date, r))) ?? getSeason(DEFAULT_SEASON_ID)
}

export function getSeason(id: string): SeasonTheme {
  return SEASONS.find((s) => s.id === id) ?? SEASONS[0]
}
