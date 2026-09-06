/**
 * LA LIGA — `/liga/:code`
 *
 * La pantalla entera de una liga internacional: mi próxima partida, la
 * inscripción, los grupos y sus jornadas. Sale de UNA llamada (`verLiga`),
 * porque un grupo de 8 son 8 plazas y 28 partidas y pedir cada cosa por
 * separado serían tres viajes para pintar una pantalla.
 *
 * ── El orden no es estético ───────────────────────────────────────────
 *
 * Arriba de todo va MI PRÓXIMA PARTIDA, no la tabla. Anotar y confirmar es la
 * única acción que existe para un jugador; la tabla es lo que mira el
 * espectador. Si el que juega tiene que bajar por 120 filas para encontrar su
 * botón, el resultado lo termina anotando la organización a mano.
 *
 * ── La unidad visible es el GRUPO, nunca la lista de 120 ──────────────
 *
 * Una tabla plana de 120 ordenada por puntos absolutos es ruido con cara de
 * dato: el campeón de Legendario 1 con 15 puntos saldría debajo de alguien de
 * Común 3 con 18 sin haberse cruzado jamás. Y acá no se dibuja un solo sable
 * ni una sola credencial 3D: Chrome corta a ~16 contextos WebGL (§2s), así que
 * una lista de 120 es imposible por construcción. Texto y color de grupo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, CalendarClock, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, Globe2, Layers, Lock, Medal, Megaphone, PlayCircle, Plus, Settings2, Star, Swords, Timer, Trash2, Trophy, Users, Zap } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { InscripcionLiga } from '../liga/InscripcionLiga'
import { PortadaLiga } from './PortadaLiga'
import { Bandera, TarjetaCifra, ContadorPlazo } from './componentes/piezas'
import { haceCuanto, restanHasta } from './componentes/tiempo'
import {
  verLiga, tablaDe, misPartidasAbiertas, reportar, confirmar, disputar,
  publicarAnuncio, borrarAnuncio, type AnuncioLiga,
  TIERS, NOMBRE_TIER,
  tonoDelTier,
  type EstadoPartida, type FilaTabla, type GrupoLiga, type LigaCompleta,
  type PartidaLiga, type PlazaLiga,
} from '../../services/ligaService'


/**
 * El rótulo de cada estado.
 *
 * `origen === 'silencio'` gana sobre el estado a propósito: ese resultado lo
 * firmó el RELOJ, no las dos personas. Llamarlo «confirmada» en la tabla
 * pública sería fingir que el rival estuvo de acuerdo, y el día que alguien
 * reclame no habrá manera de distinguir un acuerdo de un vencimiento.
 */
const ROTULO: Record<EstadoPartida, { texto: string; clase: string }> = {
  programada: { texto: 'por jugar', clase: 'text-swu-muted' },
  reportada: { texto: 'falta confirmar', clase: 'text-swu-cyan' },
  confirmada: { texto: 'confirmada', clase: 'text-swu-muted' },
  disputada: { texto: 'en disputa', clase: 'text-swu-red-texto' },
  vencida: { texto: 'vencida', clase: 'text-swu-red-texto' },
  wo_local: { texto: 'no se presentó el local', clase: 'text-swu-amber' },
  wo_visita: { texto: 'no se presentó la visita', clase: 'text-swu-amber' },
  anulada: { texto: 'anulada', clase: 'text-swu-muted' },
  // La cierra el organizador sin que nadie la jugara. No es una derrota de
  // nadie y no cuenta para la tabla: se dice tal cual.
  sin_jugar: { texto: 'no se jugó', clase: 'text-swu-muted' },
}
function rotuloDe(m: PartidaLiga): { texto: string; clase: string } {
  if (m.origen === 'silencio') return { texto: 'sin respuesta del rival', clase: 'text-swu-amber' }
  if (m.origen === 'laudo' && m.estado === 'confirmada') {
    return { texto: 'resuelta por la organización', clase: 'text-swu-amber' }
  }
  return ROTULO[m.estado]
}

/** Con marcador se muestra el marcador; sin él, «vs» y no un 0-0 inventado. */
/** El formato, en palabras. La columna guarda la clave; la pantalla, el nombre. */
const FORMATO: Record<string, string> = {
  premier: 'Premier', twin_suns: 'Twin Suns', draft: 'Draft', sealed: 'Sellado', libre: 'Libre',
}

/**
 * Cuánto se queda la portada como MÍNIMO.
 *
 * La consulta tarda medio segundo, así que el afiche era un parpadeo: se veía
 * que algo pasó, no QUÉ. Dos segundos alcanzan para leer «Liga Internacional»
 * y ver la cruz de sables, y son pocos como para que entrar no se sienta lento.
 *
 * Es un piso, no un tope: si la consulta tarda más, se sigue esperando.
 */
const MINIMO_MS = 2000

const CON_MARCADOR = new Set<EstadoPartida>(['reportada', 'confirmada', 'disputada', 'wo_local', 'wo_visita'])

/**
 * Cuánto falta para que venza el plazo.
 *
 * Vive fuera del componente porque `Date.now()` dentro del cuerpo rompe la
 * pureza del render (y el linter): el mismo render devolvería dos valores
 * distintos según cuándo se ejecute.
 */
function plazoTexto(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'el plazo ya venció'
  const horas = Math.round(ms / 3_600_000)
  if (horas < 1) return 'vence en menos de una hora'
  if (horas < 48) return `vence en ${horas} h`
  return `vence en ${Math.round(horas / 24)} días`
}

/** El VOD llega normalizado del servidor, pero puede ser id o URL entera. */
function enlaceVod(v: string): string {
  return v.startsWith('http') ? v : `https://www.youtube.com/watch?v=${v}`
}

/** Lo mejor arriba: el orden de la escalera manda sobre el número de grupo. */
function ordenarGrupos(grupos: GrupoLiga[]): GrupoLiga[] {
  return [...grupos].sort((a, b) =>
    TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.orden - b.orden)
}

