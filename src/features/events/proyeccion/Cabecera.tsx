/**
 * La banda de arriba. Es lo único que promete NO MOVERSE en tres horas.
 *
 * Los cuatro bloques tienen ancho FIJO —logo 300, nombre 584, instrumentos 300,
 * reloj 468, más los aires: 1728 exactos— y ninguno colapsa nunca. Si el hueco
 * del reloj se encogiera cuando no hay reloj, la cabecera entera se
 * recompondría y el ojo tendría que reaprender dónde mirar, que es justo lo que
 * esta banda existe para evitar.
 */

import { useEffect, useState } from 'react'
import type { CloudEvent } from '../../../services/tournamentCloud'
import { ahora, medirDesfase } from '../../../services/horaServidor'
import { etiquetaTipo, esDeMesas } from '../../../services/tipoTorneo'
import type { EstadoTablero } from './datos'

const VENCIDO_VISIBLE_MS = 20 * 60_000

interface Props {
  evento: CloudEvent
  logo: string | null
  estado: EstadoTablero
  jugadores: number
  mesasListas: number
  mesasTotal: number
}

export function Cabecera({ evento, logo, estado, jugadores, mesasListas, mesasTotal }: Props) {
  const reloj = useReloj(evento.round_timer_end)
  const enTiempo = reloj.vencido && reloj.desdeVencidoMs < VENCIDO_VISIBLE_MS

  return (
    <div
      className={`relative flex items-center ${enTiempo ? 'proy-tiempo' : ''}`}
      style={{ height: 168, backgroundColor: enTiempo ? '#7f1d1d' : undefined }}
    >
      {/* La única aparición del rojo de marca fuera del reloj. */}
      <span className="absolute left-0 top-0 h-full bg-swu-accent" style={{ width: 6 }} />

      <Logo url={logo} codigo={evento.code} />
      <span style={{ width: 28 }} />
      <Identidad evento={evento} estado={estado} jugadores={jugadores} />
      <span style={{ width: 24 }} />
      <Instrumentos evento={evento} estado={estado} listas={mesasListas} total={mesasTotal} />
      <span style={{ width: 24 }} />
      <HuecoDelReloj evento={evento} estado={estado} reloj={reloj} jugadores={jugadores} enTiempo={enTiempo} />
    </div>
  )
}

/**
 * El logo. ALTO fijo, ancho libre.
 *
 * §4m: una marca no es un avatar y no se recorta. El de TWIN SUNS es apaisado
 * y en una caja cuadrada perdería casi la mitad — quedarían dos letras del
 * nombre, que es exactamente dejar de identificar, que es lo único que un logo
 * tiene que hacer.
 */
function Logo({ url, codigo }: { url: string | null; codigo: string }) {
  const [falló, setFalló] = useState(false)

  if (!url || falló) {
    // Nunca un ícono roto: el hueco lo ocupa el código, que además sirve.
    return (
      <div
        className="proy-chapa flex items-center justify-center bg-swu-surface font-mono text-swu-amber"
        style={{ width: 300, height: 104, fontSize: 60, marginLeft: 34 }}
      >
        {codigo}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setFalló(true)}
      className="object-contain"
      style={{ height: 104, maxWidth: 300, marginLeft: 34, flexShrink: 0 }}
    />
  )
}

