/**
 * La rifa de mesas: el sorteo, mirado en grupo.
 *
 * ── Por qué esto es una secuencia y no una tabla ─────────────────────
 *
 * En un Twin Suns el reparto de mesas es EL momento: ocho personas alrededor
 * de un teléfono esperando ver dónde caen. Mostrarlo como una lista que
 * aparece de golpe desperdicia eso — y peor, si aparece sin aviso nadie sabe
 * si ya salió o todavía no.
 *
 * La secuencia tiene tres tiempos, y cada uno responde algo:
 *
 *  1. **Barajando** — todos los nombres juntos, revueltos. Dice «esto es al
 *     azar y está pasando ahora».
 *  2. **Repartiendo** — las mesas se van llenando de a una. Dice «te tocó
 *     acá», con tiempo para verlo.
 *  3. **Listo** — la tabla quieta, que es lo que se consulta después.
 *
 * Todos los que están en el lobby ven la misma secuencia al mismo tiempo,
 * porque `tournament_mesas` publica sus cambios y el reparto llega solo.
 *
 * ── Dos reglas que la mantienen honesta ──────────────────────────────
 *
 * · **Se anima UNA vez, cuando la rifa llega.** Quien entra con las mesas ya
 *   puestas las ve de una: repetir el espectáculo en cada carga lo convierte
 *   en un obstáculo entre la persona y el dato que vino a buscar.
 * · **El barajado que se VE no decide nada.** El reparto ya lo hizo el
 *   servidor; esto es la animación de un resultado que ya existe. Se dice acá
 *   para que nadie lea el código creyendo que el orden sale de este `Math`.
 *
 * Con `prefers-reduced-motion` se salta todo y se muestra la tabla.
 */

import { useEffect, useMemo, useState } from 'react'
import { Dices, Users } from 'lucide-react'
import type { MesaArmada } from '../../services/mesasService'
import { ContadorVida } from './ContadorVida'

interface Props {
  mesas: MesaArmada[]
  /** Para resaltar tu propia ficha. `null` si mirás sin cuenta. */
  miId: string | null
  /** Muestra el contador de vida. Lo lleva la mesa, no quien organiza. */
  conVida?: boolean
  onError?: (m: string) => void
}

/** Cuánto dura el revuelto inicial. */
const BARAJANDO = 1400
/** Cada cuánto salta el revuelto. */
const SALTO = 130
/** Cuánto tarda en caer cada mesa. */
const PASO = 620

type Fase = 'barajando' | 'repartiendo' | 'listo'

