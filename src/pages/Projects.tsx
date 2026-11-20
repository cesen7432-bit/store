import { motion } from 'framer-motion'
import { ArrowRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ProjectCover, ProjectModal } from '../components/project/ProjectMedia'
import { SectionTitle, Skeleton } from '../components/ui/misc'
import { formatPrice } from '../config/store'
import { api } from '../services/api'
import type { Project } from '../types'
import { useAsync } from '../utils/useAsync'

const FILTERS: { id: Project['category'] | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'arduino', label: 'Arduino' },
  { id: 'acrilico', label: 'Acrílico & Letreros' },
  { id: 'iot', label: 'IoT' },
  { id: 'robotica', label: 'Robótica' },
  { id: 'decoracion', label: 'Decoración' },
]

export default function Projects() {
  const { data, loading } = useAsync(() => api.getProjects(), [])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('todos')
  const list = (data ?? []).filter((p) => filter === 'todos' || p.category === filter)
  const [open, setOpen] = useState<Project | null>(null)
  // solo se muestran los filtros que tienen proyectos
  const filters = FILTERS.filter((f) => f.id === 'todos' || (data ?? []).some((p) => p.category === f.id))

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
      <SectionTitle
        eyebrow="Proyectos a medida"
        title={<>Tu idea + nuestro taller = <span className="text-gradient">magia</span></>}
        subtitle="Diseñamos, fabricamos e instalamos. Mira algunos proyectos que hemos hecho y cotiza el tuyo."
      />

      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {filters.length > 2 && filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx('relative rounded-full px-5 py-2 text-sm font-medium transition', filter === f.id ? 'text-black' : 'text-muted hover:text-fg')}
          >
            {filter === f.id && (
              <motion.span layoutId="proj-pill" className="absolute inset-0 -z-10 rounded-full" style={{ background: 'linear-gradient(120deg, var(--primary), var(--secondary))' }} />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {!loading && (data ?? []).length === 0 ? (
        <div className="mx-auto max-w-lg rounded-lg border border-dashed border-white/15 px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold">Pronto publicaremos nuestros trabajos</p>
          <p className="mt-2 text-muted">Mientras tanto, cuéntanos tu idea y la cotizamos sin compromiso.</p>
        </div>
      ) : loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <article
              key={p.id}
              className="card-in group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-surface transition duration-300 hover:-translate-y-1 hover:border-white/20"
              style={{ '--d': `${Math.min(i, 8) * 50}ms` } as React.CSSProperties}
              onClick={() => setOpen(p)}
              onKeyDown={(e) => e.key === 'Enter' && setOpen(p)}
              tabIndex={0}
              role="button"
              aria-label={`Ver proyecto ${p.title}`}
            >
              <div className="relative aspect-video overflow-hidden">
                <div className="h-full transition-transform duration-500 group-hover:scale-[1.04]">
                  <ProjectCover project={p} />
                </div>
                <span className="absolute top-3 left-3 rounded bg-black/65 px-2 py-0.5 text-xs font-medium backdrop-blur">{p.difficulty}</span>
                {(p.media?.length ?? 0) > 1 && (
                  <span className="absolute top-3 right-3 rounded bg-black/65 px-2 py-0.5 text-xs backdrop-blur">{p.media!.length} archivos</span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold transition-colors group-hover:text-primary">{p.title}</h3>
                {p.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.summary}</p>}
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-sm">
                  <span>
                    Desde <b className="font-display text-base">{formatPrice(p.priceFrom)}</b>
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    <Clock size={14} /> ~{p.durationDays} días
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="border-animated relative mt-20 overflow-hidden rounded-xl bg-surface p-10 text-center md:p-16"
      >
        <div className="bg-grid absolute inset-0" />
        <h2 className="relative font-display text-3xl font-bold md:text-5xl">¿Tienes un proyecto en mente?</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-muted">Cuéntanos tu idea y recibe una cotización estimada al instante. Sin compromiso.</p>
        <Link to="/cotizar?tipo=proyecto" className="btn-primary relative mt-8 inline-flex items-center gap-2 rounded-lg px-8 py-4">
          Cotizar mi proyecto <ArrowRight size={18} />
        </Link>
      </motion.div>
      <ProjectModal project={open} onClose={() => setOpen(null)} />
    </div>
  )
}
