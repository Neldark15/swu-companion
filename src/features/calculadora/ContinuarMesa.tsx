import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Swords } from 'lucide-react'
import { CLAVE_CALCULADORA, leerMesa } from './estadoCalculadora'

function leerGuardado() {
  try { return localStorage.getItem(CLAVE_CALCULADORA) } catch { return null }
}

function suscribir(avisar: () => void) {
  const cambio = (evento: StorageEvent) => {
    if (evento.key === CLAVE_CALCULADORA || evento.key === null) avisar()
  }
  window.addEventListener('storage', cambio)
  window.addEventListener('focus', avisar)
  return () => {
    window.removeEventListener('storage', cambio)
    window.removeEventListener('focus', avisar)
  }
}

/** Acceso ligero: no importa el contador, sus efectos ni el catálogo de bases. */
export function ContinuarMesa() {
  const crudo = useSyncExternalStore(suscribir, leerGuardado, () => null)
  const mesa = leerMesa(crudo)
  if (!mesa) return null
  const terminada = mesa.modo === 'premier' && mesa.jugadores.some(jugador => jugador.vida === 0)
  return <Link to="/contador" className="flex min-h-16 items-center gap-3 rounded-xl border border-swu-accent/30 bg-swu-accent/10 p-4 text-swu-text">
    <Swords size={22} className="shrink-0 text-swu-accent-texto" />
    <span className="min-w-0 flex-1">
      <strong className="block text-sm">{terminada ? 'Última mesa · resultado y revancha' : 'Continuar mesa'}</strong>
      <span className="mt-1 block text-xs text-swu-muted">{mesa.modo === 'premier' ? 'Premier' : 'Twin Suns'} · Ronda {mesa.ronda} · Guardada en este dispositivo</span>
      <span className="mt-1 block truncate text-xs">{mesa.jugadores.map(jugador => `${jugador.nombre} ${jugador.vida}/${jugador.maxVida}`).join(' · ')}</span>
    </span>
    <ArrowRight size={18} className="shrink-0 text-swu-accent-texto" />
  </Link>
}
