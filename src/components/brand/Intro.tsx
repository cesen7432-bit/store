import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { STORE } from '../../config/store'
import { LogoAssemble } from './Logo'

const KEY = 'cecom-intro-seen'

/** Pantalla de entrada: el logo se ensambla y la cortina se abre. Solo una vez por sesión. */
export function Intro() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem(KEY) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setShow(false), 1900)
    return () => clearTimeout(t)
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg"
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          initial={{ clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
        >
          <LogoAssemble className="h-28 w-auto text-fg md:h-36" />
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, letterSpacing: '0.35em' }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-8 font-display text-2xl font-bold"
          >
            {STORE.name}
          </motion.p>
          <motion.div
            className="mt-6 h-px w-40 origin-left bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2, duration: 1.5, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
