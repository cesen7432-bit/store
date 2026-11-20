import { Download, FileText, Loader2, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ORDER_STATUS, OrderBadge, QUOTE_STATUS, QuoteBadge } from '../components/ui/OrderStatus'
import { Skeleton } from '../components/ui/misc'
import { formatPrice, orderWhatsappMessage, SHIPPING } from '../config/store'
import { MATERIALS } from '../data/mock'
import { api } from '../services/api'
import type { Order, OrderStatus, Quote, QuoteStatus } from '../types'
import { fmtDate } from '../pages/Account'
import { Card, Drawer, Empty, input, PageHeader, Td, Th } from './ui'

/** Convierte un celular ecuatoriano (09…) a formato internacional para wa.me */
export const waTo = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, '')
  const intl = digits.startsWith('593') ? digits : digits.startsWith('0') ? '593' + digits.slice(1) : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
}


function StatusFilter<T extends string>({ value, onChange, options, counts }: { value: T | ''; onChange: (v: T | '') => void; options: Record<T, { label: string }>; counts: Record<string, number> }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {(['', ...Object.keys(options)] as (T | '')[]).map((k) => (
        <button
          key={k || 'all'}
          onClick={() => onChange(k)}
          className={clsx('rounded-md border px-3 py-1.5 text-sm transition', value === k ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
        >
          {k ? options[k as T].label : 'Todos'} <span className="ml-1 text-xs opacity-70">{k ? counts[k] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)}</span>
        </button>
      ))}
    </div>
  )
}

