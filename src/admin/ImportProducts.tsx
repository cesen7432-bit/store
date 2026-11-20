/**
 * Importar productos desde Excel (p. ej. la exportación "Stock disponible" del inventario).
 * El archivo se lee en el navegador, se muestra una vista previa editable y luego se envía al backend.
 * Columnas reconocidas (sin importar mayúsculas/tildes): SKU, Producto/Nombre, Disponible/Stock/Cantidad, Precio Base/Precio/PVP.
 */
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { formatPrice } from '../config/store'
import { CATEGORIES } from '../data/mock'
import { api } from '../services/api'
import type { CategoryId, Product, ProductImportItem } from '../types'
import { Drawer, Field, input, Toggle } from './ui'

type RowStatus = 'nuevo' | 'actualizar' | 'error'
interface Row {
  line: number
  sku: string
  name: string
  stock: number
  basePrice: number
  subcategory: string
  status: RowStatus
  error?: string
}

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

const COLS = {
  sku: ['sku', 'codigo', 'código', 'cod'],
  name: ['producto', 'nombre', 'descripcion', 'item'],
  stock: ['disponible', 'stock', 'cantidad', 'existencia'],
  price: ['precio base', 'precio', 'pvp', 'precio venta', 'precio unitario'],
}

/** Sugerencia de subcategoría por palabras del nombre (el admin puede cambiarla) */
const RULES: [RegExp, string][] = [
  // el tipo de pieza manda sobre la placa con la que se usa ("Pantalla Raspberry Pi" es un módulo)
  [/shield|m[oó]dulo|pantalla|display|\blcd\b|oled|programador|teclado|\bcontrolador|amplificador|convertidor|volt[ií]metro|amper[ií]metro/i, 'Módulos'],
  [/rueda|llanta|ventilador|h[eé]lice|bater[ií]a|broche|conector|cable|jumper|chasis|tornillo/i, 'Componentes'],
  [/arduino|esp32|esp8266|\bchip\b|raspberry|atmega|attiny|stm32|microcontrol|nodemcu|wemos|\bnano\b/i, 'Microcontroladores'],
  [/sensor|hc-?sr|dht|\bpir\b|mq-?\d|ultras[oó]nic|\bldr\b|fotorresist|aceler[oó]metro|giroscop|mpu-?\d|bmp\d|bme\d|galga|medidor/i, 'Sensores'],
  [/\bleds?\b|neopixel|ws2812|tira led/i, 'Iluminación LED'],
  [/caut[ií]n|mult[ií]metro|pinza|soldad|esta[ñn]o|destornill|alicate|herramient/i, 'Herramientas'],
  [/control remoto|lora|gateway|bluetooth|rfid|nfc|gps|driver|rel[eé]|servo|motor|receptor|ethernet|memoria/i, 'Módulos'],
]
const guessSub = (name: string) => RULES.find(([re]) => re.test(name))?.[1] ?? 'Componentes'

