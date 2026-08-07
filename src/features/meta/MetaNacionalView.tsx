/**
 * MetaNacionalView — el meta de El Salvador, sin inflarlo.
 *
 * Es la única de las cuatro pestañas del meta que habla de NOSOTROS. Las otras
 * describen el mundo (torneos oficiales, arquetipos globales, matchups de un
 * Galactic); esta lee las clasificaciones finales que publica melee.gg y se
 * queda solo con lo que de verdad es salvadoreño.
 *
 * ── Dos ámbitos, y NUNCA se mezclan ───────────────────────────────────
 *
 * - **«Acá»** — torneos organizados en El Salvador. Cuenta la sala ENTERA,
 *   porque esa sala *es* el meta que te vas a encontrar el sábado.
 * - **«Los nuestros»** — solo las filas de jugadores salvadoreños con su cuenta
 *   de melee enlazada, jueguen donde jueguen.
 *
 * Mezclarlos sería la mentira fácil: dos salvadoreños metidos en un Galactic
 * Open de 1.022 no convierten a esos 1.022 en el meta nacional. Por eso el
 * ámbito es un interruptor visible y no un promedio escondido.
 *
 * Y por eso la lista de un torneo se ROTULA distinto según el ámbito: en «acá»
 * es el top real de la sala; en «los nuestros» es dónde quedaron los nuestros,
 * que puede ser el puesto 340. Llamar «top» a lo segundo sería mentir.
 *
 * ── El quórum es la razón de ser de esta vista ────────────────────────
 *
 * Un torneo local salvadoreño son 8 personas, y muchas de esas filas ni
 * publican lista. Con 3 listas, «el 100% del meta nacional es Cad Bane» no es
 * un dato: es una frase que suena a dato. Por debajo de `QUORUM` esta pantalla
 * **no dibuja un solo porcentaje** —ni cuota, ni percentil, ni barra—: solo
 * conteos crudos y un aviso de que la muestra es chica. Un módulo que se calla
 * vale más que uno que inventa.
 *
 * ── El denominador es `conArquetipo`, no `totalFilas` ─────────────────
 *
 * La tabla solo puede hablar de las listas que se pudieron identificar. Dividir
 * entre `totalFilas` —que incluye a los que no publicaron mazo— achicaría todas
 * las cuotas y ninguna sumaría 100%. Las que no se pudieron leer se cuentan
 * aparte, a la vista, en vez de diluirse en el denominador.
 *
 * Y se cuentan en DOS montones, porque no dicen lo mismo: `sinLista` es gente
 * que no publicó mazo —un hecho del torneo, nada que arreglar— y `noParseado`
 * es gente que SÍ lo publicó y nosotros no supimos leerlo. Lo segundo delata
 * que el lector está roto, así que esconderlo dentro del primero sería taparse
 * los ojos con la mano.
 *
 * ── Un agregado parcial se declara parcial ────────────────────────────
 *
 * Si el servicio no pudo traer todo, devuelve `parcial: true` con lo que
 * alcanzó. Eso NO se dibuja como si fuera el total: con `parcial` esta
 * pantalla se calla los porcentajes exactamente igual que sin quórum, porque
 * un 40% calculado sobre la mitad de las filas no es el 40% de nada.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Flag, ExternalLink, RefreshCw, AlertTriangle, Users, Trophy, WifiOff, Link2,
  CalendarDays, BadgeCheck, CircleDashed,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl, type SegmentOption } from '../../components/ui/SegmentedControl'
import { CardImage } from '../../components/CardImage'
import { getCardsByIds } from '../../services/swuApi'
import { useAuth } from '../../hooks/useAuth'
import type { Card } from '../../types'
import {
  getMetaNacional, dispararIngesta, QUORUM,
  type MetaNacional, type AmbitoMeta, type ArquetipoNacional, type TorneoNacional,
} from '../../services/metaNacionalService'
import { fechaCompacta } from '../../services/horaSV'

/** melee.gg, que es de donde salen estas clasificaciones. */
const FUENTE = { nombre: 'melee.gg', url: 'https://melee.gg' }

/**
 * El id del torneo viaja como TEXTO —así está en `meta_tournaments`— y acá se
 * arma la URL a mano en vez de reusar `urlTorneoMelee()`, que espera un number.
 * Convertirlo con `Number()` solo para satisfacer una firma agrega una forma de
 * producir `/Tournament/View/NaN`.
 */
const urlTorneo = (id: string) => `https://melee.gg/Tournament/View/${encodeURIComponent(id)}`

/**
 * Los dos ámbitos, en el control segmentado compartido y no en dos chips
 * sueltos: es la elección más importante de la pantalla —cambia el significado
 * de TODOS los números de abajo— y como `radiogroup` de verdad se anuncia como
 * un grupo con dos opciones y se recorre con las flechas.
 */
