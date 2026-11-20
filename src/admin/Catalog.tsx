import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ICON_NAMES } from '../components/ui/Icon'
import { ProjectCover } from '../components/project/ProjectMedia'
import { MediaUploader } from './MediaUploader'
import { Skeleton } from '../components/ui/misc'
import { formatPrice } from '../config/store'
import { api } from '../services/api'
import { useAuth } from '../store/auth'
import type { Coupon, Project, Role, User } from '../types'
import { fmtDate } from '../pages/Account'
import { Card, ConfirmButton, Drawer, Empty, Field, input, PageHeader, Td, Th, Toggle } from './ui'

// ───────── Proyectos a medida ─────────
const EMPTY_PROJECT: Project = {
  id: '',
  title: '',
  summary: '',
  category: 'acrilico',
  difficulty: 'Intermedio',
  durationDays: 7,
  priceFrom: 0,
  icon: 'sparkles',
  gradient: ['#ff5b23', '#ffa53d'],
  highlights: [],
  media: [],
}
const PROJECT_CATS: Project['category'][] = ['arduino', 'acrilico', 'iot', 'robotica', 'decoracion']
const PROJECT_CAT_LABEL: Record<Project['category'], string> = { arduino: 'Arduino', acrilico: 'Acrílico y letreros', iot: 'IoT', robotica: 'Robótica', decoracion: 'Decoración' }

