import { BadgeCheck, Eye, EyeOff, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { Skeleton, Stars } from '../components/ui/misc'
import { api } from '../services/api'
import type { Review, ReviewStatus } from '../types'
import { fmtDate } from '../pages/Account'
import { Card, ConfirmButton, Empty, PageHeader } from './ui'

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
  activa: { label: 'Publicada', cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
  inactiva: { label: 'Oculta', cls: 'text-muted bg-white/5 border-white/15' },
}

export default function Reviews() {
  const [list, setList] = useState<Review[] | null>(null)
  const [filter, setFilter] = useState<ReviewStatus | ''>('pendiente')

  const load = () => api.admin.reviews().then(setList)
  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => (list ?? []).reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}), [list])
  const shown = (list ?? []).filter((r) => !filter || r.status === filter)

  const setStatus = async (r: Review, status: ReviewStatus) => {
    try {
      await api.admin.updateReviewStatus(r.id, status)
      toast.success(status === 'activa' ? 'Reseña publicada' : 'Reseña ocultada')
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Reseñas"
        subtitle="Las opiniones nuevas quedan pendientes. Solo las que actives se publican y cuentan para las estrellas del producto."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['pendiente', 'activa', 'inactiva', ''] as const).map((k) => (
          <button
            key={k || 'all'}
            onClick={() => setFilter(k)}
            className={clsx('rounded-md border px-3 py-1.5 text-sm transition', filter === k ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
          >
            {k ? STATUS[k].label : 'Todas'} <span className="ml-1 text-xs opacity-70">{k ? counts[k] ?? 0 : list?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {!list ? (
        <Skeleton className="h-64" />
      ) : shown.length === 0 ? (
        <Empty>
          {list.length === 0
            ? 'Aún no hay reseñas. Los clientes pueden opinar sobre productos que hayan comprado.'
            : 'No hay reseñas en este estado.'}
        </Empty>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <Stars rating={r.rating} />
                    <span className={clsx('rounded-md border px-2 py-0.5 text-xs font-medium', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">{r.authorName}</span>
                    {r.verified && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-300">
                        <BadgeCheck size={12} /> Compra verificada
                      </span>
                    )}
                    <span className="text-muted"> · {fmtDate(r.createdAt)} · </span>
                    <Link to={`/producto/${r.productId}`} target="_blank" className="text-primary hover:underline">
                      {r.productName}
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {r.status === 'activa' ? (
                    <button onClick={() => setStatus(r, 'inactiva')} className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
                      <EyeOff size={14} /> Ocultar
                    </button>
                  ) : (
                    <button onClick={() => setStatus(r, 'activa')} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
                      <Eye size={14} /> Publicar
                    </button>
                  )}
                  <ConfirmButton
                    onConfirm={async () => {
                      await api.admin.deleteReview(r.id)
                      toast.success('Reseña eliminada')
                      load()
                    }}
                  >
                    <Trash2 size={16} />
                  </ConfirmButton>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-fg/90">{r.comment}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
