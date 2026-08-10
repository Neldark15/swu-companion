/**
 * Laboratorio de mazos — la mesa de pruebas contra el meta real.
 *
 * Manda un mazo al simulador del VPS (swusim: las 1 324 cartas del Premier
 * modeladas, reglamento oficial implementado) y lo enfrenta a los 22 mazos
 * reales del Galactic Championship 2026. Tres herramientas: el informe de
 * legalidad y sinergias, la prueba contra todo el campo, y el probador
 * de cambios («quita esto, mete aquello, ¿gano o pierdo puntos?»).
 *
 * ── El encuadre no es decorativo ──────────────────────────────────────
 *
 * Contrastado contra los resultados reales del Galactic, el simulador se
 * desvía en promedio ±11 puntos. Un 65 % aquí NO significa ganar 6,5 de cada
 * 10 en una sala. Significa que ese mazo mide por encima de otro bajo las
 * mismas reglas y el mismo rival. Por eso cada número de esta pantalla se
 * presenta como COMPARACIÓN (contra el campeón, contra tu versión anterior)
 * y el aviso vive en el encabezado, no escondido en una nota al pie.
 *
 * ── Las tres capas que vienen DESPUÉS del guantelete ──────────────────
 *
 * A · **Diagnóstico** (gratis, instantáneo). Reparte los 22 resultados en
 *     «dónde perdés», «empate técnico» y «dónde ganás», y lee el patrón de las
 *     rondas. Toda la lógica es pura y vive en `diagnostico.ts`.
 * B · **Profundizar** en UN emparejamiento con `/simular`, que es la única
 *     respuesta del simulador que trae su propio margen de error.
 * C · **Buscar mejoras**: mide hipótesis con `/probar`, secuencialmente.
 *
 * Tres reglas que atraviesan las tres capas y no se negocian:
 *
 *  1. **Ninguna carta «falla».** El motor agrega por partida (ganador, rondas,
 *     vida de las bases); no rastrea cartas. Lo único que se puede afirmar de
 *     una carta es lo que mide `/probar`: «cambiar X por Y midió N puntos
 *     contra tal rival».
 *  2. **Los dos umbrales son medidos, no elegidos.** `EMPATE_TECNICO` y
 *     `DELTA_MINIMO` viven en `diagnostico.ts` con la medición al lado. Acá se
 *     usan, no se redefinen.
 *  3. **Lo que no llega al umbral se CUENTA, no se esconde.** «4 cambios
 *     quedaron dentro del margen de error» es la diferencia entre medir y
 *     adivinar, y es la parte que la gente necesita ver.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, FlaskConical, ShieldCheck, Swords, Scale,
  AlertTriangle, CheckCircle2, Loader2, ClipboardPaste, BookOpen,
  Stethoscope, Microscope, Sparkles, PackageCheck, CircleStop, Minus, Clapperboard,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { HudPanel, HudCorners, HexIcon } from '../../components/Hud'
import { db } from '../../services/db'
import { ensureCards } from '../../services/swuApi'
import { getMyCollection } from '../../services/collectionService'
import { translateAspect } from '../../services/translations'
import { useAuth } from '../../hooks/useAuth'
import { leerBorrador, guardarBorrador, borrarBorrador, LLAVES_BORRADOR } from '../../services/borradores'
import type { Card, Deck } from '../../types'

/** El sondeo se rinde a los 5 min: un id más viejo ya no apunta a nada vivo. */
const VIGENCIA_TRABAJO_MS = 6 * 60 * 1000
import {
  simApi, deckAMazo, ErrorSim,
  type MazoEnvio, type InformeValidar, type EstadoTrabajo, type ResultadoSimular,
} from './simApi'
import {
  diagnosticar, candidatos, esReportable, cambioViable,
  EMPATE_TECNICO, DELTA_MINIMO, AVISO_HIPOTESIS, EVIDENCIA_DELTA,
  PARTIDAS_GAUNTLET, PARTIDAS_PROBAR, PARTIDAS_SIMULAR,
  MARGEN_GAUNTLET, MARGEN_PROBAR, MARGEN_DIFERENCIA,
  type Diagnostico, type RivalDiag, type RivalEnriquecido, type Candidato, type Patron,
} from './diagnostico'

/**
 * Referencias medidas en el MISMO motor (gauntlet completo): el campeón y el
 * subcampeón del Galactic. Son la vara de comparación honesta: si tu mazo
 * marca 60 y el campeón marca 49, eso es señal; el número absoluto no lo es.
 *
 * Llevan el mismo margen que cualquier fila del guantelete —salieron del mismo
 * sitio, 400 partidas por rival— y por eso se pintan con él: compararse contra
 * un 49,0 pelado invita a leer un 51 propio como «mejor que el campeón».
 */
const REFERENCIAS = [
  { nombre: 'Cad Bane — campeón Galactic', media: 49.0 },
  { nombre: 'Boba Fett — subcampeón', media: 48.9 },
]

/*
 * `PARTIDAS_*` y los márgenes ya NO viven acá: se importan de `diagnostico.ts`.
 *
 * Estaban partidos entre los dos archivos y unidos por un comentario que pedía
 * «volver a medir la franja si sube este número». Un acoplamiento que solo
 * existe en prosa se rompe callado: subir las partidas no fallaba en ningún
 * lado y dejaba la franja de empate mal calibrada sin que nada lo dijera.
 * Ahora la franja se DERIVA del tamaño de muestra, así que no hay nada que
 * recordar.
 */

/**
 * Aspectos que NO agrupan un arquetipo.
 *
 * Casi todos los líderes llevan Heroism o Villainy, así que agrupar por ellos
 * daría dos cajones de once y ninguna lectura. La familia es el aspecto de
 * color: Vigilance, Command, Aggression, Cunning.
 */
const ALINEACIONES = new Set(['Heroism', 'Villainy'])

/**
 * La etiqueta de aspecto sin resolver.
 *
 * Tiene que coincidir LITERAL con `FAMILIA_DESCONOCIDA` de `diagnostico.ts`
 * (que no se exporta): si no coinciden, los rivales sin líder resoluble
 * aparecen en dos grupos distintos que dicen lo mismo.
 */
const SIN_ASPECTO = 'Sin aspecto'

/**
 * El título de cada patrón. El «por qué» NUNCA se escribe acá: lo redacta
 * `diagnostico.ts` con los números que lo sostienen, y va siempre debajo.
 * Un título sin sus rondas al lado es una etiqueta, no un diagnóstico.
 */
const TITULO_PATRON: Record<NonNullable<Patron>, string> = {
  'te-atropellan': 'Te atropellan',
  'sin-gasolina': 'Te quedás sin gasolina',
  'mixto': 'Perdés de dos maneras distintas',
}

/**
 * El punto de color de la base de cada rival. Mismos colores que usa el resto
 * de la app para los aspectos (CardPreviewSheet); acá como fondo del punto.
 */
const PUNTO_ASPECTO: Record<string, string> = {
  Vigilance: 'bg-blue-400 border-blue-300',
  Command: 'bg-green-400 border-green-300',
  Aggression: 'bg-red-400 border-red-300',
  Cunning: 'bg-yellow-400 border-yellow-300',
}

type Fuente = 'guardado' | 'pegado'

/** Un decimal con coma, como se escribe en español. Igual que en diagnostico.ts. */
function n1(v: number): string {
  return v.toFixed(1).replace('.', ',')
}

/** El aspecto de color del líder, que es lo que agrupa arquetipos. */
function familiaDe(lider: Card | undefined): string {
  if (!lider) return SIN_ASPECTO
  return lider.aspects.find((a) => !ALINEACIONES.has(a)) ?? lider.aspects[0] ?? SIN_ASPECTO
}

/**
 * Índice de la base local por nombre completo, quedándose con la impresión
 * canónica. Sin esto, las 9 057 filas del API (74 % impresiones alternativas)
 * hacen que el mismo líder resuelva a una variante con el texto recortado.
 */
function indicePorNombre(pool: readonly Card[]): Map<string, Card> {
  const m = new Map<string, Card>()
  for (const c of pool) {
    const k = (c.subtitle ? `${c.name} | ${c.subtitle}` : c.name).trim().toLowerCase()
    const previa = m.get(k)
    if (!previa || (c.isCanonical === true && previa.isCanonical !== true)) m.set(k, c)
  }
  return m
}

/**
 * Lo que HOLOCRON sabe y el simulador no: los aspectos de cada rival y qué
 * cartas tiene la persona. Se carga una sola vez, cuando el guantelete termina
 * — antes no hace falta y `db.cards` son 9 057 filas.
 */
interface Contexto {
  rivales: RivalEnriquecido[]
  pool: Card[]
  coleccion: Set<string>
  /** Sets que el motor sabe simular. `null` si no se pudo preguntar. */
  setsMotor: Set<string> | null
}

/** Un candidato ya medido. `delta` es lo único que se puede afirmar de él. */
interface Medido {
  candidato: Candidato
  antes: number
  despues: number
  delta: number
}

