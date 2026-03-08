import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAccentColor, ACCENT_COLORS } from './hooks/useSettings'
import type { AccentColor } from './hooks/useSettings'

// Apply persisted accent color before first render to avoid flash
try {
  const stored = JSON.parse(localStorage.getItem('swu-settings') || '{}')
  const accent = (stored?.state?.accentColor || 'red') as AccentColor
  if (accent in ACCENT_COLORS) {
    applyAccentColor(accent)
  }
} catch {
  // fallback: red is already default in CSS
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
