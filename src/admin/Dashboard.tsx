import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { OrderBadge } from '../components/ui/OrderStatus'
import { Skeleton } from '../components/ui/misc'
import { formatPrice } from '../config/store'
import { api } from '../services/api'
import { useAuth } from '../store/auth'
import { useAsync } from '../utils/useAsync'
import { fmtDate } from '../pages/Account'
import { Card, PageHeader } from './ui'

export default function Dashboard() {
  const user = useAuth((s) => s.user)
  const { data, loading } = useAsync(() => api.admin.stats(), [])

  return (
    <>
      <PageHeader title={`Hola, ${user?.name.split(' ')[0]}`} subtitle="Así va la tienda hoy." />

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Ventas del mes" value={formatPrice(data.salesMonth)} sub={`${data.ordersMonth} pedidos`} />
            <Kpi label="Pedidos por atender" value={String(data.pendingOrders)} sub="recibidos, pagados o en producción" to="/admin/pedidos" />
            <Kpi label="Cotizaciones nuevas" value={String(data.newQuotes)} sub="sin contactar" to="/admin/cotizaciones" />
            <Kpi label="Reseñas por revisar" value={String(data.pendingReviews ?? 0)} sub={`${data.customers} clientes registrados`} to="/admin/resenas" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card className="p-6">
              <h2 className="font-semibold">Ventas · últimos 7 días</h2>
              <p className="mb-6 text-sm text-muted">Total: {formatPrice(data.salesByDay.reduce((s, d) => s + d.total, 0))}</p>
              <SalesChart data={data.salesByDay} />
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} className="text-amber-400" /> Stock bajo
              </h2>
              {data.lowStock.length === 0 ? (
                <p className="text-sm text-muted">Todo el inventario está bien.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {data.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                      <Link to={`/admin/productos?editar=${p.id}`} className="truncate hover:text-primary">{p.name}</Link>
                      <span className={p.stock < 10 ? 'font-semibold text-red-300' : 'text-amber-300'}>{p.stock} u.</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="font-semibold">Últimos pedidos</h2>
              <Link to="/admin/pedidos" className="flex items-center gap-1 text-sm text-primary hover:underline">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/5">
                  {data.latestOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-6 py-3 font-mono text-primary">{o.id}</td>
                      <td className="px-6 py-3">{o.customer.name}</td>
                      <td className="px-6 py-3 text-muted">{fmtDate(o.createdAt)}</td>
                      <td className="px-6 py-3"><OrderBadge status={o.status} /></td>
                      <td className="px-6 py-3 text-right font-semibold">{formatPrice(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}

function Kpi({ label, value, sub, to }: { label: string; value: string; sub?: string; to?: string }) {
  const body = (
    <Card className="h-full p-5 transition hover:border-white/20">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

/** Barras de una sola serie: un color, cuadrícula discreta, tooltip al pasar el mouse. */
function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 560
  const H = 220
  const pad = { l: 44, r: 8, t: 10, b: 28 }
  const max = Math.max(10, ...data.map((d) => d.total))
  const nice = Math.ceil(max / 50) * 50
  const step = (W - pad.l - pad.r) / data.length
  const barW = Math.min(36, step * 0.5)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const ticks = [0, nice / 2, nice]
  const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' })

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ventas de los últimos 7 días">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-white/10" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-muted">
              ${t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + step * i + (step - barW) / 2
          const h = Math.max(0, y(0) - y(d.total))
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* área de hover más grande que la barra */}
              <rect x={pad.l + step * i} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${y(0)} V${y(d.total) + 4} Q${x} ${y(d.total)} ${x + 4} ${y(d.total)} H${x + barW - 4} Q${x + barW} ${y(d.total)} ${x + barW} ${y(d.total) + 4} V${y(0)} Z`}
                  fill="var(--primary)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  style={{ transition: 'opacity .15s' }}
                />
              )}
              <text x={pad.l + step * i + step / 2} y={H - 8} textAnchor="middle" fontSize={11} className="fill-muted">
                {day(d.date)}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-bg px-3 py-2 text-xs shadow-xl"
          style={{ left: `${((pad.l + step * hover + step / 2) / W) * 100}%`, top: `${(y(data[hover].total) / H) * 100}%`, marginTop: -8 }}
        >
          <p className="text-muted">{day(data[hover].date)}</p>
          <p className="font-semibold">{formatPrice(data[hover].total)}</p>
        </div>
      )}
      {/* tabla accesible */}
      <table className="sr-only">
        <caption>Ventas por día</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{formatPrice(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
