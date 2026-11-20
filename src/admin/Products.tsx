import { FileSpreadsheet, ImagePlus, Loader2, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import clsx from 'clsx'
import { Icon, ICON_NAMES } from '../components/ui/Icon'
import { ProductArt } from '../components/ui/ProductArt'
import { Skeleton } from '../components/ui/misc'
import { SEASONS } from '../config/seasons'
import { formatPrice, mediaUrl } from '../config/store'
import { CATEGORIES } from '../data/mock'
import { api } from '../services/api'
import type { CategoryId, Product } from '../types'
import { ConfirmButton, Drawer, Empty, Field, input, PageHeader, Td, Th, Toggle } from './ui'
import { ImportProducts } from './ImportProducts'

const EMPTY: Product = {
  id: '',
  slug: '',
  name: '',
  category: 'electronica',
  subcategory: CATEGORIES[0].subcategories[0],
  shortDescription: '',
  description: '',
  price: 0,
  rating: 0,
  reviews: 0,
  stock: 10,
  tags: [],
  images: [],
  icon: 'cpu',
  gradient: ['#ff5b23', '#ffa53d'],
  specs: {},
}

export default function Products() {
  const [list, setList] = useState<Product[] | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | ''>('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [params, setParams] = useSearchParams()

  const load = () => api.getProducts().then(setList)
  useEffect(() => {
    load()
  }, [])

  // abrir directamente desde ?editar=id (p. ej. desde "stock bajo")
  useEffect(() => {
    const id = params.get('editar')
    if (id && list) {
      const p = list.find((x) => x.id === id)
      if (p) setEditing(p)
      setParams({}, { replace: true })
    }
  }, [params, list, setParams])

  const filtered = useMemo(() => {
    const term = q.toLowerCase()
    return (list ?? []).filter((p) => (!cat || p.category === cat) && (!term || p.name.toLowerCase().includes(term) || p.sku?.toLowerCase().includes(term)))
  }, [list, q, cat])

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={list ? `${list.length} productos en el catálogo` : undefined}
        actions={
          <>
            <button onClick={() => setImportOpen(true)} className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm">
              <FileSpreadsheet size={16} /> Importar Excel
            </button>
            <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
              <Plus size={16} /> Nuevo producto
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3">
          <Search size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o SKU…" className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value as CategoryId | '')} className={input + ' w-auto'}>
          <option value="" className="bg-surface">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id} className="bg-surface">{c.name}</option>
          ))}
        </select>
      </div>

      {!list ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <Empty>No hay productos con ese filtro.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Stock</Th>
                <Th>Etiquetas</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <button onClick={() => setEditing(p)} className="flex items-center gap-3 text-left">
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-md">
                        <ProductArt image={p.images[0]} icon={p.icon} gradient={p.gradient} iconSize={20} />
                      </span>
                      <span>
                        <span className="block font-medium hover:text-primary">{p.name}</span>
                        <span className="text-xs text-muted">
                          {p.sku && <span className="mr-2 font-mono">{p.sku}</span>}
                          {p.subcategory}
                        </span>
                      </span>
                    </button>
                  </Td>
                  <Td className="text-muted">{CATEGORIES.find((c) => c.id === p.category)?.name}</Td>
                  <Td className="text-right">
                    <span className="font-semibold">{formatPrice(p.price)}</span>
                    {p.oldPrice && <span className="block text-xs text-muted line-through">{formatPrice(p.oldPrice)}</span>}
                  </Td>
                  <Td className={clsx('text-right font-mono', p.stock >= 999 ? 'text-muted' : p.stock < 10 ? 'text-red-300' : p.stock < 20 ? 'text-amber-300' : '')}>
                    {p.stock >= 999 ? 'Bajo pedido' : p.stock}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {p.featured && <Tag>Destacado</Tag>}
                      {p.isNew && <Tag>Nuevo</Tag>}
                      {p.customizable && <Tag>Personalizable</Tag>}
                      {p.seasons?.map((s) => <Tag key={s}>{SEASONS.find((x) => x.id === s)?.emoji} {SEASONS.find((x) => x.id === s)?.name}</Tag>)}
                    </div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => setEditing(p)} className="rounded-md p-2 text-muted hover:bg-white/5 hover:text-fg" aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <ConfirmButton
                      onConfirm={async () => {
                        await api.admin.deleteProduct(p.id)
                        toast.success('Producto eliminado')
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

      <ImportProducts
        open={importOpen}
        existing={list ?? []}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          load()
        }}
      />

      <ProductForm
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-muted">{children}</span>
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<Product>(EMPTY)
  const [tags, setTags] = useState('')
  const [specs, setSpecs] = useState<[string, string][]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)

  useEffect(() => {
    if (!product) return
    setP(structuredClone(product))
    setTags(product.tags.join(', '))
    setSpecs(Object.entries(product.specs))
  }, [product])

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const category = CATEGORIES.find((c) => c.id === p.category)!

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(Array.from(files).map((f) => api.admin.uploadImage(f)))
      setP((x) => ({ ...x, images: [...x.images, ...urls] }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!p.name.trim()) return toast.error('El nombre es obligatorio')
    if (p.price <= 0) return toast.error('El precio debe ser mayor a 0')
    setSaving(true)
    try {
      await api.admin.saveProduct({
        ...p,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        specs: Object.fromEntries(specs.filter(([k]) => k.trim())),
        oldPrice: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : undefined,
      })
      toast.success(p.id ? 'Producto actualizado' : 'Producto creado')
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!product}
      onClose={onClose}
      wide
      title={product?.id ? 'Editar producto' : 'Nuevo producto'}
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-4 py-2.5 text-sm text-muted hover:bg-white/5">Cancelar</button>
          <button onClick={() => save()} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-70">
            {saving && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-8">
        {/* Imágenes */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Fotos</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {p.images.map((src, i) => (
              <div key={i} className={clsx('group relative aspect-square overflow-hidden rounded-md border', i === 0 ? 'border-primary' : 'border-white/10')}>
                <img src={mediaUrl(src)} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 rounded bg-primary px-1.5 text-[10px] font-bold text-black">PRINCIPAL</span>}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition group-hover:opacity-100">
                  {i > 0 && (
                    <button type="button" title="Usar como principal" onClick={() => set('images', [src, ...p.images.filter((_, k) => k !== i)])} className="rounded bg-white/10 p-1.5 hover:bg-white/20">
                      <Star size={14} />
                    </button>
                  )}
                  <button type="button" title="Quitar" onClick={() => set('images', p.images.filter((_, k) => k !== i))} className="rounded bg-white/10 p-1.5 hover:bg-red-500">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                upload(e.dataTransfer.files)
              }}
              className={clsx(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted transition',
                drag ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-primary/60',
              )}
            >
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              {uploading ? 'Subiendo…' : 'Agregar'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
          {p.images.length === 0 && (
            <div className="mt-4 flex items-center gap-4 rounded-md bg-white/[0.03] p-3">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md">
                <ProductArt icon={p.icon} gradient={p.gradient} iconSize={26} />
              </span>
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]">
                <p className="text-xs text-muted sm:col-span-2">Sin fotos se muestra esta ilustración. Elige ícono y colores:</p>
                <select value={p.icon} onChange={(e) => set('icon', e.target.value)} className={input}>
                  {ICON_NAMES.map((n) => (
                    <option key={n} value={n} className="bg-surface">{n}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Icon name={p.icon} size={18} />
                  <input type="color" value={p.gradient[0]} onChange={(e) => set('gradient', [e.target.value, p.gradient[1]])} className="h-9 w-9 cursor-pointer rounded bg-transparent" />
                  <input type="color" value={p.gradient[1]} onChange={(e) => set('gradient', [p.gradient[0], e.target.value])} className="h-9 w-9 cursor-pointer rounded bg-transparent" />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Datos básicos */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input required value={p.name} onChange={(e) => set('name', e.target.value)} className={input} />
          </Field>
          <Field label="SKU" hint="Código de inventario (se usa al importar desde Excel)">
            <input value={p.sku ?? ''} onChange={(e) => set('sku', e.target.value || undefined)} className={input + ' font-mono uppercase'} />
          </Field>
          <Field label="Categoría">
            <select
              value={p.category}
              onChange={(e) => {
                const c = CATEGORIES.find((x) => x.id === e.target.value)!
                setP((x) => ({ ...x, category: c.id, subcategory: c.subcategories[0] }))
              }}
              className={input}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface">{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Subcategoría">
            <select value={p.subcategory} onChange={(e) => set('subcategory', e.target.value)} className={input}>
              {category.subcategories.map((s) => (
                <option key={s} value={s} className="bg-surface">{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Descripción corta" hint="Se ve en las tarjetas del catálogo" className="sm:col-span-2">
            <input value={p.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} className={input} />
          </Field>
          <Field label="Descripción completa" className="sm:col-span-2">
            <textarea rows={4} value={p.description} onChange={(e) => set('description', e.target.value)} className={input} />
          </Field>
        </section>

        {/* Precio y stock */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Precio (USD)">
            <input type="number" step="0.01" min="0" value={p.price || ''} onChange={(e) => set('price', +e.target.value)} className={input} />
          </Field>
          <Field label="Precio anterior" hint="Opcional: muestra el descuento">
            <input type="number" step="0.01" min="0" value={p.oldPrice ?? ''} onChange={(e) => set('oldPrice', e.target.value ? +e.target.value : undefined)} className={input} />
          </Field>
          <Field label="Stock" hint="999 = fabricado bajo pedido">
            <input type="number" min="0" value={p.stock} onChange={(e) => set('stock', +e.target.value)} className={input} />
          </Field>
        </section>

        {/* Especificaciones */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Especificaciones técnicas</h3>
          <div className="space-y-2">
            {specs.map(([k, v], i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Ej: Voltaje" value={k} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} className={input} />
                <input placeholder="Ej: 5V" value={v} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} className={input} />
                <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted hover:text-red-300" aria-label="Quitar">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setSpecs([...specs, ['', '']])} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus size={14} /> Agregar especificación
            </button>
          </div>
        </section>

        {/* Visibilidad */}
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <Toggle checked={!!p.featured} onChange={(v) => set('featured', v)} label="Destacado" description="Aparece en el inicio" />
            <Toggle checked={!!p.isNew} onChange={(v) => set('isNew', v)} label="Nuevo" description="Muestra la etiqueta Nuevo" />
            <Toggle checked={!!p.customizable} onChange={(v) => set('customizable', v)} label="Personalizable" description="El cliente puede escribir su texto/diseño" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Destacar en temporada</p>
            <div className="flex flex-wrap gap-2">
              {SEASONS.filter((s) => s.id !== 'default').map((s) => {
                const on = p.seasons?.includes(s.id)
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => set('seasons', on ? p.seasons!.filter((x) => x !== s.id) : [...(p.seasons ?? []), s.id])}
                    className={clsx('rounded-md border px-2.5 py-1.5 text-xs transition', on ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
                  >
                    {s.emoji} {s.name}
                  </button>
                )
              })}
            </div>
            <Field label="Etiquetas de búsqueda" hint="Separadas por coma" className="mt-4">
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="arduino, wifi, regalo" className={input} />
            </Field>
          </div>
        </section>
      </form>
    </Drawer>
  )
}