/** Fisher-Yates. `sort(() => Math.random() - 0.5)` está medido: sesga 2,3×. */
function revolver<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function RifaDeMesas({ mesas, miId, conVida, onError }: Props) {
  const todos = useMemo(
    () => mesas.flatMap(m => m.jugadores.map(j => ({
      clave: `${m.mesa}-${j.user_id ?? j.player_name}`,
      nombre: j.player_name,
      soyYo: !!miId && j.user_id === miId,
    }))),
    [mesas, miId],
  )

  const [fase, setFase] = useState<Fase>('listo')
  const [reveladas, setReveladas] = useState(mesas.length)
  const [revuelto, setRevuelto] = useState(todos)
  const [cuantasHabia, setCuantasHabia] = useState(mesas.length)

  /* El ajuste va EN EL RENDER, no en un efecto: escribir estado dentro de un
     efecto encadena un render antes de que React pinte, y acá se vería —la
     tabla entera aparecería un cuadro antes de empezar la secuencia—. */
  if (cuantasHabia !== mesas.length) {
    setCuantasHabia(mesas.length)
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const animar = mesas.length > 0 && !quieto
    setFase(animar ? 'barajando' : 'listo')
    setReveladas(animar ? 0 : mesas.length)
  }

  // El revuelto que se ve. Cosmético: el reparto ya lo decidió el servidor.
  useEffect(() => {
    if (fase !== 'barajando') return
    const tic = window.setInterval(() => setRevuelto(r => revolver(r)), SALTO)
    const fin = window.setTimeout(() => { setFase('repartiendo'); clearInterval(tic) }, BARAJANDO)
    return () => { clearInterval(tic); clearTimeout(fin) }
  }, [fase])

  useEffect(() => { setRevuelto(todos) }, [todos])

  useEffect(() => {
    if (fase !== 'repartiendo') return
    const relojes = mesas.map((_, i) =>
      window.setTimeout(() => {
        setReveladas(n => Math.max(n, i + 1))
        if (i === mesas.length - 1) setFase('listo')
      }, PASO * (i + 1)))
    return () => relojes.forEach(clearTimeout)
  }, [fase, mesas])

  if (mesas.length === 0) return null

  return (
    <section className="space-y-2.5">
      <header className="flex items-center gap-2">
        <Dices size={16} className={fase === 'listo' ? 'text-swu-accent-texto' : 'animate-spin text-swu-amber'} />
        <h3 className="text-sm font-black tracking-tight text-swu-text">
          {fase === 'barajando' ? 'Revolviendo…'
            : fase === 'repartiendo' ? 'Repartiendo las mesas…'
            : 'Las mesas'}
        </h3>
        {fase !== 'barajando' && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            {reveladas}/{mesas.length}
          </span>
        )}
      </header>

      {/* 1 · TODOS JUNTOS, revueltos. Es el momento en que se ve que es al azar. */}
      {fase === 'barajando' && (
        <div className="rounded-2xl border border-swu-amber/30 bg-swu-surface p-3">
          <div className="flex flex-wrap gap-1.5">
            {revuelto.map(j => (
              <span
                key={j.clave}
                className={`rifa-baraja rounded-lg px-2 py-1 text-[12px] font-semibold ${
                  j.soyYo ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-text'
                }`}
              >
                {j.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2 y 3 · Las mesas, cayendo de a una. */}
      {fase !== 'barajando' && (
        <ul className="space-y-2">
          {mesas.slice(0, reveladas).map(m => (
            <li key={m.mesa} className="rifa-entra rounded-2xl border border-swu-border bg-swu-surface p-3">
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
              <div className={conVida ? 'space-y-1' : 'flex flex-wrap gap-1.5'}>
                {m.jugadores.map((j, i) => {
                  /* La comparación es por cuenta, así que solo resalta a quien
                     la tiene. Un invitado no se puede resaltar: su fila no
                     guarda más que un nombre. */
                  const soyYo = !!miId && j.user_id === miId
                  const ficha = (
                    <span
                      className={`rifa-cae rounded-lg px-2 py-1 text-[12px] font-semibold ${
                        soyYo ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-text'
                      }`}
                      /* Las fichas de una mesa caen escalonadas: llegar todas
                         juntas se lee como un bloque, no como gente sentándose. */
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      {soyYo ? `${j.player_name} · vos` : j.player_name}
                    </span>
                  )
                  const clave = `${m.mesa}-${j.user_id ?? j.player_name}`
                  /* Con el contador, cada quien va en su renglón: los ± al
                     lado del nombre en una fila envuelta quedan pegados al
                     nombre del de al lado y se toca el equivocado. */
                  return conVida ? (
                    <div key={clave} className="flex items-center justify-between gap-2">
                      {ficha}
                      <ContadorVida
                        asiento={j}
                        bloqueada={false}
                        onError={onError ?? (() => {})}
                      />
                    </div>
                  ) : (
                    <span key={clave} className="contents">{ficha}</span>
                  )
                })}
              </div>
            </li>
          ))}

          {/* Los huecos de lo que falta salir: sin esto la lista crece de golpe
              y la pantalla salta bajo el dedo. */}
          {reveladas < mesas.length && mesas.slice(reveladas).map(m => (
            <li key={`hueco-${m.mesa}`}
                className="h-[76px] animate-pulse rounded-2xl border border-dashed border-swu-border/60 bg-swu-surface/40" />
          ))}
        </ul>
      )}
    </section>
  )
}
