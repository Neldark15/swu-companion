/**
 * AperturaSobre — rasgar el sobre y ver qué salió.
 *
 * ── La regla del suspenso ────────────────────────────────────────────
 *
 * Las cartas se revelan DE UNA EN UNA y el jugador manda. No hay animación
 * automática que las escupa: se toca para girar la de arriba, se toca otra vez
 * para pasarla. Eso es lo que hace que la quinta importe — porque llegar a
 * ella costó cuatro toques y ya se sabe que es la buena.
 *
 * El orden lo decide el servidor, pero se muestra de menos a más raro a
 * propósito: un sobre que empieza con la serializada y termina con tres
 * comunes se siente como una estafa aunque traiga exactamente lo mismo.
 *
 * ── El aura antes del giro no es un error ────────────────────────────
 *
 * La carta de premio brilla con el color de su rareza ANTES de girarse. Es
 * deliberado: en la mesa, la foil se ve por el canto antes de darle la vuelta.
 * Saber que viene algo grande sin saber QUÉ es exactamente el punto dulce del
 * misterio; si no se anunciara nada, girar la quinta sería igual que girar la
 * primera.
 *
 * ── Rendimiento ──────────────────────────────────────────────────────
 *
 * Solo `transform` y `opacity`, ninguna animación de `filter` ni de sombra, y
 * ningún `setState` por fotograma: los estados son cinco en toda la apertura.
 * Las chispas se calculan una vez por carta y las anima el CSS.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { LupaCarta } from './LupaCarta'
import { Carta3D } from '../../components/Carta3D'
import { Button } from '../../components/ui/Button'
import { SobreArte } from './SobreArte'
import { ReversoCarta } from './ReversoCarta'
import { AcabadoDeImagen } from './AcabadoDeImagen'
import { sonar } from './sonido'
import { RECETA, chispas, useMenosMovimiento } from './efectos'
import { ESCALA, NOMBRE_RAREZA, ACABADO, esApaisada, type CartaSacada } from '../../services/sobres'

type Fase = 'sellado' | 'rasgando' | 'revelando' | 'resumen'

interface Props {
  /** Qué sobre eligió, para que el papel sea el mismo que tomó de la caja. */
  indiceSobre: number
  cantidadSobres?: 1 | 5 | 10
  alReintentar?: () => void
  /** Las cartas ya sorteadas por el servidor. `null` mientras viaja. */
  cartas: CartaSacada[] | null
  /** El error del servidor, si lo hubo. */
  fallo: string | null
  /** Terminó de mirar: vuelve a la caja. */
  alCerrar: () => void
  /** Quiere abrir otro de una vez. */
  alRepetir?: () => void
  /**
   * Cuánto XP pagó ESTE sobre. Lo acredita el servidor dentro de
   * `abrir_sobre()`; acá solo se enseña.
   *
   * Se enseña en el RESUMEN y no durante el revelado a propósito: mientras las
   * cartas van saliendo, la atención está en la carta, y un número flotando al
   * lado compite con lo único que la pantalla quiere que se mire. Al final ya
   * no compite con nada.
   */
  xpGanado?: number
}

/** Las cartas ordenados de menos a más raro, para que el sobre suba. */
function ordenDeRevelado(cartas: CartaSacada[]): CartaSacada[] {
  return [...cartas]
    .sort((a, b) => {
      const d = ESCALA.indexOf(a.rareza) - ESCALA.indexOf(b.rareza)
      if (d !== 0) return d
      // A igual rareza, la marcada como premio va después: es la ranura buena.
      return Number(a.premio) - Number(b.premio)
    })
}

