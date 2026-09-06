/**
 * LA PROYECCIÓN — /events/live/:code
 *
 * La pantalla que se pone en el televisor de la tienda durante un torneo. Se
 * abre una vez, se deja tres horas y NADIE LA TOCA: no hay teclado, no hay
 * puntero, y nadie va a caminar hasta la tele a cambiar de pestaña.
 *
 * Eso es todo el diseño. No rota, no tiene pestañas y no esconde nada detrás
 * de un gesto: los tres datos que la sala necesita —cuánto falta, en qué mesa
 * me toca, quién va ganando— están los tres en pantalla al mismo tiempo.
 *
 * ── Lo que reemplaza, y por qué ──────────────────────────────────────
 *
 * La versión anterior componía en `max-w-2xl` (672 px): en una tele de 1920 eso
 * es el 35% del ancho, con dos franjas negras enormes a los lados. Los nombres
 * iban a 14 px y la clasificación a 12. Y para pasar de «clasificación» a
 * «emparejamientos» había que TOCAR una pestaña, cosa que en una tele no ocurre
 * nunca: se quedaba pegada en la primera vista toda la tarde.
 *
 * Esa versión no se borra — sigue siendo la vista de TELÉFONO. La misma URL se
 * comparte por WhatsApp y se abre desde la mesa, y una tele y un teléfono no
 * son la misma pantalla: forzar un solo diseño arruina las dos.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import TournamentPublicView from '../TournamentPublicView'
import { useProyeccion, type EstadoTablero } from './datos'
import { Cabecera } from './Cabecera'
import { Directorio } from './Directorio'
import { filasDeMesas, filasDePareos, type Fila } from './filas'
import { escalonPara, capacidad, puestoDenso, ordenFinal, nombreCorto } from './escalones'
import type { CloudStanding } from '../../../services/tournamentCloud'

const ANCHO = 1920
const ALTO = 1080
/** 5% por lado. Una tele por HDMI que no esté en «Just Scan» se come hasta un
 *  5% por borde, y ahí es donde viven el reloj y el pie. */
const MARGEN_X = 96
const MARGEN_Y = 54
const UTIL_ANCHO = ANCHO - MARGEN_X * 2   // 1728
const UTIL_ALTO = ALTO - MARGEN_Y * 2     // 972

/** Por debajo de esto no es una tele: es un teléfono, y va la vista de siempre. */
const ANCHO_MINIMO_TABLERO = 900

export default function ProyeccionPage() {
  const { code } = useParams<{ code: string }>()
  const [params] = useSearchParams()
  const ancho = useAnchoVentana()

  const datos = useProyeccion(code)

  /* La misma URL sirve a la tele y al teléfono. Se decide por ancho real y no
     por «es móvil»: lo que importa es cuántos píxeles hay para repartir. */
  if (ancho > 0 && ancho < ANCHO_MINIMO_TABLERO) return <TournamentPublicView />

  return (
    <Lienzo>
      {datos.estado === 'cargando' ? null
        : datos.estado === 'no-encontrado' ? <NoEncontrado codigo={code ?? ''} />
        : <Tablero datos={datos} pantallaChica={params.get('pantalla') === 'chica'} />}
    </Lienzo>
  )
}

/**
 * El lienzo de 1920×1080, escalado para caber en lo que haya.
 *
 * El patrón sale de `OverlayPage`, con una corrección: allá no se centra porque
 * OBS siempre entrega 16:9 exacto. Una tele o un proyector con otra proporción
 * dejarían todo pegado a la esquina superior izquierda, así que acá se traslada
 * al medio. Nada scrollea nunca: si algo no cabe, se cambia de escalón o se
 * pagina — jamás se corta.
 */
