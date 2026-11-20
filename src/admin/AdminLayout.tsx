import { motion } from 'framer-motion'
import { ExternalLink, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, MessageSquareText, Package, Settings, ShoppingBag, Tag, Users, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import clsx from 'clsx'
import { LogoMark } from '../components/brand/Logo'
import { PageLoader } from '../components/brand/LaserLoader'
import { IS_MOCK } from '../services/api'
import { useAuth } from '../store/auth'

const NAV = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/cotizaciones', label: 'Cotizaciones', icon: FileText },
  { to: '/admin/resenas', label: 'Reseñas', icon: MessageSquareText },
  { to: '/admin/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/admin/cupones', label: 'Cupones', icon: Tag },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  if (!user) return <Navigate to={`/ingresar?next=${location.pathname}`} replace />
  if (user.role !== 'admin')
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-2xl font-bold">Acceso solo para administradores</p>
        <Link to="/" className="btn-primary px-6 py-3">Volver a la tienda</Link>
      </div>
    )

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-5 py-5">
        <LogoMark className="h-7 w-auto text-fg" />
        <span className="font-display text-lg font-bold tracking-[0.1em]">CECOM</span>
        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">ADMIN</span>
      </Link>
      <ul className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx('relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition', isActive ? 'text-fg' : 'text-muted hover:bg-white/[0.03] hover:text-fg')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="admin-nav" className="absolute inset-0 -z-10 rounded-md bg-white/[0.06]" />}
                  {isActive && <span className="absolute top-2 bottom-2 left-0 w-0.5 bg-primary" />}
                  <n.icon size={18} /> {n.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted hover:bg-white/[0.03] hover:text-fg">
          <ExternalLink size={18} /> Ver tienda
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted hover:bg-white/[0.03] hover:text-fg">
          <LogOut size={18} /> Cerrar sesión
        </button>
        <div className="flex items-center gap-3 px-3 pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-black">{user.name[0]}</span>
          <span className="min-w-0 text-xs">
            <span className="block truncate font-medium">{user.name}</span>
            <span className="block truncate text-muted">{user.email}</span>
          </span>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-white/10 bg-surface/60 lg:block">{sidebar}</aside>

      {/* móvil */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/admin" className="flex items-center gap-2">
          <LogoMark className="h-6 w-auto text-fg" />
          <span className="font-display font-bold">Admin</span>
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-white/5" aria-label="Menú">
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute top-0 bottom-0 left-0 w-72 bg-surface">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-md p-2 hover:bg-white/5" aria-label="Cerrar">
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0">
        {IS_MOCK && (
          <div className="border-b border-white/10 bg-white/[0.02] px-6 py-2 text-xs text-muted lg:px-10">
            Modo demo: los cambios se guardan solo en este navegador hasta conectar el backend.
          </div>
        )}
        <div className="px-4 py-8 md:px-6 lg:px-10">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
