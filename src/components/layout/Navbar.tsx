import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { Menu, Search, ShoppingCart, User, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useCart, useCartTotals } from '../../store/cart'
import { useAuth } from '../../store/auth'
import { STORE } from '../../config/store'
import { LogoMark } from '../brand/Logo'

const LINKS = [
  { to: '/', label: 'Inicio' },
  { to: '/tienda/electronica', label: 'Electrónica' },
  { to: '/tienda/corte-laser', label: 'Corte Láser' },
  { to: '/tienda/proyectos', label: 'Kits' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/cotizar', label: 'Cotizar' },
]

export function Logo() {
  const [hover, setHover] = useState(0)
  return (
    <Link
      to="/"
      onMouseEnter={() => setHover((h) => h + 1)}
      className="group flex items-center gap-2.5"
      aria-label={`${STORE.name} inicio`}
    >
      {/* key cambia en hover → los pads parpadean como LEDs */}
      <LogoMark key={hover} blink={hover > 0} className="h-8 w-auto text-fg" />
      <span className="font-display text-xl leading-none font-bold tracking-[0.12em]">{STORE.name}</span>
    </Link>
  )
}

export function Navbar() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [term, setTerm] = useState('')
  const { count } = useCartTotals()
  const openCart = useCart((s) => s.open)
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 20))
  useEffect(() => {
    setMobile(false)
  }, [location.pathname])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!term.trim()) return
    navigate(`/tienda?q=${encodeURIComponent(term.trim())}`)
    setSearchOpen(false)
    setTerm('')
  }

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 transition-all duration-300',
        scrolled ? 'glass py-2 shadow-lg shadow-black/30' : 'bg-transparent py-4',
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 md:px-6">
        <Logo />
        <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'relative rounded-full px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-white/8"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    {l.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link
            to={user ? (user.role === 'admin' ? '/admin' : '/cuenta') : '/ingresar'}
            aria-label={user ? 'Mi cuenta' : 'Ingresar'}
            title={user ? user.name : 'Ingresar / Registrarse'}
            className="flex items-center gap-2 rounded-full p-2.5 text-muted transition hover:bg-white/5 hover:text-fg"
          >
            {user ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-black">
                {user.name[0]?.toUpperCase()}
              </span>
            ) : (
              <User size={20} />
            )}
          </Link>
          <button
            onClick={() => setSearchOpen((s) => !s)}
            aria-label="Buscar"
            className="rounded-full p-2.5 text-muted transition hover:bg-white/5 hover:text-fg"
          >
            <Search size={20} />
          </button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={openCart}
            aria-label="Carrito"
            className="relative rounded-full p-2.5 text-muted transition hover:bg-white/5 hover:text-fg"
          >
            <ShoppingCart size={20} />
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-black"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <button
            onClick={() => setMobile((m) => !m)}
            aria-label="Menú"
            className="rounded-full p-2.5 text-muted hover:bg-white/5 lg:hidden"
          >
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {searchOpen && (
          <motion.form
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mx-auto max-w-3xl overflow-hidden px-4"
          >
            <div className="glass mt-3 flex items-center gap-3 rounded-lg px-4 py-3">
              <Search size={18} className="text-muted" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Busca Arduino, acrílico, neón, sensores…"
                className="flex-1 bg-transparent outline-none placeholder:text-muted"
              />
              <button className="btn-primary rounded-xl px-4 py-1.5 text-sm">Buscar</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobile && (
          <motion.ul
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass mx-4 mt-3 rounded-lg p-2 lg:hidden"
          >
            {LINKS.map((l, i) => (
              <motion.li key={l.to} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <NavLink
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    clsx('block rounded-xl px-4 py-3 font-medium', isActive ? 'bg-primary/15 text-primary' : 'text-fg')
                  }
                >
                  {l.label}
                </NavLink>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  )
}