function Lienzo({ children }: { children: React.ReactNode }) {
  const [caja, setCaja] = useState({ escala: 1, x: 0, y: 0 })
  const [corrimiento, setCorrimiento] = useState(0)

  useEffect(() => {
    const medir = () => {
      const e = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO)
      setCaja({
        escala: e,
        x: (window.innerWidth - ANCHO * e) / 2,
        y: (window.innerHeight - ALTO * e) / 2,
      })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  /* Corrimiento anti-quemado: ±6 px recorriendo 8 posiciones, un paso cada 6
     minutos. Imperceptible, un solo `transform`, y es lo que hacen las teles.
     Tres horas del mismo reloj brillante en el mismo sitio, muchos sábados
     seguidos, deja fantasma en un OLED de tienda. */
  useEffect(() => {
    const t = setInterval(() => setCorrimiento(c => (c + 1) % 8), 6 * 60_000)
    return () => clearInterval(t)
  }, [])

  const dx = [0, 6, 6, 0, -6, -6, -6, 0][corrimiento]
  const dy = [0, 0, 6, 6, 6, 0, -6, -6][corrimiento]

  return (
    <div className="fixed inset-0 overflow-hidden bg-swu-bg">
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: ANCHO, height: ALTO,
          transform: `translate(${caja.x + dx}px, ${caja.y + dy}px) scale(${caja.escala})`,
          transformOrigin: 'top left',
          transition: 'transform 2s linear',
        }}
      >
        <div style={{ position: 'absolute', left: MARGEN_X, top: MARGEN_Y, width: UTIL_ANCHO, height: UTIL_ALTO }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Tablero({ datos, pantallaChica }: {
  datos: ReturnType<typeof useProyeccion>
  pantallaChica: boolean
}) {
  const { evento, estado } = datos
  if (!evento) return null

  const jugando = datos.standings.filter(s => !s.dropped)
  const escalon = escalonPara(jugando.length, pantallaChica)
  const modoLleno = jugando.length > 36

  // Reparto vertical, suma exacta 972.
  const altoFilas = modoLleno ? 652 : 512

  return (
    <div className="flex h-full flex-col">
      <Cabecera
        evento={evento}
        logo={datos.logo}
        estado={estado}
        jugadores={jugando.length}
        mesasListas={datos.mesasListas}
        mesasTotal={datos.mesasTotal}
      />
      <div className="bg-swu-accent" style={{ height: 4 }} />

      <div className="flex-1" style={{ paddingTop: 12 }}>
        {estado === 'cancelado' ? <Cancelado />
          : estado === 'convocatoria' ? <Convocatoria datos={datos} />
          : estado === 'sorteando' ? <Sorteando />
          : estado === 'final' ? <Final datos={datos} escalon={escalon} alto={altoFilas} />
          : <EnJuego datos={datos} escalon={escalon} alto={altoFilas} modoLleno={modoLleno} />}
      </div>

      <Pie evento={evento} frescuraMs={datos.frescuraMs} />
    </div>
  )
}

/* ── El estado normal: franja de cabeza + directorio ────────────────── */

function EnJuego({ datos, escalon, alto, modoLleno }: {
  datos: ReturnType<typeof useProyeccion>
  escalon: ReturnType<typeof escalonPara>
  alto: number
  modoLleno: boolean
}) {
  const jugando = datos.standings.filter(s => !s.dropped)
  const conDesempate = !datos.deMesas
  const puestos = puestoDenso(jugando, conDesempate)

  const filas: Fila[] = datos.deMesas
    ? filasDeMesas(datos.standings, datos.mesas)
    : filasDePareos(datos.standings, datos.pairings)

  // El puesto de la clasificación se pega a cada fila.
  for (const f of filas) f.puesto = puestos.get(f.id) ?? null

  const cabeza = [...jugando]
    .sort((a, b) => (puestos.get(a.id) ?? 99) - (puestos.get(b.id) ?? 99))
    .slice(0, 3)

  return (
    <>
      {!modoLleno && (
        <>
          <FranjaCabeza gente={cabeza} puestos={puestos} />
          <div style={{ height: 12 }} />
        </>
      )}
      <Paginado filas={filas} escalon={escalon} alto={alto} mostrarVida={datos.deMesas} />
    </>
  )
}

/**
 * Los tres punteros.
 *
 * El ordinal es DENSO: dos personas con los mismos puntos comparten el «1º». En
 * un torneo de mesas `omw_pct` y `gw_pct` son 0 para todos, así que el
 * desempate fino no desempata nada y el orden lo terminaría decidiendo el
 * abecedario — coronar a alguien por eso es inventar un resultado.
 */
function FranjaCabeza({ gente, puestos }: { gente: CloudStanding[]; puestos: Map<string, number> }) {
  return (
    <div style={{ display: 'flex', gap: 24, height: 128 }}>
      {gente.map(p => (
        <div key={p.id} className="flex items-center" style={{ flex: 1, minWidth: 0 }}>
          <span
            className="proy-chapa flex items-center justify-center bg-swu-amber/20 font-mono font-bold text-swu-amber"
            style={{ width: 96, height: 96, fontSize: 60, flexShrink: 0 }}
          >
            {puestos.get(p.id)}º
          </span>
          <span style={{ width: 16, flexShrink: 0 }} />
          <span className="truncate font-bold text-swu-text" style={{ flex: 1, minWidth: 0, fontSize: 64 }}>
            {nombreCorto(p.player_name, 10)}
          </span>
          <span className="text-right" style={{ flexShrink: 0 }}>
            <span className="block font-mono font-bold text-swu-amber" style={{ fontSize: 64, lineHeight: 1 }}>
              {p.points}
            </span>
            <span className="block uppercase tracking-[0.2em] text-swu-muted" style={{ fontSize: 26 }}>pts</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Pagina el directorio, pero SOLO arriba de la capacidad del escalón.
 *
 * En el rango del encargo —8 a 40 jugadores— esto no se activa nunca y la
 * pantalla no hace esperar a nadie. Cuando se activa, la barra que se drena es
 * el contrato de «esto vuelve»: sin ella alguien camina hasta la tele a buscar
 * un botón que no existe.
 */
function Paginado({ filas, escalon, alto, mostrarVida }: {
  filas: Fila[]
  escalon: ReturnType<typeof escalonPara>
  alto: number
  mostrarVida: boolean
}) {
  const porPagina = capacidad(escalon)
  const paginas = Math.max(1, Math.ceil(filas.length / porPagina))
  const [tic, setTic] = useState(0)

  useEffect(() => {
    if (paginas <= 1) return
    const t = setInterval(() => setTic(v => v + 1), 18_000)
    return () => clearInterval(t)
  }, [paginas])

  const i = paginas <= 1 ? 0 : tic % paginas
  const visibles = paginas <= 1 ? filas : filas.slice(i * porPagina, (i + 1) * porPagina)

  return (
    <>
      <Directorio filas={visibles} escalon={escalon} alto={alto} mostrarVida={mostrarVida} />
      {paginas > 1 && (
        <div className="mt-2">
          <div className="mb-1 text-right font-mono uppercase tracking-[0.16em] text-swu-muted" style={{ fontSize: 36 }}>
            Página {i + 1} de {paginas}
          </div>
          <div className="bg-swu-border" style={{ height: 6 }}>
            <div key={tic} className="proy-drena h-full bg-swu-amber" style={{ animationDuration: '18s' }} />
          </div>
        </div>
      )}
    </>
  )
}

/* ── Los estados que casi nunca se ven al desarrollar ───────────────── */

function Convocatoria({ datos }: { datos: ReturnType<typeof useProyeccion> }) {
  const evento = datos.evento!
  const sembrados = datos.standings.filter(s => !s.dropped)

  /* Los nombres salen de `tournament_standings`, NUNCA de `event_registrations`:
     la policy `reg_select` exige `auth.uid()` en sus cuatro ramas, así que una
     tele deslogueada lee 0 filas SIN ERROR y la pantalla anunciaría un torneo
     vacío con veintisiete personas adentro. */
  if (sembrados.length === 0) {
    // Nada que contar todavía. Un cero plausible es peor que un hueco: la
    // pantalla se vuelve el cartel de la tienda y no afirma ningún número.
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="uppercase tracking-[0.2em] text-swu-green" style={{ fontSize: 56 }}>
          Inscripción abierta
        </div>
        <div className="proy-panel my-8 bg-swu-surface px-16 py-6 font-mono font-bold text-swu-amber" style={{ fontSize: 260, lineHeight: 1 }}>
          {evento.code}
        </div>
        <div className="text-swu-text" style={{ fontSize: 56 }}>swusv.com</div>
        <div className="mt-3 text-swu-muted" style={{ fontSize: 40 }}>
          Abrí la app, entrá a Torneo y poné el código
        </div>
      </div>
    )
  }

  const escalon = escalonPara(sembrados.length)
  const filas: Fila[] = sembrados.map(s => ({
    id: s.id, player_name: s.player_name, mesa: null,
    chapa: 'cerrada', puesto: null, vida: null,
  }))

  return (
    <>
      <div className="proy-panel mb-3 flex items-center justify-center gap-8 bg-swu-surface" style={{ height: 128 }}>
        <span className="font-mono font-bold text-swu-amber" style={{ fontSize: 96 }}>{evento.code}</span>
        <span className="text-swu-text" style={{ fontSize: 44 }}>swusv.com</span>
      </div>
      <Directorio filas={filas} escalon={escalon} alto={452} mostrarVida={false} />
    </>
  )
}

function Sorteando() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="uppercase tracking-[0.2em] font-bold text-swu-amber" style={{ fontSize: 96 }}>
        Sorteando las mesas
      </div>
      <div className="mt-6 flex gap-4">
        {[0, 1, 2].map(i => (
          <span key={i} className="proy-punto bg-swu-amber" style={{ width: 60, height: 8 }} />
        ))}
      </div>
      <div className="mt-6 text-swu-muted" style={{ fontSize: 44 }}>aguantá un toque</div>
    </div>
  )
}

/**
 * El cierre.
 *
 * Si NADIE tiene `puesto` fijado —que es el caso POR DEFECTO en suizo y en
 * eliminación, porque `fijar_puestos_finales` tiene un solo llamador en toda la
 * app— no se nombra campeón ni se dibuja podio: se dice que es el orden de la
 * clasificación y se dice por qué. Afirmar un campeón que la base nunca fijó es
 * inventar un resultado delante de la sala que lo jugó.
 */
function Final({ datos, escalon, alto }: {
  datos: ReturnType<typeof useProyeccion>
  escalon: ReturnType<typeof escalonPara>
  alto: number
}) {
  const orden = ordenFinal(datos.standings)
  const hayPuestos = orden.some(s => s.puesto !== null)

  /* Un torneo cerrado sin una sola fila de clasificación. Existe de verdad
     —SWUDYP5, creado y nunca jugado— y sin este caso la pantalla dejaba medio
     televisor en blanco bajo el título «CLASIFICACIÓN FINAL» y una leyenda
     explicando una tabla que no está. Se dice lo único que se sabe. */
  if (orden.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="uppercase tracking-[0.14em] text-swu-muted" style={{ fontSize: 72 }}>
          Este torneo no llegó a jugarse
        </div>
        <div className="mt-6 text-swu-muted" style={{ fontSize: 44 }}>swusv.com</div>
      </div>
    )
  }

  /* LOS PUNTOS SOLO SE MUESTRAN SI EL ORDEN SALIÓ DE ELLOS.
   *
   * Cuando alguien fijó los puestos a mano —una final de mesas, un cuadro— el
   * orden NO lo decidieron los puntos, y ponerlos al lado hace que el tablero
   * se contradiga solo. Medido en el torneo real: 8º Winnie con 4 puntos y 4º
   * Nelson con 3. En una pared, delante de la sala que acaba de jugar, eso no
   * se lee como «el puesto salió de la mesa final»: se lee como que la app
   * calculó mal. Cuando nadie fijó puestos, el orden SÍ es el de los puntos y
   * entonces mostrarlos explica la tabla en vez de discutirla. */
  const filas: Fila[] = orden.map((s, i) => ({
    id: s.id,
    player_name: s.player_name,
    mesa: s.points,
    chapa: (s.dropped ? 'fuera' : 'cerrada') as Fila['chapa'],
    puesto: s.puesto ?? i + 1,
    vida: null,
  }))

  return (
    <>
      <div className="mb-2 flex items-baseline gap-6">
        <span className="font-bold uppercase tracking-[0.16em] text-swu-amber" style={{ fontSize: 48 }}>
          Clasificación final
        </span>
        <span className="text-swu-muted" style={{ fontSize: 32 }}>
          {hayPuestos
            ? 'Puestos fijados por el organizador'
            /* No es un caso raro: es el caso POR DEFECTO en suizo y en
               eliminación, porque `fijar_puestos_finales` tiene un solo
               llamador en toda la app. Afirmar un campeón que la base nunca
               fijó sería inventar un resultado delante de quien lo jugó. */
            : 'Es el orden de la clasificación: los puestos no se fijaron'}
        </span>
      </div>
      <Directorio
        filas={filas.slice(0, capacidad(escalon))}
        escalon={escalon}
        alto={alto - 60}
        mostrarVida={false}
        orden="dado"
        sinChapa={hayPuestos}
      />
    </>
  )
}

function Cancelado() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="font-bold uppercase tracking-[0.14em] text-swu-muted" style={{ fontSize: 120 }}>
        Torneo cancelado
      </div>
      <div className="mt-6 text-swu-muted" style={{ fontSize: 44 }}>swusv.com</div>
    </div>
  )
}

function NoEncontrado({ codigo }: { codigo: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="text-swu-text" style={{ fontSize: 56 }}>No se encontró el torneo</div>
      <div className="my-6 font-mono font-bold text-swu-muted" style={{ fontSize: 120 }}>{codigo}</div>
      <div className="text-swu-muted" style={{ fontSize: 40 }}>Revisá el código</div>
    </div>
  )
}

/**
 * El pie, con el punto de frescura.
 *
 * Es la única forma que tiene alguien de saber, mirando la pared, si el tablero
 * está vivo o congelado. Sin él, una tele con el canal muerto se ve
 * exactamente igual que un torneo tranquilo.
 */
function Pie({ evento, frescuraMs }: { evento: { code: string }; frescuraMs: number }) {
  const seg = Math.round(frescuraMs / 1000)
  const color = frescuraMs < 90_000 ? 'bg-swu-green'
    : frescuraMs < 300_000 ? 'bg-swu-amber' : 'bg-swu-red'

  return (
    <div className="flex items-center justify-between border-t-2 border-swu-border font-mono text-swu-muted"
         style={{ height: 64, fontSize: 32 }}>
      <span>HOLOCRON SWU · {evento.code} · swusv.com</span>
      <span className="flex items-center gap-3">
        <span className={`rounded-full ${color}`} style={{ width: 16, height: 16 }} />
        {frescuraMs >= 300_000 ? 'SIN SEÑAL' : `actualizado hace ${seg} s`}
      </span>
    </div>
  )
}

/* ── Ayudas ─────────────────────────────────────────────────────────── */

function useAnchoVentana(): number {
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))
  useEffect(() => {
    const medir = () => setAncho(window.innerWidth)
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  return ancho
}

export type { EstadoTablero }