export function LigaSeccion() {
  const { code } = useParams<{ code: string }>()
  const [liga, setLiga] = useState<LigaCompleta | null>(null)
  // `listo` en vez de un `cargando` que arranque en true y se apague dentro
  // del efecto: `null` es «todavía no se sabe» y nadie escribe estado de forma
  // síncrona al montar.
  const [listo, setListo] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [reglas, setReglas] = useState(false)
  /* El piso de la portada. Arranca en false SIEMPRE, también cuando la liga ya
     está en caché: si dependiera de si hay datos, quien vuelve a entrar no
     vería el afiche nunca y la portada existiría solo para la primera visita. */
  const [minimo, setMinimo] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinimo(true), MINIMO_MS)
    return () => clearTimeout(t)
  }, [])
  /** `null` = «el que decida la pantalla»; `''` = los plegué todos a mano. */
  const [abierto, setAbierto] = useState<string | null>(null)

  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    void Promise.resolve(code ? verLiga(code) : null).then(r => {
      if (!vivo) return
      setLiga(r)
      setListo(true)
    })
    return () => { vivo = false }
  }, [code, recarga])

  const grupos = useMemo(() => ordenarGrupos(liga?.grupos ?? []), [liga])
  const abiertas = useMemo(() => (liga ? misPartidasAbiertas(liga) : []), [liga])
  const proxima = abiertas[0] ?? null
  const esperandome = abiertas.filter(a => a.esperaMiRespuesta).length
  const miGrupo = useMemo(
    () => grupos.find(g => g.plazas.some(p => p.esMia))?.id ?? null,
    [grupos])

  // El afiche mientras carga: entrar a la liga tiene que sentirse como entrar
  // a otro sitio. Se va cuando la consulta terminó Y se cumplió el piso.
  if (!listo || !minimo) return <PortadaLiga ms={MINIMO_MS} />

  if (!liga) {
    // La policy del demo cerrado devuelve VACÍO, no error: acá «no existe» y
    // «no te toca verlo» son el mismo caso, y la pantalla lo dice sin drama.
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">Esta liga todavía no es pública</p>
        <p className="mt-1.5 text-[12px] text-swu-muted">
          O el enlace no existe, o la liga sigue en pruebas cerradas.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  const { temporada } = liga
  const grupoAbierto = abierto ?? miGrupo ?? grupos[0]?.id ?? null
  const sinArrancar = grupos.length === 0

  const estadoTexto = temporada
    ? temporada.estado === 'inscripcion' ? 'Inscripción abierta'
      : temporada.estado === 'en_curso' ? 'En curso' : 'Temporada cerrada'
    : liga.liga.estado === 'inscripcion' ? 'Inscripción abierta' : 'En preparación'
  /* El plazo más cercano de LO MÍO. Es la única fecha que me obliga a hacer
     algo hoy; la de la temporada es información, no un plazo. */
  const enJuego = temporada?.estado === 'en_curso' || liga.liga.estado === 'activa'
  /* La jornada sale de MI grupo. Con varios grupos, cada uno lleva su propio
     reloj: una «ronda global» sería un número que no le corresponde a nadie. */
  const jornada = (() => {
    const mio = grupos.find(g => g.plazas.some(p => p.esMia))
    if (!mio || mio.partidas.length === 0) return null
    const mias = mio.partidas.filter(m2 => {
      const yo = mio.plazas.find(p => p.esMia)
      return yo && (m2.localPlaza === yo.id || m2.visitaPlaza === yo.id)
    })
    if (mias.length === 0) return null
    const total = Math.max(...mias.map(m2 => m2.jornada))
    const pendiente = mias.filter(m2 => m2.estado === 'programada' || m2.estado === 'reportada')
    const actual = pendiente.length > 0 ? Math.min(...pendiente.map(m2 => m2.jornada)) : total
    return { actual, total }
  })()
  const plazoCercano = abiertas
    .map(a => a.partida.venceEl)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null

  /* LA CUENTA ATRÁS TIENE TRES ESTADOS, y el orden no es cosmético: se muestra
     el plazo que de verdad te obliga a hacer algo HOY.
       1. tenés una partida abierta  → su fecha límite (podés perder por no ir)
       2. la inscripción sigue abierta → cuándo cierra (podés quedarte afuera)
       3. la liga todavía no arrancó  → cuándo empieza (nada que hacer, pero
          es la pregunta que trae a alguien desde un video)
     Sin el tercero, quien llega el día 1 ve una pantalla sin ninguna fecha. */
  const cuenta: { hasta: string; rotulo: string; pie: string; urgente: boolean } | null =
    plazoCercano
      ? { hasta: plazoCercano, rotulo: 'Próxima fecha límite',
          pie: esperandome > 0
            ? 'Para responder el resultado que te reportaron.'
            : 'Para jugar y anotar tu partida.',
          urgente: esperandome > 0 }
      : temporada?.inscripcionCierra && temporada.estado === 'inscripcion'
      ? { hasta: temporada.inscripcionCierra, rotulo: 'Cierra la inscripción',
          pie: liga.miInscripcion
            ? 'Ya estás dentro. Después de esta fecha se arman los grupos.'
            : 'Después de esta fecha ya no se puede entrar a la temporada.',
          urgente: !liga.miInscripcion }
      /* SOLO mientras no haya arrancado. La condición era `estado !== 'cerrada'`,
         y una temporada pasa meses en 'en_curso' con su fecha de arranque ya
         atrás: el banner decía «ARRANCA LA LIGA — el plazo ya venció» en ROJO,
         toda la temporada, a cualquiera sin partida abierta. Un plazo vencido
         que no exige nada es la peor clase de aviso: enseña a ignorar los que
         sí exigen. */
      : temporada?.arranca && !(restanHasta(temporada.arranca)?.vencido ?? true)
      ? { hasta: temporada.arranca, rotulo: 'Arranca la liga',
          pie: 'Ese día se publican los grupos y el calendario.', urgente: false }
      : null

  return (
    <div data-modulo="liga" className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      {/* ── CABECERA sobre la portada difuminada ──
          El afiche ya existía y solo se usaba como pantalla de carga; el
          comentario de `PortadaLiga` afirmaba que la misma imagen servía de
          fondo del encabezado y eso no estaba implementado. Va detrás del
          título, oscurecida: una portada a todo trapo detrás de un texto es
          justo lo que el sistema de la credencial prohíbe (§3f — nada de
          degradados fuertes debajo de tinta). */}
      <header className="relative mb-3 overflow-hidden rounded-2xl border"
              style={{ borderColor: 'var(--liga-borde)' }}>
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-[2px]"
          style={{ backgroundImage: 'url(/liga/portada.webp)' }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-swu-bg via-swu-bg/85 to-swu-bg/55" />
        <div className="relative flex items-center gap-2 px-3 py-3">
          <Link to="/" className="-ml-1 p-1 text-swu-muted hover:text-swu-text" aria-label="Volver">
            <ChevronLeft size={18} />
          </Link>
          {/* EL EMBLEMA, como en la maqueta. Va `object-contain` y con alto
              fijo: una marca NO se recorta —recortada deja de identificar, que
              es lo único que tiene que hacer (§4m)—. Es decorativo acá porque
              el nombre está escrito al lado, así que `alt` vacío: leerlo en voz
              alta sería repetir el título. Si el archivo falta, el navegador no
              dibuja nada y la cabecera queda igual. */}
          <img
            src="/liga/emblema.webp"
            alt=""
            aria-hidden
            className="h-9 w-9 shrink-0 object-contain"
            loading="eager"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            {/* ENVUELVE, NO TRUNCA. Con el emblema, la píldora de estado y el
                botón del panel en la misma fila quedan ~150 px para el título,
                y «Liga Internacional PUENTE» salía «Liga Internacion…». El
                nombre de la liga es lo último que se puede cortar: es lo que
                le dice a alguien que llegó al sitio correcto. Dos renglones a
                15 px entran; tres se cortan, que a esa altura ya es otro
                problema. */}
            <h1 className="line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-swu-text">
              {liga.liga.nombre}
            </h1>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-swu-muted">
              {/* La temporada PRIMERO: si esta línea se corta —y se corta,
                  es la de menor prioridad de la cabecera— lo que tiene que
                  sobrevivir es en cuál temporada estás, no el descriptor. */}
              {temporada ? `${temporada.nombre} · Companion de liga` : 'Sin temporada abierta'}
            </p>
          </div>

          {/* EL PANEL, desde acá. No había ni un enlace al panel en toda la app:
              se llegaba tecleando `/liga/:code/panel`, o sea que la herramienta
              existía y no aparecía en ningún lado — que es lo mismo que no
              existir (§3l). Sale con `esStaff`, el dato que `liga_ver` ya manda. */}
          {/* La píldora de estado, como en la maqueta: verde cuando la liga
              está viva, apagada cuando no. Es lo primero que se mira al entrar
              y responde la única pregunta que trae a alguien de un video. */}
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              enJuego
                ? 'border-swu-green/50 bg-swu-green/10 text-swu-green'
                : 'border-swu-border text-swu-muted'}`}
          >
            {estadoTexto}
          </span>
          {liga.liga.esStaff && (
            <Link
              to={`/liga/${code}/panel`}
              className="flex min-h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg
                         border border-swu-border bg-swu-bg/70 text-swu-text"
              aria-label="Panel de la liga"
            >
              <Settings2 size={14} />
            </Link>
          )}
        </div>

        {/* LAS CINCO CIFRAS, en fila.
            Cada una lleva su ícono arriba, como la maqueta. La jornada y el
            total salen de MI grupo y no de una «ronda» global: cada grupo
            lleva su propio reloj (`liga_grupos.arranca/cierra`), así que una
            ronda global de 16 grupos no existe como concepto y no se puede
            inventar sin cambiar el motor. */}
        <div className="liga-carrusel relative gap-1 px-3 pb-3">
          <TarjetaCifra
            icono={<Users size={13} />}
            valor={liga.liga.cupo ? `${liga.cifras.inscritos}/${liga.liga.cupo}` : liga.cifras.inscritos}
            rotulo="jugadores"
          />
          <TarjetaCifra icono={<Globe2 size={13} />} valor={liga.cifras.paises} rotulo="países" />
          <TarjetaCifra
            icono={<Layers size={13} />}
            valor={jornada ? `J${jornada.actual}` : '—'}
            rotulo={jornada ? <>de {jornada.total}</> : 'jornada'}
          />
          <TarjetaCifra
            icono={<Star size={13} />}
            valor={FORMATO[liga.liga.formato] ?? liga.liga.formato}
            rotulo="formato"
          />
          <TarjetaCifra
            icono={<CalendarDays size={13} />}
            valor={temporada ? (temporada.arranca?.slice(0, 4) ?? temporada.numero) : '—'}
            rotulo="temporada"
          />
        </div>
      </header>

      {aviso && (
        <p className="mb-3 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* 0 · LO QUE ESPERA MI RESPUESTA, arriba de todo.
          El reloj sella por silencio a los cinco días: no responder deja de ser
          una omisión y pasa a ser una derrota. El push avisa, pero medido en
          `/envivo` solo 13 de 39 cuentas lo tienen activado (§4d) — así que
          esta franja NO es un adorno del push, es el otro canal, el que cubre
          a los dos tercios que nunca lo van a recibir. Y lee el MISMO hecho
          que el cron, así que no puede quedarse vieja. */}
      {esperandome > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-swu-red/50 bg-swu-red/10 px-3 py-2.5 text-[12px] font-bold leading-snug text-swu-red-texto">
          <AlertTriangle size={15} className="shrink-0" />
          {esperandome === 1
            ? 'Tenés un resultado esperando tu respuesta. Si no contestás antes del plazo, queda firme como lo reportó tu rival.'
            : `Tenés ${esperandome} resultados esperando tu respuesta. Los que no contestes antes del plazo quedan firmes como los reportó tu rival.`}
        </p>
      )}

      {/* PRÓXIMA FECHA LÍMITE.
          Es la única fecha que obliga a hacer algo hoy — la de la temporada es
          información, no un plazo. Va grande porque el reloj sella por
          silencio: pasada esa fecha, no haber contestado vale como haber
          aceptado lo que reportó el rival. */}
      {cuenta && (
        <button
          onClick={() => irA(plazoCercano ? 'mis-partidas' : 'como-funciona')}
          className="relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left"
          style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}
        >
          {/* EL ARTE VA DETRÁS Y A LA DERECHA, con el degradado comiéndoselo
              hacia el texto. Una imagen a todo trapo bajo una cuenta atrás es
              lo que el sistema de la credencial prohíbe (§3f): la cifra es el
              dato y el arte no puede disputarle el contraste. Si el archivo no
              está, no se dibuja nada y el banner queda igual de legible. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: 'url(/liga/banner-liga.webp)',
              maskImage: 'linear-gradient(to right, transparent, #000 70%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
            }}
          />
          <Timer size={26} className="relative shrink-0" style={{ color: 'var(--liga-acento)' }} />
          <span className="relative min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{ color: 'var(--liga-acento)' }}>
              {cuenta.rotulo}
            </span>
            <span className="mt-0.5 block text-[22px] leading-none">
              <ContadorPlazo hasta={cuenta.hasta} urgente={cuenta.urgente} />
            </span>
            <span className="mt-1 block text-[10px] leading-snug text-swu-muted">
              {cuenta.pie}
            </span>
            <span className="mt-1.5 block text-[8px] font-bold uppercase tracking-[0.2em] text-swu-muted/70">
              La disciplina también gana partidas
            </span>
          </span>
          <ChevronRight size={18} className="relative shrink-0 text-swu-muted" />
        </button>
      )}

      {/* 1 · MIS PARTIDAS ABIERTAS, todas.
          Antes era UNA tarjeta —«la próxima»— y con grupos de 8 son siete
          partidas por persona: quien tenía dos sin jugar y una esperando
          confirmación resolvía esa y las otras dos seguían invisibles, con el
          plazo corriendo. El orden lo decide `misPartidasAbiertas`. */}
      <div id="mis-partidas" />
      {abiertas.map(a => (
        <MiPartida
          key={a.partida.id}
          partida={a.partida}
          grupo={a.grupo}
          rival={a.rival}
          miPlaza={a.miPlaza}
          alHacer={() => { setAviso(null); recargar() }}
          alAvisar={setAviso}
        />
      ))}

      {/* 2 · La inscripción, solo si no estoy dentro y todavía se puede entrar.

          LA CONDICIÓN ES LA DE LA LIGA, NO LA DE LA TEMPORADA. Estaba mirando
          `temporada?.estado` mientras `liga_inscribirse` valida `ligas.estado`,
          y son dos interruptores que se abren por separado:

            liga abierta, sin temporada  →  el formulario NO APARECE NUNCA
            temporada abierta, liga sin abrir  →  aparece, y el botón rechaza

          O sea que había que acertarle al orden para que la gente pudiera
          entrar. La pantalla ofrece lo que el servidor acepta. */}
      {!liga.miInscripcion && liga.liga.estado === 'inscripcion' && (
        <InscripcionLiga
          ligaId={liga.liga.id}
          onListo={() => { setAviso('Estás dentro. Cuando se armen los grupos vas a ver tu calendario.'); recargar() }}
        />
      )}

      {/* Inscrito pero sin grupo todavía: no hay partida que mostrar y hay que
          decir por qué, o parece que la inscripción no quedó. */}
      {liga.miInscripcion && !proxima && sinArrancar && (
        <p className="mb-3 rounded-2xl border border-swu-green/40 bg-swu-green/10 px-4 py-3 text-center text-[12px] font-bold text-swu-green">
          Ya estás inscrito. Los grupos se arman cuando cierre la inscripción.
        </p>
      )}

      {/* ACCIONES RÁPIDAS.
          No son atajos decorativos: cada una lleva a algo que hoy está
          enterrado a dos o tres toques. «Horarios» es el caso claro — la
          rejilla solo se montaba en el alta, que desaparece al inscribirte. */}
      {liga.miInscripcion && (
        <section className="mb-3 rounded-2xl border border-swu-border bg-swu-surface p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black text-swu-text">
            <Zap size={13} style={{ color: 'var(--liga-acento)' }} /> Acciones rápidas
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Atajo
              icono={<Users size={14} />} rotulo="Mi grupo"
              alTocar={() => { if (miGrupo) { setAbierto(miGrupo); irA(`grupo-${miGrupo}`) } }}
              apagado={!miGrupo}
            />
            <Atajo
              icono={<Trophy size={14} />} rotulo="Tabla"
              alTocar={() => irA('tabla')} apagado={!miGrupo}
            />
            <Atajo
              icono={<Swords size={14} />} rotulo="Partidas"
              alTocar={() => irA('mis-partidas')} apagado={abiertas.length === 0}
            />
            <Atajo
              icono={<Megaphone size={14} />} rotulo="Anuncios"
              alTocar={() => irA('anuncios')} apagado={liga.anuncios.length === 0 && !liga.liga.esStaff}
            />
            <Atajo
              icono={<BookOpen size={14} />} rotulo="Reglas"
              alTocar={() => { setReglas(true); irA('como-funciona') }}
            />
            <Atajo icono={<CalendarClock size={14} />} rotulo="Horarios" a="/profile" />
          </div>
        </section>
      )}

      {/* ANUNCIOS. Van en scroll lateral por lo mismo que las cifras: apilados
          a 390 px, tres avisos empujan la tabla abajo del pliegue. */}
      <AnunciosLiga
        id="anuncios"
        ligaId={liga.liga.id}
        anuncios={liga.anuncios}
        puedoPublicar={liga.liga.esStaff}
        alCambiar={recargar}
        alAvisar={setAviso}
      />

      {/* TOP 8 — el podio de MI grupo, no un ranking cruzado.
          Un ranking entre grupos que nunca se enfrentaron es ruido con cara de
          dato: un campeón de Legendario 1 con 15 puntos quedaría debajo de un
          Común 3 con 18 sin haberse cruzado nunca. Con un solo grupo, el Top 8
          ES la tabla del grupo, exacto; con varios, esto sigue diciendo de qué
          grupo habla. */}
      <TopOcho
        id="tabla"
        grupo={grupos.find(g => g.id === miGrupo) ?? null}
        alVerTodo={() => { if (miGrupo) { setAbierto(miGrupo); irA(`grupo-${miGrupo}`) } }}
      />

      {/* 3 · Los grupos. Uno por tarjeta, el mío abierto. */}
      <div id="grupos" />
      {sinArrancar ? (
        /* MIENTRAS NO HAY GRUPOS, EL LOBBY ES ESTO.
           Listaba grupos, y durante toda la inscripción no hay ninguno: la
           pantalla a la que apunta el enlace del video mostraba un párrafo y
           nada más, tres semanas. Quiénes van entrando es lo único que hay para
           mostrar en ese período — y es lo que hace ver que la liga es de
           verdad y que es internacional. */
        <Padron
          gente={liga.padron}
          total={liga.cifras.inscritos}
          cupo={liga.liga.cupo}
          vacio={liga.liga.descripcion ?? 'La temporada todavía no está abierta: cuando se armen los grupos, acá va tu calendario.'}
        />
      ) : (
        grupos.map(g => (
          <TarjetaGrupo
            key={g.id}
            grupo={g}
            abierto={grupoAbierto === g.id}
            alPlegar={() => setAbierto(grupoAbierto === g.id ? '' : g.id)}
          />
        ))
      )}

      {/* CÓMO FUNCIONA.
          Texto estático, y hasta hoy no existía en NINGÚN lado: es lo único a
          lo que la primera queja de la jornada 3 va a poder apuntar. Los
          números salen de la liga, no están escritos a mano — con grupos de 6
          un «jugás 7 partidas» sería mentira. */}
      <ComoFunciona
        id="como-funciona"
        abierto={reglas}
        alPlegar={() => setReglas(r => !r)}
        porGrupo={liga.liga.tamanoGrupo}
      />
    </div>
  )
}

/* ── MI PRÓXIMA PARTIDA ─────────────────────────────────────────────── */

/** En un BO3 solo hay cuatro marcadores posibles, y se leen en primera persona. */
const MARCADORES = [
  { rotulo: 'Gané 2-0', mis: 2, sus: 0 },
  { rotulo: 'Gané 2-1', mis: 2, sus: 1 },
  { rotulo: 'Perdí 1-2', mis: 1, sus: 2 },
  { rotulo: 'Perdí 0-2', mis: 0, sus: 2 },
] as const

function MiPartida({ partida, grupo, rival, miPlaza, alHacer, alAvisar }: {
  partida: PartidaLiga
  grupo: GrupoLiga
  rival: PlazaLiga
  miPlaza: PlazaLiga
  alHacer: () => void
  alAvisar: (m: string | null) => void
}) {
  const [anotando, setAnotando] = useState(false)
  const [vod, setVod] = useState('')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // El marcador viaja como local-visita, pero se LEE como mío-suyo: nadie
  // recuerda si le tocó de local en la jornada 4.
  const soyLocal = partida.localPlaza === miPlaza.id
  const mis = soyLocal ? partida.vl : partida.vv
  const sus = soyLocal ? partida.vv : partida.vl
  const laReporteYo = partida.reportadaPor === miPlaza.id
  const plazo = plazoTexto(partida.venceEl)

  const enviar = (accion: Promise<{ ok: boolean; mensaje?: string }>) => {
    setOcupado(true)
    void accion.then(r => {
      setOcupado(false)
      if (r.ok) { setAnotando(false); setMotivo(null); alHacer() }
      else alAvisar(r.mensaje ?? 'No se pudo')
    })
  }

  return (
    <section className="mb-4 rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-swu-amber">
        <Swords size={11} /> Te toca — jornada {partida.jornada}
        <span className="font-bold normal-case tracking-normal text-swu-muted">
          · {NOMBRE_TIER[grupo.tier]} {grupo.orden}
        </span>
      </p>

      <p className="mt-1 flex items-center gap-1.5 truncate text-[17px] font-black text-swu-text">
        <Bandera pais={rival.pais} tam={16} />
        <span className="truncate">{rival.nombre}</span>
      </p>
      {rival.lider && <p className="truncate text-[11px] text-swu-muted">{rival.lider}</p>}

      {plazo && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-swu-muted">
          <Clock size={11} /> {plazo}
        </p>
      )}

      {/* ── Nadie anotó todavía ── */}
      {partida.estado === 'programada' && (
        anotando ? (
          <div className="mt-3 space-y-2 rounded-xl border border-swu-border bg-swu-bg p-2.5">
            <div className="grid grid-cols-2 gap-2">
              {MARCADORES.map(m => (
                <button
                  key={m.rotulo}
                  disabled={ocupado}
                  onClick={() => enviar(reportar(
                    partida.id,
                    soyLocal ? m.mis : m.sus,
                    soyLocal ? m.sus : m.mis,
                    vod.trim() || undefined,
                  ))}
                  className="min-h-[46px] rounded-xl border border-swu-border bg-swu-surface text-[13px] font-black text-swu-text disabled:opacity-50"
                >{m.rotulo}</button>
              ))}
            </div>
            <input
              value={vod} onChange={e => setVod(e.target.value)}
              placeholder="Enlace de YouTube (opcional)"
              className="w-full rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5 text-[12px] text-swu-text outline-none focus:border-swu-accent"
            />
            <button onClick={() => setAnotando(false)} className="w-full py-1 text-[11px] font-bold text-swu-muted">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAnotando(true)}
            className="mt-3 min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg"
          >Anotar resultado</button>
        )
      )}

      {/* ── Lo anotó el rival: confirmo o lo peleo ── */}
      {partida.estado === 'reportada' && !laReporteYo && (
        <div className="mt-3">
          <p className="text-center text-[12px] text-swu-muted">
            {rival.nombre} anotó <span className="font-black tabular-nums text-swu-text">{sus}-{mis}</span> a su favor.
          </p>
          {motivo === null ? (
            <>
              {/* El marcador va EN el botón y viaja otra vez a la RPC: si el
                  botón solo dijera «Aceptar», se acepta sin leer. */}
              <button
                disabled={ocupado}
                onClick={() => enviar(confirmar(partida.id, partida.vl, partida.vv))}
                className="mt-2 min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
              >Confirmar {mis}-{sus}</button>
              <button
                onClick={() => setMotivo('')}
                className="mt-2 min-h-[40px] w-full rounded-xl border border-swu-border text-[12px] font-bold text-swu-red-texto"
              >No fue así</button>
            </>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-swu-red/40 bg-swu-bg p-2.5">
              <textarea
                value={motivo} onChange={e => setMotivo(e.target.value.slice(0, 300))}
                rows={3} placeholder="¿Qué pasó? Lo lee la organización."
                className="w-full resize-none rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[12px] text-swu-text outline-none focus:border-swu-accent"
              />
              <button
                disabled={ocupado || motivo.trim().length < 5}
                onClick={() => enviar(disputar(partida.id, motivo.trim()))}
                className="min-h-[44px] w-full rounded-lg bg-swu-red text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50"
              >Mandar a la organización</button>
              <button onClick={() => setMotivo(null)} className="w-full py-1 text-[11px] font-bold text-swu-muted">
                Volver
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lo anoté yo: la pelota está del otro lado ── */}
      {partida.estado === 'reportada' && laReporteYo && (
        <p className="mt-3 rounded-xl border border-swu-border bg-swu-bg px-3 py-3 text-center text-[12px] text-swu-muted">
          Anotaste <span className="font-black tabular-nums text-swu-text">{mis}-{sus}</span>.
          Esperando a {rival.nombre}{plazo ? ` — ${plazo}` : ''}.
        </p>
      )}

      {/* ── Se pasó el plazo: no hay botón que apretar y hay que decirlo ── */}
      {partida.estado === 'vencida' && (
        <p className="mt-3 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-3 text-center text-[12px] font-bold text-swu-red-texto">
          Se venció el plazo sin resultado: esto lo destraba la organización.
        </p>
      )}
    </section>
  )
}

/* ── LOS GRUPOS ─────────────────────────────────────────────────────── */

const CERRADAS = new Set<EstadoPartida>(['confirmada', 'wo_local', 'wo_visita', 'anulada'])

function TarjetaGrupo({ grupo, abierto, alPlegar }: {
  grupo: GrupoLiga
  abierto: boolean
  alPlegar: () => void
}) {
  const filas = useMemo(
    () => tablaDe(grupo.plazas, grupo.partidas, grupo.id),
    [grupo])
  const jornadas = useMemo(() => {
    const m = new Map<number, PartidaLiga[]>()
    for (const p of grupo.partidas) {
      const lista = m.get(p.jornada) ?? []
      lista.push(p)
      m.set(p.jornada, lista)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [grupo.partidas])

  const jugadas = grupo.partidas.filter(p => CERRADAS.has(p.estado)).length
  const estoyAca = grupo.plazas.some(p => p.esMia)
  const porPlaza = new Map(grupo.plazas.map(p => [p.id, p]))

  return (
    <section className={`mb-2.5 overflow-hidden rounded-2xl border bg-swu-surface ${estoyAca ? 'border-swu-amber/40' : 'border-swu-border'}`}>
      <button
        onClick={alPlegar}
        aria-expanded={abierto}
        className="flex min-h-[56px] w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Badge variant={tonoDelTier(grupo.tier)}>{NOMBRE_TIER[grupo.tier]} {grupo.orden}</Badge>
        <span className="min-w-0 flex-1 truncate text-[11px] text-swu-muted">
          {grupo.plazas.filter(p => p.estado === 'activa').length} jugando · {jugadas} de {grupo.partidas.length} partidas
        </span>
        {estoyAca && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-swu-amber">Acá juego yo</span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-swu-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="border-t border-swu-border p-3">
          <TablaGrupo filas={filas} />

          {/* 4 · Las jornadas del grupo abierto, con su estado y su VOD. */}
          {jornadas.map(([n, lista]) => (
            <div key={n} className="mt-3">
              <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">Jornada {n}</h3>
              <div className="space-y-1.5">
                {lista.map(p => (
                  <Encuentro
                    key={p.id}
                    partida={p}
                    local={porPlaza.get(p.localPlaza)}
                    visita={porPlaza.get(p.visitaPlaza)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function TablaGrupo({ filas }: { filas: FilaTabla[] }) {
  // Quien abandona se va AL FINAL y apagado, pero no desaparece: sus partidas
  // ya jugadas siguen contando para el rival, y borrar la fila haría que el
  // que ganó ese encuentro tuviera puntos de una partida que no se ve.
  const activas = filas.filter(f => !f.abandonada)
  const idas = filas.filter(f => f.abandonada)

  if (filas.length === 0) {
    return <p className="py-4 text-center text-[12px] text-swu-muted">Este grupo todavía no tiene plazas.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-swu-border bg-swu-bg">
      <div className="flex items-center gap-2 border-b border-swu-border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
        <span className="w-5 text-center">#</span>
        <span className="min-w-0 flex-1">Jugador</span>
        <span className="w-6 text-right">PJ</span>
        <span className="w-10 text-right">G-P</span>
        <span className="w-8 text-right">Dif</span>
        <span className="w-8 text-right">Pts</span>
      </div>

      {activas.map((f, i) => (
        <FilaGrupo key={f.plazaId} f={f} puesto={i + 1} />
      ))}
      {idas.map(f => (
        <FilaGrupo key={f.plazaId} f={f} puesto={null} />
      ))}

      <p className="border-t border-swu-border px-2.5 py-1.5 text-[9px] text-swu-muted">
        3 puntos por victoria · desempate: enfrentamiento directo, después diferencia de games.
      </p>
    </div>
  )
}

function FilaGrupo({ f, puesto }: { f: FilaTabla; puesto: number | null }) {
  return (
    <div className={`flex items-center gap-2 border-t border-swu-border px-2.5 py-2 first:border-t-0 ${
      f.esMia ? 'bg-swu-accent/10' : ''} ${f.abandonada ? 'opacity-45' : ''}`}>
      <span className={`w-5 text-center text-[12px] font-black tabular-nums ${
        puesto === 1 ? 'text-swu-amber' : 'text-swu-muted'}`}>
        {puesto ?? '—'}
      </span>
      <div className="min-w-0 flex-1">
        {/* La bandera va PEGADA al nombre y no en columna propia: 3 de 42
            perfiles no tienen país, y una columna con huecos se lee como una
            tabla rota. `Bandera` devuelve null sin país — el hueco es honesto,
            un emoji genérico afirmaría una nacionalidad que nadie declaró. */}
        <p className={`flex items-center gap-1.5 truncate text-[13px] font-bold ${
          f.esMia ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
          <Bandera pais={f.pais} tam={12} />
          <span className="truncate">{f.nombre}</span>
        </p>
        {f.abandonada
          ? <p className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">abandonó</p>
          : f.lider && <p className="truncate text-[10px] text-swu-muted">{f.lider}</p>}
      </div>
      <span className="w-6 text-right text-[11px] tabular-nums text-swu-muted">{f.jugadas}</span>
      <span className="w-10 text-right text-[11px] tabular-nums text-swu-muted">{f.ganadas}-{f.perdidas}</span>
      <span className="w-8 text-right text-[11px] tabular-nums text-swu-muted">
        {f.difGames > 0 ? `+${f.difGames}` : f.difGames}
      </span>
      <span className="w-8 text-right text-[14px] font-black tabular-nums text-swu-text">{f.puntos}</span>
    </div>
  )
}

function Encuentro({ partida, local, visita }: {
  partida: PartidaLiga
  local: PlazaLiga | undefined
  visita: PlazaLiga | undefined
}) {
  const rot = rotuloDe(partida)
  const conMarcador = CON_MARCADOR.has(partida.estado)
  const ganoLocal = conMarcador && partida.vl > partida.vv
  const ganoVisita = conMarcador && partida.vv > partida.vl
  const soyParte = local?.esMia || visita?.esMia

  return (
    <div className={`rounded-xl border px-2.5 py-2 ${soyParte ? 'border-swu-accent/40 bg-swu-accent/5' : 'border-swu-border bg-swu-bg'}`}>
      <div className="flex items-center gap-2">
        {/* La bandera PEGADA al nombre y del lado de afuera, para que las dos
            columnas queden simétricas alrededor del marcador. Sin país no
            dibuja nada y la fila sigue alineada. */}
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 text-[12px] font-bold ${ganoLocal ? 'text-swu-amber' : 'text-swu-text'}`}>
          <Bandera pais={local?.pais} tam={11} />
          <span className="truncate">{local?.nombre ?? '—'}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-swu-surface px-2 py-0.5 text-[12px] font-black tabular-nums text-swu-text">
          {conMarcador ? `${partida.vl}-${partida.vv}` : 'vs'}
        </span>
        <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold ${ganoVisita ? 'text-swu-amber' : 'text-swu-text'}`}>
          <span className="truncate">{visita?.nombre ?? '—'}</span>
          <Bandera pais={visita?.pais} tam={11} />
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-3">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${rot.clase}`}>{rot.texto}</span>
        {/* El VOD va como ENLACE, no como iframe: un grupo son 28 encuentros y
            28 reproductores de YouTube incrustados cuestan más que la pantalla
            entera. */}
        {partida.vod && (
          <a
            href={enlaceVod(partida.vod)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-swu-cyan"
          >
            <PlayCircle size={11} /> Ver
          </a>
        )}
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════════════════════════════════
   LAS PIEZAS DEL LOBBY

   Viven acá y no en `componentes/` a propósito: cada una tiene UN consumidor.
   Extraer un componente con un solo consumidor no es reutilización, es
   indirección — la regla que el propio documento de diseño fija para decidir
   qué se comparte y qué no.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Llevar la vista a un bloque.
 *
 * `scrollIntoView` y no un `#hash`: un hash entra al historial, así que el
 * botón de atrás dejaría de salir de la liga y empezaría a recorrer los
 * atajos que se tocaron. Y va con `behavior` automático, que respeta
 * `prefers-reduced-motion` sin que haya que preguntarlo.
 */
function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
}

/** Un atajo de la rejilla. Navega o hace scroll, nunca las dos cosas. */
export function Atajo({ icono, rotulo, a, alTocar, apagado }: {
  icono: React.ReactNode
  rotulo: string
  a?: string
  alTocar?: () => void
  apagado?: boolean
}) {
  /* ENVUELVE, NO TRUNCA. Medido a 375 px con tres columnas: quedan 55 px de
     texto y «Mis partidas» necesita 67 — salían «Mis par…», «Reglam…». Es la
     misma cuenta que las cifras de la cabecera, y la misma respuesta: un rótulo
     que no se puede leer no es un rótulo. Se acortó lo redundante («Mis» dentro
     de MI liga) y lo que igual no entre baja a dos renglones. */
  const clases = `flex min-h-[50px] items-center gap-1.5 rounded-xl border px-2
                  text-left text-[11px] font-bold leading-tight text-swu-text
                  disabled:opacity-40`
  const estilo = { borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }
  const dentro = <>
    <span className="shrink-0" style={{ color: 'var(--liga-acento)' }}>{icono}</span>
    <span className="min-w-0">{rotulo}</span>
  </>
  if (a && !apagado) return <Link to={a} className={clases} style={estilo}>{dentro}</Link>
  return (
    <button onClick={alTocar} disabled={apagado} className={clases} style={estilo}>
      {dentro}
    </button>
  )
}

/**
 * La tira de anuncios, y el formulario de quien organiza.
 *
 * Alejo no podía publicar NADA: `news_insert` exige `role='admin'` y `news` no
 * tiene columna de alcance, así que un aviso suyo habría salido en el Inicio de
 * toda la comunidad salvadoreña.
 *
 * Si no hay anuncios y no soy staff, esto no dibuja nada. Un bloque vacío que
 * SIEMPRE termina en nada es un hueco en cada visita (§3h-quinquies).
 */
export function AnunciosLiga({ id, ligaId, anuncios, puedoPublicar, alCambiar, alAvisar }: {
  id: string
  ligaId: string
  anuncios: AnuncioLiga[]
  puedoPublicar: boolean
  alCambiar: () => void
  alAvisar: (m: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (anuncios.length === 0 && !puedoPublicar) return null

  const publicar = () => {
    setOcupado(true)
    void publicarAnuncio(ligaId, titulo.trim(), cuerpo.trim()).then(r => {
      setOcupado(false)
      if (!r.ok) { alAvisar(r.mensaje ?? 'No se pudo publicar.'); return }
      setTitulo(''); setCuerpo(''); setAbierto(false); alCambiar()
    })
  }

  return (
    <section id={id} className="mb-3">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
          <Megaphone size={12} /> Anuncios
        </p>
        {puedoPublicar && (
          <button
            onClick={() => setAbierto(a => !a)}
            className="ml-auto flex min-h-[32px] items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold text-swu-text"
            style={{ borderColor: 'var(--liga-borde)' }}
          >
            <Plus size={12} /> {abierto ? 'Cancelar' : 'Publicar'}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mb-2 rounded-xl border p-3" style={{ borderColor: 'var(--liga-borde)' }}>
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value.slice(0, 120))}
            placeholder="Título — ej. Se sembró la jornada 4"
            className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-[13px] text-swu-text outline-none focus:border-swu-accent"
          />
          <textarea
            value={cuerpo}
            onChange={e => setCuerpo(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Lo que la liga tiene que saber."
            className="mt-2 w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-[13px] text-swu-text outline-none focus:border-swu-accent"
          />
          <button
            onClick={publicar}
            disabled={ocupado || !titulo.trim() || !cuerpo.trim()}
            className="mt-2 min-h-[44px] w-full rounded-lg text-[12px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
            style={{ background: 'var(--liga-acento)' }}
          >
            {ocupado ? 'Publicando…' : 'Publicar el aviso'}
          </button>
        </div>
      )}

      {anuncios.length === 0 ? (
        <p className="rounded-xl border border-dashed border-swu-border px-3 py-3 text-center text-[11px] text-swu-muted">
          Todavía no publicaste ningún aviso.
        </p>
      ) : (
        <div className="liga-carrusel -mx-4 px-4">
          {anuncios.map(a => (
            <article
              key={a.id}
              className="w-[248px] shrink-0 snap-start rounded-xl border p-3"
              style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}
            >
              <p className="flex items-start gap-1.5 text-[12px] font-black leading-snug text-swu-text">
                <FileText size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--liga-acento)' }} />
                <span>{a.titulo}</span>
              </p>
              <p className="mt-1 line-clamp-4 text-[11px] leading-snug text-swu-muted">{a.cuerpo}</p>
              <div className="mt-2 flex items-center gap-2">
                <time
                  className="text-[9px] uppercase tracking-wider text-swu-muted"
                  dateTime={a.creadoEn}
                  title={new Date(a.creadoEn).toLocaleString('es-SV')}
                >
                  {haceCuanto(a.creadoEn)}
                </time>
                {puedoPublicar && (
                  <button
                    onClick={() => void borrarAnuncio(a.id).then(r => {
                      if (r.ok) alCambiar(); else alAvisar(r.mensaje ?? 'No se pudo borrar.')
                    })}
                    className="ml-auto p-1 text-swu-muted hover:text-swu-red-texto"
                    aria-label={`Borrar el aviso «${a.titulo}»`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * CÓMO FUNCIONA.
 *
 * Hasta hoy estas reglas no estaban escritas en ningún lado de la app: vivían
 * en el código y en la cabeza de quien la construyó. Es lo único a lo que la
 * primera queja de la jornada 3 va a poder apuntar.
 *
 * Los números salen de la liga y no están cableados: con grupos de 6, un
 * «jugás 7 partidas» sería una mentira impresa.
 */
export function ComoFunciona({ id, abierto, alPlegar, porGrupo }: {
  id: string; abierto: boolean; alPlegar: () => void; porGrupo: number
}) {
  return (
    <section id={id} className="mt-3">
      <button
        onClick={alPlegar}
        className="flex min-h-[48px] w-full items-center gap-2 rounded-xl border px-3 text-left"
        style={{ borderColor: 'var(--liga-borde)' }}
      >
        <BookOpen size={15} style={{ color: 'var(--liga-acento)' }} />
        <span className="flex-1 text-[12px] font-black text-swu-text">Cómo funciona la liga</span>
        <ChevronDown size={16} className={`text-swu-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <ul className="mt-2 space-y-2 rounded-xl border border-swu-border bg-swu-surface px-4 py-3 text-[12px] leading-snug text-swu-text">
          <li>
            <b>Grupos de {porGrupo}.</b> Jugás {Math.max(0, porGrupo - 1)} partidas, una contra
            cada quien. Ese número no cambia aunque la liga crezca.
          </li>
          <li><b>3 puntos</b> por victoria, <b>0</b> por derrota. No hay empates: un BO3 siempre
            termina 2-0 o 2-1.</li>
          <li>
            <b>Si dos quedan iguales</b>, manda el enfrentamiento directo; si aun así siguen
            iguales, la diferencia de games, y después los games ganados.
          </li>
          <li>
            <b>Los resultados los confirman los dos.</b> Uno anota, el otro confirma o dice que
            no fue así. Si nadie contesta antes de la fecha límite de esa partida,{' '}
            <b>vale lo que reportó tu rival</b> — por eso la fecha se avisa antes.
          </li>
          <li>
            <b>Si nadie la jugó</b> cuando vence la jornada, la partida no se inventa: pasa a la
            cola de quien organiza, que decide.
          </li>
        </ul>
      )}
    </section>
  )
}


/**
 * TOP 8 — el podio de MI grupo.
 *
 * La maqueta lo pide como «Top 8» a secas. Se dibuja con el nombre del grupo
 * arriba a propósito: un Top 8 sin decir de qué se lee como un ranking global,
 * y un ranking cruzado entre grupos que nunca se enfrentaron es ruido con cara
 * de dato — el campeón de Legendario 1 con 15 puntos quedaría debajo de un
 * Común 3 con 18. Con UN solo grupo son exactamente lo mismo, y ahí el rótulo
 * no molesta a nadie.
 *
 * Las medallas van solo en los tres primeros y solo cuando esa persona YA
 * jugó: un podio de oro sobre una tabla de ceros —el día 1, con todos en 0—
 * corona a quien quedó primero por orden alfabético.
 */
export function TopOcho({ id, grupo, alVerTodo }: {
  id: string; grupo: GrupoLiga | null; alVerTodo: () => void
}) {
  const filas = useMemo(
    () => (grupo ? tablaDe(grupo.plazas, grupo.partidas, grupo.id).slice(0, 8) : []),
    [grupo])
  if (!grupo || filas.length === 0) return null
  const hayJuego = filas.some(f => f.jugadas > 0)

  return (
    <section id={id} className="mb-3 overflow-hidden rounded-2xl border border-swu-border bg-swu-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Trophy size={14} style={{ color: 'var(--liga-oro)' }} />
        <p className="flex-1 truncate text-[12px] font-black text-swu-text">
          Top {filas.length} · {NOMBRE_TIER[grupo.tier] ?? grupo.tier} {grupo.orden}
        </p>
        <button onClick={alVerTodo} className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: 'var(--liga-acento)' }}>
          Ver todo <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-[28px_1fr_34px_auto] items-center gap-x-2 border-t border-swu-border px-3 py-1.5
                      text-[9px] font-bold uppercase tracking-wider text-swu-muted">
        <span>#</span><span>Jugador</span><span className="text-center">País</span><span>Puntos</span>
      </div>
      {filas.map((f, i) => (
        <div
          key={f.plazaId}
          className={`grid grid-cols-[28px_1fr_34px_auto] items-center gap-x-2 border-t border-swu-border px-3 py-2 ${
            f.esMia ? 'bg-swu-accent/10' : ''} ${f.abandonada ? 'opacity-45' : ''}`}
        >
          <span className="flex items-center justify-center">
            {hayJuego && i < 3
              ? <Medal size={14} style={{ color: ['var(--liga-oro)', '#C6CBD4', '#C08457'][i] }} />
              : <span className="text-[12px] font-black tabular-nums text-swu-muted">{i + 1}</span>}
          </span>
          <span className={`min-w-0 truncate text-[13px] font-bold ${
            f.esMia ? 'text-swu-accent-texto' : 'text-swu-text'}`}>
            {f.nombre}
          </span>
          {/* País en columna propia, como la maqueta. Sin país queda VACÍA:
              una bandera genérica afirmaría una nacionalidad que nadie declaró. */}
          <span className="flex justify-center"><Bandera pais={f.pais} tam={14} /></span>
          <span className="text-[13px] font-black tabular-nums text-swu-text">{f.puntos}</span>
        </div>
      ))}
    </section>
  )
}


/**
 * QUIÉNES VAN ENTRANDO.
 *
 * Solo mientras no hay grupos. En cuanto se arman, la tabla del grupo dice lo
 * mismo y mejor —con puntos— y esta lista sobra.
 *
 * El orden es el de llegada y **no se numera**: poner el puesto convierte una
 * lista de gente en una carrera por entrar primero, y entrar primero no da
 * ninguna ventaja en esta liga.
 *
 * Si todavía no hay nadie no se dibuja una lista vacía: se dice qué falta.
 */
export function Padron({ gente, total, cupo, vacio }: {
  gente: LigaCompleta['padron']
  total: number
  cupo: number | null
  vacio: string
}) {
  if (gente.length === 0) {
    return (
      <p className="rounded-2xl border border-swu-border bg-swu-surface px-4 py-6 text-center text-[12px] text-swu-muted">
        {vacio}
      </p>
    )
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-swu-border bg-swu-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Users size={14} style={{ color: 'var(--liga-acento)' }} />
        <p className="flex-1 text-[12px] font-black text-swu-text">Quiénes van entrando</p>
        <span className="font-mono text-[11px] tabular-nums text-swu-muted">
          {total}{cupo ? `/${cupo}` : ''}
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto barra-fina">
        {gente.map(p => (
          <div key={p.id} className="flex items-center gap-2 border-t border-swu-border px-3 py-2">
            <Bandera pais={p.pais} tam={13} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-swu-text">{p.nombre}</span>
              {p.lider && (
                <span className="block truncate text-[10px] text-swu-muted">
                  {p.lider}{p.base ? ` · ${p.base}` : ''}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {total > gente.length && (
        <p className="border-t border-swu-border px-3 py-2 text-center text-[10px] text-swu-muted">
          y {total - gente.length} más
        </p>
      )}
    </section>
  )
}