function Identidad({ evento, estado, jugadores }: { evento: CloudEvent; estado: EstadoTablero; jugadores: number }) {
  const chip = CHIP[estado] ?? CHIP.tablero

  /* `overflow: hidden` + `flexShrink: 0` en TODOS los bloques de la cabecera:
     sin eso, una linea de estado larga se desborda del bloque y se dibuja
     ENCIMA del instrumento de ronda. Se vio en la primera captura contra datos
     reales: «FINALIZADO» y «RONDA 2» superpuestos. Un ancho declarado no es un
     ancho respetado. */
  return (
    <div style={{ width: 584, flexShrink: 0, overflow: 'hidden' }}>
      {/* El nombre del torneo se recorta con CSS, NUNCA con `nombreCorto`:
          ese ayudante abrevia por apellido y un torneo no tiene apellido —
          convertía «Torneo SWU · 12 jugadores» en «Torneo S.», que es peor que
          cortarlo. Se vio en la captura contra datos reales. */}
      <div className="truncate font-bold text-swu-text" style={{ fontSize: 56, lineHeight: 1.1 }}>
        {evento.name}
      </div>
      <div
        className="mt-1 flex items-center gap-3 whitespace-nowrap uppercase tracking-[0.12em] text-swu-muted"
        style={{ fontSize: 26 }}
      >
        <span>{etiquetaTipo(evento.tournament_type)}</span>
        {jugadores > 0 && <><span>·</span><span>{jugadores} jugadores</span></>}
        {/* El chip se calla cuando el reloj ya dice lo mismo: con el torneo
            cerrado, «FINALIZADO» aca y «FINAL» a 96 px a la derecha son el
            mismo dato ocupando dos sitios. */}
        {estado !== 'final' && estado !== 'cancelado' && (
          <>
            <span>·</span>
            <span className={chip.clase}>
              {chip.punto && <span className="mr-2 inline-block rounded-full bg-swu-green" style={{ width: 14, height: 14 }} />}
              {chip.texto}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

const CHIP: Record<string, { texto: string; clase: string; punto?: boolean }> = {
  convocatoria: { texto: 'Por empezar', clase: 'text-swu-amber' },
  sorteando:    { texto: 'En vivo',     clase: 'text-swu-green', punto: true },
  tablero:      { texto: 'En vivo',     clase: 'text-swu-green', punto: true },
  'cierre-ronda': { texto: 'En vivo',   clase: 'text-swu-green', punto: true },
  final:        { texto: 'Finalizado',  clase: 'text-swu-muted' },
  cancelado:    { texto: 'Cancelado',   clase: 'text-swu-red-texto' },
}

function Instrumentos({ evento, estado, listas, total }: {
  evento: CloudEvent; estado: EstadoTablero; listas: number; total: number
}) {
  /* «MESAS 5/8» es lo único de esta pantalla que contesta la pregunta que la
     sala hace en voz alta cada diez minutos: «¿ya casi terminamos?». Va en la
     cabecera, donde no rota nunca. */
  const hayMesas = total > 0 && (estado === 'tablero' || estado === 'cierre-ronda')
  const listo = listas === total

  /* «RONDA 0» no es un dato, es un campo sin llenar asomándose a una pared.
     Pasa en los torneos que se cerraron sin jugar rondas en la app —dos de los
     seis reales— y también antes de empezar. Si no hay ronda, no hay
     instrumento: el hueco de 84 px se queda vacío y la cabecera no se mueve. */
  const hayRonda = evento.current_round > 0

  return (
    <div style={{ width: 300, flexShrink: 0 }}>
      {hayRonda
        ? <Instrumento rotulo="Ronda" valor={rondaTexto(evento)} color="text-swu-amber" />
        : <div style={{ height: 84 }} />}
      {hayMesas && (
        <Instrumento
          rotulo="Mesas"
          valor={`${listas}/${total}`}
          color={listo ? 'text-swu-green' : 'text-swu-amber'}
        />
      )}
    </div>
  )
}

function Instrumento({ rotulo, valor, color }: { rotulo: string; valor: string; color: string }) {
  return (
    <div className="flex items-baseline gap-3" style={{ height: 84 }}>
      <span className="uppercase tracking-[0.20em] font-bold text-swu-muted" style={{ fontSize: 26 }}>
        {rotulo}
      </span>
      <span className={`font-mono font-bold ${color}`} style={{ fontSize: 68 }}>{valor}</span>
    </div>
  )
}

/** «3/5», o «3» a secas cuando `max_rounds` viene null — que es el caso normal. */
function rondaTexto(e: CloudEvent): string {
  if (esDeMesas(e.tournament_type) || !e.max_rounds) return String(e.current_round)
  return `${e.current_round}/${e.max_rounds}`
}

/**
 * El hueco del reloj: 468 px que existen SIEMPRE, con lo que toque adentro.
 *
 * La escalera de reemplazo va de más a menos información:
 *   reloj corriendo → TIEMPO → jugadores (antes de empezar) → FINAL → RONDA n
 *
 * Nunca dice «Sin timer», que es un detalle de implementación filtrándose a
 * una pared.
 */
function HuecoDelReloj({ evento, estado, reloj, jugadores, enTiempo }: {
  evento: CloudEvent
  estado: EstadoTablero
  reloj: Reloj
  jugadores: number
  enTiempo: boolean
}) {
  let rotulo = 'Quedan de la ronda'
  let valor = reloj.texto
  let clase = 'text-swu-accent-texto'
  let cuerpo = 140

  if (estado === 'final') {
    rotulo = 'Torneo'; valor = 'FINAL'; clase = 'text-swu-muted'; cuerpo = 96
  } else if (estado === 'cancelado') {
    rotulo = 'Torneo'; valor = 'ANULADO'; clase = 'text-swu-red-texto'; cuerpo = 96
  } else if (estado === 'convocatoria') {
    /* Sin nadie sembrado no se muestra «JUGADORES —»: es el mismo campo sin
       llenar que «RONDA 0», y en una convocatoria vacía además compite con el
       código gigante, que es lo único que hay que leer. El hueco se queda
       vacío y conserva sus 468 px para que nada se mueva al llegar el primero. */
    if (jugadores === 0) return <div style={{ width: 468, flexShrink: 0, marginRight: 34 }} />
    rotulo = 'Jugadores'; valor = String(jugadores); clase = 'text-swu-amber'
  } else if (enTiempo) {
    /* Texto CLARO sobre la banda roja, no oscuro. Invertir el contraste
       —«TIEMPO» del color del fondo del tablero— sonaba bien y medido en
       pantalla es débil: #181825 sobre #7f1d1d es oscuro sobre oscuro y a
       cuatro metros se apaga justo en el único momento en que esta pantalla
       tiene algo urgente que decir. */
    rotulo = 'Terminen el turno'
    valor = 'TIEMPO'; clase = 'text-white'; cuerpo = 110
  } else if (!reloj.hay || reloj.vencido) {
    /* Sin reloj —el caso MEDIDO de los tres torneos que se jugaron de verdad,
       los tres con `round_timer_end` en null— el hueco no se colapsa: lleva la
       ronda, que es el dato que quedaba. */
    rotulo = 'Ronda'; valor = String(evento.current_round); clase = 'text-swu-text'
  } else if (reloj.minutos < 1) {
    clase = 'text-swu-red-texto'
  } else if (reloj.minutos < 5) {
    clase = 'text-swu-amber'
  }

  return (
    <div className="text-right" style={{ width: 468, flexShrink: 0, marginRight: 34 }}>
      <div
        className={`uppercase tracking-[0.20em] font-bold ${enTiempo ? 'text-swu-text' : 'text-swu-muted'}`}
        style={{ fontSize: 26 }}
      >
        {rotulo}
      </div>
      <div
        className={`font-mono font-bold tabular-nums ${clase}`}
        style={{ fontSize: cuerpo, lineHeight: 1, letterSpacing: '-0.02em' }}
      >
        {valor}
      </div>
    </div>
  )
}

interface Reloj {
  hay: boolean
  texto: string
  minutos: number
  vencido: boolean
  desdeVencidoMs: number
}

/**
 * El reloj, contra la hora del SERVIDOR.
 *
 * No se reusa `RoundTimer` por tres cosas: su `large` es `text-5xl` (48 px, un
 * tercio de lo que hace falta acá), su `animate-pulse` no para nunca, y clava
 * el restante en 0 para siempre — con lo cual no hay forma de saber CUÁNTO hace
 * que venció, que es justo lo que decide si el cartel de TIEMPO sigue puesto.
 */
function useReloj(fin: string | null): Reloj {
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    /* Sin plazo no se toca el estado: el render de abajo ya resuelve ese caso
       mirando `fin`, así que ponerlo en null acá solo encadenaría un render de
       más. Si `fin` desaparece, el `ms` viejo queda y nadie lo lee. */
    if (!fin) return
    const tic = () => setMs(new Date(fin).getTime() - ahora())
    const t = setInterval(tic, 1000)
    /* Las dos vueltas van dentro de una función asíncrona: la primera para
       pintar el reloj antes del primer segundo sin llamar a setState en seco
       desde el efecto, y la segunda ya con el desfase del servidor medido. */
    void (async () => { tic(); await medirDesfase(); tic() })()
    return () => clearInterval(t)
  }, [fin])

  if (!fin || ms === null) {
    return { hay: false, texto: '—', minutos: 0, vencido: false, desdeVencidoMs: 0 }
  }

  const restante = Math.max(0, ms)
  const total = Math.floor(restante / 1000)
  const minutos = Math.floor(total / 60)
  const segundos = total % 60

  return {
    hay: true,
    texto: `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`,
    minutos,
    vencido: ms <= 0,
    /* Cuánto hace que venció, y NO un booleano. `arrancar_reloj` exige ser
       organizador o admin mientras `armar_mesas` corre con curador, así que una
       ronda nueva puede heredar el plazo vencido de la anterior — y un cartel
       de TIEMPO clavado tres horas es una mentira creíble. */
    desdeVencidoMs: ms <= 0 ? -ms : 0,
  }
}