const num = (v: unknown) => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[$\s]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function ImportProducts({ open, onClose, onImported, existing }: { open: boolean; onClose: () => void; onImported: () => void; existing: Product[] }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [margin, setMargin] = useState(0)
  const [category, setCategory] = useState<CategoryId>('electronica')
  const [updateExisting, setUpdateExisting] = useState(true)
  const [filter, setFilter] = useState<RowStatus | ''>('')
  const [drag, setDrag] = useState(false)

  const subcats = CATEGORIES.find((c) => c.id === category)!.subcategories
  const skus = useMemo(() => new Set(existing.map((p) => p.sku?.toUpperCase()).filter(Boolean)), [existing])
  const salePrice = (base: number) => Math.round(base * (1 + margin / 100) * 100) / 100

  const reset = () => {
    setRows([])
    setFileName('')
    setFilter('')
  }

  const read = async (file?: File) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) return toast.error('Sube un archivo Excel .xlsx')
    setParsing(true)
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const data = (await readSheet(file)) as unknown[][]
      // fila de encabezados: la primera que tenga SKU y Producto/Nombre
      const headerIdx = data.findIndex((r) => r.some((c) => COLS.sku.includes(norm(c))) && r.some((c) => COLS.name.includes(norm(c))))
      if (headerIdx < 0) throw new Error('No encontré las columnas "SKU" y "Producto" en el archivo')
      const header = data[headerIdx].map(norm)
      const col = (keys: string[]) => header.findIndex((h) => keys.includes(h))
      const ci = { sku: col(COLS.sku), name: col(COLS.name), stock: col(COLS.stock), price: col(COLS.price) }
      if (ci.price < 0) throw new Error('No encontré la columna de precio ("Precio Base" o "Precio")')

      const seen = new Set<string>()
      const parsed: Row[] = []
      data.slice(headerIdx + 1).forEach((r, k) => {
        const sku = String(r[ci.sku] ?? '').trim()
        const name = String(r[ci.name] ?? '').trim()
        if (!sku && !name) return // filas vacías o de totales
        const stockRaw = ci.stock >= 0 ? num(r[ci.stock]) : 0
        const basePrice = num(r[ci.price])
        const row: Row = {
          line: headerIdx + k + 2,
          sku,
          name,
          stock: Number.isFinite(stockRaw) ? Math.max(0, Math.round(stockRaw)) : 0,
          basePrice,
          subcategory: guessSub(name),
          status: skus.has(sku.toUpperCase()) ? 'actualizar' : 'nuevo',
        }
        if (!sku) Object.assign(row, { status: 'error', error: 'Sin SKU' })
        else if (!name) Object.assign(row, { status: 'error', error: 'Sin nombre' })
        else if (!(basePrice > 0)) Object.assign(row, { status: 'error', error: 'Precio inválido' })
        else if (seen.has(sku.toUpperCase())) Object.assign(row, { status: 'error', error: 'SKU repetido en el archivo' })
        seen.add(sku.toUpperCase())
        parsed.push(row)
      })
      if (!parsed.length) throw new Error('El archivo no tiene filas de productos')
      setRows(parsed)
      setFileName(file.name)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const counts = useMemo(() => rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}), [rows])
  const valid = rows.filter((r) => r.status !== 'error' && (updateExisting || r.status === 'nuevo'))
  const shown = rows.filter((r) => !filter || r.status === filter)

  const doImport = async () => {
    if (!valid.length) return
    setImporting(true)
    try {
      const items: ProductImportItem[] = valid.map((r) => ({
        sku: r.sku,
        name: r.name,
        stock: r.stock,
        price: salePrice(r.basePrice),
        category,
        subcategory: r.subcategory,
      }))
      const res = await api.admin.importProducts(items, updateExisting)
      toast.success(`Importación lista: ${res.created} nuevos, ${res.updated} actualizados${res.skipped ? `, ${res.skipped} omitidos` : ''}`)
      reset()
      onImported()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      wide
      title="Importar productos desde Excel"
      footer={
        rows.length > 0 && (
          <>
            <button onClick={reset} className="rounded-md px-4 py-2.5 text-sm text-muted hover:bg-white/5">
              Elegir otro archivo
            </button>
            <button onClick={doImport} disabled={importing || !valid.length} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importar {valid.length} productos
            </button>
          </>
        )
      }
    >
      {rows.length === 0 ? (
        <div className="space-y-5">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              read(e.dataTransfer.files[0])
            }}
            className={clsx(
              'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition',
              drag ? 'border-primary bg-primary/10' : 'border-white/15 hover:border-primary/60',
            )}
          >
            {parsing ? <Loader2 size={36} className="animate-spin text-primary" /> : <FileSpreadsheet size={36} className="text-primary" />}
            <p className="font-semibold">{parsing ? 'Leyendo archivo…' : 'Arrastra tu Excel aquí o haz clic'}</p>
            <p className="text-sm text-muted">Archivo .xlsx con columnas SKU, Producto, Disponible y Precio Base</p>
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
          </label>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>• El <b className="text-fg">SKU</b> identifica cada producto: si ya existe se actualizan nombre, precio y stock; las fotos y descripciones se conservan.</li>
            <li>• Verás una vista previa para revisar y corregir la subcategoría antes de importar.</li>
            <li>• Las filas vacías y la fila de totales se ignoran.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet size={16} className="text-primary" />
            <span className="font-medium">{fileName}</span>
            <span className="text-muted">· {rows.length} filas</span>
          </div>

          {/* opciones */}
          <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-3">
            <Field label="Categoría" hint="Para todos los productos del archivo">
              <select
                value={category}
                onChange={(e) => {
                  const c = e.target.value as CategoryId
                  setCategory(c)
                  const subs = CATEGORIES.find((x) => x.id === c)!.subcategories
                  setRows((rs) => rs.map((r) => (subs.includes(r.subcategory) ? r : { ...r, subcategory: subs[0] })))
                }}
                className={input}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-surface">{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Margen sobre precio base (%)" hint={margin ? `Ej. ${formatPrice(10)} → ${formatPrice(salePrice(10))}` : 'El precio base se usa como precio de venta'}>
              <input type="number" min={0} max={500} step={1} value={margin} onChange={(e) => setMargin(Math.max(0, +e.target.value || 0))} className={input} />
            </Field>
            <div className="sm:pt-6">
              <Toggle checked={updateExisting} onChange={setUpdateExisting} label="Actualizar existentes" description="Nombre, precio y stock por SKU" />
            </div>
          </div>

          {/* filtros */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['', 'Todas', rows.length],
                ['nuevo', 'Nuevos', counts.nuevo ?? 0],
                ['actualizar', 'Se actualizan', counts.actualizar ?? 0],
                ['error', 'Con errores', counts.error ?? 0],
              ] as const
            ).map(([k, l, n]) => (
              <button
                key={k || 'all'}
                onClick={() => setFilter(k)}
                className={clsx('rounded-md border px-3 py-1.5 text-sm transition', filter === k ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
              >
                {l} <span className="ml-1 text-xs opacity-70">{n}</span>
              </button>
            ))}
          </div>

          {/* vista previa */}
          <div data-lenis-prevent className="max-h-[50vh] overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-left text-xs tracking-wider text-muted uppercase">
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">Producto</th>
                  <th className="px-3 py-2.5 text-right">Stock</th>
                  <th className="px-3 py-2.5 text-right">Precio</th>
                  <th className="px-3 py-2.5">Subcategoría</th>
                  <th className="px-3 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shown.map((r) => (
                  <tr key={r.line} className={clsx(r.status === 'error' && 'bg-red-500/[0.05]')}>
                    <td className="px-3 py-2 font-mono text-xs">{r.sku || '—'}</td>
                    <td className="max-w-[260px] truncate px-3 py-2" title={r.name}>{r.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.stock}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.basePrice > 0 ? (
                        <>
                          {formatPrice(salePrice(r.basePrice))}
                          {margin > 0 && <span className="block text-[11px] text-muted">base {formatPrice(r.basePrice)}</span>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.subcategory}
                        disabled={r.status === 'error'}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.line === r.line ? { ...x, subcategory: e.target.value } : x)))}
                        className="rounded border border-white/10 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-primary"
                      >
                        {subcats.map((s) => (
                          <option key={s} value={s} className="bg-surface">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.status === 'nuevo' && <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 size={12} /> Nuevo</span>}
                      {r.status === 'actualizar' && (
                        <span className={clsx('inline-flex items-center gap-1 text-xs', updateExisting ? 'text-sky-300' : 'text-muted')}>
                          <RefreshCw size={12} /> {updateExisting ? 'Se actualiza' : 'Se omite'}
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-300" title={`Fila ${r.line}`}>
                          <AlertTriangle size={12} /> {r.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(counts.error ?? 0) > 0 && <p className="text-xs text-muted">Las filas con errores no se importan. Corrígelas en el Excel y vuelve a subirlo si las necesitas.</p>}
        </div>
      )}
    </Drawer>
  )
}
