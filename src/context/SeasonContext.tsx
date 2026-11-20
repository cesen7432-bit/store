import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSeason, seasonForDate, type SeasonTheme } from '../config/seasons'
import { api } from '../services/api'
import type { StoreSettings } from '../types'

/**
 * La temporada la decide el ADMINISTRADOR (Admin → Configuración) y aplica a
 * todos los visitantes. 'auto' = según la fecha (rangos en config/seasons.ts).
 */
interface SeasonCtx {
  season: SeasonTheme
  settings: StoreSettings
  /** Aplica una configuración recién guardada sin recargar la página */
  applySettings: (s: StoreSettings) => void
  effectsEnabled: boolean
}

const DEFAULT_SETTINGS: StoreSettings = {
  seasonMode: import.meta.env.VITE_SEASON || 'auto',
  showParticles: true,
  showSeasonBanner: true,
  welcomeCoupon: '',
}

const Ctx = createContext<SeasonCtx | null>(null)

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    api
      .getSettings()
      .then((s) => s && setSettings(s))
      .catch(() => {})
  }, [])

  const season = useMemo(
    () => (settings.seasonMode === 'auto' ? seasonForDate() : getSeason(settings.seasonMode)),
    [settings.seasonMode],
  )

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const effectsEnabled = settings.showParticles && !reducedMotion

  // Inyecta la paleta como variables CSS → Tailwind las usa vía @theme
  useEffect(() => {
    const root = document.documentElement
    Object.entries(season.palette).forEach(([k, v]) => root.style.setProperty(`--${k}`, v))
    root.dataset.season = season.id
  }, [season])

  const applySettings = useCallback((s: StoreSettings) => setSettings(s), [])

  return <Ctx.Provider value={{ season, settings, applySettings, effectsEnabled }}>{children}</Ctx.Provider>
}

export function useSeason() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSeason debe usarse dentro de <SeasonProvider>')
  return ctx
}
