import { AnimatePresence, motion } from 'framer-motion'
import { Bot, CheckCircle2, FileUp, Loader2, Scissors, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import clsx from 'clsx'
import { SectionTitle } from '../components/ui/misc'
import { MATERIALS } from '../data/mock'
import { formatPrice } from '../config/store'
import { api } from '../services/api'
import { withLaser } from '../store/laser'
import type { QuoteRequest, QuoteResponse } from '../types'

const TYPES = [
  { id: 'corte-laser', label: 'Corte / grabado láser', icon: Scissors },
  { id: 'letrero', label: 'Letrero neón / acrílico', icon: Sparkles },
  { id: 'proyecto', label: 'Proyecto electrónico', icon: Bot },
] as const

const input = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white/[0.07]'

export default function Quote() {
  const [params] = useSearchParams()
  const initialType = (TYPES.find((t) => t.id === params.get('tipo'))?.id ?? 'corte-laser') as QuoteRequest['type']
  const [form, setForm] = useState<QuoteRequest>({
    name: '',
    email: '',
    phone: '',
    type: initialType,
    material: 'acrilico-3',
    width: 30,
    height: 20,
    quantity: 1,
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QuoteResponse | null>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const pickFile = (f?: File | null) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return toast.error('El archivo supera 20 MB')
    setFile(f)
    set('fileName', f.name)
  }

  const set = <K extends keyof QuoteRequest>(k: K, v: QuoteRequest[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Estimación en vivo (misma fórmula que el mock; el backend tendrá la oficial)
  const live = useMemo(() => {
    const mat = MATERIALS.find((m) => m.id === form.material)
    const base = form.type === 'proyecto' ? 65 : form.type === 'letrero' ? 30 : 4
    return Math.round((base + (form.width ?? 0) * (form.height ?? 0) * (mat?.pricePerCm2 ?? 0.004) * (form.quantity ?? 1)) * 100) / 100
  }, [form])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    let res
    try {
      res = await withLaser(() => api.requestQuote(form, file ?? undefined), { label: 'Enviando tu cotización…', done: '¡Cotización enviada!' })
    } catch (err) {
      setLoading(false)
      return toast.error((err as Error).message)
    }
    setLoading(false)
    setResult(res)
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <SectionTitle
        eyebrow="Cotizador"
        title={<>Cotiza tu idea <span className="text-gradient">en segundos</span></>}
        subtitle="Sube tu archivo, elige material y medidas, y obtén un precio estimado al instante."
      />

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-animated mx-auto max-w-lg rounded-xl bg-surface p-10 text-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
              <CheckCircle2 size={72} className="mx-auto text-primary" />
            </motion.div>
            <h2 className="mt-6 font-display text-3xl font-bold">¡Cotización enviada!</h2>
            <p className="mt-2 text-muted">{result.message}</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="glass rounded-lg p-4">
                <p className="text-xs text-muted">Precio estimado</p>
                <p className="font-display text-2xl font-bold text-primary">{formatPrice(result.estimatedPrice)}</p>
              </div>
              <div className="glass rounded-lg p-4">
                <p className="text-xs text-muted">Tiempo estimado</p>
                <p className="font-display text-2xl font-bold">{result.estimatedDays} días</p>
              </div>
            </div>
            <p className="mt-6 font-mono text-sm text-muted">Referencia: {result.id}</p>
            <button onClick={() => setResult(null)} className="mt-6 text-sm text-primary underline">Hacer otra cotización</button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {/* Tipo */}
              <div className="grid gap-3 sm:grid-cols-3">
                {TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => set('type', t.id)}
                    className={clsx(
                      'flex flex-col items-center gap-2 rounded-lg border p-5 text-sm font-medium transition',
                      form.type === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:border-white/30',
                    )}
                  >
                    <t.icon size={26} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Archivo */}
              <label
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  pickFile(e.dataTransfer.files[0])
                }}
                className={clsx(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition',
                  dragging ? 'scale-[1.02] border-primary bg-primary/10' : 'border-white/15 hover:border-primary/50',
                )}
              >
                <motion.div animate={{ y: dragging ? -6 : 0 }}>
                  <FileUp size={40} className="text-primary" />
                </motion.div>
                {form.fileName ? (
                  <p className="font-semibold text-primary">{form.fileName}</p>
                ) : (
                  <>
                    <p className="font-semibold">Arrastra tu diseño aquí o haz clic</p>
                    <p className="text-sm text-muted">SVG, DXF, AI, PDF, PNG · máx. 20MB (opcional)</p>
                  </>
                )}
                <input type="file" className="hidden" accept=".svg,.dxf,.ai,.pdf,.png,.jpg,.jpeg,.webp,.cdr,.eps" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>

              {form.type !== 'proyecto' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Material</label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {MATERIALS.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => set('material', m.id)}
                          className={clsx('rounded-xl border px-3 py-2.5 text-sm transition', form.material === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 text-muted hover:text-fg')}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label={`Ancho: ${form.width} cm`}>
                    <input type="range" min={5} max={120} value={form.width} onChange={(e) => set('width', +e.target.value)} className="w-full accent-[var(--primary)]" />
                  </Field>
                  <Field label={`Alto: ${form.height} cm`}>
                    <input type="range" min={5} max={120} value={form.height} onChange={(e) => set('height', +e.target.value)} className="w-full accent-[var(--primary)]" />
                  </Field>
                  <Field label="Cantidad">
                    <input type="number" min={1} value={form.quantity} onChange={(e) => set('quantity', Math.max(1, +e.target.value))} className={input} />
                  </Field>
                </div>
              )}

              <Field label="Describe tu idea">
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={form.type === 'proyecto' ? 'Ej: Necesito un sistema que encienda las luces del local con el celular…' : 'Ej: Letrero con el nombre "Café Luna" en neón cálido…'}
                  className={input}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nombre"><input required value={form.name} onChange={(e) => set('name', e.target.value)} className={input} /></Field>
                <Field label="Correo"><input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={input} /></Field>
                <Field label="WhatsApp"><input required value={form.phone} onChange={(e) => set('phone', e.target.value)} className={input} /></Field>
              </div>
            </div>

            {/* Resumen en vivo */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="border-animated rounded-xl bg-surface p-6">
                <p className="text-sm text-muted">Precio estimado</p>
                <motion.p key={live} initial={{ opacity: 0.4, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-gradient font-display text-4xl font-bold">
                  {formatPrice(live)}
                </motion.p>
                {form.type !== 'proyecto' && (
                  <div className="my-6 flex h-52 items-center justify-center">
                    {/* vista previa proporcional de la pieza */}
                    <motion.div
                      animate={(() => {
                        const w = form.width ?? 1, h = form.height ?? 1, k = 170 / Math.max(w, h)
                        return { width: w * k, height: h * k }
                      })()}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className="relative rounded-lg border border-dashed border-primary"
                      style={{ background: 'color-mix(in oklab, var(--primary) 10%, transparent)', maxWidth: 220, maxHeight: 220 }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-muted">{form.width} cm</span>
                      <span className="absolute top-1/2 -right-9 -translate-y-1/2 text-[10px] text-muted">{form.height} cm</span>
                    </motion.div>
                  </div>
                )}
                <ul className="space-y-2 text-sm text-muted">
                  <li>• Precio final sujeto a revisión del diseño</li>
                  <li>• Respuesta en menos de 24 horas</li>
                  <li>• Diseño gráfico disponible</li>
                </ul>
                <button disabled={loading} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-4 disabled:opacity-70">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Enviando…</> : 'Solicitar cotización'}
                </button>
              </div>
            </aside>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