function Seccion({ titulo, icono, tono, children }: {
  titulo: string
  icono: React.ReactNode
  tono: 'cyan' | 'amber' | 'green' | 'purple'
  children: React.ReactNode
}) {
  return (
    <HudPanel tone={tono} glow>
      <div className="relative p-3.5 space-y-3">
        <HudCorners tone={tono} />
        <div className="flex items-center gap-2.5">
          <HexIcon tone={tono} size={36}>{icono}</HexIcon>
          <h2 className="text-sm font-bold text-white tracking-wide">{titulo}</h2>
        </div>
        {children}
      </div>
    </HudPanel>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start text-[11px] leading-relaxed text-swu-muted bg-swu-surface rounded-lg p-2.5 border border-swu-border">
      <AlertTriangle size={14} className="text-swu-amber flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

/**
 * Barra horizontal 0–100 con la línea del 50 % como referencia.
 *
 * Dos cosas que parecen de estilo y son de honestidad:
 *
 * · **`margen` es obligatorio.** Un win rate sin su error es una opinión con
 *   formato de dato. Se imprime `49,0 ± 4,9` en todas partes, no solo donde
 *   alguien se acordó de escribirlo en prosa.
 * · **`tono='neutro'` para las medias.** Los cortes de color son los de
 *   `EMPATE_TECNICO`, que están calibrados para UNA fila de 400 partidas.
 *   Aplicárselos a la media de una familia pintaba de rojo un 44,9 y de cian un
 *   45,1 con la misma resolución detrás — un umbral duro sobre un número que no
 *   lo tiene. Las medias van en gris y su margen al lado.
 */
function BarraWin({ etiqueta, valor, margen, tono = 'umbral' }: {
  etiqueta: string
  valor: number
  /** `null` = no hay margen que dar (una familia de un solo rival). */
  margen: number | null
  tono?: 'umbral' | 'destacada' | 'neutro'
}) {
  const color = tono === 'destacada'
    ? 'bg-swu-amber'
    : tono === 'neutro' ? 'bg-swu-muted/60'
    : valor > EMPATE_TECNICO.max ? 'bg-swu-green'
    : valor >= EMPATE_TECNICO.min ? 'bg-swu-cyan'
    : 'bg-swu-red'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-2 items-center text-xs">
      <div className="min-w-0">
        <div className={`truncate ${tono === 'destacada' ? 'text-swu-amber font-semibold' : 'text-swu-text'}`}>
          {etiqueta}
        </div>
        <div className="relative h-2 mt-1 rounded bg-swu-surface overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded ${color}`} style={{ width: `${Math.min(valor, 100)}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-px bg-swu-muted/50" title="50 %" />
        </div>
      </div>
      <span className="font-mono tabular-nums text-right text-swu-text whitespace-nowrap">
        {n1(valor)}
        {/* Sin margen no se inventa uno: se calla. Ver `FamiliaDiag.margen`. */}
        {margen !== null && <span className="text-swu-muted"> ±{n1(margen)}</span>}
      </span>
    </div>
  )
}

/**
 * Un rival del diagnóstico, tocable para profundizar (capa B).
 *
 * El detalle se despliega DEBAJO de la fila en vez de abrir otra pantalla: lo
 * que importa es leer el margen al lado del mismo número que lo motivó.
 */
function FilaRival({ fila, activo, cargando, bloqueado, detalle, error, onClick, onVerPartida }: {
  fila: RivalDiag
  activo: boolean
  cargando: boolean
  /** Hay otra medición en vuelo (acá o en otra capa): no se puede pedir más. */
  bloqueado: boolean
  detalle: ResultadoSimular | null
  error: string | null
  onClick: () => void
  /**
   * Ir a ver UNA partida de este emparejamiento en la mesa 3D.
   *
   * Falta cuando el mazo se pegó como texto: la mesa arranca de un mazo
   * guardado, y aquí no hay ninguno al que apuntar. Se omite el enlace en vez
   * de enseñarlo roto.
   */
  onVerPartida?: () => void
}) {
  return (
    <div>
      <button type="button" onClick={onClick} disabled={cargando || (bloqueado && !activo)}
        aria-expanded={activo}
        className="w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-swu-surface disabled:opacity-70">
        <BarraWin etiqueta={fila.lider.split(' | ')[0]} valor={fila.win} margen={MARGEN_GAUNTLET} />
        {/* La base, con su color y su vida, pedida por Nel: saber que Boba
            juega la base sin color de 34 PV o que Luke trae Data Vault cambia
            cómo se lee el número de arriba. El punto de color va SIEMPRE con
            el nombre del aspecto al lado — el color nunca es el único
            portador — y «sin color» es un dato, no una carencia. */}
        {fila.base && (
          <div className="flex items-center gap-1.5 text-[10px] text-swu-muted mt-0.5 min-w-0">
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full flex-shrink-0 border ${
                PUNTO_ASPECTO[fila.baseAspecto ?? ''] ?? 'bg-zinc-500/40 border-zinc-400/50'
              }`}
            />
            <span className="truncate">{fila.base}</span>
            <span className="flex-shrink-0">
              {fila.baseAspecto ? translateAspect(fila.baseAspecto) : 'sin color'}
            </span>
            {fila.baseVida != null && (
              <span className="font-mono tabular-nums flex-shrink-0 text-swu-text">
                {fila.baseVida} PV
              </span>
            )}
          </div>
        )}
      </button>

      {activo && (
        <div className="mt-1 ml-1.5 pl-2.5 border-l border-swu-border text-[11px] leading-relaxed">
          {cargando && (
            <span className="flex items-center gap-1.5 text-swu-muted">
              <Loader2 size={12} className="animate-spin text-swu-cyan" />
              Midiendo <span className="font-mono">{PARTIDAS_SIMULAR}</span> partidas…
            </span>
          )}
          {!cargando && error && <span className="text-swu-red-texto">{error}</span>}
          {!cargando && !error && detalle && (
            <div className="space-y-0.5">
              {/* El margen va SIEMPRE pegado al win rate. Es lo que separa un
                  dato de una opinión: 45,9 ± 2,5 puede ser 43,4 o 48,4. */}
              <div className="text-swu-text">
                <span className="font-mono tabular-nums">{n1(detalle.win)} %</span>
                {' '}<span className="text-swu-muted">±</span>{' '}
                <span className="font-mono tabular-nums">{n1(detalle.margen95)}</span>
                <span className="text-swu-muted"> · </span>
                <span className="font-mono tabular-nums">{n1(detalle.rondas)}</span>
                <span className="text-swu-muted"> rondas de media</span>
              </div>
              <div className="text-swu-muted">
                Medido con <span className="font-mono">{PARTIDAS_SIMULAR}</span> partidas contra{' '}
                <span className="text-swu-text">{fila.lider}</span>
                {fila.base ? <> · base <span className="text-swu-text">{fila.base}</span></> : null}
              </div>
              {/* El número dice CUÁNTO ganás; esto enseña CÓMO. Es una partida
                  de esta misma medición, no una recreación: misma semilla,
                  mismo motor. */}
              {onVerPartida && (
                <button type="button" onClick={onVerPartida}
                  className="inline-flex items-center gap-1 text-swu-cyan hover:underline pt-0.5">
                  <Clapperboard size={12} /> Ver una partida
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Un cambio que SÍ superó el umbral, con la frase exacta de lo que se midió.
 *
 * La redacción es deliberada: «cambiar X por Y midió N puntos contra Z». En
 * ningún lugar dice que una carta falle, porque el motor no rastrea cartas —
 * agrega por partida. Lo que se afirma es la diferencia entre dos mazos
 * completos medidos con la misma semilla contra el mismo rival, que es
 * exactamente lo que `/probar` devuelve y ni un milímetro más.
 */
function CambioMedido({ medido, rival }: { medido: Medido; rival: string }) {
  const { candidato: c, delta } = medido
  const mejora = delta > 0
  return (
    <div className={`rounded-lg border p-2.5 space-y-1.5 ${
      mejora ? 'border-swu-green/30 bg-swu-green/10' : 'border-swu-red/30 bg-swu-red/10'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-swu-text font-semibold break-words">{c.entra.nombre}</span>
            {c.enColeccion && (
              <span title="Ya la tenés en tu colección"
                className="inline-flex items-center gap-1 text-[10px] text-swu-green
                  bg-swu-green/15 border border-swu-green/30 rounded px-1.5 py-0.5">
                <PackageCheck size={11} /> la tenés
              </span>
            )}
          </div>
          <div className="text-swu-muted break-words">
            en lugar de <span className="text-swu-text">{c.sale.nombre}</span>
          </div>
        </div>
        <div className={`font-mono tabular-nums text-xl font-black flex-shrink-0 ${
          mejora ? 'text-swu-green' : 'text-swu-red-texto'}`}>
          {mejora ? '+' : '−'}{n1(Math.abs(delta))}
        </div>
      </div>

      {/* Los dos extremos llevan su margen. El `delta` está protegido por
          `DELTA_MINIMO`, pero `antes` y `despues` son dos win rates de 1000
          partidas (±3,1 cada uno) y se estaban pintando desnudos justo debajo
          del número grande: quien los lea así se lleva una precisión que no
          existe. (Que el delta aguante más que sus extremos no es magia: los
          dos lados corren con la MISMA semilla, y el error común se cancela.) */}
      <div className="text-[11px] text-swu-muted leading-relaxed">
        Medido con <span className="font-mono">{PARTIDAS_PROBAR}</span> partidas contra{' '}
        <span className="text-swu-text">{rival}</span>:{' '}
        <span className="font-mono tabular-nums">{n1(medido.antes)}</span> →{' '}
        <span className="font-mono tabular-nums">{n1(medido.despues)}</span> %, cada uno con{' '}
        ±<span className="font-mono tabular-nums">{n1(MARGEN_PROBAR)}</span> de margen. La resta
        aguanta más que sus extremos porque los dos lados corren con la misma semilla.
      </div>

      <p className="text-[11px] text-swu-muted leading-relaxed break-words">{c.porque}</p>
    </div>
  )
}

export function LabPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // ── fuente del mazo ──
  const [fuente, setFuente] = useState<Fuente>('guardado')
  const [mazos, setMazos] = useState<Deck[]>([])
  const [mazoId, setMazoId] = useState<string>('')
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  // ── resultados ──
  const [informe, setInforme] = useState<InformeValidar | null>(null)
  const [validando, setValidando] = useState(false)
  const [trabajo, setTrabajo] = useState<EstadoTrabajo | null>(null)
  const [corriendo, setCorriendo] = useState(() =>
    !!leerBorrador<{ idTrabajo: string }>(LLAVES_BORRADOR.laboratorio, VIGENCIA_TRABAJO_MS)?.idTrabajo)
  /**
   * El id del trabajo es ESTADO, no una `ref`, y esa diferencia era el bug.
   *
   * Antes vivía en un `useRef`. La secuencia real era: `setCorriendo(true)`
   * provoca un render, el efecto del sondeo corre en ese commit —o sea ANTES
   * de que la petición al simulador conteste—, encuentra el id todavía en
   * `null` y se va por la puerta de atrás sin montar el intervalo. Cuando el
   * id llegaba, asignarlo a una `ref` NO vuelve a disparar el efecto: nadie
   * sondeaba nunca, `corriendo` se quedaba en `true` para siempre y el botón
   * giraba sin mostrar nada. No era intermitente: fallaba en todas las
   * corridas.
   *
   * Como estado, la llegada del id es lo que dispara el sondeo.
   */
  /* Se persiste, y por un motivo concreto: el trabajo corre en el VPS y sigue
     corriendo aunque la app se cierre. Lo único que se perdía al remontarse la
     pantalla era el ID —y sin ID no hay a quién sondear, así que una prueba de
     varios minutos quedaba huérfana y había que relanzarla.

     La vigencia es corta a propósito: el sondeo se rinde a los 5 minutos, así
     que un id más viejo que eso ya no apunta a nada vivo. */
  const [idTrabajo, setIdTrabajo] = useState<string | null>(() =>
    leerBorrador<{ idTrabajo: string }>(LLAVES_BORRADOR.laboratorio, VIGENCIA_TRABAJO_MS)?.idTrabajo ?? null)
  /** Sondeos seguidos que fallaron. Sirve para rendirse diciendo por qué. */
  const fallosSeguidos = useRef(0)

  // ── probador de cambios ──
  const [quitaCarta, setQuitaCarta] = useState('')
  const [quitaN, setQuitaN] = useState(1)
  const [meteCarta, setMeteCarta] = useState('')
  const [meteN, setMeteN] = useState(1)
  const [prueba, setPrueba] = useState<{ antes: number; despues: number; delta: number } | null>(null)
  const [probando, setProbando] = useState(false)
  /**
   * El error del probador manual vive ACÁ, no en el `error` global.
   *
   * Iba al recuadro de arriba del todo, a varias pantallas del botón que lo
   * disparó: quien pedía un cambio veía el botón volver a su sitio sin nada al
   * lado y el motivo fuera de la vista. Un error tiene que salir donde se
   * pidió la acción.
   */
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null)

  // ── A · diagnóstico ──
  const currentProfileId = useAuth((s) => s.currentProfileId)
  const [contexto, setContexto] = useState<Contexto | null>(null)
  const [cargandoContexto, setCargandoContexto] = useState(false)
  const [errorContexto, setErrorContexto] = useState<string | null>(null)
  /** Perfil cuyo contexto ya se pidió. Ver el efecto de más abajo. */
  const contextoPedido = useRef<string | null>(null)

  // ── B · profundizar en un emparejamiento ──
  const [abierto, setAbierto] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<ResultadoSimular | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null)

  // ── C · búsqueda de mejoras ──
  const [buscando, setBuscando] = useState(false)
  const [progresoBusqueda, setProgresoBusqueda] = useState({ hecho: 0, total: 0, fallidos: 0 })
  const [medidos, setMedidos] = useState<Medido[] | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)

  /**
   * ── Los tres contadores de generación, y por qué no son banderas ──────
   *
   * Cada capa tenía respuestas en vuelo que podían aterrizar sobre un estado
   * que ya no era el suyo, y las tres formas de arreglarlo con un `boolean`
   * fallan por lo mismo: una bandera dice «cancelado ahora», no «cancelado
   * PARA ESTA corrida», así que la corrida siguiente la reinicia y resucita a
   * la anterior. Un número que solo sube no se puede resucitar: cada tarea se
   * queda con el suyo y compara.
   *
   *  · `genTrabajo` — el sondeo del guantelete. Cambiar de mazo a mitad de la
   *    prueba no apagaba `corriendo` ni `idTrabajo`, así que el intervalo seguía
   *    vivo y 20 s después pintaba los 22 win rates del mazo A rotulados como
   *    del mazo B, con el diagnóstico y los candidatos calculados encima.
   *  · `genDetalle` — `/simular`. Tocabas el rival A, después el B, y la
   *    respuesta de A se pintaba bajo el nombre de B, con su pie diciendo
   *    «medido contra B». El slug que devuelve el servicio también se comprueba.
   *  · `genBusqueda` — la búsqueda. «Detener» ponía la bandera y devolvía el
   *    botón a «Buscar de nuevo» al instante; pulsarlo la volvía a poner en
   *    `false` y el bucle VIEJO, al despertar, pasaba su propia guarda y seguía
   *    corriendo junto al nuevo: dos bucles a la vez sobre 2 núcleos
   *    compartidos, el progreso mintiendo y `medidos` mezclando dos corridas.
   */
  const genTrabajo = useRef(0)
  const genDetalle = useRef(0)
  const genBusqueda = useRef(0)

  // Salir de la pantalla invalida TODO lo que esté en vuelo. Sin dependencias a
  // propósito: solo tiene que correr al desmontar.
  useEffect(() => () => {
    genTrabajo.current += 1
    genDetalle.current += 1
    genBusqueda.current += 1
  }, [])

  useEffect(() => {
    db.decks.toArray().then((todos) => {
      const orden = todos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      setMazos(orden)
      const pedido = params.get('deck')
      if (pedido && orden.some((d) => d.id === pedido)) setMazoId(pedido)
      else if (orden.length > 0) setMazoId(orden[0].id)
      else setFuente('pegado')
    }).catch(() => setFuente('pegado'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * El mazo guardado que está seleccionado, si lo hay.
   *
   * Solo existe en el modo «guardados». Una lista PEGADA es texto que
   * interpreta el VPS: acá no hay objeto `Deck`, así que no se pueden proponer
   * candidatos —haría falta resolver cada línea contra la base local— y la
   * capa C lo dice en vez de fallar en silencio.
   */
  const deckActual = fuente === 'guardado' ? mazos.find((d) => d.id === mazoId) : undefined

  /** El mazo elegido, en el formato que viaja al simulador. */
  const armarMazo = useCallback((): MazoEnvio => {
    if (fuente === 'pegado') {
      if (!texto.trim()) throw new ErrorSim('Pega una lista primero.')
      return { texto }
    }
    const deck = mazos.find((d) => d.id === mazoId)
    if (!deck) throw new ErrorSim('Elige un mazo guardado.')
    return deckAMazo(deck)
  }, [fuente, texto, mazos, mazoId])

  const validar = useCallback(async () => {
    setError(null); setInforme(null); setValidando(true)
    try {
      setInforme(await simApi.validar(armarMazo()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fallo inesperado.')
    } finally {
      setValidando(false)
    }
  }, [armarMazo])

  /**
   * Todo lo que dejó de ser cierto al cambiar de mazo.
   *
   * `contexto` NO se borra: los aspectos de los 22 rivales y la colección de la
   * persona no dependen del mazo, y volver a leer 9 057 filas de Dexie por
   * cambiar de mazo en un `select` es trabajo tirado.
   *
   * **`corriendo` e `idTrabajo` SÍ se borran**, y ese era el agujero: sin
   * apagarlos, el efecto del sondeo —que depende justo de esos dos— seguía
   * montado después de cambiar de mazo. Las secciones desaparecían un momento
   * y volvían solas con los resultados del mazo anterior puestos bajo el nombre
   * del nuevo. Números de un mazo atribuidos a otro es lo peor que puede hacer
   * esta pantalla, así que se corta por los dos lados: se desmonta el intervalo
   * y además se invalida la generación, para que el sondeo que ya salió y está
   * volviendo tampoco pueda escribir.
   */
  const limpiarMediciones = useCallback(() => {
    genTrabajo.current += 1
    genDetalle.current += 1
    genBusqueda.current += 1
    setCorriendo(false); setIdTrabajo(null); setTrabajo(null)
    borrarBorrador(LLAVES_BORRADOR.laboratorio)
    setPrueba(null); setErrorPrueba(null)
    setAbierto(null); setDetalle(null); setErrorDetalle(null); setCargandoDetalle(false)
    setBuscando(false); setMedidos(null); setErrorBusqueda(null)
    setProgresoBusqueda({ hecho: 0, total: 0, fallidos: 0 })
  }, [])

  // ── prueba contra el meta, con sondeo ──
  const lanzarGauntlet = useCallback(async () => {
    setError(null); limpiarMediciones(); setCorriendo(true)
    const mia = genTrabajo.current
    fallosSeguidos.current = 0
    try {
      const { trabajo: id } = await simApi.gauntlet(armarMazo(), PARTIDAS_GAUNTLET)
      if (genTrabajo.current !== mia) return
      if (!id) throw new Error('El simulador no devolvió un número de trabajo.')
      setIdTrabajo(id)
      // El trabajo ya vive en el VPS: desde acá el id es lo único que hace
      // falta para volver a encontrarlo si la pantalla se remonta.
      guardarBorrador(LLAVES_BORRADOR.laboratorio, { idTrabajo: id })
    } catch (e) {
      if (genTrabajo.current !== mia) return
      setError(e instanceof Error ? e.message : 'Fallo inesperado.')
      setCorriendo(false)
    }
  }, [armarMazo, limpiarMediciones])

  useEffect(() => {
    // `idTrabajo` está en las dependencias a propósito: es su LLEGADA la que
    // arranca el sondeo. Con el id en una `ref` este efecto corría una sola
    // vez, cuando todavía no existía, y no volvía a correr nunca.
    if (!corriendo || !idTrabajo) return

    // La generación se captura al montar el intervalo. `clearInterval` frena
    // los ticks futuros, pero no la petición que ya salió: sin esta captura,
    // esa respuesta rezagada seguía teniendo permiso para escribir.
    const mia = genTrabajo.current

    /**
     * Rendirse también es una respuesta.
     *
     * Un gauntlet de 22 rivales tarda entre 15 y 40 s según la carga del
     * servidor. Cinco minutos es holgado de sobra; pasado eso, algo se rompió
     * del otro lado y seguir girando es mentirle a quien mira. Sin este tope,
     * un trabajo que muere en el simulador deja el botón en marcha para
     * siempre — que es justo el síntoma que se está arreglando, por otra causa.
     */
    const limite = Date.now() + 5 * 60_000

    const timer = setInterval(async () => {
      if (genTrabajo.current !== mia) return
      if (Date.now() > limite) {
        setCorriendo(false)
        // Se acabó la espera: el id ya no sirve para nada y no debe sobrevivir
        // a la recarga, o volverías a una pantalla sondeando un fantasma.
        borrarBorrador(LLAVES_BORRADOR.laboratorio)
        setError('El simulador tardó más de 5 minutos. Probá de nuevo en un rato.')
        return
      }
      try {
        const estado = await simApi.trabajo(idTrabajo)
        if (genTrabajo.current !== mia) return
        fallosSeguidos.current = 0
        setTrabajo(estado)
        if (estado.estado === 'listo' || estado.estado === 'error') {
          setCorriendo(false)
          borrarBorrador(LLAVES_BORRADOR.laboratorio)
          if (estado.estado === 'error') setError(estado.error || 'La prueba falló.')
        }
      } catch (e) {
        if (genTrabajo.current !== mia) return
        // Un fallo suelto no cancela el trabajo —el simulador sigue trabajando
        // aunque se corte un sondeo—, pero tragárselos TODOS en silencio deja
        // la pantalla girando sin decir nada. A los cinco seguidos se admite.
        fallosSeguidos.current += 1
        if (fallosSeguidos.current >= 5) {
          setCorriendo(false)
          borrarBorrador(LLAVES_BORRADOR.laboratorio)
          setError(
            e instanceof Error
              ? `Se perdió el contacto con el simulador: ${e.message}`
              : 'Se perdió el contacto con el simulador.',
          )
        }
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [corriendo, idTrabajo])

  // ── A · el contexto que el simulador no tiene ──
  //
  // El guantelete devuelve slugs y win rates. Los aspectos de cada rival y las
  // cartas que la persona TIENE salen de HOLOCRON, y solo hacen falta cuando
  // hay resultados que leer: `db.cards` son 9 057 filas y no se cargan por si
  // acaso. Este efecto corre una vez, cuando el guantelete termina.
  const hayResultados = trabajo?.estado === 'listo' && trabajo.resultados.length > 0

  useEffect(() => {
    // El centinela es una `ref` con la clave del perfil, NO el estado
    // `cargandoContexto`. Con el estado en las dependencias, el propio
    // `setCargandoContexto(true)` volvía a disparar el efecto, la limpieza de
    // la primera pasada marcaba su resultado como muerto y el `finally` no
    // apagaba nada: la pantalla quedaba «cargando» para siempre. Con la ref no
    // hay segunda pasada, y al llevar la clave del perfil, cambiar de cuenta
    // sí vuelve a leer la colección.
    const clave = currentProfileId ?? 'anon'
    if (!hayResultados || contextoPedido.current === clave) return
    contextoPedido.current = clave
    setCargandoContexto(true)
    setErrorContexto(null)
    ;(async () => {
      try {
        await ensureCards()
        // `pool` del motor va en el MISMO Promise.all: es una lectura más y
        // esperar en cascada sumaría un viaje. Si falla, se sigue sin filtro
        // (la respuesta del motor es la última red) en vez de quedarse sin
        // diagnóstico por un dato accesorio.
        const [pool, listaRivales, items, setsMotor] = await Promise.all([
          db.cards.toArray(),
          simApi.rivales(),
          getMyCollection(currentProfileId ?? undefined),
          simApi.pool().then((p) => new Set(p.sets)).catch(() => null),
        ])
        const porNombre = indicePorNombre(pool)
        const rivales: RivalEnriquecido[] = listaRivales.rivales.map((r) => {
          // La base también se resuelve contra la base local: su color y su
          // vida cambian la lectura del emparejamiento (una sin color paga el
          // aspecto con vida extra — Data Vault 33, no 30). Las bases no
          // llevan subtítulo, así que la clave es el nombre pelado.
          const cartaBase = r.base ? porNombre.get(r.base.trim().toLowerCase()) : undefined
          return {
            slug: r.slug,
            lider: r.lider,
            base: r.base ?? null,
            familia: familiaDe(porNombre.get(r.lider.trim().toLowerCase())),
            baseAspecto: cartaBase?.aspects[0] ?? null,
            baseVida: cartaBase?.hp ?? null,
          }
        })
        setContexto({ rivales, pool, coleccion: new Set(items.map((i) => i.cardId)), setsMotor })
      } catch (e) {
        // Se libera el centinela: un fallo de red no puede dejar la pantalla
        // sin diagnóstico hasta que se recargue la app.
        contextoPedido.current = null
        setErrorContexto(e instanceof Error ? e.message : 'No se pudo leer la base de cartas.')
      } finally {
        setCargandoContexto(false)
      }
    })()
  }, [hayResultados, currentProfileId])

  const diagnostico: Diagnostico | null = useMemo(() => {
    if (!hayResultados || !trabajo || !contexto) return null
    return diagnosticar(trabajo.resultados, contexto.rivales)
  }, [hayResultados, trabajo, contexto])

  // ── B · profundizar en un emparejamiento ──
  //
  // Cada toque son 1500 partidas en el VPS. Dos guardas, y las dos importan:
  //
  //  · **No se relanza mientras haya una en vuelo.** Antes N toques eran N
  //    trabajos de 1500 partidas, todos vivos a la vez sobre 2 núcleos.
  //  · **La respuesta se comprueba contra la fila que la pidió**, por token y
  //    además por el `rival` que devuelve el servicio. Sin eso, tocar A y
  //    después B pintaba el win rate y el margen de A bajo el nombre de B, con
  //    el pie afirmando «medido contra B». El campo `rival` de la respuesta
  //    existía en el tipo desde el principio y no lo miraba nadie.
  const profundizar = useCallback(async (fila: RivalDiag) => {
    // Segundo toque sobre la misma fila: cerrar. No se vuelve a pedir.
    if (abierto === fila.slug) {
      genDetalle.current += 1
      setAbierto(null); setDetalle(null); setErrorDetalle(null); setCargandoDetalle(false)
      return
    }
    if (cargandoDetalle) return

    genDetalle.current += 1
    const mia = genDetalle.current
    setAbierto(fila.slug); setDetalle(null); setErrorDetalle(null); setCargandoDetalle(true)
    try {
      const r = await simApi.simular(armarMazo(), fila.slug, PARTIDAS_SIMULAR)
      if (genDetalle.current !== mia) return
      if (r.rival && r.rival !== fila.slug) {
        throw new Error(`El simulador midió «${r.rival}», no este emparejamiento.`)
      }
      setDetalle(r)
    } catch (e) {
      if (genDetalle.current !== mia) return
      setErrorDetalle(e instanceof Error ? e.message : 'No se pudo medir este emparejamiento.')
    } finally {
      if (genDetalle.current === mia) setCargandoDetalle(false)
    }
  }, [abierto, cargandoDetalle, armarMazo])

  /**
   * Contra quién se miden los cambios. Lo decide `diagnosticar()`.
   *
   * Vivía acá y tomaba `diagnostico.pierde[0]`, o sea la primera fila de una
   * lista ordenada por win rate — y la UI lo llamaba «el emparejamiento donde
   * más claramente perdés». Ese superlativo necesita que el segundo esté a más
   * de ±6,9 puntos (`MARGEN_DIFERENCIA`), cosa que casi nunca pasa. Ahora la
   * elección viaja con dos banderas, `claro` y `destacado`, y la frase se
   * ajusta a lo que de verdad se puede afirmar.
   */
  const rivalPrueba = diagnostico?.pruebaContra ?? null

  // ── C · buscar mejoras ──
  //
  // Las hipótesis se arman ANTES de tocar el botón, no dentro del bucle. Sale
  // gratis (`candidatos()` es puro y local) y permite decir cuántas mediciones
  // van a correr en vez de prometer «hasta 6»: si salen 3, el aviso dice 3.
  const hipotesis = useMemo(() => {
    if (!deckActual || !diagnostico || !contexto) return []
    return candidatos(deckActual, diagnostico, contexto.pool, contexto.coleccion, contexto.setsMotor)
  }, [deckActual, diagnostico, contexto])

  /**
   * Detener de verdad.
   *
   * Subir la generación es lo que hace que sea de verdad: la petición en vuelo
   * ya no puede escribir NUNCA, ni siquiera si alguien arranca otra búsqueda
   * mientras vuelve. Con la bandera booleana anterior, ese segundo arranque la
   * reseteaba y el bucle viejo revivía en paralelo al nuevo.
   */
  const detenerBusqueda = useCallback(() => {
    genBusqueda.current += 1
    setBuscando(false)
  }, [])

  const buscarMejoras = useCallback(async () => {
    // Guarda real, no solo visual: antes lo único que impedía el segundo clic
    // era que el botón se sustituyera por «Detener».
    if (buscando || !rivalPrueba || hipotesis.length === 0) return
    const lista = hipotesis
    setErrorBusqueda(null)

    genBusqueda.current += 1
    const mia = genBusqueda.current
    setBuscando(true)
    setMedidos([])
    setProgresoBusqueda({ hecho: 0, total: lista.length, fallidos: 0 })

    const acumulado: Medido[] = []
    let fallidos = 0
    let ultimoFallo: string | null = null
    const mazo = armarMazo()

    for (const c of lista) {
      if (genBusqueda.current !== mia) return
      try {
        // SECUENCIAL, nunca en paralelo: son 2 núcleos compartidos con ~20
        // contenedores. Seis peticiones a la vez las pagaría HERMES.
        const r = await simApi.probar(
          mazo, [`1x ${c.sale.nombre}`], [`1x ${c.entra.nombre}`],
          PARTIDAS_PROBAR, rivalPrueba.fila.slug,
        )
        if (genBusqueda.current !== mia) return
        acumulado.push({ candidato: c, antes: r.antes, despues: r.despues, delta: r.delta })
      } catch (e) {
        // El `try` envolvía el bucle ENTERO, así que un solo candidato malo
        // abortaba los que faltaban. Y pasa de verdad: los candidatos salen de
        // las 9.057 filas locales y el simulador modela 1.324 del Premier, así
        // que basta una carta que él no conozca —medido: `«Vanquish» no existe
        // en el Premier actual (JTL–ASH)`— para tirar la búsqueda y regalar la
        // CPU ya gastada. Ahora ese candidato se salta y se CUENTA.
        if (genBusqueda.current !== mia) return
        fallidos += 1
        ultimoFallo = e instanceof Error ? e.message : 'error desconocido'
      }
      setMedidos([...acumulado])
      setProgresoBusqueda({ hecho: acumulado.length, total: lista.length, fallidos })
    }

    if (genBusqueda.current !== mia) return
    if (fallidos > 0) {
      setErrorBusqueda(
        `${fallidos} ${fallidos === 1 ? 'cambio no se pudo medir' : 'cambios no se pudieron medir'}` +
        ` (el último: ${ultimoFallo}). El resto sí está medido.`,
      )
    }
    setBuscando(false)
  }, [buscando, hipotesis, rivalPrueba, armarMazo])

  const probar = useCallback(async () => {
    setErrorPrueba(null); setPrueba(null); setProbando(true)
    try {
      const quita = quitaCarta ? [`${quitaN}x ${quitaCarta}`] : []
      const mete = meteCarta.trim() ? [`${meteN}x ${meteCarta.trim()}`] : []
      if (quita.length === 0 && mete.length === 0) {
        throw new ErrorSim('Indica al menos un cambio: qué quitar o qué meter.')
      }
      setPrueba(await simApi.probar(
        armarMazo(), quita, mete, PARTIDAS_PROBAR, rivalPrueba?.fila.slug,
      ))
    } catch (e) {
      setErrorPrueba(e instanceof Error ? e.message : 'Fallo inesperado.')
    } finally {
      setProbando(false)
    }
  }, [armarMazo, quitaCarta, quitaN, meteCarta, meteN, rivalPrueba])

  const curvaMax = informe ? Math.max(1, ...Object.values(informe.curva)) : 1
  const listo = trabajo?.estado === 'listo'

  /**
   * ¿El cambio del probador manual deja un mazo jugable?
   *
   * Esto era un bloqueo por «tope duro de 50 cartas de `swusim.py`» que apagaba
   * el probador entero para cualquier mazo con base Data Vault. Medido contra
   * el servicio vivo, ese tope está en el subcomando de línea de comandos, no
   * en `POST /probar`: el mazo Luke/Data Vault de 66 cartas responde 200 con su
   * delta. La pantalla apagaba una función que funciona.
   *
   * Peor: el bloqueo salía de `deckActual`, que es `undefined` en la ruta
   * «Pegar lista» — y el marcador de posición de ese cuadro de texto dice
   * literalmente `Base: Data Vault`. O sea que la ruta más probable para pegar
   * un mazo de Data Vault era justo la que no pasaba por el bloqueo.
   *
   * Lo que queda es lo que sí es cierto y sale de `/validar`, que funciona
   * igual en las dos rutas: un cambio que quita más de lo que mete puede dejar
   * el mazo por debajo de su mínimo legal.
   */
  const viabilidad = informe ? cambioViable(informe, quitaCarta ? quitaN : 0, meteCarta.trim() ? meteN : 0) : null

  /**
   * ¿Hay algo corriendo en el VPS ahora mismo?
   *
   * Nada impedía tener a la vez un `/simular` de 1500, un `/probar` de 1000 y
   * la búsqueda de 6×1000. Son 2 núcleos compartidos con ~20 contenedores y el
   * limitador del simulador corta a 40 peticiones/minuto: pasarse significa
   * comerse un 429 a mitad de búsqueda, con la CPU ya gastada.
   */
  const ocupado = corriendo || probando || cargandoDetalle || buscando

  const reportables = medidos?.filter((m) => esReportable(m.delta))
    .sort((a, b) => b.delta - a.delta) ?? []
  const dentroDelMargen = (medidos?.length ?? 0) - reportables.length

  return (
    <div className="max-w-2xl mx-auto px-3 pb-24 pt-4 space-y-4">
      {/* ── encabezado ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver"
          className="p-2 rounded-lg bg-swu-surface hover:bg-swu-surface-hover text-swu-muted">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical size={18} className="text-swu-cyan" /> Laboratorio de mazos
          </h1>
          <p className="text-[11px] text-swu-muted leading-snug">
            Simulación contra los 22 mazos reales del Galactic 2026
          </p>
        </div>
      </div>

      <Aviso>
        Los números de esta pantalla sirven para <b className="text-swu-text">comparar mazos entre
        sí</b> bajo las mismas reglas — no predicen tu win rate en torneo. Contrastado con los
        resultados reales del Galactic, el simulador se desvía en promedio ±11 puntos.
      </Aviso>

      {/* ── 1 · el mazo ── */}
      <Seccion titulo="El mazo" icono={<BookOpen size={16} />} tono="cyan">
        <div className="flex gap-2">
          <Button size="xs" variant={fuente === 'guardado' ? 'primary' : 'secondary'}
            onClick={() => { setFuente('guardado'); setInforme(null); limpiarMediciones() }}
            disabled={mazos.length === 0}>
            <BookOpen size={13} /> Guardados
          </Button>
          <Button size="xs" variant={fuente === 'pegado' ? 'primary' : 'secondary'}
            onClick={() => { setFuente('pegado'); setInforme(null); limpiarMediciones() }}>
            <ClipboardPaste size={13} /> Pegar lista
          </Button>
        </div>

        {fuente === 'guardado' ? (
          <select value={mazoId} onChange={(e) => { setMazoId(e.target.value); setInforme(null); limpiarMediciones() }}
            className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text">
            {mazos.map((d) => (
              <option key={d.id} value={d.id}>
                {/* `d.leaders?.` — el `?.` estaba un nivel tarde y un mazo sin
                    `leaders` (los guarda `sync.ts` con el JSON de la nube tal
                    cual) tumbaba la pantalla entera al ErrorBoundary. Mismo
                    caso que MesaPage. */}
                {d.name} — {d.leaders?.[0]?.name ?? 'sin líder'}
              </option>
            ))}
          </select>
        ) : (
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder={'Leader: Luke Skywalker | I Can Save Him\nBase: Data Vault\n3x Red Squadron X-Wing\n…'}
            className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-xs font-mono text-swu-text placeholder:text-swu-muted/60" />
        )}

        <Button variant="primary" size="sm" block onClick={validar} loading={validando}>
          <ShieldCheck size={14} /> Analizar el mazo
        </Button>
      </Seccion>

      {error && (
        <div className="flex gap-2 items-start text-xs text-swu-red-texto bg-swu-red/10 border border-swu-red/30 rounded-lg p-3">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* ── 2 · informe ── */}
      {informe && (
        <Seccion titulo="Informe" icono={informe.legal ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          tono={informe.legal ? 'green' : 'amber'}>
          <div className="flex items-center gap-2 text-sm">
            {informe.legal
              ? <span className="text-swu-green font-semibold">Legal en Premier</span>
              : <span className="text-swu-amber font-semibold">Con problemas</span>}
            <span className="text-swu-muted text-xs">
              · {informe.total}/{informe.minimo} cartas · {informe.aspectos_disponibles.join(' + ')}
            </span>
          </div>

          {informe.problemas.map((p) => (
            <div key={p} className="text-xs text-swu-amber">• {p}</div>
          ))}
          {informe.penalizaciones.map((p) => (
            <div key={p.carta} className="text-xs text-swu-amber">
              • {p.carta}: fuera de aspecto ({p.aspectos.join(', ')}) → paga +{p.sobrecoste}
            </div>
          ))}

          {/* curva */}
          <div className="flex items-end gap-1.5 h-20 pt-1" aria-label="Curva de coste">
            {Object.entries(informe.curva).map(([coste, n]) => (
              <div key={coste} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <span className="text-[10px] font-mono text-swu-text">{n}</span>
                <div className="w-full rounded-t bg-swu-cyan/70" style={{ height: `${(n / curvaMax) * 100}%`, minHeight: 2 }} />
                <span className="text-[10px] font-mono text-swu-muted">{coste}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              ['Unidades', informe.unidades], ['Eventos', informe.eventos], ['Mejoras', informe.mejoras],
              ['Sentinel', informe.sentinel], ['Únicas 4+', informe.unicas_coste4], ['Mínimo', informe.minimo],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-swu-surface rounded-lg py-1.5">
                <div className="text-swu-muted">{k}</div>
                <div className="font-mono font-bold text-swu-text">{v}</div>
              </div>
            ))}
          </div>

          {informe.sinergias && informe.sinergias.huerfanas.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-swu-text">Sinergias sin apoyo</div>
              {informe.sinergias.huerfanas.map((h) => (
                <div key={`${h.carta}-${h.pide}`} className="text-[11px] text-swu-muted">
                  • {h.copias}x <span className="text-swu-text">{h.carta}</span> pide{' '}
                  <span className="font-mono">{h.pide}</span> (hay {h.hay}, suele bastar con ~{h.umbral})
                </div>
              ))}
              <Aviso>{informe.sinergias.aviso}</Aviso>
            </div>
          )}
        </Seccion>
      )}

      {/* ── 3 · prueba contra el meta ──
          Se llamaba «Guantelete», traducción literal de *gauntlet*: en español
          eso es el guante de la armadura, no la prueba. Nadie de la comunidad
          iba a saber qué botón era ese. */}
      {informe && (
        <Seccion titulo="Probar contra el meta" icono={<Swords size={16} />} tono="amber">
          {!trabajo && !corriendo && (
            <p className="text-xs text-swu-muted leading-relaxed">
              Tu mazo contra los 22 del Galactic,{' '}
              <span className="font-mono">{PARTIDAS_GAUNTLET}</span> partidas contra cada uno.
              Tarda alrededor de medio minuto.
            </p>
          )}
          <Button variant="primary" size="sm" block onClick={lanzarGauntlet}
            loading={corriendo && !trabajo} disabled={ocupado}>
            <Swords size={14} /> {listo ? 'Volver a probar' : 'Probar contra el meta'}
          </Button>

          {corriendo && trabajo && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-swu-muted">
                <Loader2 size={13} className="animate-spin text-swu-amber" />
                {trabajo.hechos} de {trabajo.total} emparejamientos
              </div>
              <div className="h-2 rounded bg-swu-surface overflow-hidden">
                <div className="h-full bg-swu-amber rounded transition-all"
                  style={{ width: `${(trabajo.hechos / Math.max(trabajo.total, 1)) * 100}%` }} />
              </div>
            </div>
          )}

          {listo && trabajo && (
            <div className="space-y-3">
              {/* El titular de la pantalla es el número que MÁS necesita su
                  encuadre, y era el único que no lo llevaba: iba solo, en 4xl,
                  justo encima de dos referencias también peladas — la invitación
                  perfecta a leer «51,2 contra 49,0 del campeón» como una
                  ventaja. Además usaba `toFixed(1)`, así que era el único
                  número con punto decimal entre docenas con coma. */}
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-swu-amber font-mono tabular-nums">
                  {n1(trabajo.media ?? 0)}<span className="text-lg">%</span>
                </span>
                <span className="text-[11px] text-swu-muted leading-tight">
                  media de los <span className="font-mono">{trabajo.resultados.length}</span>{' '}
                  emparejamientos,<br />cada uno medido con{' '}
                  <span className="font-mono">{PARTIDAS_GAUNTLET}</span> partidas
                  (±<span className="font-mono">{n1(MARGEN_GAUNTLET)}</span> cada uno)
                </span>
              </div>

              {/* la vara de comparar: el podio real medido en el mismo motor */}
              <div className="space-y-1.5 border-b border-swu-border pb-2.5">
                {REFERENCIAS.map((r) => (
                  <BarraWin key={r.nombre} etiqueta={r.nombre} valor={r.media}
                    margen={MARGEN_GAUNTLET} tono="destacada" />
                ))}
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {trabajo.resultados.map((r) => (
                  <BarraWin key={r.rival} etiqueta={r.lider ? r.lider.split(' | ')[0] : r.rival}
                    valor={r.win} margen={MARGEN_GAUNTLET} />
                ))}
              </div>
            </div>
          )}
        </Seccion>
      )}

      {/* ── A · diagnóstico + B · profundizar ──
          Gratis e instantáneo: sale de los 22 números que YA se midieron. Lo
          único que cuesta acá es tocar un rival, que dispara `/simular`. */}
      {listo && trabajo && (
        <Seccion titulo="Diagnóstico" icono={<Stethoscope size={16} />} tono="cyan">
          {cargandoContexto && (
            <div className="flex items-center gap-2 text-xs text-swu-muted">
              <Loader2 size={13} className="animate-spin text-swu-cyan" />
              Cruzando los resultados con la base de cartas…
            </div>
          )}

          {!cargandoContexto && errorContexto && (
            <p className="text-xs text-swu-red-texto">
              {errorContexto} Sin la base de cartas local no se puede agrupar por aspecto.
            </p>
          )}

          {/* El vacío exige `contexto` cargado. Sin esa condición, el frame que
              va entre pintar la sección y correr el efecto mostraba «no
              devolvió emparejamientos» sobre un guantelete que sí los tiene. */}
          {!cargandoContexto && !errorContexto && contexto && !diagnostico && (
            <p className="text-xs text-swu-muted">
              El guantelete no devolvió emparejamientos que leer.
            </p>
          )}

          {diagnostico && (
            <div className="space-y-4">
              {/* El patrón, SOLO si existe.
                  Con `patron === null` no se dibuja nada: el motor mide rondas,
                  y menos de una ronda de diferencia entre derrotas y victorias
                  no alcanza para afirmar cómo perdés. Rellenar ese hueco con
                  una frase genérica sería inventar el diagnóstico. */}
              {diagnostico.patron && (
                <div className="rounded-lg border border-swu-amber/30 bg-swu-amber/10 p-2.5 space-y-1">
                  <div className="text-xs font-bold text-swu-amber">
                    {TITULO_PATRON[diagnostico.patron]}
                  </div>
                  <p className="text-[11px] leading-relaxed text-swu-text">
                    {diagnostico.patronPorque}
                  </p>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-swu-muted">
                Tocá cualquier rival para medirlo a fondo:{' '}
                <span className="font-mono">{PARTIDAS_SIMULAR}</span> partidas con su margen de error.
              </p>

              {/* Dónde perdés. **No** «del peor al menos malo»: eso decía el
                  comentario que estaba acá, con el argumento de que están todos
                  fuera de la franja de ruido. No se sigue. Fuera de la franja
                  significa distinguible del 50 %, no distinguible ENTRE SÍ:
                  para eso hace falta ±6,9 (`MARGEN_DIFERENCIA`) y un 44,2
                  contra un 40,1 no los tiene. Van alfabéticos, igual que el
                  empate técnico, y por exactamente la misma razón. */}
              {diagnostico.pierde.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-swu-red-texto">
                    Dónde perdés{' '}
                    <span className="font-mono font-normal text-swu-muted">
                      ({diagnostico.pierde.length})
                    </span>
                  </h3>
                  <p className="text-[11px] leading-relaxed text-swu-muted">
                    Cada fila lleva su margen: ±<span className="font-mono">{n1(MARGEN_GAUNTLET)}</span>{' '}
                    puntos. Para afirmar que un rival te va peor que otro harían falta{' '}
                    <span className="font-mono">{n1(MARGEN_DIFERENCIA)}</span> puntos entre ellos, así
                    que van en orden alfabético.
                  </p>
                  {diagnostico.pierde.map((f) => (
                    <FilaRival key={f.slug} fila={f} activo={abierto === f.slug}
                      cargando={abierto === f.slug && cargandoDetalle}
                      bloqueado={ocupado}
                      detalle={abierto === f.slug ? detalle : null}
                      error={abierto === f.slug ? errorDetalle : null}
                      onClick={() => void profundizar(f)}
                      onVerPartida={deckActual
                        ? () => navigate(`/mesa?deck=${deckActual.id}&rival=${f.slug}`)
                        : undefined} />
                  ))}
                </div>
              )}

              {/* Empate técnico — rotulado y SIN ordenar entre sí.
                  A 400 partidas por rival el margen es ±4,9 puntos: 52 y 48 son
                  el mismo número. `diagnosticar()` los devuelve alfabéticos a
                  propósito, un orden que nadie confunde con una clasificación. */}
              {diagnostico.parejo.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-swu-cyan">
                    Empate técnico (±<span className="font-mono">{n1(MARGEN_GAUNTLET)}</span> puntos de
                    margen){' '}
                    <span className="font-mono font-normal text-swu-muted">
                      ({diagnostico.parejo.length})
                    </span>
                  </h3>
                  <p className="text-[11px] leading-relaxed text-swu-muted">
                    El guantelete corre <span className="font-mono">{PARTIDAS_GAUNTLET}</span>{' '}
                    partidas por rival, así que uno que marca <span className="font-mono">52</span>{' '}
                    podría estar en <span className="font-mono">{n1(52 - MARGEN_GAUNTLET)}</span>. Van
                    en orden alfabético: acá no se puede decir cuál te va mejor.
                  </p>
                  {diagnostico.parejo.map((f) => (
                    <FilaRival key={f.slug} fila={f} activo={abierto === f.slug}
                      cargando={abierto === f.slug && cargandoDetalle}
                      bloqueado={ocupado}
                      detalle={abierto === f.slug ? detalle : null}
                      error={abierto === f.slug ? errorDetalle : null}
                      onClick={() => void profundizar(f)}
                      onVerPartida={deckActual
                        ? () => navigate(`/mesa?deck=${deckActual.id}&rival=${f.slug}`)
                        : undefined} />
                  ))}
                </div>
              )}

              {diagnostico.gana.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-swu-green">
                    Dónde ganás{' '}
                    <span className="font-mono font-normal text-swu-muted">
                      ({diagnostico.gana.length})
                    </span>
                  </h3>
                  <p className="text-[11px] leading-relaxed text-swu-muted">
                    También alfabéticos, y también con ±
                    <span className="font-mono">{n1(MARGEN_GAUNTLET)}</span> cada uno: cuál te va
                    <i> mejor</i> es tan poco afirmable como cuál te va peor.
                  </p>
                  {diagnostico.gana.map((f) => (
                    <FilaRival key={f.slug} fila={f} activo={abierto === f.slug}
                      cargando={abierto === f.slug && cargandoDetalle}
                      bloqueado={ocupado}
                      detalle={abierto === f.slug ? detalle : null}
                      error={abierto === f.slug ? errorDetalle : null}
                      onClick={() => void profundizar(f)}
                      onVerPartida={deckActual
                        ? () => navigate(`/mesa?deck=${deckActual.id}&rival=${f.slug}`)
                        : undefined} />
                  ))}
                </div>
              )}

              {/* Medias por familia de aspecto.
                  Este bloque era una lista ORDENADA de peor a mejor media, sin
                  margen y con los colores de umbral encima: una familia de un
                  solo rival (±4,9) se presentaba como «el peor aspecto», y dos
                  medias en 48,5 y 51,5 quedaban ordenadas como si eso
                  significara algo. Ahora va alfabético, cada media trae su
                  propio margen (que baja con la raíz de `n`) y las barras son
                  grises: un umbral duro no se le aplica a un promedio. */}
              {diagnostico.porFamilia.length > 0 && (
                <div className="space-y-1.5 border-t border-swu-border pt-3">
                  <h3 className="text-xs font-bold text-swu-text">Por aspecto del rival</h3>
                  {/* El margen mide cuánto se separan ENTRE SÍ los rivales del
                      aspecto, no cuántas partidas se jugaron. Antes decía que
                      «baja a medida que hay más rivales», que es lo que hace el
                      error binomial y NO lo que hace la dispersión real: una
                      familia con rivales en 30 y 70 tiene un margen enorme por
                      muchas partidas que se le echen. Ver `FamiliaDiag.margen`. */}
                  <p className="text-[11px] leading-relaxed text-swu-muted">
                    Alfabético, no de peor a mejor. El margen dice cuánto se separan entre sí los
                    rivales de ese aspecto: si van todos parecido es estrecho, y si uno gana 70 y
                    otro 30 es ancho por muchas partidas que se jueguen. Con un solo rival no hay
                    margen que dar —es una fila suelta con otro nombre, ±
                    <span className="font-mono">{n1(MARGEN_GAUNTLET)}</span> por su propia muestra—.
                  </p>
                  {diagnostico.porFamilia.map((f) => (
                    <BarraWin key={f.familia}
                      etiqueta={`${translateAspect(f.familia)} · ${f.n} ${f.n === 1 ? 'rival' : 'rivales'}`}
                      valor={f.media} margen={f.margen} tono="neutro" />
                  ))}
                </div>
              )}
            </div>
          )}
        </Seccion>
      )}

      {/* ── C · buscar mejoras ──
          Lo caro. Cada candidato son 3-6 s de CPU del VPS, así que va acotado a
          seis, secuencial, y se avisa el costo ANTES de arrancar. */}
      {listo && diagnostico && (
        <Seccion titulo="Buscar mejoras" icono={<Sparkles size={16} />} tono="purple">
          {fuente === 'pegado' ? (
            <p className="text-xs leading-relaxed text-swu-muted">
              La búsqueda de mejoras necesita un mazo <b className="text-swu-text">guardado</b>: para
              proponer recambios hay que cruzar cada carta con tu colección y con los aspectos del
              líder, y una lista pegada es texto que interpreta el simulador, no cartas de HOLOCRON.
            </p>
          ) : !rivalPrueba ? (
            <p className="text-xs text-swu-muted">
              No hay emparejamientos contra los que medir un cambio.
            </p>
          ) : hipotesis.length === 0 ? (
            <p className="text-xs leading-relaxed text-swu-muted">
              No se pudo armar ninguna hipótesis para este mazo: o el líder y la base no se
              resolvieron contra la base de cartas local, o no hay recambios que entren sin pagar
              sobrecoste de aspecto. Podés medir un cambio a mano acá abajo.
            </p>
          ) : (
            <>
              {!buscando && !medidos && (
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-swu-muted">
                    {/* El número de cambios NO se promete: sale de contar las
                        hipótesis que se armaron de verdad. */}
                    Prueba <span className="font-mono text-swu-text">{hipotesis.length}</span>{' '}
                    {hipotesis.length === 1 ? 'cambio' : 'cambios'},{' '}
                    <span className="font-mono text-swu-text">{PARTIDAS_PROBAR}</span> partidas cada
                    uno, contra{' '}
                    <b className="text-swu-text">{rivalPrueba.fila.lider.split(' | ')[0]}</b>
                    {/* Tres frases, no dos, porque hay tres cosas distintas que
                        se pueden afirmar. La del medio faltaba, y era la que
                        cubría el caso más común: una derrota clara que NO se
                        puede llamar «la peor» porque el segundo está dentro de
                        los ±6,9 puntos que hacen falta para separarlas. */}
                    {rivalPrueba.destacado && rivalPrueba.claro
                      ? ' — el emparejamiento donde más claramente perdés: el siguiente está a más de'
                      : rivalPrueba.claro
                        ? ' — una de tus derrotas claras. No se puede decir que sea la peor: eso exigiría'
                        : ' — no hay ninguna derrota clara, así que se mide contra el de menor win rate,' +
                          ' que dentro del margen podría no ser el peor. Harían falta'}
                    {' '}<span className="font-mono">{n1(MARGEN_DIFERENCIA)}</span> puntos de distancia.
                  </p>
                  <p className="text-xs leading-relaxed text-swu-muted">
                    Cada medición son <span className="font-mono text-swu-text">3-6</span> segundos en
                    el servidor de Nel, que tiene 2 núcleos compartidos con el resto de sus servicios:
                    por eso van <b className="text-swu-text">de a una</b> y no todas juntas. Contá un
                    par de minutos con la pantalla abierta.
                  </p>
                  <Aviso>{AVISO_HIPOTESIS}</Aviso>
                </div>
              )}

              {/* Un solo botón a la vez: a 320 px, «Buscar mejoras» a todo lo
                  ancho más «Detener» al lado parte las dos etiquetas. */}
              {buscando ? (
                <Button variant="secondary" size="sm" block onClick={detenerBusqueda}>
                  <CircleStop size={14} /> Detener la búsqueda
                </Button>
              ) : (
                // `ocupado` apaga el botón mientras haya CUALQUIER medición en
                // vuelo (un /simular, el probador manual, el guantelete). Son 2
                // núcleos compartidos y el simulador corta a 40 peticiones por
                // minuto: apilar capas es cómo se llega al 429 a media búsqueda.
                <Button variant="primary" size="sm" block disabled={ocupado}
                  onClick={() => void buscarMejoras()}>
                  <Microscope size={14} /> {medidos ? 'Buscar de nuevo' : 'Buscar mejoras'}
                </Button>
              )}

              {buscando && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-swu-muted">
                    <Loader2 size={13} className="animate-spin text-purple-400" />
                    <span className="font-mono tabular-nums">{progresoBusqueda.hecho}</span> de{' '}
                    <span className="font-mono tabular-nums">{progresoBusqueda.total}</span> cambios medidos
                    {progresoBusqueda.fallidos > 0 && (
                      <span>
                        {' · '}<span className="font-mono tabular-nums">{progresoBusqueda.fallidos}</span>{' '}
                        sin medir
                      </span>
                    )}
                  </div>
                  <div className="h-2 rounded bg-swu-surface overflow-hidden">
                    <div className="h-full bg-purple-400 rounded transition-all"
                      style={{ width: `${(progresoBusqueda.hecho / Math.max(progresoBusqueda.total, 1)) * 100}%` }} />
                  </div>
                </div>
              )}

              {errorBusqueda && (
                <p className="text-xs text-swu-red-texto leading-relaxed">{errorBusqueda}</p>
              )}

              {medidos && medidos.length > 0 && (
                <div className="space-y-2.5">
                  {reportables.map((m) => (
                    <CambioMedido key={`${m.candidato.entra.id}-${m.candidato.sale.cardId}`}
                      medido={m} rival={rivalPrueba.fila.lider} />
                  ))}

                  {/* Ningún ganador es un RESULTADO, no un fallo del laboratorio. */}
                  {!buscando && reportables.length === 0 && (
                    <p className="text-xs leading-relaxed text-swu-text">
                      Ningún cambio de los probados movió la aguja más allá del margen de error.
                    </p>
                  )}

                  {/* Lo que no llegó al umbral se CUENTA. Esconderlo dejaría
                      «probé 6, encontré 2» indistinguible de «probé 2». */}
                  {dentroDelMargen > 0 && (
                    <div className="flex gap-2 items-start text-[11px] leading-relaxed text-swu-muted
                      bg-swu-surface rounded-lg p-2.5 border border-swu-border">
                      <Minus size={13} className="text-swu-muted flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono tabular-nums text-swu-text">{dentroDelMargen}</span>
                        {dentroDelMargen === 1 ? ' cambio quedó' : ' cambios quedaron'} dentro del
                        margen de error (menos de{' '}
                        <span className="font-mono">{DELTA_MINIMO}</span> puntos). A{' '}
                        <span className="font-mono">{PARTIDAS_PROBAR}</span> partidas, el mismo cambio
                        midió <span className="font-mono">+{n1(EVIDENCIA_DELTA.alto)}</span> y{' '}
                        <span className="font-mono">−{n1(Math.abs(EVIDENCIA_DELTA.bajo))}</span> según
                        la muestra: por debajo de ese umbral no se puede decir en qué dirección va.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Seccion>
      )}

      {/* ── 4 · probador de cambios ── */}
      {informe && (
        <Seccion titulo="Probar un cambio" icono={<Scale size={16} />} tono="purple">
          <p className="text-xs text-swu-muted leading-relaxed">
            Mide el mazo con y sin el cambio contra{' '}
            {rivalPrueba
              ? <b className="text-swu-text">{rivalPrueba.fila.lider.split(' | ')[0]}</b>
              : 'el campeón del Galactic'}{' '}
            (<span className="font-mono">{PARTIDAS_PROBAR}</span> partidas por lado) y te dice cuántos
            puntos gana o pierde. Esta es la comparación más fiable del laboratorio: mismo rival,
            mismas reglas, misma semilla.
          </p>

          {viabilidad && !viabilidad.viable && (
            <p className="text-xs text-swu-amber leading-relaxed">{viabilidad.motivo}</p>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={quitaN} onChange={(e) => setQuitaN(Number(e.target.value))}
                className="w-14 bg-swu-surface border border-swu-border rounded-lg px-1 py-2 text-xs text-swu-text">
                {[1, 2, 3].map((n) => <option key={n} value={n}>−{n}</option>)}
              </select>
              <select value={quitaCarta} onChange={(e) => setQuitaCarta(e.target.value)}
                className="flex-1 min-w-0 bg-swu-surface border border-swu-border rounded-lg px-2 py-2 text-xs text-swu-text">
                <option value="">(no quitar nada)</option>
                {(deckActual?.mainDeck ?? []).map((c) => {
                  const n = c.subtitle ? `${c.name} | ${c.subtitle}` : c.name
                  return <option key={n} value={n}>{n}</option>
                })}
              </select>
            </div>
            <div className="flex gap-2">
              <select value={meteN} onChange={(e) => setMeteN(Number(e.target.value))}
                className="w-14 bg-swu-surface border border-swu-border rounded-lg px-1 py-2 text-xs text-swu-text">
                {[1, 2, 3].map((n) => <option key={n} value={n}>+{n}</option>)}
              </select>
              <input value={meteCarta} onChange={(e) => setMeteCarta(e.target.value)}
                placeholder="Carta a meter (nombre o id SWUDB)"
                className="flex-1 min-w-0 bg-swu-surface border border-swu-border rounded-lg px-2 py-2 text-xs text-swu-text placeholder:text-swu-muted/60" />
            </div>
          </div>

          {/* Deshabilitado cuando el cambio dejaría el mazo bajo su mínimo
              legal, y cuando ya hay otra medición en vuelo. Lo que ya NO se
              bloquea es el mazo de Data Vault: medido contra el servicio vivo,
              `POST /probar` lo acepta y devuelve su delta. */}
          <Button variant="primary" size="sm" block onClick={probar} loading={probando}
            disabled={(!!viabilidad && !viabilidad.viable) || ocupado}>
            <Scale size={14} /> Medir el cambio
          </Button>

          {/* El error del probador, junto al botón que lo pidió. */}
          {errorPrueba && (
            <div className="flex gap-2 items-start text-xs text-swu-red-texto bg-swu-red/10
              border border-swu-red/30 rounded-lg p-2.5">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {errorPrueba}
            </div>
          )}

          {prueba && (
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="text-center">
                <div className="text-[10px] text-swu-muted uppercase tracking-wider">antes</div>
                <div className="font-mono text-lg text-swu-text tabular-nums">{n1(prueba.antes)}%</div>
                <div className="text-[10px] text-swu-muted font-mono">±{n1(MARGEN_PROBAR)}</div>
              </div>
              {/* El color sale de `esReportable`, no de un ±0,5 elegido a ojo.
                  Pintar de verde un +2 sería decir «mejoró» de algo que a 1000
                  partidas puede ser un −4,5 real.

                  Y el SIGNO tampoco se pinta cuando no es reportable. El `+` en
                  2xl black era el glifo más fuerte de la pantalla y se dibujaba
                  igual para un +0,3, contradiciendo al descargo que iba justo
                  debajo diciendo que no se puede saber la dirección. Si no se
                  sabe la dirección, no se dibuja la dirección. (De paso muere
                  el «-0,0» que salía de un delta de −0,04.) */}
              <div className={`text-2xl font-black font-mono tabular-nums ${
                !esReportable(prueba.delta) ? 'text-swu-muted'
                  : prueba.delta > 0 ? 'text-swu-green' : 'text-swu-red-texto'}`}>
                {esReportable(prueba.delta) ? (prueba.delta > 0 ? '+' : '−') : ''}
                {n1(Math.abs(prueba.delta))}
              </div>
              <div className="text-center">
                <div className="text-[10px] text-swu-muted uppercase tracking-wider">después</div>
                <div className="font-mono text-lg text-swu-text tabular-nums">{n1(prueba.despues)}%</div>
                <div className="text-[10px] text-swu-muted font-mono">±{n1(MARGEN_PROBAR)}</div>
              </div>
            </div>
          )}
          {prueba && !esReportable(prueba.delta) && (
            <p className="text-[11px] text-swu-muted text-center leading-relaxed">
              Dentro del margen de error, en cualquiera de las dos direcciones — por eso el número va
              sin signo. A <span className="font-mono">{PARTIDAS_PROBAR}</span>{' '}
              partidas hace falta un delta de al menos{' '}
              <span className="font-mono">{DELTA_MINIMO}</span> puntos para afirmar la dirección del
              cambio: el mismo cambio medido a distintos tamaños de muestra dio{' '}
              <span className="font-mono">+{n1(EVIDENCIA_DELTA.alto)}</span> y{' '}
              <span className="font-mono">−{n1(Math.abs(EVIDENCIA_DELTA.bajo))}</span>.
            </p>
          )}
        </Seccion>
      )}
    </div>
  )
}