const AMBITOS: SegmentOption<AmbitoMeta>[] = [
  { value: 'aca', label: 'Acá' },
  { value: 'nuestros', label: 'Los nuestros' },
]

/** Récord como lo escribe melee: `4-1`, o `4-1-1` cuando hubo empates. */
const record = (a: ArquetipoNacional) =>
  `${a.victorias}-${a.derrotas}${a.empates ? `-${a.empates}` : ''}`

/**
 * Una fila de la tabla de arquetipos.
 *
 * El líder va con su cara APAISADA de frente —así se reconoce un mazo de un
 * vistazo— y la base al lado, más chica: desempata dos mazos del mismo líder,
 * pero no es lo primero que se mira. Las dos son 400x286, así que la caja se
 * declara con esa proporción y no hay recorte ni salto de layout.
 */
function FilaArquetipo({
  a, listas, mostrarCuotas, cartas, maxVeces,
}: {
  a: ArquetipoNacional
  /** `conArquetipo`: el único denominador honesto de esta tabla. */
  listas: number
  /**
   * Si se puede dibujar un porcentaje. Es quórum **y** muestra completa: los
   * dos motivos para callarse producen exactamente el mismo silencio, así que
   * viajan resueltos en un solo booleano en vez de repetir la condición en
   * cada uno de los tres sitios donde hay un número relativo.
   */
  mostrarCuotas: boolean
  cartas: Map<string, Card>
  maxVeces: number
}) {
  const cuota = listas > 0 ? a.vecesJugado / listas : 0

  return (
    <li className="flex items-center gap-2 bg-swu-surface rounded-lg border border-swu-border px-2.5 py-2">
      <div className="flex items-center gap-1 flex-shrink-0">
        <CardImage
          src={cartas.get(a.liderId)?.imageUrl}
          alt={a.liderNombre}
          orientacion="apaisada"
          fit="cover"
          className="w-14 aspect-[400/286]"
        />
        <CardImage
          src={cartas.get(a.baseId)?.imageUrl}
          alt={a.baseNombre}
          orientacion="apaisada"
          fit="cover"
          className="w-9 aspect-[400/286]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-swu-text truncate leading-tight">{a.liderNombre}</p>
        <p className="text-[10px] text-swu-muted truncate">{a.baseNombre}</p>
        <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[10px] font-mono text-swu-muted">
          <span>{record(a)}</span>
          {/* El puesto SIEMPRE con su denominador, o no va (gotcha 2n): un
              «mejor 3.º» puede ser 3 de 4, y sin el «de N» esa cifra se lee como
              un logro que quizá no existió. Cuando la fuente no dijo cuántos
              jugaron, la respuesta honesta no es enseñarlo a medias: es no
              enseñarlo. El récord de al lado ya dice cómo le fue. */}
          {a.mejorPuesto !== null && a.participantes !== null && (
            <span className="text-swu-amber" title="Su mejor puesto, y de cuántos jugadores">
              mejor {a.mejorPuesto}.º de {a.participantes}
            </span>
          )}
          {/* El percentil medio también es un porcentaje, así que también se
              calla sin quórum o con la muestra incompleta: promediar tres
              puestos no describe nada. */}
          {mostrarCuotas && a.percentilMedio !== null && (
            <span className="text-swu-cyan">percentil {a.percentilMedio}</span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0 w-16">
        {mostrarCuotas ? (
          <>
            <p className="text-sm font-mono font-bold text-swu-text leading-none">
              {(cuota * 100).toFixed(0)}%
            </p>
            {/* El «de N» va SIEMPRE pegado a la cuota, nunca en una nota al pie:
                un 40% de 5 listas y un 40% de 200 no son el mismo hecho. */}
            <p className="text-[9px] text-swu-muted font-mono mt-0.5">
              {a.vecesJugado} de {listas}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-mono font-bold text-swu-text leading-none">{a.vecesJugado}</p>
            <p className="text-[9px] text-swu-muted font-mono mt-0.5">de {listas}</p>
          </>
        )}
        {/* La barra es un porcentaje dibujado, así que solo aparece cuando el
            porcentaje aparece: si no, afirmaría en píxeles justo lo que
            estamos tapando en cifras. */}
        {mostrarCuotas && (
          <div className="h-1 rounded-full bg-swu-bg overflow-hidden mt-1" aria-hidden>
            <div
              className="h-full rounded-full bg-swu-amber/70"
              style={{ width: `${maxVeces > 0 ? (a.vecesJugado / maxVeces) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Un torneo con sus filas. Enlaza a melee, que es donde viven los datos.
 *
 * ── `t.fecha` SÍ es un instante, y por eso va por `fechaCompacta` ──────
 *
 * Acá vivía un `fecha()` propio que partía el ISO a mano —`iso.slice(0, 10)`—
 * porque «`new Date(iso)` se lee en UTC y en El Salvador mostraría el día
 * anterior». Ese razonamiento vale para una fecha SIN zona, como las de la
 * agenda mundial (ver `diaMesSinZona` en horaSV). Este valor no es eso:
 * `meta_tournaments.date` es **timestamptz**, y melee publica
 * `TournamentStartDate` en UTC. Cortar a 10 devolvía el día **UTC**, seis
 * horas adelante del nuestro.
 *
 * Medido contra las 8 filas de la tabla: los tres Weekly Play —los únicos que
 * empiezan de noche, 19:00 y 19:30 SV— se mostraban **un día tarde** (14 mar
 * por 13 mar, 7 mar por 6 mar, 28 feb por 27 feb). Los Galactic, que son de la
 * mañana, no cruzaban la medianoche UTC y por eso el bug pasaba desapercibido:
 * pegaba justo en los torneos de sala, que son el punto de la pestaña.
 */
function FilaTorneo({ t, ambito }: { t: TorneoNacional; ambito: AmbitoMeta }) {
  return (
    <li className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2">
      <a
        href={urlTorneo(t.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 group"
      >
        <Trophy size={13} className="text-swu-amber flex-shrink-0 mt-0.5" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-swu-text group-hover:text-swu-cyan leading-tight">
            {t.nombre}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[10px] font-mono text-swu-muted">
            {t.fecha && (
              <span className="flex items-center gap-0.5">
                <CalendarDays size={9} aria-hidden />{fechaCompacta(t.fecha)}
              </span>
            )}
            {t.jugadores !== null && (
              <span className="flex items-center gap-0.5">
                <Users size={9} aria-hidden />{t.jugadores}
              </span>
            )}
            {t.organizador && <span className="truncate max-w-[45%]">{t.organizador}</span>}
            {t.esLocal && <span className="text-swu-green">local</span>}
          </span>
        </span>
        <ExternalLink size={11} className="text-swu-cyan flex-shrink-0 mt-0.5" aria-hidden />
      </a>

      {t.top.length > 0 && (
        <>
          {/* El rótulo cambia con el ámbito, y no por gusto: en «los nuestros»
              estas filas pueden ser el puesto 340 de una sala de 1.022.
              Llamarlas «top» ahí sería una mentira de una sola palabra. */}
          <p className="text-[9px] font-mono uppercase tracking-wider text-swu-muted/60">
            {ambito === 'aca' ? 'Top de la sala' : 'Dónde quedaron los nuestros'}
            {t.jugadores !== null && ` · de ${t.jugadores}`}
          </p>
          <ol className="space-y-0.5">
            {t.top.map(p => (
              <li key={`${p.puesto}-${p.jugador}`} className="flex items-baseline gap-2 text-[11px]">
                <span
                  className={`w-6 text-right font-mono flex-shrink-0 ${
                    p.puesto === 1 ? 'text-swu-amber font-bold' : 'text-swu-muted'
                  }`}
                >
                  {p.puesto}
                </span>
                <span className="flex items-baseline gap-1 min-w-0 flex-shrink-0 max-w-[45%]">
                  <span className="text-swu-text truncate">{p.jugador}</span>
                  {/* Los TRES estados de `verificado` son tres cosas distintas y
                      solo dos se dibujan:
                        true  → visto: un admin confirmó que la cuenta es suya.
                        false → aro punteado: está enlazada y nadie la revisó.
                                No es una acusación —nadie PUEDE probar que una
                                cuenta de melee es suya (gotcha 2n)— y hoy es el
                                estado de casi todos.
                        null  → nada: esta persona no está en la comunidad, que
                                en «acá» es el caso normal. Marcarla sería
                                inventarle un estado que no tiene. */}
                  {p.verificado === true && (
                    <span
                      role="img"
                      aria-label="cuenta de melee confirmada"
                      title="Cuenta de melee confirmada por un administrador"
                      className="flex-shrink-0 text-swu-cyan"
                    >
                      <BadgeCheck size={10} aria-hidden />
                    </span>
                  )}
                  {p.verificado === false && (
                    <span
                      role="img"
                      aria-label="cuenta de melee sin confirmar"
                      title="Cuenta enlazada, sin confirmar: nadie ha revisado todavía que sea de quien dice"
                      className="flex-shrink-0 text-swu-muted/50"
                    >
                      <CircleDashed size={10} aria-hidden />
                    </span>
                  )}
                </span>
                {/* Sin lista publicada no se rellena con nada: en un local de 8
                    los 8 pueden venir sin mazo, y eso es un hecho, no un hueco. */}
                <span className="text-swu-muted truncate min-w-0">
                  {p.mazo ?? <span className="italic text-swu-muted/60">sin lista</span>}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </li>
  )
}

/** Invitación a enlazar melee. Se usa vacía y con datos, así que va suelta. */
function BotonEnlazar() {
  return (
    <Link
      to="/profile"
      className="inline-flex items-center justify-center gap-1.5 font-semibold border
                 bg-swu-surface text-swu-text border-swu-border hover:border-swu-accent/40
                 text-xs px-3 min-h-11 rounded-xl transition-colors active:scale-[0.98]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      <Link2 size={13} aria-hidden /> Enlazar mi melee
    </Link>
  )
}

export function MetaNacionalView() {
  // Las tablas del meta se leen solo con sesión (RLS `to authenticated`): el
  // dato es público en melee, pero el valor de haberlo juntado es de la
  // comunidad. Para un visitante sin sesión el «permission denied» es lo
  // ESPERADO, no un fallo — mostrarle un error rojo con un código de Postgres
  // sería alarmar por algo que se arregla iniciando sesión. Se corta acá.
  const { supabaseUser: sesion } = useAuth()
  const [ambito, setAmbito] = useState<AmbitoMeta>('aca')
  const [datos, setDatos] = useState<MetaNacional | null>(null)
  const [cartas, setCartas] = useState<Map<string, Card>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  /** Lo que contestó la ingesta. Se enseña tal cual: si dice que no hay nada
   *  nuevo, eso es información y no un fallo que haya que disimular. */
  const [avisoIngesta, setAvisoIngesta] = useState<string | null>(null)

  /** Descarta la respuesta de un ámbito ya abandonado: sin esto, la consulta
   *  lenta de «Acá» pisaba los datos de «Los nuestros» bajo el rótulo del otro. */
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const id = ++peticion.current
    setCargando(true)
    setError(null)
    try {
      const d = await getMetaNacional(ambito)
      if (id !== peticion.current) return
      setDatos(d)
    } catch (e) {
      if (id !== peticion.current) return
      // Lo que ya había se conserva SOLO si es de este mismo ámbito. Dejar los
      // arquetipos de «acá» bajo el rótulo de «los nuestros» sería mentir —ese
      // era el motivo de tirarlo todo—, pero como cada respuesta declara su
      // `ambito` ahora se puede distinguir un caso del otro en vez de castigar
      // a los dos: si falla el refresco del ámbito que ya está en pantalla, se
      // queda lo que había con el aviso encima.
      setDatos(prev => (prev && prev.ambito === ambito ? prev : null))
      setError(e instanceof Error ? e.message : 'no se pudo consultar')
    } finally {
      if (id === peticion.current) setCargando(false)
    }
  }, [ambito])

  useEffect(() => { void cargar() }, [cargar])

  /**
   * Las imágenes de líder y base. Va aparte del fetch porque un fallo de
   * IndexedDB no es culpa de los datos: sin arte la tabla se sigue leyendo
   * entera —nombres, conteos y récords vienen del servicio—.
   *
   * No hace falta `ensureCards()`: el servicio ya resolvió estos arquetipos
   * contra la base local, así que si hay ids es porque las cartas están.
   */
  useEffect(() => {
    const ids = [
      ...new Set((datos?.arquetipos ?? []).flatMap(a => [a.liderId, a.baseId])),
    ]
    if (ids.length === 0) return
    let vivo = true
    void getCardsByIds(ids)
      .then(m => { if (vivo) setCartas(m) })
      .catch(() => { /* sin imágenes, la tabla se lee igual */ })
    return () => { vivo = false }
  }, [datos])

  /** Pide una pasada de ingesta y relee. La descarga real la hace el cron cada
   *  6 h; esto solo adelanta el turno para quien está mirando la pantalla. */
  const buscarNuevos = async () => {
    setBuscando(true)
    setAvisoIngesta(null)
    try {
      const r = await dispararIngesta()
      setAvisoIngesta(r.mensaje)
      if (r.ok) await cargar()
    } catch (e) {
      setAvisoIngesta(e instanceof Error ? e.message : 'no se pudo pedir la ingesta')
    } finally {
      setBuscando(false)
    }
  }

  const maxVeces = useMemo(
    () => (datos?.arquetipos ?? []).reduce((m, a) => Math.max(m, a.vecesJugado), 0),
    [datos],
  )

  /** El denominador de la tabla: solo las listas que se pudieron identificar. */
  const listas = datos?.conArquetipo ?? 0
  const hayQuorum = datos?.hayQuorum ?? false
  /** Faltaron datos: lo de abajo es un pedazo, no el total. */
  const parcial = datos?.parcial ?? false
  /** La base local de cartas está a medias, así que el parser no es de fiar. */
  const baseIncompleta = datos?.baseIncompleta ?? false
  /**
   * Muestra chica de verdad —pocas listas—, que es UNA de las razones por las
   * que `hayQuorum` puede venir en `false`. Se separa porque el aviso las
   * distingue: con 200 listas y el agregado a medias, decir «muestra chica»
   * sería falso aunque el silencio de los porcentajes sea el mismo.
   */
  const muestraChica = listas < QUORUM
  /**
   * Los tres motivos para callarse un porcentaje, resueltos de una vez. Sin
   * quórum el número describe una anécdota; con la muestra incompleta o la base
   * de cartas a medias describe un trozo al azar. La respuesta honesta es
   * siempre la misma: el conteo crudo.
   *
   * `hayQuorum` ya incluye los tres del lado del servicio; se repiten acá a
   * propósito, porque el día que ese cálculo cambie lo peor que puede pasar es
   * que esta pantalla se calle de más.
   */
  const mostrarCuotas = hayQuorum && !parcial && !baseIncompleta
  const sinDatos = !datos || (datos.arquetipos.length === 0 && datos.torneos.length === 0)
  /**
   * «¿Hay alguien enlazado en la comunidad?» — una pregunta GLOBAL, y por eso
   * se responde con `jugadoresEnlazados` y nunca con `jugadoresConFilas`. Con
   * diez enlazados y un torneo local lleno de gente de fuera, `jugadoresConFilas`
   * es 0 y decir «nadie tiene su melee enlazado» sería sencillamente falso.
   */
  const sinEnlaces = (datos?.jugadoresEnlazados ?? 0) === 0
  /**
   * El ámbito de lo que se está DIBUJANDO, que durante una recarga todavía no
   * es el que ya marcó el interruptor. Los rótulos cuelgan de este y no del
   * estado, porque «Top de la sala» sobre las filas del otro ámbito sería una
   * mentira de una sola palabra —justo la que este archivo evita en todos
   * lados— y duraría lo que dure la consulta.
   */
  const ambitoMostrado = datos?.ambito ?? ambito

  /**
   * La ÚNICA frase que se anuncia sola.
   *
   * Antes el `aria-live` envolvía el resultado entero, así que cada cambio de
   * ámbito le recitaba a un lector de pantalla la tabla completa, los torneos y
   * los pies de nota. Aquí va el estado y nada más; el contenido se lee cuando
   * la persona decide leerlo.
   */
  const estado = (() => {
    if (cargando) return datos ? 'Actualizando el meta nacional…' : 'Consultando el meta nacional…'
    if (error && !datos) return `No se pudo leer el meta nacional: ${error}`
    if (error) return `No se pudo actualizar: ${error}`
    if (!datos) return ''
    if (sinDatos) return 'Todavía no hay torneos que contar.'
    const base = `${datos.arquetipos.length} ${datos.arquetipos.length === 1 ? 'arquetipo' : 'arquetipos'} de ${listas} ${listas === 1 ? 'lista identificada' : 'listas identificadas'}, sobre ${datos.totalFilas} ${datos.totalFilas === 1 ? 'fila' : 'filas'}.`
    if (parcial) return `${base} Muestra incompleta: sin porcentajes.`
    if (baseIncompleta) return `${base} Base de cartas incompleta: sin porcentajes.`
    if (muestraChica) return `${base} Muestra chica: sin porcentajes.`
    return base
  })()

  // Sin sesión no hay nada que consultar: el «permission denied» que daría la
  // base es lo esperado, no un error que enseñar en rojo. Se invita, y ya.
  if (!sesion) {
    return (
      <EmptyState
        icon={<Flag size={28} aria-hidden />}
        title="El meta salvadoreño"
        hint="Los torneos y arquetipos de la comunidad se ven con sesión iniciada. Entrá y aparece todo."
        action={
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-swu-cyan"
          >
            <Link2 size={13} aria-hidden /> Iniciar sesión
          </Link>
        }
      />
    )
  }

  return (
    <>
      {/* Qué es esto en una frase, y de quién son los datos. La atribución va
          arriba y visible, no al pie: es material ajeno. */}
      <div className="flex items-center gap-2 text-[11px] text-swu-muted bg-swu-surface border border-swu-border rounded-xl px-3 py-2">
        <Flag size={13} className="text-swu-amber flex-shrink-0" aria-hidden />
        <span className="flex-1 leading-snug min-w-0">
          El meta salvadoreño, armado con las clasificaciones finales que publica{' '}
          <a
            href={FUENTE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-swu-cyan underline underline-offset-2"
          >
            {FUENTE.nombre}
          </a>
        </span>
        <button
          onClick={() => void buscarNuevos()}
          disabled={buscando || cargando}
          aria-label="Buscar torneos nuevos"
          className="text-swu-muted hover:text-swu-text rounded p-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
        >
          <RefreshCw size={13} className={buscando ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      {/* Lo que contestó la ingesta, en su propia región viva: es la respuesta
          a un botón concreto y llega en otro momento que el estado de la
          consulta, así que mezclarlas haría que una pisara a la otra. Va
          siempre montada porque una región que nace ya con texto no se
          anuncia. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {avisoIngesta && (
          <p className="text-[10px] text-swu-muted font-mono px-1">{avisoIngesta}</p>
        )}
      </div>

      {/* Ámbito. La diferencia no es obvia, así que se explica en una línea en
          vez de dejarla en dos etiquetas que cada quien interpreta a su modo. */}
      <div className="space-y-1.5">
        <SegmentedControl
          label="Ámbito del meta nacional"
          value={ambito}
          onChange={setAmbito}
          options={AMBITOS}
        />
        <p className="text-[10px] text-swu-muted leading-snug">
          {ambito === 'aca'
            ? 'Torneos jugados en El Salvador, contando la sala entera: es lo que te vas a encontrar el sábado.'
            : 'Solo las listas de jugadores de acá con su melee enlazado, jueguen donde jueguen.'}
          {' '}Los dos ámbitos nunca se suman: dos salvadoreños en un Galactic de
          1.022 no hacen que esos 1.022 sean nuestro meta.
        </p>
      </div>

      {/* ── La línea de estado ──
          El resultado NO se anuncia: se anuncia esta frase y nada más. Antes el
          `aria-live` envolvía la tabla, los torneos y los pies de nota, así que
          cada cambio de ámbito se los recitaba enteros a un lector de pantalla.
          Va siempre montada —una región viva que nace junto con su texto no se
          anuncia— y hace además de indicador de recarga: durante una consulta
          lo de abajo se atenúa y esta línea dice por qué, en vez de vaciar la
          pantalla. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {estado && (
          <p
            className={`flex items-start gap-1.5 text-[10px] font-mono px-1 leading-snug ${
              error ? 'text-swu-red' : 'text-swu-muted'
            }`}
          >
            {cargando && <RefreshCw size={10} className="animate-spin flex-shrink-0 mt-0.5" aria-hidden />}
            <span className="min-w-0">{estado}</span>
          </p>
        )}
      </div>

      <div
        aria-busy={cargando}
        className={`space-y-3 transition-opacity ${cargando && datos ? 'opacity-50' : ''}`}
      >
        {/* Primera carga y nada que enseñar todavía. `aria-hidden` porque la
            línea de estado ya lo dijo, y decirlo dos veces es peor que una. */}
        {cargando && !datos && (
          <p className="text-center text-xs text-swu-muted py-8" aria-hidden>
            Consultando el meta nacional…
          </p>
        )}

        {!cargando && error && !datos && (
          <EmptyState
            icon={<WifiOff size={28} aria-hidden />}
            title="No se pudo leer el meta nacional"
            hint={`${error}. Esta sección necesita internet.`}
            action={
              <Button size="sm" variant="secondary" onClick={() => void cargar()}>
                Reintentar
              </Button>
            }
          />
        )}

        {/* El QUÉ pasó ya lo dice —y lo anuncia— la línea de estado. Este
            recuadro dice lo que hay que saber para leer lo de abajo: que no es
            lo de ahora. Repetir el mensaje de error palabra por palabra dos
            veces seguidas se lee como un fallo del programa. */}
        {error && datos && (
          <div className="flex items-start gap-2 text-[11px] text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
            <span className="leading-snug min-w-0">
              Esto es lo último que se pudo leer, no lo de ahora.{' '}
              <button
                onClick={() => void cargar()}
                disabled={cargando}
                className="underline underline-offset-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent rounded"
              >
                Reintentar
              </button>
            </span>
          </div>
        )}

        {/* Vacío: no es un error ni una carencia que haya que dramatizar, es una
            invitación. Los torneos se descubren desde los perfiles de melee de
            la comunidad, así que enlazar el propio es literalmente lo que hace
            que esta pantalla exista. */}
        {/* Durante una recarga se mantiene en pantalla: solo se esconde en la
            PRIMERA carga, cuando no hay nada que mantener. */}
        {!error && sinDatos && !(cargando && !datos) && (
          <EmptyState
            icon={<Link2 size={28} aria-hidden />}
            title={sinEnlaces ? 'Todavía no hay cuentas de melee enlazadas' : 'Todavía no hay torneos que contar'}
            hint={
              sinEnlaces
                ? 'Los torneos se descubren desde los perfiles de melee de la comunidad. Enlazá el tuyo y los tuyos empiezan a contar acá.'
                : ambitoMostrado === 'aca'
                  ? 'Cuando se juegue —y se publique— un torneo organizado acá, aparece solo.'
                  : 'Ninguno de los perfiles enlazados tiene todavía un torneo publicado.'
            }
            action={<BotonEnlazar />}
          />
        )}

        {/* Ya NO se apaga con `cargando`: los cinco bloques colgaban de esa
            condición, así que al cambiar de ámbito no se dibujaba absolutamente
            nada y la pantalla quedaba en blanco hasta que volviera la consulta.
            Lo anterior se queda a la vista, atenuado y con la línea de estado
            encima diciendo que se está actualizando. */}
        {!sinDatos && datos && (
          <>
            {/* Con datos en pantalla, la invitación NO reemplaza a la tabla: hay
                meta local aunque nadie de acá haya enlazado su cuenta todavía,
                y esconderlo detrás de un estado vacío sería peor que el vacío. */}
            {sinEnlaces && (
              <div className="flex items-start gap-2 text-[11px] text-swu-cyan bg-swu-cyan/10 border border-swu-cyan/30 rounded-lg px-2.5 py-2">
                <Link2 size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <span className="leading-snug">
                  Nadie de la comunidad tiene su melee enlazado todavía.{' '}
                  <Link to="/profile" className="underline underline-offset-2">
                    Enlazá el tuyo
                  </Link>{' '}
                  y tus torneos empiezan a contar acá.
                </span>
              </div>
            )}

            {/* ── Aviso de muestra INCOMPLETA ──
                Un agregado al que le faltaron datos se declara, no se dibuja
                como si fuera el total. Va antes que el de muestra chica porque
                es más grave: aquello dice «hay poco», esto dice «lo que hay
                puede no ser lo que pasó». */}
            {parcial && (
              <div className="flex items-start gap-1.5 text-[11px] text-swu-red bg-swu-red/10 border border-swu-red/30 rounded-lg px-2.5 py-2">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <span className="leading-snug min-w-0">
                  <b>Muestra incompleta.</b> No se pudo traer todo, así que lo de abajo es un
                  pedazo de los datos y no el total. Por eso no se muestra ni un porcentaje:
                  un 40% calculado sobre la mitad de las filas no es el 40% de nada.{' '}
                  <button
                    onClick={() => void cargar()}
                    disabled={cargando}
                    className="underline underline-offset-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent rounded"
                  >
                    Reintentar
                  </button>
                </span>
              </div>
            )}

            {/* ── Aviso de base de cartas a medias ──
                Es un estado propio y no un cero: con la base local incompleta
                el lector de arquetipos no puede resolver nada, así que las
                listas caerían en «no se pudo leer» y la tabla parecería decir
                que nadie publica mazo. Sin esto se culpa a los torneos de un
                problema que es de esta app. */}
            {baseIncompleta && (
              <div className="flex items-start gap-1.5 text-[11px] text-swu-amber bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-2.5 py-2">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <span className="leading-snug min-w-0">
                  <b>Falta base de cartas.</b> La base local todavía no está completa, así que
                  los nombres de mazo no se pueden resolver y casi todo cae en «no se pudo
                  leer». No es que nadie publique lista: es que acá falta con qué leerla.
                  Abrí el buscador de cartas una vez para que termine de bajarse.
                </span>
              </div>
            )}

            {/* ── Aviso de muestra chica ──
                Va ARRIBA de la tabla y no debajo: cambia cómo hay que leer
                todos los números que siguen.
                Cuelga de `muestraChica` y NO de `hayQuorum`: son pocas listas o
                no lo son, y decir «muestra chica» con 200 listas porque el
                agregado vino a medias sería cambiar una verdad incómoda por una
                mentira cómoda. Cada motivo tiene su propio aviso. */}
            {muestraChica && (
              <div className="flex items-start gap-1.5 text-[11px] text-swu-amber bg-swu-amber/10 border border-swu-amber/30 rounded-lg px-2.5 py-2">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
                <span className="leading-snug">
                  Muestra chica: <b className="font-mono">{listas}</b>{' '}
                  {listas === 1 ? 'lista identificada' : 'listas identificadas'}. Por debajo
                  de <b className="font-mono">{QUORUM}</b> no se muestra ni un porcentaje —
                  con tres listas, «el 100% del meta es Cad Bane» dice más de la muestra
                  que del meta. Van los conteos crudos.
                </span>
              </div>
            )}

            {/* ── Qué se juega ── */}
            {datos.arquetipos.length > 0 && (
              <section>
                <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                  Qué se juega · {datos.arquetipos.length} arquetipos de {listas} listas
                </h2>
                <ul className="space-y-1">
                  {datos.arquetipos.map(a => (
                    <FilaArquetipo
                      key={`${a.liderId}-${a.baseId}`}
                      a={a}
                      listas={listas}
                      mostrarCuotas={mostrarCuotas}
                      cartas={cartas}
                      maxVeces={maxVeces}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* ── Lo que NO entró en la tabla ──
                Vivía DENTRO del bloque de arquetipos, así que desaparecía justo
                en el caso donde más falta hace: 8 jugadores, 8 sin lista, cero
                arquetipos y una pantalla que no explicaba por qué está vacía.
                Ahora se muestra siempre que haya filas.

                Y separa las dos causas, que no son la misma: no publicar mazo
                es un hecho del torneo; publicarlo y que nosotros no sepamos
                leerlo es un defecto NUESTRO, y si ese número crece hay que ir a
                arreglar el lector, no a resignarse. */}
            {datos.totalFilas > 0 && (
              <p className="text-[10px] text-swu-muted leading-relaxed px-1">
                {datos.conArquetipo === 0 ? (
                  <>
                    Ninguna de las <b className="font-mono">{datos.totalFilas}</b>{' '}
                    {datos.totalFilas === 1 ? 'fila' : 'filas'} trae un mazo que se pueda
                    contar, así que no hay tabla de arquetipos:{' '}
                    <b className="font-mono text-swu-amber">{datos.sinLista}</b> sin lista
                    publicada
                    {datos.noParseado > 0 && (
                      <>
                        {' '}y <b className="font-mono text-swu-red">{datos.noParseado}</b> con
                        lista publicada que no se pudo leer
                      </>
                    )}
                    .
                  </>
                ) : datos.sinArquetipo > 0 ? (
                  <>
                    De <b className="font-mono">{datos.totalFilas}</b>{' '}
                    {datos.totalFilas === 1 ? 'fila' : 'filas'},{' '}
                    <b className="font-mono text-swu-amber">{datos.sinArquetipo}</b> no{' '}
                    {datos.sinArquetipo === 1 ? 'entra' : 'entran'} en la tabla:{' '}
                    <b className="font-mono">{datos.sinLista}</b> sin lista publicada
                    {datos.noParseado > 0 && (
                      <>
                        {' '}y <b className="font-mono text-swu-red">{datos.noParseado}</b> con
                        lista publicada que no se pudo leer
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>
                    Las <b className="font-mono">{datos.totalFilas}</b>{' '}
                    {datos.totalFilas === 1 ? 'fila' : 'filas'} se pudieron identificar.
                  </>
                )}
                {datos.noParseado > 0 && (
                  <>
                    {' '}
                    {baseIncompleta
                      ? 'Lo segundo es esta app, no los torneos: falta base de cartas para leer los nombres de mazo.'
                      : 'Lo segundo es cosa nuestra: el nombre de la lista venía escrito a mano o nuestro lector no lo entendió.'}
                  </>
                )}
              </p>
            )}

            {/* ── De qué torneos sale ── */}
            {datos.torneos.length > 0 && (
              <section>
                <h2 className="text-[10px] font-mono tracking-wider uppercase text-swu-muted/60 mb-2">
                  De qué torneos sale · {datos.torneos.length}
                </h2>
                <ul className="space-y-1.5">
                  {datos.torneos.map(t => (
                    <FilaTorneo key={t.id} t={t} ambito={ambitoMostrado} />
                  ))}
                </ul>
              </section>
            )}

            {/* ── Cuánta gente sostiene esto ──
                DOS números, y no uno, porque son dos hechos distintos:
                `jugadoresEnlazados` es la comunidad entera y `jugadoresConFilas`
                los que aparecen en ESTE ámbito. Confundirlos hacía que con diez
                enlazados y un torneo local de gente de fuera la app dijera «nadie
                tiene su melee enlazado», que es simplemente falso. */}
            {!sinEnlaces && (
              <p className="text-[10px] text-swu-muted flex items-start gap-1.5 pt-1">
                <Users size={11} className="flex-shrink-0 mt-0.5" aria-hidden />
                <span className="min-w-0">
                  {datos.jugadoresConFilas > 0 ? (
                    <>
                      <b className="font-mono text-swu-text">{datos.jugadoresConFilas}</b> de{' '}
                      <b className="font-mono text-swu-text">{datos.jugadoresEnlazados}</b>{' '}
                      {datos.jugadoresEnlazados === 1 ? 'jugador enlazado' : 'jugadores enlazados'}{' '}
                      de la comunidad {datos.jugadoresConFilas === 1 ? 'aparece' : 'aparecen'} en
                      este ámbito.
                    </>
                  ) : (
                    <>
                      <b className="font-mono text-swu-text">{datos.jugadoresEnlazados}</b>{' '}
                      {datos.jugadoresEnlazados === 1 ? 'jugador enlazado' : 'jugadores enlazados'}{' '}
                      en la comunidad, pero ninguno aparece en este ámbito
                      {ambitoMostrado === 'aca'
                        ? ': estas filas salen de la sala entera, enlazada o no.'
                        : ' todavía.'}
                    </>
                  )}{' '}
                  <Link to="/profile" className="text-swu-cyan underline underline-offset-2">
                    Enlazá tu melee
                  </Link>{' '}
                  y los tuyos también cuentan.
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
