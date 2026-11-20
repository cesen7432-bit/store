import { motion } from 'framer-motion'
import { ArrowRight, Headphones, MessageCircle, Truck, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../../data/mock'
import { useSeason } from '../../context/SeasonContext'
import { api } from '../../services/api'
import { useAsync } from '../../utils/useAsync'
import { formatPrice, SHIPPING } from '../../config/store'
import { ProductCard } from '../product/ProductCard'
import { Icon } from '../ui/Icon'
import { ProjectCover } from '../project/ProjectMedia'
import { Reveal, SectionTitle, Skeleton } from '../ui/misc'

// ───────── Marquesina ─────────
const MARQUEE = ['Arduino', 'ESP32', 'Raspberry Pi', 'Acrílico', 'MDF', 'Neón LED', 'Sensores', 'Robótica', 'IoT', 'Grabado láser', 'Letreros', 'Kits educativos']

export function Marquee() {
  return (
    <div className="relative overflow-hidden border-y border-white/10 py-5" style={{ background: 'color-mix(in oklab, var(--surface) 80%, transparent)' }}>
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
        {[...MARQUEE, ...MARQUEE].map((w, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl font-bold text-muted/70 uppercase">
            {w} <span className="h-3 w-3 bg-primary" />
          </span>
        ))}
      </div>
    </div>
  )
}

// ───────── Categorías ─────────
export function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <SectionTitle
        eyebrow="Lo que hacemos"
        title={<>Tres mundos, <span className="text-gradient">un mismo taller</span></>}
        subtitle="Desde el componente más pequeño hasta el proyecto terminado e instalado."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {CATEGORIES.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.1}>
            <Link to={`/tienda/${c.id}`} className="group relative block h-full overflow-hidden rounded-xl border border-white/10 bg-surface p-8">
              <div
                className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl transition-all duration-700 group-hover:scale-150 group-hover:opacity-60"
                style={{ background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}
              />
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-lg"
                style={{ background: `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})` }}
              >
                <Icon name={c.icon} size={30} color="white" />
              </motion.div>
              <h3 className="relative font-display text-2xl font-bold">{c.name}</h3>
              <p className="relative mt-3 text-muted">{c.description}</p>
              <div className="relative mt-6 flex flex-wrap gap-2">
                {c.subcategories.slice(0, 4).map((s) => (
                  <span key={s} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">{s}</span>
                ))}
              </div>
              <span className="relative mt-8 inline-flex items-center gap-2 font-semibold text-primary">
                Ver productos <ArrowRight size={16} className="transition-transform group-hover:translate-x-2" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ───────── Destacados (prioriza productos de la temporada) ─────────
export function Featured() {
  const { season } = useSeason()
  const { data, loading } = useAsync(() => api.getFeatured(season.id), [season.id])
  const isSeasonal = season.id !== 'default'
  if (!loading && !data?.length) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle
          align="left"
          eyebrow={isSeasonal ? `${season.emoji} Especial ${season.name}` : 'Selección CECOM'}
          title={isSeasonal ? <>Ideas para <span className="text-gradient">{season.name}</span></> : <>Productos <span className="text-gradient">destacados</span></>}
        />
        <Link to="/tienda" className="mb-10 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
          Ver todo <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !data
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4.4]" />)
          : data.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
    </section>
  )
}

// ───────── Proyectos destacados ─────────
export function ProjectsTeaser() {
  const { data } = useAsync(() => api.getProjects(), [])
  if (!data?.length) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <SectionTitle
        eyebrow="Proyectos a medida"
        title={<>¿Lo imaginas? <span className="text-gradient">Lo construimos.</span></>}
        subtitle="Letreros para negocios, automatización, robótica educativa, proyectos de grado y mucho más."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {(data ?? []).slice(0, 3).map((p, i) => (
          <Reveal key={p.id} delay={i * 0.1}>
            <motion.div whileHover={{ y: -8 }} className="group overflow-hidden rounded-xl border border-white/10 bg-surface">
              <div className="h-48 overflow-hidden">
                <div className="h-full transition-transform duration-700 group-hover:scale-110">
                  <ProjectCover project={p} hoverPlay={false} />
                </div>
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">{p.difficulty}</span>
                  <span className="text-muted">~{p.durationDays} días</span>
                </div>
                <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted">{p.summary}</p>
                <p className="mt-4 text-sm">Desde <b className="font-display text-lg">{formatPrice(p.priceFrom)}</b></p>
              </div>
            </motion.div>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link to="/proyectos" className="glass inline-flex items-center gap-2 rounded-lg px-6 py-3.5 font-semibold hover:border-primary/50">
          Ver todos los proyectos <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}

// ───────── Beneficios ─────────
export function Perks() {
  const perks = [
    { icon: Truck, t: 'Envío gratis a domicilio', d: `Loja desde ${formatPrice(SHIPPING.loja.freeFrom)} · Ecuador desde ${formatPrice(SHIPPING.nacional.freeFrom)}` },
    { icon: MessageCircle, t: 'Pedidos por WhatsApp', d: 'Tu orden llega directo a nuestro equipo' },
    { icon: Wallet, t: 'Pago sin complicaciones', d: 'Coordinas la forma de pago por WhatsApp' },
    { icon: Headphones, t: 'Asesoría técnica', d: 'Te ayudamos a elegir y armar tu proyecto' },
  ]
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {perks.map((p, i) => (
          <Reveal key={p.t} delay={i * 0.08}>
            <div className="flex items-center gap-4 rounded-lg border border-white/5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <p.icon size={22} />
              </div>
              <div>
                <p className="font-semibold">{p.t}</p>
                <p className="text-sm text-muted">{p.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