export function Projects() {
  const [list, setList] = useState<Project[] | null>(null)
  const [edit, setEdit] = useState<Project | null>(null)
  const [highlights, setHighlights] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => api.getProjects().then(setList)
  useEffect(() => {
    load()
  }, [])

  const openEdit = (p: Project) => {
    setEdit(structuredClone(p))
    setHighlights(p.highlights.join('\n'))
  }
  const save = async () => {
    if (!edit?.title.trim()) return toast.error('El título es obligatorio')
    setSaving(true)
    try {
      await api.admin.saveProject({ ...edit, highlights: highlights.split('\n').map((h) => h.trim()).filter(Boolean) })
      toast.success('Proyecto guardado')
      setEdit(null)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x))

  return (
    <>
      <PageHeader
        title="Proyectos a medida"
        subtitle="Se muestran en la página Proyectos como portafolio."
        actions={
          <button onClick={() => openEdit(EMPTY_PROJECT)} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={16} /> Nuevo proyecto
          </button>
        }
      />
      {!list ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="h-32">
                <ProjectCover project={p} iconSize={40} hoverPlay={false} />
              </div>
              <div className="p-4">
                <p className="font-semibold">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">Desde <b>{formatPrice(p.priceFrom)}</b></span>
                  <span>
                    <button onClick={() => openEdit(p)} className="rounded-md p-2 text-muted hover:bg-white/5 hover:text-fg" aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <ConfirmButton
                      onConfirm={async () => {
                        await api.admin.deleteProject(p.id)
                        load()
                      }}
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Editar proyecto' : 'Nuevo proyecto'}
        footer={
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Fotos y videos</p>
              <MediaUploader value={edit.media ?? []} onChange={(m) => set('media', m)} />
            </div>
            <Field label="Título" className="sm:col-span-2">
              <input value={edit.title} onChange={(e) => set('title', e.target.value)} className={input} />
            </Field>
            <Field label="Resumen" className="sm:col-span-2">
              <textarea rows={3} value={edit.summary} onChange={(e) => set('summary', e.target.value)} className={input} />
            </Field>
            <Field label="Categoría">
              <select value={edit.category} onChange={(e) => set('category', e.target.value as Project['category'])} className={input}>
                {PROJECT_CATS.map((c) => (
                  <option key={c} value={c} className="bg-surface">{PROJECT_CAT_LABEL[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Dificultad">
              <select value={edit.difficulty} onChange={(e) => set('difficulty', e.target.value as Project['difficulty'])} className={input}>
                {(['Básico', 'Intermedio', 'Avanzado'] as const).map((d) => (
                  <option key={d} className="bg-surface">{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Precio desde (USD)">
              <input type="number" step="0.01" value={edit.priceFrom || ''} onChange={(e) => set('priceFrom', +e.target.value)} className={input} />
            </Field>
            <Field label="Días estimados">
              <input type="number" value={edit.durationDays} onChange={(e) => set('durationDays', +e.target.value)} className={input} />
            </Field>
            <Field label="Ícono" hint="Se usa si no hay fotos">
              <select value={edit.icon} onChange={(e) => set('icon', e.target.value)} className={input}>
                {ICON_NAMES.map((n) => (
                  <option key={n} className="bg-surface">{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Colores">
              <div className="flex gap-2">
                <input type="color" value={edit.gradient[0]} onChange={(e) => set('gradient', [e.target.value, edit.gradient[1]])} className="h-10 w-12 cursor-pointer rounded bg-transparent" />
                <input type="color" value={edit.gradient[1]} onChange={(e) => set('gradient', [edit.gradient[0], e.target.value])} className="h-10 w-12 cursor-pointer rounded bg-transparent" />
              </div>
            </Field>
            <Field label="Puntos destacados" hint="Uno por línea" className="sm:col-span-2">
              <textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} className={input} />
            </Field>
          </div>
        )}
      </Drawer>
    </>
  )
}

// ───────── Cupones ─────────
export function Coupons() {
  const [list, setList] = useState<Coupon[] | null>(null)
  const [draft, setDraft] = useState<Coupon>({ code: '', percent: 10, description: '', active: true, firstOrderOnly: false })
  const load = () => api.admin.coupons().then(setList)
  useEffect(() => {
    load()
  }, [])

  const save = async (c: Coupon) => {
    try {
      await api.admin.saveCoupon(c)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Cupones" subtitle="Cada cliente puede usar un cupón una sola vez y debe tener sesión iniciada. Los de temporada se anuncian en el banner." />
      <Card className="mb-6 p-5">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!draft.code.trim()) return
            await save(draft)
            toast.success('Cupón creado')
            setDraft({ code: '', percent: 10, description: '', active: true, firstOrderOnly: false })
          }}
          className="grid gap-3 sm:grid-cols-[1fr_120px_2fr_auto_auto] sm:items-end"
        >
          <Field label="Código">
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="VERANO10" className={input + ' font-mono uppercase'} />
          </Field>
          <Field label="% descuento">
            <input type="number" min={1} max={90} value={draft.percent} onChange={(e) => setDraft({ ...draft, percent: +e.target.value })} className={input} />
          </Field>
          <Field label="Descripción">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} />
          </Field>
          <label className="flex items-center gap-2 pb-2.5 text-sm whitespace-nowrap">
            <input type="checkbox" checked={!!draft.firstOrderOnly} onChange={(e) => setDraft({ ...draft, firstOrderOnly: e.target.checked })} className="accent-[var(--primary)]" />
            Solo 1ª compra
          </label>
          <button className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-sm">
            <Plus size={16} /> Crear
          </button>
        </form>
      </Card>
      {!list ? (
        <Skeleton className="h-48" />
      ) : list.length === 0 ? (
        <Empty>No hay cupones.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <Th>Código</Th>
                <Th>Descuento</Th>
                <Th>Descripción</Th>
                <Th>Condición</Th>
                <Th>Usos</Th>
                <Th>Activo</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {list.map((c) => (
                <tr key={c.code}>
                  <Td className="font-mono font-semibold text-primary">{c.code}</Td>
                  <Td>{c.percent}%</Td>
                  <Td className="text-muted">{c.description}</Td>
                  <Td>
                    <button
                      onClick={() => save({ ...c, firstOrderOnly: !c.firstOrderOnly })}
                      className={clsx('rounded-md border px-2 py-0.5 text-xs', c.firstOrderOnly ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
                    >
                      {c.firstOrderOnly ? 'Solo 1ª compra' : 'Cualquier compra'}
                    </button>
                  </Td>
                  <Td className="font-mono">{c.uses ?? 0}</Td>
                  <Td>
                    <div className="w-12">
                      <Toggle checked={c.active !== false} onChange={(v) => save({ ...c, active: v })} label="" />
                    </div>
                  </Td>
                  <Td className="text-right">
                    <ConfirmButton
                      onConfirm={async () => {
                        await api.admin.deleteCoupon(c.code)
                        load()
                      }}
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ───────── Clientes ─────────
export function Customers() {
  const [list, setList] = useState<User[] | null>(null)
  const me = useAuth((s) => s.user)
  const load = () => api.admin.users().then(setList)
  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <PageHeader title="Clientes y usuarios" subtitle="Personas registradas en la tienda. Puedes dar acceso de administrador." />
      {!list ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <Th>Nombre</Th>
                <Th>Contacto</Th>
                <Th>Ciudad</Th>
                <Th>Registro</Th>
                <Th>Rol</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {list.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', u.role === 'admin' ? 'bg-primary text-black' : 'bg-white/10')}>{u.name[0]}</span>
                      {u.name}
                    </span>
                  </Td>
                  <Td className="text-muted">
                    {u.email}
                    {u.phone && <span className="block text-xs">{u.phone}</span>}
                  </Td>
                  <Td className="text-muted">{u.city ?? '—'}</Td>
                  <Td className="text-muted">{fmtDate(u.createdAt)}</Td>
                  <Td>
                    <select
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={async (e) => {
                        try {
                          await api.admin.setUserRole(u.id, e.target.value as Role)
                          toast.success('Rol actualizado')
                          load()
                        } catch (err) {
                          toast.error((err as Error).message)
                        }
                      }}
                      className={input + ' w-auto py-1.5 disabled:opacity-50'}
                    >
                      <option value="cliente" className="bg-surface">Cliente</option>
                      <option value="admin" className="bg-surface">Administrador</option>
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
