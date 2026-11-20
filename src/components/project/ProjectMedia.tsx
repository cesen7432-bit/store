import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock, MessageCircle, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { formatPrice, mediaUrl, whatsappLink } from '../../config/store'
import type { Project } from '../../types'
import { ProductArt } from '../ui/ProductArt'

/** Portada del proyecto: primera foto o video (el video se reproduce en silencio al pasar el mouse) */
export function ProjectCover({ project, iconSize = 56, hoverPlay = true }: { project: Project; iconSize?: number; hoverPlay?: boolean }) {
  const cover = project.media?.[0]
  const video = useRef<HTMLVideoElement>(null)
  if (!cover) return <ProductArt icon={project.icon} gradient={project.gradient} iconSize={iconSize} alt={project.title} />
  if (cover.type === 'image') return <img src={mediaUrl(cover.url)} alt={project.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
  return (
    <div
      className="relative h-full w-full bg-black"
      onMouseEnter={() => hoverPlay && video.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (!hoverPlay || !video.current) return
        video.current.pause()
        video.current.currentTime = 0
      }}
    >
      <video ref={video} src={mediaUrl(cover.url) + '#t=0.5'} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
      <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur">
        <Play size={11} className="fill-white" /> Video
      </span>
    </div>
  )
}

/** Detalle del proyecto con galería de fotos y videos */
export function ProjectModal({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const [i, setI] = useState(0)
  const media = project?.media ?? []

  useEffect(() => {
    setI(0)
  }, [project?.id])

  useEffect(() => {
    if (!project) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((v) => Math.min(media.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [project, media.length, onClose])

  const current = media[i]

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onClose}
          data-lenis-prevent
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-surface lg:grid-cols-[1.5fr_1fr]"
          >
            {/* galería */}
            <div className="relative flex min-h-[260px] flex-col bg-black">
              <div className="relative flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0 flex items-center justify-center">
                    {!current ? (
                      <ProductArt icon={project.icon} gradient={project.gradient} iconSize={90} />
                    ) : current.type === 'video' ? (
                      <video src={mediaUrl(current.url)} controls autoPlay playsInline className="max-h-full max-w-full" />
                    ) : (
                      <img src={mediaUrl(current.url)} alt={project.title} className="max-h-full max-w-full object-contain" />
                    )}
                  </motion.div>
                </AnimatePresence>
                {media.length > 1 && (
                  <>
                    <button
                      onClick={() => setI((v) => Math.max(0, v - 1))}
                      disabled={i === 0}
                      aria-label="Anterior"
                      className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setI((v) => Math.min(media.length - 1, v + 1))}
                      disabled={i === media.length - 1}
                      aria-label="Siguiente"
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-30"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
              </div>
              {media.length > 1 && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/10 p-2">
                  {media.map((m, k) => (
                    <button
                      key={m.url + k}
                      onClick={() => setI(k)}
                      aria-label={`Ver ${m.type === 'video' ? 'video' : 'foto'} ${k + 1}`}
                      className={clsx('relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition', k === i ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100')}
                    >
                      {m.type === 'video' ? (
                        <>
                          <video src={mediaUrl(m.url) + '#t=0.5'} muted preload="metadata" className="h-full w-full object-cover" />
                          <Play size={14} className="absolute inset-0 m-auto fill-white text-white" />
                        </>
                      ) : (
                        <img src={mediaUrl(m.url)} alt="" className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* información */}
            <div className="flex flex-col overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{project.difficulty}</span>
                <button onClick={onClose} aria-label="Cerrar" className="-mt-1 -mr-2 rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold">{project.title}</h2>
              {project.summary && <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{project.summary}</p>}
              {project.highlights.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {project.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-primary" /> {h}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-6">
                <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span>
                    Desde <b className="font-display text-xl">{formatPrice(project.priceFrom)}</b>
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    <Clock size={14} /> ~{project.durationDays} días
                  </span>
                </div>
                <a
                  href={whatsappLink(`Hola CECOM, me interesa un proyecto como "${project.title}". ¿Me pueden asesorar?`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#25d366] py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  <MessageCircle size={17} /> Quiero un proyecto así
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
