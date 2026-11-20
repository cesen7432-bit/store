import { CheckCircle2, CircleDashed, Cog, CreditCard, PackageCheck, Truck, XCircle } from 'lucide-react'
import clsx from 'clsx'
import type { OrderStatus, QuoteStatus } from '../../types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; icon: typeof Truck; cls: string }> = {
  recibido: { label: 'Recibido', icon: CircleDashed, cls: 'text-sky-300 bg-sky-400/10 border-sky-400/30' },
  pagado: { label: 'Pagado', icon: CreditCard, cls: 'text-violet-300 bg-violet-400/10 border-violet-400/30' },
  'en-produccion': { label: 'En producción', icon: Cog, cls: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
  enviado: { label: 'Enviado', icon: Truck, cls: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/30' },
  entregado: { label: 'Entregado', icon: PackageCheck, cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
  cancelado: { label: 'Cancelado', icon: XCircle, cls: 'text-red-300 bg-red-400/10 border-red-400/30' },
}

export const ORDER_FLOW: OrderStatus[] = ['recibido', 'pagado', 'en-produccion', 'enviado', 'entregado']

export function OrderBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium', s.cls)}>
      <s.icon size={12} /> {s.label}
    </span>
  )
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; cls: string }> = {
  nueva: { label: 'Nueva', cls: 'text-sky-300 bg-sky-400/10 border-sky-400/30' },
  contactado: { label: 'Contactado', cls: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
  aprobada: { label: 'Aprobada', cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
  rechazada: { label: 'Rechazada', cls: 'text-red-300 bg-red-400/10 border-red-400/30' },
}

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  const s = QUOTE_STATUS[status]
  return <span className={clsx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
}

/** Línea de tiempo del pedido para el cliente */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelado') return <OrderBadge status="cancelado" />
  const idx = ORDER_FLOW.indexOf(status)
  return (
    <ol className="flex items-center gap-1">
      {ORDER_FLOW.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-1">
          <span
            title={ORDER_STATUS[s].label}
            className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', i <= idx ? 'border-primary bg-primary text-black' : 'border-white/15 text-muted')}
          >
            {i < idx ? <CheckCircle2 size={14} /> : (() => { const I = ORDER_STATUS[s].icon; return <I size={12} /> })()}
          </span>
          {i < ORDER_FLOW.length - 1 && <span className={clsx('h-px flex-1', i < idx ? 'bg-primary' : 'bg-white/10')} />}
        </li>
      ))}
    </ol>
  )
}
