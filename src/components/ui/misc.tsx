import { Star } from 'lucide-react'
import { motion, useInView, useMotionValue, animate } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}
        />
      ))}
    </div>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  align?: 'center' | 'left'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={clsx('mb-10', align === 'center' && 'mx-auto max-w-2xl text-center')}
    >
      {eyebrow && (
        <span className={clsx('mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.18em] text-primary uppercase', align === 'center' && 'justify-center')}>
          <span className="h-2 w-2 bg-primary" />
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-muted md:text-lg">{subtitle}</p>}
    </motion.div>
  )
}

/** Número que cuenta hasta su valor al entrar en pantalla */
export function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    const ctrl = animate(mv, to, { duration: 2, ease: 'easeOut', onUpdate: (v) => setVal(Math.round(v)) })
    return () => ctrl.stop()
  }, [inView, to, mv])
  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString('es-EC')}
      {suffix}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-white/5', className)} />
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
