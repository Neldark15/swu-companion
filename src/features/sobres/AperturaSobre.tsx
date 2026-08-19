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
import { Sparkles, Check } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { Button } from '../../components/ui/Button'
import { SobreArte } from './SobreArte'
import { ReversoCarta } from './ReversoCarta'
import { Acabado } from './Acabado'
import { sonar } from './sonido'
import { RECETA, chispas, useMenosMovimiento } from './efectos'
import { ESCALA, NOMBRE_RAREZA, ACABADO, esApaisada, type CartaSacada } from '../../services/sobres'

type Fase = 'sellado' | 'rasgando' | 'revelando' | 'resumen'

interface Props {
  /** Qué sobre eligió, para que el papel sea el mismo que tomó de la caja. */
  indiceSobre: number
  /** Las cartas ya sorteadas por el servidor. `null` mientras viaja. */
  cartas: CartaSacada[] | null
  /** El error del servidor, si lo hubo. */
  fallo: string | null
  /** Terminó de mirar: vuelve a la caja. */
  alCerrar: () => void
  /** Quiere abrir otro de una vez. */
  alRepetir?: () => void
}

/** Los índices ordenados de menos a más raro, para que el sobre suba. */
function ordenDeRevelado(cartas: CartaSacada[]): number[] {
  return cartas
    .map((_, i) => i)
    .sort((a, b) => {
      const d = ESCALA.indexOf(cartas[a].rareza) - ESCALA.indexOf(cartas[b].rareza)
      if (d !== 0) return d
      // A igual rareza, la marcada como premio va después: es la ranura buena.
      return Number(cartas[a].premio) - Number(cartas[b].premio)
    })
}

