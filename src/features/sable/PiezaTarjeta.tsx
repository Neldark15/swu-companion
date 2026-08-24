/**
 * La tarjeta de una pieza: rareza, nombre, precio y lo que te CAMBIA.
 *
 * ── El delta es lo que la vuelve una decisión ─────────────────────────
 *
 * Sin el delta de stats, elegir entre un emisor de 900 y otro de 1.800 es
 * adivinar: el precio no dice qué te llevás. Con «+8 potencia · −2 control» la
 * tarjeta responde la única pregunta que importa antes de gastar.
 *
 * ── Puesta / la tengo / se compra son TRES estados, no dos ────────────
 *
 * Una pieza comprada y no puesta no es lo mismo que una sin comprar, y taparlas
 * con el mismo borde es cómo alguien vuelve a pagar por algo que ya tiene. El
 * borde de rareza se queda SIEMPRE (es información de la pieza, no de tu
 * relación con ella) y lo que cambia es el fondo y el pie.
 */

import { Check, Lock } from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { MiniaturaPieza } from './MiniaturaPieza'
import { rarezaDe, type Stats } from './kyber'
import type { ParteTaller } from '../../services/sableService'

interface Props {
  parte: ParteTaller
  puesta: boolean
  delta: Stats | null
  ocupado: boolean
  alElegir: () => void
}

/** Una cifra con signo. El «+» explícito: «8» a secas no dice si sube o baja. */
function conSigno(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export function PiezaTarjeta({ parte, puesta, delta, ocupado, alElegir }: Props) {
  const r = rarezaDe(parte.rareza)
  const cambia = delta && (delta.potencia || delta.control || delta.energia)

  return (
    <button
      onClick={alElegir}
      disabled={ocupado}
      className={`flex w-full flex-col gap-1.5 rounded-xl border-2 p-2.5 text-left
                  transition-transform active:scale-[0.99] disabled:opacity-60
                  ${r.borde} ${puesta ? 'bg-swu-accent/12' : parte.tengo ? 'bg-swu-surface' : 'bg-swu-bg'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${r.ficha} ${r.texto}`}>
          {r.rotulo}
        </span>
        {puesta
          ? <Check size={15} className="shrink-0 text-swu-accent-texto" />
          : !parte.tengo && <Lock size={13} className="shrink-0 text-swu-muted" />}
      </div>

      {/* La miniatura sale del MISMO perfil que la malla 3D, así que no puede
          separarse del sable. Los cristales no la llevan: un cristal no es una
          pieza torneada y su identidad es el COLOR, que ya se ve en la hoja. */}
      <div className="flex items-center gap-2">
        {parte.tipo !== 'color' && (
          <MiniaturaPieza tipo={parte.tipo} id={parte.id} size={44} />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-tight text-swu-text">
          {parte.nombre}
        </span>
      </div>

      {/* El pie dice UNA cosa según el estado. Tres estados, tres frases. */}
      {puesta ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-swu-accent-texto">
          Equipada
        </span>
      ) : parte.tengo ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">
          La tenés · tocá para poner
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[11px] font-black text-swu-amber">
          <CreditoIcon size={13} />
          {parte.precio.toLocaleString('es-SV')}
        </span>
      )}

      {/* Lo que cambia. Solo si cambia algo: un «+0 +0 +0» es ruido. */}
      {cambia && (
        <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-tight">
          {delta.potencia !== 0 && (
            <span className={delta.potencia > 0 ? 'text-emerald-400' : 'text-swu-red-texto'}>
              {conSigno(delta.potencia)} pot
            </span>
          )}
          {delta.control !== 0 && (
            <span className={delta.control > 0 ? 'text-emerald-400' : 'text-swu-red-texto'}>
              {conSigno(delta.control)} ctrl
            </span>
          )}
          {delta.energia !== 0 && (
            <span className={delta.energia > 0 ? 'text-emerald-400' : 'text-swu-red-texto'}>
              {conSigno(delta.energia)} ener
            </span>
          )}
        </span>
      )}
    </button>
  )
}
