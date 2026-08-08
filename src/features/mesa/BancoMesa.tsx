/**
 * BancoMesa — banco de pruebas de la mesa 3D. **Solo desarrollo.**
 *
 * `/mesa` necesita el simulador del VPS para tener una partida que reproducir,
 * y en `vite dev` ese proxy no existe (da 404). Sin él no hay forma de MIRAR un
 * cambio en la escena, que es justo lo único que se puede juzgar de un cambio
 * visual. Esta pantalla monta `MesaEscena` con el fixture que ya usan las
 * pruebas, así que no depende de la red.
 *
 * Sin arte a propósito: con el `Map` vacío cada carta se dibuja como el
 * rectángulo del color de su bando. Para revisar sombras, arcos y colocación
 * eso es MEJOR que el arte — sin ilustración encima, lo que se está mirando se
 * ve solo.
 */

import { useState } from 'react'
import { MesaEscena } from './MesaEscena'
import { PARTIDAS } from './partidas.fixture'
import { estadoEn, totalPasos, frase } from './reproductor'

export function BancoMesa() {
  const partida = PARTIDAS[0]
  const total = totalPasos(partida)
  const [i, setI] = useState(Math.min(24, total))
  const estado = estadoEn(partida, i)

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-swu-muted" data-banco="1">
        Banco de pruebas · paso {i} de {total} · {frase(partida.eventos[i - 1] ?? null)}
        {' · '}A: {estado.a.unidades.length}u vida {estado.a.vida}
        {' · '}B: {estado.b.unidades.length}u vida {estado.b.vida}
      </p>
      <div className="rounded-xl overflow-hidden border border-swu-border bg-black">
        <div className="h-[52vh] min-h-[320px]">
          <MesaEscena estado={estado} arte={new Map()} duracion={900} />
        </div>
      </div>
      <input
        type="range" min={0} max={total} value={i}
        onChange={e => setI(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}
