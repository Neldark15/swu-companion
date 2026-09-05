/**
 * La rifa de mesas, en vivo y para todos.
 *
 * ── Por qué esto es una pantalla y no una lista ──────────────────────
 *
 * En un Twin Suns el reparto de mesas es EL momento: ocho personas alrededor
 * de un teléfono esperando ver dónde caen. Mostrarlo como una tabla que
 * aparece de golpe desperdicia eso —y peor, si aparece sin aviso nadie sabe
 * si ya salió o todavía no—.
 *
 * Acá se revela mesa por mesa, y todos los que están en el lobby ven la misma
 * revelación al mismo tiempo, porque `tournament_mesas` ya publica sus cambios
 * y el reparto llega solo.
 *
 * ── La animación tiene una regla ─────────────────────────────────────
 *
 * Se anima UNA vez, cuando la rifa LLEGA. Si entrás al lobby con las mesas ya
 * repartidas, se ven de una: repetir la animación en cada carga convertiría
 * el momento en un obstáculo entre vos y el dato que venís a buscar. Y con
 * `prefers-reduced-motion` no se anima nunca.
 */

import { useEffect, useState } from 'react'
import { Dices, Users } from 'lucide-react'
import type { MesaArmada } from '../../services/mesasService'

interface Props {
  mesas: MesaArmada[]
  /** Para resaltar tu propia fila. `null` si mirás sin cuenta. */
  miId: string | null
}

/** Cuánto tarda en aparecer cada mesa, en milisegundos. */
const PASO = 550

export function RifaDeMesas({ mesas, miId }: Props) {
  /* Cuántas mesas se muestran ya.
     El ajuste va EN EL RENDER y no en un efecto: escribir estado dentro de un
     efecto encadena un render antes de que React pinte, y acá se notaría —la
     lista aparecería entera un cuadro antes de empezar a revelarse—. */
  const [reveladas, setReveladas] = useState(mesas.length)
  const [cuantasHabia, setCuantasHabia] = useState(mesas.length)

  if (cuantasHabia !== mesas.length) {
    setCuantasHabia(mesas.length)
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Se anima cuando la rifa LLEGA, y también cuando se vuelve a repartir:
    // es una rifa nueva y merece verse. Quien entra con las mesas ya puestas
    // las ve de una — repetir la animación en cada carga la convertiría en un
    // obstáculo entre la persona y el dato que vino a buscar.
    setReveladas(quieto ? mesas.length : 0)
  }

  useEffect(() => {
    if (mesas.length === 0) return
    const relojes = mesas.map((_, i) =>
      window.setTimeout(() => setReveladas(n => Math.max(n, i + 1)), PASO * (i + 1)))
    return () => relojes.forEach(clearTimeout)
  }, [mesas])

  if (mesas.length === 0) return null

  const sorteando = reveladas < mesas.length

  return (
    <section className="space-y-2.5">
      <header className="flex items-center gap-2">
        <Dices size={16} className={sorteando ? 'animate-spin text-swu-amber' : 'text-swu-accent-texto'} />
        <h3 className="text-sm font-black tracking-tight text-swu-text">
          {sorteando ? 'Sorteando las mesas…' : 'Las mesas'}
        </h3>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-swu-muted">
          {reveladas}/{mesas.length}
        </span>
      </header>

      <ul className="space-y-2">
        {mesas.slice(0, reveladas).map((m) => (
          <li
            key={m.mesa}
            /* Sin retardo de CSS: la mesa se MONTA cuando le toca, y el
               escalonado lo hace el reloj de arriba. Con un `animation-delay`
               encima, una mesa que aparece tarde arrancaría su animación a
               mitad de camino. */
            className="rifa-entra rounded-2xl border border-swu-border bg-swu-surface p-3"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-swu-amber/15 font-mono text-[11px] font-black text-swu-amber">
                {m.mesa}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">
                Mesa {m.mesa}
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-swu-muted">
                <Users size={11} />{m.jugadores.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.jugadores.map(j => {
                /* La comparación es por cuenta, y por eso solo resalta a quien
                   la tiene. Un invitado sin cuenta no se puede resaltar: su
                   fila no guarda más que un nombre. */
                const soyYo = !!miId && j.user_id === miId
                return (
                  <span
                    key={`${m.mesa}-${j.user_id ?? j.player_name}`}
                    className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${
                      soyYo
                        ? 'bg-swu-accent text-white'
                        : 'bg-swu-bg text-swu-text'
                    }`}
                  >
                    {soyYo ? `${j.player_name} · vos` : j.player_name}
                  </span>
                )
              })}
            </div>
          </li>
        ))}

        {/* Los huecos de lo que falta salir. Sin esto la lista crece de golpe
            y la pantalla salta; con esto se ve cuántas mesas faltan. */}
        {sorteando && mesas.slice(reveladas).map((m) => (
          <li key={`hueco-${m.mesa}`}
              className="h-[76px] animate-pulse rounded-2xl border border-dashed border-swu-border/60 bg-swu-surface/40" />
        ))}
      </ul>
    </section>
  )
}
