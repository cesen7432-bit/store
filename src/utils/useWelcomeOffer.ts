import { api } from '../services/api'
import { useAsync } from './useAsync'

/** Oferta de bienvenida por crear cuenta (null si no hay) */
export function useWelcomeOffer() {
  return useAsync(() => api.getWelcomeOffer().catch(() => null), []).data
}
