/**
 * El directorio: TODOS los que están jugando, una fila por persona.
 *
 * ── La apuesta ───────────────────────────────────────────────────────
 *
 * La pregunta que la sala hace en voz alta es «¿en qué mesa estoy?», y es una
 * BÚSQUEDA POR NOMBRE. Por eso el índice de esta pantalla es el nombre en orden
 * alfabético y no la clasificación: el abecedario es la única llave que una
 * persona puede computar sobre sí misma sin leer nada más.
 *
 * Y la mesa viaja EN LA MISMA FILA que el nombre. Eso es lo que hace que esta
 * pantalla no tenga un estado que pueda quedar en el lugar equivocado: no hay
 * pestaña que se quede pegada, no hay rotación que llegue tarde, no hay quien
 * tenga que caminar hasta la tele. Encontrás tu nombre y la mesa ya está ahí.
 *
 * ── Por qué no hay cebra ─────────────────────────────────────────────
 *
 * `bg-swu-surface` sobre `bg-swu-bg` da 1,09:1 de contraste. A cuatro metros
 * eso no existe. El renglón lo sostiene un filete de 2 px en `swu-border`, que
 * sí se ve.
 */

import { useEffect, useState } from 'react'
import { type Escalon, nombreCorto, repartirEnColumnas } from './escalones'
import type { Fila } from './filas'

interface Props {
  filas: Fila[]
  escalon: Escalon
  /** Alto disponible para las filas. Lo reparte la rejilla con `1fr`. */
  alto: number
  mostrarVida: boolean
  /**
   * Cómo se ordenan las filas.
   *
   * `alfabetico` mientras se juega: la pregunta es «¿en qué mesa estoy?», o sea
   * una búsqueda por nombre, y el abecedario es la única llave que una persona
   * puede computar sobre sí misma.
   *
   * `dado` al terminar: ahí la pregunta cambia a «¿cómo quedamos?» y el orden
   * ES la respuesta. Se respeta el que venga y las cabeceras dicen el rango de
   * puestos en vez del de letras.
   */
  orden?: 'alfabetico' | 'dado'
  /** Oculta la chapa entera. Ver el porqué en el cierre con puestos fijados. */
  sinChapa?: boolean
}

