/**
 * La barra de instalar, para quien llega por un enlace.
 *
 * ── El hueco que tapa ────────────────────────────────────────────────
 *
 * El ofrecimiento de instalar vivía en dos sitios: la puerta —que se salta en
 * las rutas libres— y una tarjeta en Inicio, que exige tener cuenta y haber
 * entrado.
 *
 * O sea que a quien llega desde un enlace de WhatsApp al archivo de un torneo
 * —la vía por la que entra casi toda la gente nueva— NUNCA se le ofrecía
 * instalar nada. Justo a quien más falta le hace.
 *
 * ── Por qué es una barra y no un cartel ──────────────────────────────
 *
 * Esa persona vino a ver algo concreto: quién ganó, contra quién le toca.
 * Taparle eso con una pantalla de instalación es cobrarle un peaje por mirar,
 * y se va. La barra ocupa una línea abajo, no bloquea nada, y se cierra.
 *
 * Cerrarla se recuerda: volver a ofrecer lo mismo a quien ya dijo que no es
 * cómo una app se vuelve molesta.
 */

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { promptDisponible, alCambiarInstalacion, instalar } from '../../services/instalacion'
import { esStandalone } from '../../services/entorno'

const CLAVE_CERRADA = 'swu.barraInstalar.cerrada'

export function BarraInstalar() {
  // Se lee lo YA guardado: el evento pudo llegar antes de que esto montara y
  // no se repite.
  const [hay, setHay] = useState(() => !!promptDisponible())
  const [cerrada, setCerrada] = useState(() => {
    try { return localStorage.getItem(CLAVE_CERRADA) === '1' } catch { return false }
  })
  const [lanzando, setLanzando] = useState(false)

  useEffect(() => alCambiarInstalacion(() => setHay(!!promptDisponible())), [])

  // Instalada ya, sin prompt, o cerrada: no hay nada que ofrecer.
  if (esStandalone() || !hay || cerrada) return null

  const cerrar = () => {
    setCerrada(true)
    try { localStorage.setItem(CLAVE_CERRADA, '1') } catch { /* modo privado */ }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-swu-border bg-swu-surface/95 px-3 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <img src="/icon-192.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-swu-text">Instalá HOLOCRON SWU</p>
          <p className="truncate text-[10px] text-swu-muted">
            Para que te avise de tus pareos y tus torneos
          </p>
        </div>
        <button
          onClick={() => { setLanzando(true); void instalar().finally(() => setLanzando(false)) }}
          disabled={lanzando}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-swu-accent px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          <Download size={14} /> {lanzando ? 'Instalando…' : 'Instalar'}
        </button>
        <button onClick={cerrar} aria-label="Ahora no" className="shrink-0 p-1.5 text-swu-muted">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
