import { motion } from 'framer-motion'
import { ChevronRight, Heart, LayoutDashboard, LogOut, Package, User as UserIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ProductCard } from '../components/product/ProductCard'
import { OrderBadge } from '../components/ui/OrderStatus'
import { Skeleton } from '../components/ui/misc'
import { formatPrice } from '../config/store'
import { api } from '../services/api'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { useAsync } from '../utils/useAsync'
import { inputCls } from './Auth'

const TABS = [
  { id: 'pedidos', label: 'Mis pedidos', icon: Package },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'datos', label: 'Mis datos', icon: UserIcon },
] as const

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Account() {
  const { user, logout } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as (typeof TABS)[number]['id']) || 'pedidos'
  const navigate = useNavigate()

  if (!user) return <Navigate to="/ingresar?next=/cuenta" replace />

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">Mi cuenta</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Hola, {user.name.split(' ')[0]}</h1>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && (
            <Link to="/admin" className="btn-ghost inline-flex items-center gap-2 px-4 py-2.5 text-sm">
              <LayoutDashboard size={16} /> Panel de administración
            </Link>
          )}
          <button
            onClick={() => {
              logout()
              navigate('/')
              toast('Sesión cerrada')
            }}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-fg"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </div>

      <div className="mb-8 flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={clsx('relative flex items-center gap-2 px-4 pb-3 text-sm font-medium transition', tab === t.id ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            <t.icon size={16} /> {t.label}
            {tab === t.id && <motion.span layoutId="acc-tab" className="absolute right-0 -bottom-px left-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && <MyOrders />}
      {tab === 'favoritos' && <Favorites />}
      {tab === 'datos' && <Profile />}
    </div>
  )
}

function MyOrders() {
  const { data, loading } = useAsync(() => api.myOrders(), [])
  if (loading) return <Skeleton className="h-40" />
  if (!data?.length)
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">Aún no tienes pedidos</p>
        <Link to="/tienda" className="btn-primary mt-6 inline-block px-6 py-3">Ir a la tienda</Link>
      </div>
    )
  return (
    <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10 bg-surface/60">
      {data.map((o) => {
        const count = o.items.reduce((n, i) => n + i.quantity, 0)
        return (
          <li key={o.id}>
            <Link to={`/cuenta/pedidos/${o.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono font-bold text-primary">{o.id}</span>
                  <OrderBadge status={o.status} />
                  {o.status === 'enviado' && <span className="text-xs font-medium text-amber-300">¿Ya lo recibiste? Confírmalo</span>}
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {fmtDate(o.createdAt)} · {count} {count === 1 ? 'artículo' : 'artículos'} · {o.items[0]?.name}
                  {o.items.length > 1 && ` y ${o.items.length - 1} más`}
                </p>
              </div>
              <span className="font-display text-lg font-bold">{formatPrice(o.total)}</span>
              <ChevronRight size={18} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Favorites() {
  const favorites = useCart((s) => s.favorites)
  const { data, loading } = useAsync(() => api.getProducts(), [])
  const list = (data ?? []).filter((p) => favorites.includes(p.id))
  if (loading) return <Skeleton className="h-40" />
  if (!list.length) return <p className="py-16 text-center text-muted">Toca el ♡ en cualquier producto para guardarlo aquí.</p>
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
    </div>
  )
}

function Profile() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user!.name, address: user!.address ?? '', city: user!.city ?? '' })
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      setUser(await api.updateProfile(form))
      toast.success('Datos actualizados')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-sm text-muted">Correo</span>
        <input disabled value={user!.email} className={inputCls + ' opacity-60'} />
      </label>
      <label>
        <span className="mb-1.5 block text-sm text-muted">Celular (verificación en dos pasos)</span>
        <input disabled value={user!.phone} className={inputCls + ' opacity-60'} />
        <span className="mt-1 block text-xs text-muted">Para cambiarlo escríbenos por WhatsApp.</span>
      </label>
      <label>
        <span className="mb-1.5 block text-sm text-muted">Fecha de nacimiento</span>
        <input disabled type="date" value={user!.birthDate ?? ''} className={inputCls + ' opacity-60'} />
      </label>
      {(
        [
          ['name', 'Nombre completo'],
          ['city', 'Ciudad'],
          ['address', 'Dirección de envío'],
        ] as const
      ).map(([k, l]) => (
        <label key={k} className={k === 'address' ? 'sm:col-span-2' : ''}>
          <span className="mb-1.5 block text-sm text-muted">{l}</span>
          <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
        </label>
      ))}
      <button disabled={saving} className="btn-primary mt-2 w-fit px-8 py-3 disabled:opacity-70">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  )
}
