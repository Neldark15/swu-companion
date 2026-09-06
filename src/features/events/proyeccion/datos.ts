/**
 * Los datos de la proyección, y sobre todo: qué hacer cuando dejan de llegar.
 *
 * Esta pantalla es la única de la app que corre TRES HORAS SIN QUE NADIE LA
 * TOQUE, en un televisor, deslogueada. Eso cambia cuál es el peor modo de
 * fallo. En un teléfono, quedarse sin datos es una molestia: la persona tira
 * para refrescar. Acá no hay quien tire de nada, así que el peor fallo no es la
 * pantalla en blanco —esa se nota— sino **el tablero congelado que sigue
 * pareciendo correcto**: la ronda 2 en pantalla mientras la sala juega la 4.
 *
 * Por eso hay cuatro capas y no una:
 *
 *   1. tiempo real  — lo normal, llega en menos de un segundo
 *   2. sondeo cada 30 s — porque `subscribeToEvent` llama a `.subscribe()` SIN
 *      callback de estado (tournamentCloud.ts:1477): un CHANNEL_ERROR es hoy
 *      completamente mudo, y un canal muerto se ve igual que un torneo tranquilo
 *   3. relectura al volver la pestaña al frente
 *   4. recarga entera a los 12 minutos sin una lectura buena
 *
 * La cuarta es la que importa y por eso está escrita aquí: **un tablero
 * congelado que miente es peor que un segundo en negro.**
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getEventTournamentInfo, getStandings, getRoundPairings,
  subscribeToEvent,
  type CloudEvent, type CloudStanding, type CloudPairing,
} from '../../../services/tournamentCloud'
import { ultimaRonda, getMesasDeRonda, type MesaArmada } from '../../../services/mesasService'
import { getLogosPorFormato, logoDe } from '../../../services/events'
import { esDeMesas } from '../../../services/tipoTorneo'
import { supabase, isSupabaseReady } from '../../../services/supabase'
import { mesaCerrada } from './filas'

/** En qué está el torneo. Lo decide el HECHO, no un campo de estado suelto. */
export type EstadoTablero =
  | 'cargando'
  | 'no-encontrado'
  | 'cancelado'
  | 'convocatoria'   // todavía no empieza
  | 'sorteando'      // hay ronda pero no hay ni mesas ni pareos
  | 'tablero'        // lo normal, el 90% del tiempo
  | 'cierre-ronda'   // todas las mesas cerraron y no ha avanzado
  | 'final'

const SONDEO_MS = 30_000
const VIGILANTE_MS = 12 * 60_000

export interface DatosProyeccion {
  estado: EstadoTablero
  evento: CloudEvent | null
  logo: string | null
  standings: CloudStanding[]
  pairings: CloudPairing[]
  mesas: MesaArmada[]
  deMesas: boolean
  /** Cuántas mesas cerraron y cuántas hay. Alimenta el instrumento «MESAS 5/8». */
  mesasListas: number
  mesasTotal: number
  /** Milisegundos desde la última lectura BUENA. Alimenta el punto del pie. */
  frescuraMs: number
}

