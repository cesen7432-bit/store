import { Eye, Monitor, ShoppingCart, Smartphone, Tablet, UserCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Skeleton } from '../components/ui/misc'
import { api } from '../services/api'
import type { VisitorSummary } from '../types'
import { useAsync } from '../utils/useAsync'
import { Card, Drawer, Empty, PageHeader } from './ui'

const RANGES = [
  { days: 1, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}
const visitorLabel = (v: VisitorSummary) => v.user?.name ?? `Visitante anónimo #${v.visitorId.slice(0, 4)}`
const DeviceIcon = ({ d }: { d: string }) => (d === 'Celular' ? <Smartphone size={14} /> : d === 'Tablet' ? <Tablet size={14} /> : <Monitor size={14} />)

export default function Visits() {
  const [days, setDays] = useState(7)
  const [open, setOpen] = useState<VisitorSummary | null>(null)
  const [onlyKnown, setOnlyKnown] = useState(false)
  const { data, loading } = useAsync(() => api.admin.analytics(days), [days])
  const visitors = (data?.recentVisitors ?? []).filter((v) => !onlyKnown || v.user)

  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle="Quién visitó la tienda y qué productos vio. Los clientes con sesión aparecen con su nombre; el resto como visitantes anónimos."
        actions={
          <div className="flex rounded-lg border border-white/10 p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={clsx('rounded-md px-3 py-1.5 transition', days === r.days ? 'bg-white/10 text-fg' : 'text-muted hover:text-fg')}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data.visitors === 0 ? (
        <Empty>Todavía no hay visitas registradas en este periodo. Se registran automáticamente cuando alguien navega la tienda (sin contar a los administradores).</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<Users size={16} />} label="Visitantes únicos" value={data.visitors} sub={`${data.pageViews} páginas vistas`} />
            <Kpi icon={<UserCheck size={16} />} label="Con cuenta" value={data.identifiedVisitors} sub={`${data.visitors - data.identifiedVisitors} anónimos`} />
            <Kpi icon={<Eye size={16} />} label="Productos vistos" value={data.productViews} sub="vistas de detalle" />
            <Kpi icon={<ShoppingCart size={16} />} label="Agregados al carrito" value={data.addToCart} sub={data.productViews ? `${Math.round((data.addToCart / data.productViews) * 100)}% de las vistas` : undefined} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card className="p-6">
              <h2 className="mb-5 font-semibold">Visitantes por día</h2>
              <DayBars data={data.byDay} />
            </Card>
            <Card className="p-6">
              <h2 className="mb-4 font-semibold">De dónde llegan</h2>
              <Bars rows={data.referrers.map((r) => ({ label: r.source, value: r.visitors }))} />
              <h2 className="mt-6 mb-4 font-semibold">Dispositivos</h2>
              <Bars rows={data.devices.map((d) => ({ label: d.device, value: d.visitors }))} />
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <h2 className="px-6 pt-5 pb-3 font-semibold">Productos más vistos</h2>
            {data.topProducts.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">Aún nadie abrió un producto en este periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-white/10 bg-white/[0.02] text-left text-xs tracking-wider text-muted uppercase">
                    <tr>
                      <th className="px-6 py-2.5">Producto</th>
                      <th className="px-4 py-2.5 text-right">Vistas</th>
                      <th className="px-4 py-2.5 text-right">Visitantes</th>
                      <th className="px-6 py-2.5 text-right">Al carrito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.topProducts.map((p) => (
                      <tr key={p.id}>
                        <td className="px-6 py-2.5">
                          {p.slug ? <Link to={`/producto/${p.slug}`} target="_blank" className="hover:text-primary">{p.name}</Link> : <span className="text-muted">{p.name}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{p.views}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted">{p.visitors}</td>
                        <td className={clsx('px-6 py-2.5 text-right font-mono', p.addedToCart ? 'text-emerald-300' : 'text-muted')}>{p.addedToCart}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
              <h2 className="font-semibold">Visitantes recientes</h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={onlyKnown} onChange={(e) => setOnlyKnown(e.target.checked)} className="accent-[var(--primary)]" />
                Solo clientes con cuenta
              </label>
            </div>
            {visitors.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">No hay visitantes con cuenta en este periodo.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {visitors.map((v) => (
                  <li key={v.visitorId}>
                    <button onClick={() => setOpen(v)} className="flex w-full flex-wrap items-start gap-x-4 gap-y-2 px-6 py-3.5 text-left transition hover:bg-white/[0.03]">
                      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', v.user ? 'bg-primary text-black' : 'bg-white/10 text-muted')}>
                        {v.user ? v.user.name[0]?.toUpperCase() : '?'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{visitorLabel(v)}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          {v.user && <span>{v.user.email}</span>}
                          <span className="inline-flex items-center gap-1"><DeviceIcon d={v.device} /> {v.device}</span>
                          {v.referrer && <span>· desde {v.referrer}</span>}
                          <span>· {v.pageViews} páginas</span>
                        </span>
                        {v.products.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            {v.products.slice(0, 5).map((p) => (
                              <span key={p.id} className={clsx('rounded border px-1.5 py-0.5 text-[11px]', p.addedToCart ? 'border-emerald-400/30 text-emerald-300' : 'border-white/10 text-muted')}>
                                {p.name}
                                {p.addedToCart && ' 🛒'}
                              </span>
                            ))}
                            {v.products.length > 5 && <span className="text-[11px] text-muted">+{v.products.length - 5} más</span>}
                          </span>
                        )}
                      </span>
                      <span className="text-xs whitespace-nowrap text-muted" title={fmtDateTime(v.lastSeen)}>{ago(v.lastSeen)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <VisitorDrawer visitor={open} onClose={() => setOpen(null)} />
    </>
  )
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        <span className="text-primary">{icon}</span> {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold">{value.toLocaleString('es-EC')}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  )
}

/** Barras horizontales simples (una sola serie, valores visibles) */
function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-sm text-muted">Sin datos.</p>
  return (
    <ul className="space-y-2.5 text-sm">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="font-mono text-muted">{r.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Visitantes por día: una barra por día con su valor al pasar el mouse */
function DayBars({ data }: { data: { date: string; visitors: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.visitors))
  const label = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
  return (
    <div>
      <div className="flex h-40 items-end gap-1" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={clsx('w-full rounded-t-[4px] transition', hover === null || hover === i ? 'bg-primary' : 'bg-primary/40')}
              style={{ height: `${Math.max(d.visitors ? 4 : 0, (d.visitors / max) * 100)}%` }}
            />
            {hover === i && (
              <span className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md border border-white/10 bg-bg px-2 py-1 text-xs whitespace-nowrap shadow-xl">
                {label(d.date)}: <b>{d.visitors}</b>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0] && label(data[0].date)}</span>
        <span>{data.at(-1) && label(data.at(-1)!.date)}</span>
      </div>
    </div>
  )
}

/** Recorrido completo del visitante */
function VisitorDrawer({ visitor, onClose }: { visitor: VisitorSummary | null; onClose: () => void }) {
  const { data: events, loading } = useAsync(() => (visitor ? api.admin.visitorEvents(visitor.visitorId) : Promise.resolve([])), [visitor?.visitorId])
  return (
    <Drawer open={!!visitor} onClose={onClose} title={visitor ? visitorLabel(visitor) : ''}>
      {visitor && (
        <div className="space-y-5 text-sm">
          <Card className="p-4">
            {visitor.user ? (
              <>
                <p className="font-semibold">{visitor.user.name}</p>
                <p className="text-muted">{visitor.user.email} · {visitor.user.phone}</p>
              </>
            ) : (
              <p className="text-muted">Visitante sin sesión. Si luego ingresa o crea su cuenta, sus siguientes visitas aparecerán con su nombre.</p>
            )}
            <p className="mt-2 text-xs text-muted">
              Primera visita {fmtDateTime(visitor.firstSeen)} · última {fmtDateTime(visitor.lastSeen)} · {visitor.device}
              {visitor.referrer && ` · llegó desde ${visitor.referrer}`}
            </p>
          </Card>
          <div>
            <h3 className="mb-3 font-semibold">Recorrido</h3>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (
              <ol className="relative space-y-3 border-l border-white/10 pl-5">
                {(events ?? []).map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      className={clsx(
                        'absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-bg',
                        e.type === 'cart' ? 'bg-emerald-400' : e.type === 'product' ? 'bg-primary' : 'bg-white/30',
                      )}
                    />
                    <p className={clsx(e.type === 'page' && 'text-muted')}>
                      {e.type === 'cart' ? (
                        <>Agregó al carrito <b>{e.productName}</b></>
                      ) : e.type === 'product' ? (
                        <>Vio <b>{e.productName}</b></>
                      ) : (
                        <>Abrió <span className="font-mono text-xs">{e.path}</span></>
                      )}
                    </p>
                    <p className="text-xs text-muted">{fmtDateTime(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
