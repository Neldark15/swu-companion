import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAccentColor, ACCENT_COLORS } from './hooks/useSettings'
import type { AccentColor } from './hooks/useSettings'
import { aplicarTemaFondo, esTemaFondo } from './services/personalizacion'

// Apply persisted accent color before first render to avoid flash
try {
  const stored = JSON.parse(localStorage.getItem('swu-settings') || '{}')
  const accent = (stored?.state?.accentColor || 'red') as AccentColor
  if (accent in ACCENT_COLORS) {
    applyAccentColor(accent)
  }
  // El tema de fondo va por el mismo camino y por la misma razón: pintar
  // ANTES del primer render, o la app parpadea del tema default al elegido.
  const tema: unknown = stored?.state?.temaFondo
  if (esTemaFondo(tema) && tema !== 'holocron') {
    aplicarTemaFondo(tema)
  }
} catch {
  // fallback: red is already default in CSS
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
