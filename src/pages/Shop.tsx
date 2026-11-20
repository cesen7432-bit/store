/**
 * Catálogo. Se cargan los productos de la categoría UNA vez y búsqueda, filtros
 * y orden se aplican en el navegador (instantáneo). Se muestran por bloques de 24
 * y se cargan más al acercarse al final.
 */
import { ChevronRight, PackageSearch, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ProductCard } from '../components/product/ProductCard'
import { Skeleton } from '../components/ui/misc'
import { useSeason } from '../context/SeasonContext'
import { CATEGORIES } from '../data/mock'
import { api } from '../services/api'
import type { CategoryId, Product } from '../types'
import { useAsync } from '../utils/useAsync'

type Sort = 'relevancia' | 'precio-asc' | 'precio-desc' | 'nombre' | 'nuevos'
const SORTS: { v: Sort; l: string }[] = [
  { v: 'relevancia', l: 'Destacados' },
  { v: 'precio-asc', l: 'Menor precio' },
  { v: 'precio-desc', l: 'Mayor precio' },
  { v: 'nombre', l: 'Nombre (A–Z)' },
  { v: 'nuevos', l: 'Novedades' },
]
const PAGE = 24

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const available = (p: Product) => (p.stock > 0 ? 0 : 1)

export default function Shop() {
  const { category } = useParams<{ category?: CategoryId }>()
  const [params, setParams] = useSearchParams()
  const { season } = useSeason()
  const search = params.get('q') ?? ''
  const sub = params.get('sub') ?? ''
  const sort = (params.get('sort') as Sort) || 'relevancia'
  const onlySeason = params.get('temporada') === '1'
  const [term, setTerm] = useState(search)
  const [visible, setVisible] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  const cat = CATEGORIES.find((c) => c.id === category)
  const { data: all, loading } = useAsync(() => api.getProducts(category ? { category } : {}), [category])

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    setTerm(search)
  }, [search])
  // búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => term !== search && update('q', term.trim() || null), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  // productos que cumplen búsqueda + temporada (antes de la subcategoría, para los contadores)
  const base = useMemo(() => {
    let list = all ?? []
    if (onlySeason) list = list.filter((p) => p.seasons?.includes(season.id))
    if (search) {
      const words = norm(search).split(/\s+/).filter(Boolean)
      list = list.filter((p) => {
        const hay = norm([p.name, p.sku ?? '', p.subcategory, p.shortDescription, ...p.tags].join(' '))
        return words.every((w) => hay.includes(w))
      })
    }
    return list
  }, [all, onlySeason, season.id, search])

  const subCounts = useMemo(() => base.reduce<Record<string, number>>((m, p) => ((m[p.subcategory] = (m[p.subcategory] ?? 0) + 1), m), {}), [base])

  const results = useMemo(() => {
    const list = sub ? base.filter((p) => p.subcategory === sub) : [...base]
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      relevancia: (a, b) => available(a) - available(b) || Number(!!b.featured) - Number(!!a.featured),
      'precio-asc': (a, b) => available(a) - available(b) || a.price - b.price,
      'precio-desc': (a, b) => available(a) - available(b) || b.price - a.price,
      nombre: (a, b) => a.name.localeCompare(b.name, 'es'),
      nuevos: (a, b) => Number(!!b.isNew) - Number(!!a.isNew),
    }
    return list.sort(by[sort] ?? by.relevancia)
  }, [base, sub, sort])

  // al cambiar filtros se vuelve al primer bloque
  useEffect(() => setVisible(PAGE), [category, sub, search, sort, onlySeason])

  // carga automática del siguiente bloque al acercarse al final
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible((v) => v + PAGE), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [results.length, visible])

  const hasSeasonal = (all ?? []).some((p) => p.seasons?.includes(season.id))
  const subcats = cat ? cat.subcategories.filter((s) => subCounts[s]) : []
  const filtersKey = `${category}|${sub}|${search}|${sort}|${onlySeason}`

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 md:px-6">
      {/* Encabezado compacto */}
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted">
        <Link to="/" className="hover:text-fg">Inicio</Link>
        <ChevronRight size={14} />
        {cat ? (
          <>
            <Link to="/tienda" className="hover:text-fg">Tienda</Link>
            <ChevronRight size={14} />
            <span className="text-fg">{cat.name}</span>
          </>
        ) : (
          <span className="text-fg">Tienda</span>
        )}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{cat?.name ?? 'Toda la tienda'}</h1>
          <p className="mt-1 text-muted">{cat?.description ?? 'Electrónica, corte láser y proyectos en un solo lugar.'}</p>
        </div>
        {/* categorías */}
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02] p-1 text-sm">
          {[{ id: undefined as CategoryId | undefined, name: 'Todo' }, ...CATEGORIES].map((c) => (
            <Link
              key={c.name}
              to={(c.id ? `/tienda/${c.id}` : '/tienda') + (search ? `?q=${encodeURIComponent(search)}` : '')}
              className={clsx('shrink-0 rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition', c.id === category ? 'bg-white/10 text-fg' : 'text-muted hover:text-fg')}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Barra fija: búsqueda y orden */}
      <div className="sticky top-[64px] z-30 -mx-4 mt-6 border-y border-white/[0.06] bg-bg/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-lg border border-white/10 bg-black/30 px-3.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search size={17} className="text-muted" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Buscar en ${cat?.name.toLowerCase() ?? 'la tienda'}…`}
              className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70"
            />
            {term && (
              <button onClick={() => setTerm('')} className="rounded p-0.5 text-muted hover:text-fg" aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => update('sort', e.target.value === 'relevancia' ? null : e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-primary"
            aria-label="Ordenar"
          >
            {SORTS.map((s) => (
              <option key={s.v} value={s.v} className="bg-surface">{s.l}</option>
            ))}
          </select>
          {season.id !== 'default' && hasSeasonal && (
            <button
              onClick={() => update('temporada', onlySeason ? null : '1')}
              className={clsx('rounded-lg border px-3 py-2.5 text-sm transition', onlySeason ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
            >
              {season.emoji} {season.name}
            </button>
          )}
        </div>

        {/* subcategorías en móvil */}
        {cat && subcats.length > 0 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto lg:hidden">
            <Chip active={!sub} onClick={() => update('sub', null)} label="Todas" count={base.length} />
            {subcats.map((s) => (
              <Chip key={s} active={sub === s} onClick={() => update('sub', sub === s ? null : s)} label={s} count={subCounts[s]} />
            ))}
          </div>
        )}
      </div>

      <div className={clsx('mt-6 grid gap-8', cat && 'lg:grid-cols-[210px_1fr]')}>
        {/* subcategorías en escritorio */}
        {cat && (
          <aside className="hidden lg:block">
            <div className="sticky top-[140px]">
              <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted uppercase">Subcategorías</p>
              <ul className="space-y-0.5">
                <SideItem active={!sub} onClick={() => update('sub', null)} label="Todas" count={base.length} />
                {cat.subcategories.map((s) => (
                  <SideItem key={s} active={sub === s} disabled={!subCounts[s]} onClick={() => update('sub', s)} label={s} count={subCounts[s] ?? 0} />
                ))}
              </ul>
            </div>
          </aside>
        )}

        <section>
          {/* resumen + filtros activos */}
          <div className="mb-4 flex min-h-[28px] flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">
              {loading ? 'Cargando productos…' : `${results.length} ${results.length === 1 ? 'producto' : 'productos'}`}
            </span>
            {search && <ActiveFilter label={`“${search}”`} onClear={() => setTerm('')} />}
            {sub && <ActiveFilter label={sub} onClear={() => update('sub', null)} />}
            {onlySeason && <ActiveFilter label={season.name} onClear={() => update('temporada', null)} />}
            {(search || sub || onlySeason) && (
              <button
                onClick={() => {
                  setTerm('')
                  setParams({}, { replace: true })
                }}
                className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {loading ? (
            <div className={clsx('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3', cat ? 'xl:grid-cols-3 2xl:grid-cols-4' : 'lg:grid-cols-4')}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-white/[0.06]">
                  <Skeleton className="aspect-[4/3] rounded-none" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="card-in flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/15 py-20 text-center">
              <PackageSearch size={44} className="text-muted" />
              <p className="text-lg font-semibold">{(all ?? []).length === 0 ? 'Pronto agregaremos productos aquí' : 'No encontramos productos'}</p>
              <p className="max-w-sm text-sm text-muted">
                {search ? 'Prueba con otra palabra o revisa la ortografía. ' : ''}
                ¿Buscas algo específico?{' '}
                <Link to="/cotizar" className="text-primary hover:underline">Cotízalo con nosotros</Link>.
              </p>
            </div>
          ) : (
            <>
              <div key={filtersKey} className={clsx('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3', cat ? 'xl:grid-cols-3 2xl:grid-cols-4' : 'lg:grid-cols-4')}>
                {results.slice(0, visible).map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
              {visible < results.length && (
                <div ref={sentinel} className="mt-10 flex justify-center">
                  <button onClick={() => setVisible((v) => v + PAGE)} className="btn-ghost px-6 py-2.5 text-sm">
                    Ver más productos ({results.length - visible})
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'shrink-0 rounded-full border px-3 py-1.5 text-sm transition',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg',
      )}
    >
      {label} <span className="ml-0.5 text-xs opacity-60">{count}</span>
    </button>
  )
}

function SideItem({ active, disabled, onClick, label, count }: { active: boolean; disabled?: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'relative flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition',
          active ? 'bg-white/[0.06] font-medium text-fg' : 'text-muted hover:bg-white/[0.03] hover:text-fg',
          disabled && 'pointer-events-none opacity-35',
        )}
      >
        {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded bg-primary" />}
        {label}
        <span className="text-xs tabular-nums opacity-60">{count}</span>
      </button>
    </li>
  )
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pr-1 pl-2.5 text-xs">
      {label}
      <button onClick={onClear} className="rounded-full p-0.5 text-muted hover:bg-white/10 hover:text-fg" aria-label={`Quitar ${label}`}>
        <X size={12} />
      </button>
    </span>
  )
}
