import { Check, Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { SEASONS, seasonForDate } from '../config/seasons'
import { useSeason } from '../context/SeasonContext'
import { api, IS_MOCK } from '../services/api'
import { useAsync } from '../utils/useAsync'
import { input } from './ui'
import type { StoreSettings } from '../types'
import { Card, ConfirmButton, PageHeader, Toggle } from './ui'

export default function Settings() {
  const { settings, applySettings } = useSeason()
  const [draft, setDraft] = useState<StoreSettings>(settings)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(settings), [settings])

  const auto = seasonForDate()
  const { data: couponList } = useAsync(() => api.admin.coupons(), [])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const save = async () => {
    setSaving(true)
    try {
      const s = await api.admin.saveSettings(draft)
      applySettings(s)
      toast.success('Configuración guardada · ya la ven todos los visitantes')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const options = [{ id: 'auto', name: `Automático (hoy: ${auto.name})`, emoji: '🗓️', palette: auto.palette }, ...SEASONS]

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Solo los administradores pueden cambiar el tema de la tienda."
        actions={
          <button onClick={save} disabled={!dirty || saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40">
            {saving && <Loader2 size={14} className="animate-spin" />} Guardar cambios
          </button>
        }
      />

      <Card className="p-6">
        <h2 className="font-semibold">Tema de temporada</h2>
        <p className="mb-5 text-sm text-muted">
          En automático cambia solo según la fecha (Navidad del 15 nov al 26 dic, Amor y Amistad en febrero, etc.). Elige uno para forzarlo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {options.map((s) => {
            const active = draft.seasonMode === s.id
            return (
              <button
                key={s.id}
                onClick={() => setDraft({ ...draft, seasonMode: s.id })}
                className={clsx('relative rounded-lg border p-4 text-left transition', active ? 'border-primary bg-primary/[0.07]' : 'border-white/10 hover:border-white/25')}
              >
                {active && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-black">
                    <Check size={12} />
                  </span>
                )}
                <span className="text-2xl">{s.emoji}</span>
                <span className="mt-2 block text-sm font-semibold">{s.name}</span>
                <span className="mt-3 flex gap-1">
                  {[s.palette.bg, s.palette.primary, s.palette.secondary, s.palette.accent].map((c, i) => (
                    <span key={i} className="h-5 flex-1 rounded-sm border border-white/10" style={{ background: c }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Descuento por crear cuenta</h2>
        <p className="mb-4 text-sm text-muted">
          Se muestra a los visitantes sin cuenta en el carrito y en el registro, y se aplica solo al terminar el registro. Usa un cupón marcado como “solo 1ª compra”.
        </p>
        <select value={draft.welcomeCoupon} onChange={(e) => setDraft({ ...draft, welcomeCoupon: e.target.value })} className={input + ' max-w-md'}>
          <option value="" className="bg-surface">Sin descuento de bienvenida</option>
          {(couponList ?? []).map((c) => (
            <option key={c.code} value={c.code} className="bg-surface">
              {c.code} · {c.percent}% {c.firstOrderOnly ? '· solo 1ª compra' : ''} {c.active === false ? '(inactivo)' : ''}
            </option>
          ))}
        </select>
      </Card>

      <Card className="mt-6 space-y-5 p-6">
        <h2 className="font-semibold">Efectos visibles para los clientes</h2>
        <Toggle
          checked={draft.showSeasonBanner}
          onChange={(v) => setDraft({ ...draft, showSeasonBanner: v })}
          label="Barra de anuncio de temporada"
          description="Franja superior con la promo y el cupón de la temporada"
        />
        <Toggle
          checked={draft.showParticles}
          onChange={(v) => setDraft({ ...draft, showParticles: v })}
          label="Partículas animadas"
          description="Nieve, corazones, estrellas… (se desactivan solas si el visitante prefiere menos movimiento)"
        />
      </Card>

      {IS_MOCK && api.admin.resetDemo && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-semibold">Datos de demostración</h2>
            <p className="text-sm text-muted">Restaura productos, pedidos y usuarios de ejemplo. Borra lo creado en este navegador.</p>
          </div>
          <ConfirmButton
            onConfirm={async () => {
              await api.admin.resetDemo!()
              toast.success('Datos restaurados')
              setTimeout(() => window.location.reload(), 600)
            }}
            className="flex items-center gap-2 border border-white/10"
          >
            <RotateCcw size={14} /> Restaurar demo
          </ConfirmButton>
        </Card>
      )}
    </>
  )
}
