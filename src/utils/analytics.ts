/**
 * Registro de visitas (analítica propia, sin terceros).
 * Cada navegador recibe un id aleatorio (no personal). Si la persona tiene sesión,
 * el backend asocia el evento a su cuenta. Los errores se ignoran: nunca afecta la navegación.
 */
import { API_BASE, getAuthToken, IS_MOCK } from '../services/api'
import type { VisitEventType } from '../types'

const KEY = 'cecom-visitor'
let memoryId = ''

function visitorId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // almacenamiento bloqueado: id solo para esta pestaña
    memoryId ||= crypto.randomUUID()
    return memoryId
  }
}

let last = ''
let lastAt = 0

export function trackEvent(type: VisitEventType, path: string, productId?: string) {
  if (IS_MOCK) return
  // evita duplicados inmediatos (p. ej. efectos que se ejecutan dos veces en desarrollo)
  const sig = `${type}|${path}|${productId ?? ''}`
  if (sig === last && Date.now() - lastAt < 1500) return
  last = sig
  lastAt = Date.now()

  const token = getAuthToken()
  fetch(`${API_BASE}/track`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      visitorId: visitorId(),
      type,
      path,
      productId,
      referrer: document.referrer || undefined,
    }),
  }).catch(() => {})
}
