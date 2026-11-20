import {
  AudioWaveform,
  Bot,
  Clock,
  CloudSun,
  Coffee,
  Cpu,
  Droplets,
  Flame,
  Gamepad2,
  Gauge,
  GraduationCap,
  Heart,
  KeyRound,
  Lamp,
  Layers,
  Lightbulb,
  Monitor,
  Package,
  Radio,
  ScanEye,
  Scissors,
  Signpost,
  Sparkles,
  Store,
  Thermometer,
  ToggleRight,
  TreePine,
  Wifi,
  type LucideProps,
} from 'lucide-react'

// Mapa de nombres (usados en los datos) → componentes de icono
const ICONS = {
  'audio-waveform': AudioWaveform,
  bot: Bot,
  clock: Clock,
  'cloud-sun': CloudSun,
  coffee: Coffee,
  cpu: Cpu,
  droplets: Droplets,
  flame: Flame,
  'gamepad-2': Gamepad2,
  gauge: Gauge,
  'graduation-cap': GraduationCap,
  heart: Heart,
  'key-round': KeyRound,
  lamp: Lamp,
  layers: Layers,
  lightbulb: Lightbulb,
  monitor: Monitor,
  radio: Radio,
  'scan-eye': ScanEye,
  scissors: Scissors,
  signpost: Signpost,
  sparkles: Sparkles,
  store: Store,
  thermometer: Thermometer,
  'toggle-right': ToggleRight,
  'tree-pine': TreePine,
  wifi: Wifi,
} as const

export const ICON_NAMES = Object.keys(ICONS)

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name as keyof typeof ICONS] ?? Package
  return <C {...props} />
}
