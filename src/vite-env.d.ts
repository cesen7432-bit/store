/// <reference types="vite/client" />

interface Window {
  __lenis?: import('lenis').default
}

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_URL?: string
  readonly VITE_SEASON?: string
}
