import { motion, useScroll, useSpring } from 'framer-motion'
import { useEffect } from 'react'
import Lenis from 'lenis'
import { Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Intro } from '../brand/Intro'
import { CartDrawer } from '../product/CartDrawer'
import { SeasonalParticles } from '../seasonal/SeasonalParticles'
import { SeasonBanner } from '../seasonal/SeasonBanner'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

export function Layout() {
  const location = useLocation()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  // Scroll suave (desactivado si el usuario prefiere menos movimiento)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ autoRaf: true, lerp: 0.12 })
    window.__lenis = lenis
    return () => {
      lenis.destroy()
      window.__lenis = undefined
    }
  }, [])

  useEffect(() => {
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true })
    else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="relative min-h-screen">
      <Intro />
      {/* barra de progreso de scroll */}
      <motion.div
        className="fixed top-0 right-0 left-0 z-[70] h-0.5 origin-left"
        style={{ scaleX: progress, background: 'var(--primary)' }}
      />
      {/* auroras de fondo */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.12] blur-[120px]" style={{ background: 'var(--primary)' }} />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.07] blur-[120px]" style={{ background: 'var(--secondary)' }} />
      </div>

      <SeasonBanner />
      <Navbar />
      <SeasonalParticles />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Outlet />
      </motion.main>
      <Footer />
      <CartDrawer />
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