export function useProyeccion(code: string | undefined): DatosProyeccion {
  const [evento, setEvento] = useState<CloudEvent | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [standings, setStandings] = useState<CloudStanding[]>([])
  const [pairings, setPairings] = useState<CloudPairing[]>([])
  const [mesas, setMesas] = useState<MesaArmada[]>([])
  const [buscado, setBuscado] = useState(false)
  const [frescuraMs, setFrescuraMs] = useState(0)

  /* La marca de la última lectura BUENA va en una ref y no en el estado: la
     escribe el traedor y la lee el vigilante, y si estuviera en el estado cada
     lectura re-crearía el efecto que monta el vigilante. Arranca en 0 y no en
     `Date.now()` porque leer el reloj durante el render es impuro; el vigilante
     la siembra en su primera vuelta. */
  const ultimaBuena = useRef(0)

  const traer = useCallback(async () => {
    if (!code) return
    const ev = await getEventTournamentInfo(code)
    if (!ev) { setBuscado(true); return }

    const deMesas = esDeMesas(ev.tournament_type)

    const [clas, pares, ronda, logos] = await Promise.all([
      getStandings(ev.id),
      ev.current_round > 0 && !deMesas
        ? getRoundPairings(ev.id, ev.current_round)
        : Promise.resolve([] as CloudPairing[]),
      deMesas ? ultimaRonda(ev.id) : Promise.resolve(null),
      getLogosPorFormato(),
    ])

    setEvento(ev)
    setStandings(clas)
    setPairings(pares)
    setMesas(ronda ? await getMesasDeRonda(ronda.id) : [])
    setLogo(logoDe(ev, logos))
    setBuscado(true)
    ultimaBuena.current = Date.now()
  }, [code])

  // Primera lectura y sondeo de respaldo.
  useEffect(() => {
    // Envuelto en una función asíncrona a propósito: llamarlo en seco desde el
    // cuerpo del efecto encadena un render antes de que React pinte.
    void (async () => { await traer() })()
    const t = setInterval(() => { void traer() }, SONDEO_MS)
    return () => clearInterval(t)
  }, [traer])

  // Tiempo real. Las cinco tablas están en la publicación (verificado), pero
  // el canal puede morir sin avisar — por eso lo de arriba no se quita.
  useEffect(() => {
    const id = evento?.id
    if (!id || !isSupabaseReady()) return

    const cortar = subscribeToEvent(id, {
      onStandingsChange: () => { void traer() },
      onPairingsChange: () => { void traer() },
      onEventChange: () => { void traer() },
    })

    /* Las mesas van por canal propio: `subscribeToEvent` no las mira, y en un
       torneo de mesas son LO ÚNICO que cambia durante una ronda entera. Este
       sí lleva callback de estado. */
    const canal = supabase
      .channel(`proy-mesas-${id}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_mesas', filter: `event_id=eq.${id}` },
          () => { void traer() })
      .subscribe(estado => {
        if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          console.warn('[proyección] el canal de mesas no quedó:', estado, '— queda el sondeo')
        }
      })

    return () => { cortar(); void supabase.removeChannel(canal) }
  }, [evento?.id, traer])

  // Al volver la pestaña al frente, releer. Una tele que estuvo tapada por un
  // salvapantallas vuelve con datos viejos y nadie lo notaría.
  useEffect(() => {
    const alVolver = () => { if (!document.hidden) void traer() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [traer])

  // El reloj de frescura y el vigilante.
  useEffect(() => {
    if (ultimaBuena.current === 0) ultimaBuena.current = Date.now()
    const t = setInterval(() => {
      const desde = Date.now() - ultimaBuena.current
      setFrescuraMs(desde)
      /* Doce minutos sin una lectura buena: se recarga la página entera. Un
         tablero congelado que miente es peor que un segundo en negro. */
      if (desde > VIGILANTE_MS) location.reload()
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Mantener la pantalla encendida. Falla en silencio en Tizen y webOS, que es
  // justo donde más falta hace: la respuesta de verdad es apagarle el ahorro de
  // energía al televisor, y eso va en la nota de operación, no en el código.
  useEffect(() => {
    let candado: WakeLockSentinel | null = null
    const pedir = async () => {
      try { candado = await navigator.wakeLock?.request('screen') ?? null } catch { /* no hay */ }
    }
    void pedir()
    const alVolver = () => { if (!document.hidden) void pedir() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      void candado?.release().catch(() => {})
    }
  }, [])

  const deMesas = evento ? esDeMesas(evento.tournament_type) : false

  const mesasTotal = deMesas ? mesas.length : pairings.length
  const mesasListas = deMesas
    ? mesas.filter(m => m.anotada).length
    : pairings.filter(mesaCerrada).length

  return {
    estado: decidirEstado({ evento, buscado, standings, pairings, mesas, deMesas, mesasListas, mesasTotal }),
    evento, logo, standings, pairings, mesas, deMesas,
    mesasListas, mesasTotal, frescuraMs,
  }
}

/**
 * Qué se dibuja. Se decide por HECHOS, no por un campo de estado a secas.
 *
 * Es una función aparte y exportada para poder probarla: los estados feos
 * —convocatoria sin siembra, sorteo, cierre de ronda— son exactamente los que
 * nunca se ven al desarrollar y siempre se ven en la tienda.
 */
export function decidirEstado(d: {
  evento: CloudEvent | null
  buscado: boolean
  standings: CloudStanding[]
  pairings: CloudPairing[]
  mesas: MesaArmada[]
  deMesas: boolean
  mesasListas: number
  mesasTotal: number
}): EstadoTablero {
  if (!d.evento) return d.buscado ? 'no-encontrado' : 'cargando'

  /* «cancelado» va antes que todo lo demás. Sin este caso, un torneo cancelado
     —que se queda con current_round en 0— caería en la convocatoria y estaría
     anunciando «INSCRIPCIÓN ABIERTA» en verde toda la tarde. */
  if (d.evento.status === 'cancelled') return 'cancelado'
  if (d.evento.status === 'finished') return 'final'
  if (d.evento.status === 'open' || d.evento.current_round === 0) return 'convocatoria'

  // Hay ronda pero todavía no hay a quién sentar dónde.
  if (d.mesasTotal === 0) return 'sorteando'

  // Todo cerrado y el organizador aún no avanzó.
  if (d.mesasListas === d.mesasTotal) return 'cierre-ronda'

  return 'tablero'
}
