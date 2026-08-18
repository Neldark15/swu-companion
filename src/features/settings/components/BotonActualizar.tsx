/**
 * Actualizar la app desde Ajustes.
 *
 * Hasta ahora la ÚNICA puerta a una versión nueva era el aviso emergente. Si lo
 * cerrabas con «Después» no quedaba ninguna: te enterabas cuando volviera a
 * aparecer, que podía ser al día siguiente. Y quien sospechaba que estaba
 * viendo la app vieja —el síntoma que más se reporta— no tenía dónde
 * comprobarlo.
 *
 * Los tres estados dicen cosas distintas y por eso se dibujan distinto:
 * hay versión nueva (podés aplicarla), estás al día (te lo confirma con la
 * hora), y no se sabe todavía (nunca se comprobó en esta sesión). Un botón que
 * no acusa recibo se toca cinco veces.
 */

import { RefreshCw, CheckCircle2, Download } from 'lucide-react'
import { useActualizacion } from '../../../services/actualizacion'
import { hora } from '../../../services/horaSV'

export function BotonActualizar() {
  const hayVersionNueva = useActualizacion(s => s.hayVersionNueva)
  const aplicar = useActualizacion(s => s.aplicar)
  const comprobando = useActualizacion(s => s.comprobando)
  const ultima = useActualizacion(s => s.ultimaComprobacion)
  const comprobarAhora = useActualizacion(s => s.comprobarAhora)

  // ── Hay algo que instalar ──
  if (hayVersionNueva) {
    return (
      <button
        onClick={() => { void aplicar?.() }}
        disabled={!aplicar}
        className="w-full flex items-center gap-3 rounded-xl border border-swu-accent/40
                   bg-swu-accent/10 p-3 text-left active:scale-[0.99] transition-transform
                   disabled:opacity-50"
      >
        <Download size={18} className="flex-shrink-0 text-swu-accent-texto" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-swu-text">Hay una versión nueva</span>
          <span className="block text-[11px] text-swu-muted">
            Tocá para instalarla. La app se recarga.
          </span>
        </span>
      </button>
    )
  }

  // ── Comprobar ──
  return (
    <button
      onClick={() => { void comprobarAhora() }}
      disabled={comprobando}
      className="w-full flex items-center gap-3 rounded-xl border border-swu-border
                 bg-swu-surface p-3 text-left active:scale-[0.99] transition-transform
                 disabled:opacity-60"
    >
      {ultima && !comprobando
        ? <CheckCircle2 size={18} className="flex-shrink-0 text-swu-green" />
        : <RefreshCw size={18} className={`flex-shrink-0 text-swu-muted ${comprobando ? 'animate-spin' : ''}`} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-swu-text">
          {comprobando ? 'Buscando actualización…' : 'Buscar actualización'}
        </span>
        <span className="block text-[11px] text-swu-muted">
          {comprobando
            ? 'Un momento'
            : ultima
              // Se dice la HORA de la comprobación, no «hace un rato»: si tocás
              // dos veces seguidas, un texto relativo no cambia y parece que el
              // botón no hizo nada.
              ? `Estás al día · comprobado a las ${hora(new Date(ultima))}`
              : 'Estás viendo la versión que tenés instalada'}
        </span>
      </span>
    </button>
  )
}
