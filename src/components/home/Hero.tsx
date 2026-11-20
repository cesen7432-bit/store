import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeason } from '../../context/SeasonContext'
import { LaserStage } from './LaserStage'

const GLYPHS = '01<>/[]{}#=+*_'

/** Efecto "decodificando": los caracteres pasan por símbolos antes de fijarse. */
function useScramble(text: string, delay = 400) {
  const [out, setOut] = useState(text.replace(/\S/g, ' '))
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setOut(text)
    let frame = 0
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      if (now < start) {
        raf = requestAnimationFrame(tick)
        return
      }
      frame++
      const revealed = Math.floor(frame / 2)
      setOut(
        text
          .split('')
          .map((ch, i) => (ch === ' ' || i < revealed ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(''),
      )
      if (revealed < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, delay])
  return out
}

export function Hero() {
  const { season } = useSeason()
  const words = season.hero.title.split(' ')
  const highlight = useScramble(season.hero.highlight, 250 + words.length * 80)
  const ref = useRef<HTMLElement>(null)

  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      className="hero-spotlight relative overflow-hidden"
    >
      {/* cuadrícula de puntos base + puntos iluminados alrededor del cursor */}
      <div className="bg-dots absolute inset-0 -z-10" />
      <div className="bg-dots-lit pointer-events-none absolute inset-0 -z-10" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-8 pb-20 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14 lg:pb-24">
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={season.id} exit={{ opacity: 0, y: -10 }}>
              {season.hero.eyebrow && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-7 inline-flex items-center gap-2.5 font-mono text-xs tracking-[0.18em] text-muted uppercase"
              >
                <span className="h-2 w-2 bg-primary" />
                {season.hero.eyebrow}
              </motion.span>
              )}

              <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-tight md:text-7xl">
                {words.map((w, i) => (
                  <span key={i} className="mr-[0.25em] inline-block overflow-hidden pb-1 align-bottom">
                    <motion.span
                      className="inline-block"
                      initial={{ y: '110%' }}
                      animate={{ y: 0 }}
                      transition={{ delay: 0.1 + i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {w}
                    </motion.span>
                  </span>
                ))}
                <span className="block font-mono text-[0.86em] tracking-tight text-primary" aria-label={season.hero.highlight}>
                  {highlight}
                  <span className="caret ml-1 inline-block h-[0.8em] w-[0.45em] translate-y-[0.08em] bg-primary" />
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-7 max-w-xl text-lg leading-relaxed text-muted"
              >
                {season.hero.subtitle}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link to="/tienda" className="btn-primary group inline-flex items-center gap-2 px-7 py-4">
              Explorar tienda
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/cotizar" className="btn-ghost inline-flex items-center gap-2 px-7 py-4">
              <Sparkles size={18} className="text-primary" /> Cotizar mi diseño
            </Link>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[560px]"
        >
          <div className="absolute -inset-10 -z-10 rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, var(--primary), transparent 65%)' }} />
          <LaserStage />
        </motion.div>
      </div>
    </section>
  )
}
