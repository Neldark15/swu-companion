/**
 * POTENCIA · CONTROL · ENERGÍA — los tres stats del sable armado.
 *
 * ── Se SUMAN de las piezas y no se guardan ────────────────────────────
 *
 * No hay ninguna fila que diga «potencia 76»: la potencia ES lo que aportan las
 * cuatro piezas puestas. Derivado no puede quedar viejo (§3c).
 *
 * ── Y no afectan a nada fuera del taller, a propósito ─────────────────
 *
 * Son la identidad del sable y el motivo para preferir una pieza sobre otra.
 * Engancharlos al ranking o a las partidas convertiría gastar créditos en
 * comprar ventaja competitiva, y esta app ya tuvo un ranking que medía
 * coleccionar en vez de jugar (§3c). Acá describen; no deciden.
 *
 * ── La barra se anima con `scaleX`, no con `width` ────────────────────
 *
 * Animar el ancho es un reflow por cuadro; `transform` lo hace el compositor
 * (§3u). Son tres barras y no se nota, pero la regla es la regla y la próxima
 * pantalla que la copie puede tener veinte.
 */

import { Zap, Crosshair, BatteryCharging } from 'lucide-react'
import { TOPE_STAT, type Stats } from './kyber'

const FILAS = [
  { clave: 'potencia' as const, rotulo: 'Potencia', Icono: Zap },
  { clave: 'control' as const, rotulo: 'Control', Icono: Crosshair },
  { clave: 'energia' as const, rotulo: 'Energía', Icono: BatteryCharging },
]

export function BarraStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-swu-border bg-swu-surface/70 p-3">
      {FILAS.map(({ clave, rotulo, Icono }) => {
        const v = stats[clave]
        const p = Math.max(0, Math.min(1, v / TOPE_STAT))
        return (
          <div key={clave} className="min-w-0">
            <div className="flex items-center gap-1 text-swu-muted">
              <Icono size={12} />
              <span className="truncate text-[9px] font-black uppercase tracking-wider">{rotulo}</span>
            </div>
            <p className="mt-0.5 font-mono text-[19px] font-black leading-none tabular-nums text-swu-amber">
              {v}
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-swu-bg">
              <div
                className="h-full origin-left rounded-full bg-swu-amber transition-transform duration-500"
                style={{ transform: `scaleX(${p})` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