export function Directorio({ filas, escalon, alto, mostrarVida, orden = 'alfabetico', sinChapa }: Props) {
  const columnas = orden === 'alfabetico'
    ? repartirEnColumnas(filas, escalon.cols, escalon.filas)
    : enTrozos(filas, escalon.filas)
  const canaleta = escalon.cols >= 4 ? 16 : 24

  /* Los nombres se acortan de una sola pasada y con memoria COMPARTIDA entre
     columnas: si «Nelson Martínez» y «Nelson Meléndez» caen en columnas
     distintas y cada una acortara por su cuenta, las dos dirían «Nelson M.» y
     quien las busque no sabría cuál es su mesa. */
  const usados = new Set<string>()
  const corto = new Map<string, string>()
  for (const c of columnas) {
    for (const f of c.gente) corto.set(f.id, nombreCorto(f.player_name, escalon.maxCaracteres, usados))
  }

  return (
    <div style={{ display: 'flex', gap: canaleta, height: alto + 60 }}>
      {columnas.map((c, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0 }}>
          <div
            className="border-b-2 border-swu-border pb-2 font-bold uppercase tracking-[0.18em] text-swu-accent-texto"
            style={{ fontSize: 44, height: 52 }}
          >
            {c.rango}
          </div>
          <div
            style={{
              display: 'grid',
              /* `minmax(0, 1fr)` y NO `1fr` a secas: `1fr` es en realidad
                 `minmax(auto, 1fr)`, y ese `auto` deja que una fila CREZCA por
                 encima de su reparto cuando su contenido es más alto. Con eso,
                 once nombres a 63 px desbordaban la zona y la última fila se
                 dibujaba encima del pie — visto en el banco. Con `minmax(0,…)`
                 el reparto manda y el contenido se ajusta. */
              gridTemplateRows: `repeat(${escalon.filas}, minmax(0, 1fr))`,
              overflow: 'hidden',
              height: alto,
              marginTop: 8,
            }}
          >
            {c.gente.map(f => (
              <FilaJugador
                key={f.id}
                fila={f}
                nombre={corto.get(f.id) ?? f.player_name}
                escalon={escalon}
                mostrarVida={mostrarVida}
                sinChapa={sinChapa}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FilaJugador({ fila, nombre, escalon, mostrarVida, sinChapa }: {
  fila: Fila; nombre: string; escalon: Escalon; mostrarVida: boolean; sinChapa?: boolean
}) {
  const enCabeza = fila.puesto !== null && fila.puesto <= 3
  const conVida = mostrarVida && escalon.vidaAncho > 0

  return (
    <div className="flex items-center border-b-2 border-swu-border" style={{ minWidth: 0 }}>
      {/* Canto de estado: en modo lleno es el ÚNICO indicador de «va ganando». */}
      <span
        className={enCabeza ? 'bg-swu-amber' : ''}
        style={{ width: 6, height: '70%', flexShrink: 0 }}
      />
      <span style={{ width: 14, flexShrink: 0 }} />

      {escalon.chipAncho > 0 && (
        <span
          className={`font-mono font-bold ${enCabeza ? 'text-swu-amber' : 'text-swu-muted'}`}
          style={{ width: escalon.chipAncho, fontSize: escalon.chipPx, flexShrink: 0 }}
        >
          {fila.puesto ? `${fila.puesto}º` : ''}
        </span>
      )}

      <span
        className={`truncate font-semibold ${
          fila.chapa === 'cerrada' ? 'text-swu-muted'
            : enCabeza ? 'text-swu-amber' : 'text-swu-text'
        }`}
        style={{ flex: 1, minWidth: 0, fontSize: escalon.nombrePx, paddingRight: 12 }}
      >
        {nombre}
      </span>

      {conVida && (
        <span
          className={`text-right font-mono font-bold ${
            fila.vida === null ? 'text-swu-muted'
              : fila.vida <= 5 ? 'text-swu-red-texto' : 'text-swu-text'
          }`}
          style={{ width: escalon.vidaAncho, fontSize: escalon.vidaPx, flexShrink: 0 }}
        >
          {/* «—» y nunca 0: no haber anotado no es haber quedado en cero. */}
          {fila.vida === null ? '—' : fila.vida}
        </span>
      )}

      {!sinChapa && <Chapa fila={fila} escalon={escalon} />}
      <span style={{ width: 14, flexShrink: 0 }} />
    </div>
  )
}

/**
 * La chapa de mesa, y su color dice el estado REAL de la base.
 *
 * ÁMBAR   la mesa sigue jugando
 * VERDE   el resultado ya se anotó
 * ROJO    en disputa — no cuenta como terminada
 * CIAN    descansa esta ronda (se decide por `player2_standing`, JAMÁS por
 *         `player2_id`: un invitado tiene lo primero y no lo segundo, y
 *         confundirlos es lo que regalaba partidas 2-0)
 * GRIS    ya no está en la ronda en curso (eliminación)
 */
function Chapa({ fila, escalon }: { fila: Fila; escalon: Escalon }) {
  /* La guarda es un interruptor que se enciende SOLO tras el primer segundo y
     medio, y no una comparación de marcas de tiempo: leer el reloj durante el
     render es impuro. Sin la guarda, al abrir la página vuelan las cuarenta
     chapas de golpe y se ve como un error de la app. */
  const [asentado, setAsentado] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAsentado(true), 1500)
    return () => clearTimeout(t)
  }, [])

  /* El valor anterior va en ESTADO ajustado durante el render, no en una ref:
     una ref leída mientras se dibuja da resultados distintos entre dos
     repintados del mismo estado. Este es el patrón que React sí permite —
     ajustar estado en el render, no encadenarlo desde un efecto. */
  const [previo, setPrevio] = useState(fila.chapa)
  const [acabaDeCerrar, setAcabaDeCerrar] = useState(false)
  if (previo !== fila.chapa) {
    setPrevio(fila.chapa)
    setAcabaDeCerrar(asentado && previo !== 'cerrada' && fila.chapa === 'cerrada')
  }

  const { fondo, texto, etiqueta } = ASPECTO[fila.chapa]

  return (
    <span className="proy-gira" style={{ flexShrink: 0 }}>
      <span
        className={`proy-chapa flex items-center justify-center font-mono font-bold ${fondo} ${texto} ${
          acabaDeCerrar ? 'proy-vuelta' : ''
        }`}
        style={{
          width: escalon.chapaAncho,
          height: escalon.chapaPx + 18,
          fontSize: etiqueta ? Math.round(escalon.chapaPx * 0.45) : escalon.chapaPx,
        }}
      >
        {etiqueta ?? (fila.mesa ?? '—')}
      </span>
    </span>
  )
}

/** Reparte en columnas RESPETANDO el orden recibido, con cabecera de puestos. */
function enTrozos(filas: Fila[], porColumna: number) {
  const cols: Array<{ gente: Fila[]; rango: string }> = []
  for (let i = 0; i < filas.length; i += porColumna) {
    const trozo = filas.slice(i, i + porColumna)
    const a = trozo[0]?.puesto ?? i + 1
    const b = trozo[trozo.length - 1]?.puesto ?? i + trozo.length
    cols.push({ gente: trozo, rango: a === b ? `${a}º` : `${a}º – ${b}º` })
  }
  return cols
}

const ASPECTO: Record<Fila['chapa'], { fondo: string; texto: string; etiqueta?: string }> = {
  pendiente: { fondo: 'bg-swu-amber/20',  texto: 'text-swu-amber' },
  cerrada:   { fondo: 'bg-swu-green/20',  texto: 'text-swu-green' },
  disputa:   { fondo: 'bg-swu-red/20',    texto: 'text-swu-red-texto', etiqueta: 'EN DISPUTA' },
  libre:     { fondo: 'bg-cyan-500/15',   texto: 'text-cyan-300',      etiqueta: 'LIBRE' },
  fuera:     { fondo: 'bg-swu-surface',   texto: 'text-swu-muted',     etiqueta: 'FUERA' },
}