// ───────── Pedidos ─────────
export function Orders() {
  const [list, setList] = useState<Order[] | null>(null)
  const [filter, setFilter] = useState<OrderStatus | ''>('')
  const [open, setOpen] = useState<Order | null>(null)

  const load = () => api.admin.orders().then(setList)
  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => (list ?? []).reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {}), [list])
  const shown = (list ?? []).filter((o) => !filter || o.status === filter)

  const changeStatus = async (o: Order, status: OrderStatus) => {
    const updated = await api.admin.updateOrderStatus(o.id, status)
    toast.success(`${o.id}: ${ORDER_STATUS[status].label}`)
    setOpen((cur) => (cur?.id === o.id ? updated : cur))
    load()
  }

  return (
    <>
      <PageHeader title="Pedidos" subtitle="Órdenes de compra generadas desde la tienda (también llegan por WhatsApp)." />
      <StatusFilter value={filter} onChange={setFilter} options={ORDER_STATUS} counts={counts} />
      {!list ? (
        <Skeleton className="h-96" />
      ) : shown.length === 0 ? (
        <Empty>No hay pedidos en este estado.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <Th>Orden</Th>
                <Th>Cliente</Th>
                <Th>Fecha</Th>
                <Th>Envío</Th>
                <Th>Estado</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {shown.map((o) => (
                <tr key={o.id} onClick={() => setOpen(o)} className="cursor-pointer hover:bg-white/[0.03]">
                  <Td className="font-mono text-primary">{o.id}</Td>
                  <Td>
                    {o.customer.name}
                    <span className="block text-xs text-muted">{o.userId ? 'Cliente registrado' : 'Invitado'}</span>
                  </Td>
                  <Td className="text-muted">{fmtDate(o.createdAt)}</Td>
                  <Td className="text-muted">{SHIPPING[o.shippingZone ?? 'nacional'].label}</Td>
                  <Td>
                    <OrderBadge status={o.status} />
                  </Td>
                  <Td className="text-right font-semibold">{formatPrice(o.total)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `Orden ${open.id}` : ''}>
        {open && (
          <div className="space-y-6 text-sm">
            <div>
              <p className="mb-2 font-medium">Estado</p>
              <select value={open.status} onChange={(e) => changeStatus(open, e.target.value as OrderStatus)} className={input}>
                {Object.entries(ORDER_STATUS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-surface">{v.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                El cliente ve este estado en "Mis pedidos". Cuando lo marques como <b>Enviado</b>, el cliente podrá confirmar que lo recibió.
              </p>
              {open.status === 'entregado' && (
                <p className="mt-2 text-xs text-emerald-300">
                  {open.confirmedByCustomer ? '✓ Recepción confirmada por el cliente' : 'Marcado como entregado por la tienda'}
                  {open.deliveredAt && ` · ${fmtDate(open.deliveredAt)}`}
                </p>
              )}
            </div>
            <Card className="p-4">
              <p className="font-semibold">{open.customer.name}</p>
              <p className="text-muted">{open.customer.email} · {open.customer.phone}</p>
              <p className="text-muted">{open.customer.address}, {open.customer.city}</p>
              <p className="mt-2 text-muted">Envío a domicilio: {SHIPPING[open.shippingZone ?? 'nacional'].label} · pago a coordinar por WhatsApp</p>
              <a
                href={waTo(open.customer.phone, `Hola ${open.customer.name.split(' ')[0]}, te escribimos de CECOM sobre tu orden ${open.id} (${ORDER_STATUS[open.status].label}).`)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#25d366] px-3 py-2 font-semibold text-white hover:brightness-110"
              >
                <MessageCircle size={16} /> Escribir al cliente
              </a>
            </Card>
            <div>
              <p className="mb-2 font-medium">Productos</p>
              <ul className="divide-y divide-white/5 rounded-md border border-white/10">
                {open.items.map((i) => (
                  <li key={i.productId} className="flex justify-between gap-4 px-4 py-3">
                    <span>
                      {i.quantity} × {i.name}
                      {i.note && <span className="block text-xs text-primary">✎ {i.note}</span>}
                    </span>
                    <span className="whitespace-nowrap">{formatPrice(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1">
                <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{formatPrice(open.subtotal)}</dd></div>
                {open.discount > 0 && <div className="flex justify-between text-muted"><dt>Descuento {open.couponCode}</dt><dd>-{formatPrice(open.discount)}</dd></div>}
                <div className="flex justify-between text-muted"><dt>Envío</dt><dd>{open.shippingPending ? 'Por coordinar' : open.shipping ? formatPrice(open.shipping) : 'Gratis'}</dd></div>
                <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatPrice(open.total)}</dd></div>
              </dl>
            </div>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Ver mensaje de WhatsApp de la orden</summary>
              <pre className="mt-2 rounded-md bg-white/[0.03] p-3 whitespace-pre-wrap">{orderWhatsappMessage(open)}</pre>
            </details>
          </div>
        )}
      </Drawer>
    </>
  )
}

// ───────── Cotizaciones ─────────
const TYPE_LABEL: Record<Quote['type'], string> = { 'corte-laser': 'Corte / grabado láser', letrero: 'Letrero neón / acrílico', proyecto: 'Proyecto electrónico' }

export function Quotes() {
  const [list, setList] = useState<Quote[] | null>(null)
  const [filter, setFilter] = useState<QuoteStatus | ''>('')

  const load = () => api.admin.quotes().then(setList)
  useEffect(() => {
    load()
  }, [])
  const counts = useMemo(() => (list ?? []).reduce<Record<string, number>>((m, q) => ((m[q.status] = (m[q.status] ?? 0) + 1), m), {}), [list])
  const shown = (list ?? []).filter((q) => !filter || q.status === filter)

  return (
    <>
      <PageHeader title="Cotizaciones" subtitle="Solicitudes enviadas desde el cotizador." />
      <StatusFilter value={filter} onChange={setFilter} options={QUOTE_STATUS} counts={counts} />
      {!list ? (
        <Skeleton className="h-64" />
      ) : shown.length === 0 ? (
        <Empty>No hay cotizaciones en este estado.</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((q) => (
            <Card key={q.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-primary">{q.id}</p>
                  <p className="mt-1 font-semibold">{q.name}</p>
                  <p className="text-xs text-muted">{q.email} · {q.phone} · {fmtDate(q.createdAt)}</p>
                </div>
                <QuoteBadge status={q.status} />
              </div>
              <p className="mt-4 text-sm">{q.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                <span>{TYPE_LABEL[q.type]}</span>
                {q.material && <span>{MATERIALS.find((m) => m.id === q.material)?.name}</span>}
                {q.width && <span>{q.width}×{q.height} cm · x{q.quantity}</span>}

                <span>Estimado: <b className="text-fg">{formatPrice(q.estimatedPrice)}</b> · {q.estimatedDays} días</span>
              </div>
              {q.file ? <QuoteAttachment quote={q} /> : q.fileName && <p className="mt-3 text-xs text-muted">📎 {q.fileName} (archivo no disponible: se envió antes de habilitar las subidas)</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                <select
                  value={q.status}
                  onChange={async (e) => {
                    await api.admin.updateQuoteStatus(q.id, e.target.value as QuoteStatus)
                    toast.success('Estado actualizado')
                    load()
                  }}
                  className={input + ' w-auto py-2'}
                >
                  {Object.entries(QUOTE_STATUS).map(([k, v]) => (
                    <option key={k} value={k} className="bg-surface">{v.label}</option>
                  ))}
                </select>
                <a
                  href={waTo(q.phone, `Hola ${q.name.split(' ')[0]}, te escribimos de CECOM por tu cotización ${q.id}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-[#25d366] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  <MessageCircle size={16} /> Contactar
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

/** Adjunto privado de una cotización: vista previa (imágenes) y descarga */
function QuoteAttachment({ quote }: { quote: Quote }) {
  const f = quote.file!
  const isImage = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(f.type)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // la vista previa se pide con el token del admin; <img> no ejecuta scripts (seguro incluso con SVG)
  useEffect(() => {
    if (!isImage) return
    let url = ''
    api.admin
      .quoteFile(quote.id)
      .then((b) => setPreview((url = URL.createObjectURL(b))))
      .catch(() => {})
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [quote.id, isImage])

  const download = async () => {
    setBusy(true)
    try {
      const blob = await api.admin.quoteFile(quote.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const kb = f.size / 1024
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5">
        {preview ? (
          <img src={preview} alt={f.name} className="h-16 w-16 object-cover" />
        ) : (
          <FileText size={22} className="text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{f.name}</p>
        <p className="text-xs text-muted">{kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`}</p>
      </div>
      <button onClick={download} disabled={busy} className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Descargar
      </button>
    </div>
  )
}
