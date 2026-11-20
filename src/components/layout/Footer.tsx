import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { STORE, whatsappLink } from '../../config/store'
import { api } from '../../services/api'
import { Logo } from './Navbar'

export function Footer() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const subscribe = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await api.subscribe(email)
    setLoading(false)
    setEmail('')
    toast.success('¡Listo! Te avisaremos de promociones y novedades.')
  }

  return (
    <footer className="relative mt-24 border-t border-white/10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--primary), var(--secondary), transparent)' }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 md:px-6 lg:grid-cols-12 lg:gap-8">
        {/* Marca */}
        <div className="col-span-2 lg:col-span-4">
          <Logo />
          <p className="mt-5 font-display text-xl leading-snug font-bold">
            Lo imaginas, <span className="text-primary">lo cortamos</span>,
            <br />
            <span className="relative inline-block">
              lo encendemos
              <span className="absolute -bottom-0.5 left-0 h-[3px] w-full bg-primary" />
            </span>
            .
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Electrónica original, corte láser de precisión y proyectos a la medida desde Loja.</p>
        </div>

        <Column title="Tienda" className="lg:col-span-2">
          <FooterLink to="/tienda/electronica">Electrónica</FooterLink>
          <FooterLink to="/tienda/corte-laser">Corte láser</FooterLink>
          <FooterLink to="/tienda/proyectos">Kits</FooterLink>
          <FooterLink to="/tienda">Todo el catálogo</FooterLink>
        </Column>

        <Column title="Servicios" className="lg:col-span-2">
          <FooterLink to="/cotizar">Cotizar corte láser</FooterLink>
          <FooterLink to="/proyectos">Proyectos a medida</FooterLink>
          <FooterLink to="/cotizar">Letreros neón</FooterLink>
          <FooterLink to="/proyectos">Asesoría de tesis</FooterLink>
        </Column>

        {/* Contacto */}
        <Column title="Contacto" className="col-span-2 lg:col-span-4">
          <li className="flex items-center gap-2.5">
            <MapPin size={15} className="shrink-0 text-primary" /> {STORE.city}
          </li>
          <li className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <Phone size={15} className="shrink-0 text-primary" />
            <span className="text-fg/90 tabular-nums">{STORE.phoneDisplay}</span>
            <span className="flex gap-1.5">
              <a
                href={`tel:+${STORE.whatsapp}`}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-0.5 text-xs transition hover:border-primary/50 hover:text-primary"
              >
                <Phone size={11} /> Llamar
              </a>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-0.5 text-xs transition hover:border-[#25d366]/50 hover:text-[#25d366]"
              >
                <MessageCircle size={11} /> WhatsApp
              </a>
            </span>
          </li>
          <li>
            <a href={`mailto:${STORE.email}`} className="flex items-center gap-2.5 transition hover:text-primary">
              <Mail size={15} className="shrink-0 text-primary" /> {STORE.email}
            </a>
          </li>
        </Column>
      </div>

      {/* Boletín */}
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-display font-semibold">Ofertas en tu correo</p>
            <p className="text-sm text-muted">Promos de temporada, lanzamientos y tutoriales.</p>
          </div>
          <form onSubmit={subscribe} className="flex w-full rounded-lg border border-white/10 bg-black/30 p-1 focus-within:border-primary md:max-w-sm">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              aria-label="Tu correo"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted"
            />
            <button disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm" aria-label="Suscribirse">
              <Send size={14} /> Suscribirme
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-white/5 pt-6 pb-24 text-center text-xs text-muted md:pb-6">
        © {new Date().getFullYear()} {STORE.name} · Hecho con ⚡ y mucho estaño
      </div>

      <a
        href={whatsappLink()}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
        className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-[#25d366]/40 transition hover:scale-110"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25d366] opacity-30" />
        <MessageCircle size={26} className="relative" />
      </a>
    </footer>
  )
}

function Column({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h4 className="mb-4 font-display font-semibold">{title}</h4>
      <ul className="space-y-2.5 text-sm text-muted">{children}</ul>
    </div>
  )
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link className="transition hover:text-primary" to={to}>
        {children}
      </Link>
    </li>
  )
}