export function AperturaSobre({ indiceSobre, cartas, fallo, alCerrar, alRepetir, alReintentar, xpGanado = 0, cantidadSobres = 1 }: Props) {
  const [fase, setFase] = useState<Fase>('sellado')
  const [sobre, setSobre] = useState(0)
  const [pos, setPos] = useState(0)
  const [inspeccion, setInspeccion] = useState<number | null>(null)
  const [girada, setGirada] = useState(false)
  const quieto = useMenosMovimiento()

  // Todos los temporizadores en un saco, para poder cortarlos al desmontar.
  // Sin esto, salir de la pantalla a mitad de una apertura dejaba `setState`
  // programados sobre un componente muerto.
  const relojes = useRef<number[]>([])
  const luego = useCallback((fn: () => void, ms: number) => {
    relojes.current.push(window.setTimeout(fn, ms))
  }, [])
  useEffect(
    () => () => {
      relojes.current.forEach(clearTimeout)
      relojes.current = []
    },
    [],
  )

  // Cada bloque llega completo en el orden de los sobres que abrió el servidor.
  const grupos = useMemo(() => {
    const sobres: CartaSacada[][] = []
    if (cartas) for (let i = 0; i < cartas.length; i += 5) sobres.push(cartas.slice(i, i + 5))
    return sobres
  }, [cartas])
  const orden = useMemo(() => ordenDeRevelado(grupos[sobre] ?? []), [grupos, sobre])
  const actual = orden[pos]
  const enTanda = cantidadSobres > 1
  const cerrojo = useRef(false)
  const receta = actual ? RECETA[actual.rareza] : null

  // Las chispas de la carta de turno: una vez por carta, no por repintado.
  const polvora = useMemo(
    () => (receta && !quieto ? chispas(receta.chispas, pos + 1) : []),
    [receta, pos, quieto],
  )

  /** Rasgar. Solo se puede cuando el servidor ya contestó. */
  const rasgar = useCallback(() => {
    if (fase !== 'sellado' || !grupos.length || cerrojo.current) return
    cerrojo.current = true
    setFase('rasgando')
    sonar('rasgar')
    const mostrar = () => {
      cerrojo.current = false
      setFase('revelando')
    }
    if (quieto) mostrar()
    else luego(mostrar, 620)
  }, [fase, grupos.length, luego, quieto])

  /**
   * Un toque: gira la de arriba, o la pasa si ya estaba girada.
   *
   * El cerrojo NO es adorno. Los manejadores de React leen `girada` del cierre
   * del render en curso, así que dos toques dentro del mismo fotograma ven los
   * DOS el mismo valor: el segundo toque después de girar avanzaba la carta
   * otra vez y se saltaba una entera. Medido dando ocho toques seguidos desde
   * la consola. Se cierra durante lo que dura el giro, que además es el rato en
   * que tocar no debería hacer nada de todos modos.
   */
  const tocar = useCallback(() => {
    if (fase !== 'revelando' || !actual || !receta) return
    if (cerrojo.current) return
    cerrojo.current = true
    luego(() => { cerrojo.current = false }, quieto ? 100 : girada ? 160 : 540)

    if (!girada) {
      setGirada(true)
      // La escala sube con cada carta: las cinco arman una melodía que asciende.
      if (actual.serializada) sonar('unica', receta.nota)
      else if (actual.premio) sonar('premio', receta.nota)
      else sonar('carta', receta.nota * (1 + pos * 0.06))

      return
    }

    setGirada(false)
    if (pos + 1 < orden.length) setPos(p => p + 1)
    else if (sobre + 1 < grupos.length) {
      setSobre(s => s + 1)
      setPos(0)
    } else setFase('resumen')
  }, [fase, actual, receta, girada, pos, orden.length, sobre, grupos.length, luego, quieto])

  const irAlSiguienteSobre = () => {
    setSobre(sobre + 1)
    setPos(0)
    setGirada(false)
  }
  const resumen = () => {
    setSobre(0)
    setFase('resumen')
  }
  // La altura del escenario queda reservada también para las cartas apaisadas.
  const altoCarta = 'min(360px, 44svh, 105vw)'
  const apaisada = esApaisada(actual?.carta)
  const cajaCarta = apaisada ? { width: `min(100%, ${altoCarta})`, aspectRatio: '400 / 286' } : {
    height: altoCarta,
    aspectRatio: '286 / 400',
  } as const

  // ── El sobre todavía sellado ─────────────────────────────────────────
  if (fase === 'sellado' || fase === 'rasgando') {
    return (
      <div className="flex flex-col items-center">
        {enTanda && <p className="mb-2 text-sm font-bold text-swu-text">Sobre 1 de {cantidadSobres}</p>}
        <div aria-hidden className="mb-4 h-1.5" />
        <div className="relative flex w-full max-w-[340px] items-center justify-center"
          style={{ height: `calc(${altoCarta} + 34px)` }}>
          {fase === 'rasgando' && (
            <div aria-hidden className={`sobre-cartas-dentro absolute ${apaisada ? 'sobre-giro-apaisado' : ''}`}
              style={cajaCarta}>
              <span className="sobre-dorso absolute inset-0"><ReversoCarta /></span>
            </div>
          )}
          <div className="sobre-paquete relative" style={{ height: altoCarta }}>
            <SobreArte indice={indiceSobre} abierto={fase === 'rasgando'} />
          </div>
        </div>

        <div className="mt-8 min-h-[92px] text-center">
          {fallo ? (
            <>
              <p role="alert" className="text-sm font-bold text-swu-red-texto">{fallo}</p>
              {alReintentar && <Button className="mt-3 mr-2" onClick={alReintentar}>Reintentar</Button>}
              <Button variant="secondary" className="mt-3" onClick={alCerrar}>
                Volver
              </Button>
            </>
          ) : !cartas ? (
            <p className="text-sm text-swu-muted">
              <span className="mr-2 inline-block animate-spin">◠</span>
              {enTanda ? 'Preparando los sobres…' : 'Preparando el sobre…'}
            </p>
          ) : fase === 'sellado' ? (
            <Button onClick={rasgar} className="px-8">
              {enTanda ? `Rasgar y ver los ${cantidadSobres} sobres` : 'Rasgar'}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  // ── Revelando de una en una ──────────────────────────────────────────
  if (fase === 'revelando' && actual && receta) {
    return (
      <div className="flex flex-col items-center">
        {enTanda && <p className="mb-2 text-sm font-bold text-swu-text" aria-live="polite">
          Sobre {sobre + 1} de {grupos.length}
        </p>}
        {/* Cuántas van */}
        <div className="mb-4 flex items-center gap-1.5" aria-label={`Carta ${pos + 1} de ${orden.length}`}>
          {orden.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === pos ? 22 : 8,
                background: i < pos ? '#22C55E' : i === pos ? receta.color : 'rgba(255,255,255,0.16)',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={tocar}
          className="sobres-revelador carta3d-escena relative flex w-full max-w-[340px] items-center justify-center
                     focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-swu-cyan"
          style={{ height: `calc(${altoCarta} + 34px)` }}
          aria-label={girada ? 'Siguiente carta' : 'Girar la carta'}
        >
          {/* Rayos por detrás. Giran con `transform`, no repintan nada. */}
          {receta.rayos > 0 && !quieto && (
            <span
              aria-hidden
              className="rayos pointer-events-none absolute"
              style={{
                // El aura ya se ve antes de girar: es el anuncio de que viene
                // algo, sin decir qué.
                opacity: girada ? 0.75 : 0.3,
                ['--rayo-color' as string]: receta.color,
              }}
            />
          )}

          {/* Aura latiendo mientras está boca abajo */}
          {!girada && receta.latido && !quieto && (
            <span
              aria-hidden
              className="aura-late pointer-events-none absolute h-[300px] w-[300px] rounded-full"
              style={{ ['--aura-color' as string]: receta.color }}
            />
          )}

          {/* La carta siguiente empieza directamente de dorso. Cada cara solo
              gira 90 grados y desaparece al pasar por el canto. */}
          <span key={`${sobre}-${pos}`} data-girada={girada}
            className={`sobre-giro sobre-revelado-entra relative block ${apaisada ? 'sobre-giro-apaisado' : ''}`}
            style={cajaCarta}>
            <span aria-hidden={!girada} className="sobre-frente absolute inset-0 flex items-center justify-center">
              <span className="relative block w-full">
                {actual.arte || actual.carta ? (
                  <AcabadoDeImagen
                    acabado={girada ? ACABADO[actual.rareza] : undefined}
                    movimiento="solo"
                    src={actual.arte || actual.carta?.imageUrl}
                    alt={actual.carta?.name ?? 'Carta'}
                    orientacion={apaisada ? 'apaisada' : 'vertical'}
                    className="w-full"
                  />
                ) : (
                  <span className="flex min-h-24 w-full items-center justify-center rounded-xl bg-swu-surface text-sm text-swu-muted">
                    Carta sin arte local
                  </span>
                )}
              </span>
            </span>
            <span aria-hidden className="sobre-dorso absolute inset-0">
              <ReversoCarta color={receta.color} misterio={!girada && receta.suspenso > 0} />
            </span>
          </span>

          {/* Chispas: solo al girar, y solo si la rareza las merece. */}
          {girada &&
            polvora.map((c, i) => (
              <span
                key={i}
                aria-hidden
                className="chispa pointer-events-none absolute"
                style={{
                  background: receta.color,
                  ['--cx' as string]: `${c.x}px`,
                  ['--cy' as string]: `${c.y}px`,
                  animationDelay: `${c.d}ms`,
                }}
              />
            ))}
        </button>

        {/* Qué salió */}
        <div className="mt-4 min-h-[74px] text-center">
          {girada ? (
            <div className={quieto ? '' : 'grito-entra'}>
              {receta.grito && (
                <p
                  className="text-[13px] font-black uppercase tracking-[0.28em]"
                  style={{ color: receta.color }}
                >
                  {actual.serializada ? 'ÚNICA EN LA COMUNIDAD' : receta.grito}
                </p>
              )}
              <p className="mt-0.5 truncate text-lg font-bold text-swu-text">
                {actual.carta?.name ?? 'Carta desconocida'}
              </p>
              <p className="text-xs text-swu-muted">
                {actual.variante}
                {actual.carta ? ` · ${actual.carta.setCode} ${actual.carta.setNumber}` : ''}
              </p>
            </div>
          ) : (
            <p className="pt-4 text-sm text-swu-muted">
              {receta.suspenso > 900 ? 'Algo pesa distinto…' : 'Tocá para girarla'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-x-5">
          {enTanda && sobre + 1 < grupos.length && (
            <button type="button" className="min-h-11 text-sm text-swu-cyan"
              onClick={irAlSiguienteSobre}>
              Siguiente sobre
            </button>
          )}
          <button type="button" onClick={resumen}
            className="min-h-11 text-sm text-swu-muted underline underline-offset-4">
            {enTanda ? 'Ver resumen de la tanda' : 'Ver todas de una vez'}
          </button>
        </div>
      </div>
    )
  }

  // ── Todo lo que salió ────────────────────────────────────────────────
  const lista = grupos[sobre] ?? []
  const ampliada = inspeccion === null ? undefined : lista[inspeccion]
  const todas = cartas ?? []
  const mejor = todas.reduce(
    (a, c) => (ESCALA.indexOf(c.rareza) > ESCALA.indexOf(a.rareza) ? c : a),
    todas[0],
  )

  return (
    <div>
      <div className="mb-4 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-swu-muted">
          {enTanda ? `${grupos.length} sobres abiertos · ${todas.length} cartas` : 'Sobre abierto'}
        </p>
        {mejor && (
          <p className="mt-1 text-sm" style={{ color: RECETA[mejor.rareza].color }}>
            <Sparkles size={13} className="mr-1 inline" />
            Lo mejor: {NOMBRE_RAREZA[mejor.rareza]}
          </p>
        )}
      </div>

      {enTanda && (
        <div className="mx-auto mb-4 flex items-center justify-center gap-3">
          <button type="button" aria-label="Sobre anterior" disabled={sobre === 0}
            onClick={() => setSobre(sobre - 1)} className="grid size-11 place-items-center rounded-lg border border-swu-border disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <select aria-label="Elegir sobre del resumen" value={sobre}
            onChange={e => setSobre(Number(e.target.value))}
            className="h-11 rounded-lg border border-swu-border bg-swu-surface px-3 text-sm font-bold text-swu-text">
            {grupos.map((_, i) => <option value={i} key={i}>Sobre {i + 1} de {grupos.length}</option>)}
          </select>
          <button type="button" aria-label="Sobre siguiente" disabled={sobre + 1 >= grupos.length}
            onClick={() => setSobre(sobre + 1)} className="grid size-11 place-items-center rounded-lg border border-swu-border disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      <p className="mb-3 text-center text-xs text-swu-muted">Tocá una carta para verla en 3D.</p>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {lista.map((c, i) => (
          <div key={`${sobre}-${c.cardId}-${i}`} className="carta3d-escena min-w-0">
            <button type="button" aria-haspopup="dialog" aria-label={`Ver en 3D: ${c.carta?.name ?? 'Carta'}, posición ${i + 1}`}
              className="sobre-resumen-carta block w-full rounded-lg text-left"
              onClick={e => { e.currentTarget.focus({ preventScroll: true }); setInspeccion(i) }}>
              <Carta3D
                intensidad={9}
                brillo={c.rareza !== 'hiper'}
                iridiscente={ACABADO[c.rareza] !== 'foil'}
                alAbrir
              >
                <div
                  className="relative rounded-lg"
                  style={{
                    boxShadow:
                      c.rareza === 'hiper' ? 'none' : `0 0 14px ${RECETA[c.rareza].color}55`,
                  }}
                >
                  {c.arte || c.carta ? (
                    <AcabadoDeImagen acabado={ACABADO[c.rareza]} calidad="plano"
                      src={c.arte || c.carta?.imageUrl}
                      alt={c.carta?.name ?? 'Carta'}
                      orientacion={esApaisada(c.carta) ? 'apaisada' : 'vertical'}
                      className="w-full"
                    />
                  ) : (
                    <div className="aspect-[286/400] rounded-lg bg-swu-surface" />
                  )}
                </div>
              </Carta3D>
              <span className="mt-1 block truncate text-[10px] text-swu-muted" title={c.carta?.name}>
                {c.carta?.name ?? '—'}
              </span>
            </button>
          </div>
        ))}
      </div>

      {ampliada && inspeccion !== null && (
        <LupaCarta hallazgo={ampliada} contexto={`Sobre ${sobre + 1} · Carta ${inspeccion + 1} de ${lista.length}`}
          color={RECETA[ampliada.rareza].color} acabado={ACABADO[ampliada.rareza]}
          alCerrar={() => setInspeccion(null)} />
      )}
      {xpGanado > 0 && (
        <p className="mt-5 text-center text-[13px] font-bold text-swu-amber">
          +{xpGanado} XP
        </p>
      )}

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {alRepetir && (
          <Button onClick={alRepetir} className="px-7">
            {enTanda ? 'Elegir más sobres' : 'Abrir otro'}
          </Button>
        )}
        <Button variant="secondary" onClick={alCerrar} className="px-7">
          <Check size={15} className="mr-1.5" />
          Listo
        </Button>
      </div>
    </div>
  )
}
