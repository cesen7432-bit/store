import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'

export const input =
  'w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-primary'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-4 text-left">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className={clsx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-white/15')} role="switch" aria-checked={checked}>
        <motion.span layout className={clsx('absolute top-1 h-4 w-4 rounded-full bg-white', checked ? 'right-1' : 'left-1')} />
      </span>
    </button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-lg border border-white/10 bg-surface', className)}>{children}</div>
}

/** Panel lateral para formularios y detalles */
export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className={clsx('fixed top-0 right-0 z-[61] flex h-full w-full flex-col border-l border-white/10 bg-bg', wide ? 'max-w-3xl' : 'max-w-lg')}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-md p-2 hover:bg-white/5" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/** Botón que pide confirmación con un segundo clic (evita borrados accidentales) */
export function ConfirmButton({ onConfirm, children, className }: { onConfirm: () => Promise<void> | void; children: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      onClick={async () => {
        if (!armed) return setArmed(true)
        setBusy(true)
        await onConfirm()
        setBusy(false)
        setArmed(false)
      }}
      className={clsx('rounded-md px-3 py-2 text-sm transition', armed ? 'bg-red-500 text-white' : 'text-muted hover:bg-red-500/10 hover:text-red-300', className)}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : armed ? '¿Seguro? Clic de nuevo' : children}
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-white/15 py-16 text-center text-muted">{children}</div>
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx('px-4 py-3 text-left text-xs font-medium tracking-wider text-muted uppercase', className)}>{children}</th>
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 align-middle', className)}>{children}</td>
}