export function AperturaSobre({ indiceSobre, cartas, fallo, alCerrar, alRepetir }: Props) {
  const [fase, setFase] = useState<Fase>('sellado')
  const [pos, setPos] = useState(0)
  const [girada, setGirada] = useState(false)
  const [fogonazo, setFogonazo] = useState<string | null>(null)
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

  const orden = useMemo(() => (cartas ? ordenDeRevelado(cartas) : []), [cartas])
  const actual = cartas && pos < orden.length ? cartas[orden[pos]] : null
  const receta = actual ? RECETA[actual.rareza] : null

  // Las chispas de la carta de turno: una vez por carta, no por repintado.
  const polvora = useMemo(
    () => (receta && !quieto ? chispas(receta.chispas, pos + 1) : []),
    [receta, pos, quieto],
  )

  /** Rasgar. Solo se puede cuando el servidor ya contestó. */
  const rasgar = useCallback(() => {
    if (fase !== 'sellado' || !cartas) return
    setFase('rasgando')
    sonar('rasgar')
    luego(() => setFase('revelando'), quieto ? 120 : 620)
  }, [fase, cartas, luego, quieto])

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
  const cerrojo = useRef(false)
  const tocar = useCallback(() => {
    if (fase !== 'revelando' || !actual || !receta) return
    if (cerrojo.current) return
    cerrojo.current = true
    luego(() => { cerrojo.current = false }, quieto ? 60 : 380)

    if (!girada) {
      setGirada(true)
      // La escala sube con cada carta: las cinco arman una melodía que asciende.
      if (actual.serializada) sonar('unica', receta.nota)
      else if (actual.premio) sonar('premio', receta.nota)
      else sonar('carta', receta.nota * (1 + pos * 0.06))

      if (receta.fogonazo && !quieto) {
        setFogonazo(receta.color)
        luego(() => setFogonazo(null), 520)
      }
      return
    }

    setGirada(false)
    if (pos + 1 >= orden.length) setFase('resumen')
    else setPos(p => p + 1)
  }, [fase, actual, receta, girada, pos, orden.length, luego, quieto])

  /* La carta se mide contra la ALTURA de la pantalla, no en píxeles fijos.
   * Medido en un teléfono de 375×812: con 360 px de alto fijos, el nombre de la
   * carta y el botón de saltar quedaban debajo de la barra de navegación. El
   * ancho sale del alto por la proporción del arte (286/400) para que la caja
   * nunca deforme la carta. */
  const ALTO_CARTA = 'min(360px, 44vh)'
  const cajaCarta = {
    height: ALTO_CARTA,
    width: `calc(${ALTO_CARTA} * ${286 / 400})`,
  } as const

  // ── El sobre todavía sellado ─────────────────────────────────────────
  if (fase === 'sellado' || fase === 'rasgando') {
    return (
      <div className="flex flex-col items-center">
        <div className="carta3d-escena relative h-[320px] w-[210px]">
          <div
            className={fase === 'rasgando' && !quieto ? 'sobre-rasga' : ''}
            style={{ height: '100%', width: '100%' }}
          >
            <Carta3D intensidad={12} brillo>
              <div className="h-[320px] w-[210px] drop-shadow-[0_14px_26px_rgba(0,0,0,0.6)]">
                <SobreArte indice={indiceSobre} abierto={fase === 'rasgando'} />
              </div>
            </Carta3D>
          </div>

          {/* La luz que se escapa por la abertura al rasgarlo. */}
          {fase === 'rasgando' && !quieto && (
            <div aria-hidden className="sobre-fuga pointer-events-none absolute inset-x-0 top-0 h-24" />
          )}
        </div>

        <div className="mt-8 min-h-[92px] text-center">
          {fallo ? (
            <>
              <p className="text-sm font-bold text-swu-red-texto">{fallo}</p>
              <Button variant="secondary" className="mt-3" onClick={alCerrar}>
                Volver
              </Button>
            </>
          ) : !cartas ? (
            <p className="text-sm text-swu-muted">
              <span className="mr-2 inline-block animate-spin">◠</span>
              Sellando el sobre…
            </p>
          ) : fase === 'sellado' ? (
            <Button onClick={rasgar} className="px-8">
              Rasgar
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  // ── Revelando de una en una ──────────────────────────────────────────
  if (fase === 'revelando' && actual && receta) {
    const vertical = !(actual.carta?.isLeader || actual.carta?.isBase)

    return (
      <div className="flex flex-col items-center">
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
          className="carta3d-escena relative flex w-full max-w-[300px] items-center justify-center
                     focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-swu-cyan"
          style={{ height: `calc(${ALTO_CARTA} + 34px)` }}
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

          {/* La carta: un solo nodo que gira 180°, con las dos caras dentro. */}
          <span
            className="relative block"
            style={{
              ...cajaCarta,
              transformStyle: 'preserve-3d',
              transform: girada ? 'rotateY(0deg)' : 'rotateY(180deg)',
              transition: quieto ? 'none' : 'transform 620ms cubic-bezier(0.34,1.3,0.42,1)',
              willChange: 'transform',
            }}
          >
            {/* Cara: el arte real de la impresión que salió */}
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {actual.arte || actual.carta ? (
                <CardImage
                  src={actual.arte || actual.carta?.imageUrl}
                  alt={actual.carta?.name ?? 'Carta'}
                  orientacion={vertical ? 'vertical' : 'apaisada'}
                  className="w-full"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-xl bg-swu-surface text-sm text-swu-muted">
                  Carta sin arte local
                </span>
              )}
              {/* El brillo, hermano de la imagen y no hijo: CardImage lleva
                  `overflow-hidden` y `drop-shadow`, que aplanarían el 3D. Solo
                  se pinta una vez girada — antes taparía el dorso. */}
              {girada && (
                <Acabado acabado={ACABADO[actual.rareza]} movimiento="solo" apaisada={esApaisada(actual.carta)} />
              )}
            </span>

            {/* Reverso */}
            <span
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
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

        <button
          type="button"
          onClick={() => setFase('resumen')}
          className="mt-1 text-xs text-swu-muted/70 underline underline-offset-4"
        >
          Ver todas de una vez
        </button>

        {/* El fogonazo tapa la pantalla un instante. `position: fixed` para que
            no lo recorte el contenedor de la carta. */}
        {fogonazo && (
          <span
            aria-hidden
            className="fogonazo pointer-events-none fixed inset-0 z-50"
            style={{ background: fogonazo }}
          />
        )}
      </div>
    )
  }

  // ── Todo lo que salió ────────────────────────────────────────────────
  const lista = cartas ?? []
  const mejor = lista.reduce(
    (a, c) => (ESCALA.indexOf(c.rareza) > ESCALA.indexOf(a.rareza) ? c : a),
    lista[0],
  )

  return (
    <div>
      <div className="mb-4 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-swu-muted">
          Sobre abierto
        </p>
        {mejor && (
          <p className="mt-1 text-sm" style={{ color: RECETA[mejor.rareza].color }}>
            <Sparkles size={13} className="mr-1 inline" />
            Lo mejor: {NOMBRE_RAREZA[mejor.rareza]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {lista.map((c, i) => (
          <div key={`${c.cardId}-${i}`} className="carta3d-escena">
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
                  <CardImage
                    src={c.arte || c.carta?.imageUrl}
                    alt={c.carta?.name ?? 'Carta'}
                    orientacion={esApaisada(c.carta) ? 'apaisada' : 'vertical'}
                    className="w-full"
                  />
                ) : (
                  <div className="aspect-[286/400] rounded-lg bg-swu-surface" />
                )}
                {/* Cinco a la vez: acabado barato. */}
                <Acabado acabado={ACABADO[c.rareza]} calidad="plano" apaisada={esApaisada(c.carta)} />
              </div>
            </Carta3D>
            <p className="mt-1 truncate text-[10px] text-swu-muted" title={c.carta?.name}>
              {c.carta?.name ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {alRepetir && (
          <Button onClick={alRepetir} className="px-7">
            Abrir otro
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
