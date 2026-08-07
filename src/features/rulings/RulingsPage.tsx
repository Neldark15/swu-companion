/**
 * RULLINGS — asistencia de reglas para jueces y jugadores.
 *
 * Tres formas de llegar a una regla, en orden de urgencia real en una mesa:
 *
 *   1. Buscador: texto libre («shield overwhelm»), número exacto («7.4.2»
 *      va directo) o nombre de carta (resuelve sus mecánicas desde la base
 *      local de Dexie y enlaza a las reglas de cada una).
 *   2. Chips de mecánicas: las 22 del índice, a un toque.
 *   3. Índice navegable: el árbol de capítulos, para leer en orden.
 *
 * El texto NORMATIVO de las reglas es el inglés de FFG, tal cual. Desde v8.0
 * hay además una traducción DE CORTESÍA al español (es.json, mejora
 * progresiva: si falla, todo sigue en inglés) con selector EN · ES · Ambos
 * persistido en localStorage. La búsqueda cubre los dos idiomas.
 *
 * La ruta es PÚBLICA y el estado vive en la URL (?regla=7.4.2, ?mec=Sentinel)
 * para que una cita se pueda compartir por WhatsApp y abrir sin cuenta.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, ChevronRight, ChevronDown, Copy, Check, ExternalLink,
  ArrowLeft, BookMarked, FlaskConical, X, Gavel, Ban, AlertTriangle,
} from 'lucide-react'
import {
  cargarRulings, cargarSimulador, cargarTraducciones, cargarRulingsCartas,
  buscarEnReglas, comoIdDeRegla,
  rutaDeMigas, cartasConMecanicas, compararIds, traduccionDe,
  type DatosRulings, type EntradaRegla, type EstadoSimulador, type DatosTraducciones,
  type ResultadoBusqueda, type CartaConMecanicas, type EstadoModelado,
  type DatosRulingsCartas, type NotaTransicion,
} from '../../services/rulingsService'
import { normalizeSearch } from '../../services/swuApi'

// ─── Utilidades de presentación ───

const NOMBRE_TIPO: Record<EntradaRegla['tipo'], string> = {
  capitulo: 'Capítulo',
  seccion: 'Sección',
  regla: 'Regla',
  letra: 'Regla',
}

// ─── Idioma de lectura (EN normativo · ES cortesía · Ambos) ───

type Idioma = 'en' | 'es' | 'ambos'

const CLAVE_IDIOMA = 'swu_rulings_idioma'

/** «Ambos» por defecto: es el modo pedido — nunca esconde el texto normativo. */
function leerIdiomaGuardado(): Idioma {
  try {
    const v = localStorage.getItem(CLAVE_IDIOMA)
    return v === 'en' || v === 'es' || v === 'ambos' ? v : 'ambos'
  } catch {
    return 'ambos'
  }
}

/**
 * Título según el idioma visible. En «Ambos» va «GAME CONCEPTS · Conceptos
 * del juego»; en «ES», solo el español (si existe); el inglés siempre es el
 * respaldo — una entrada jamás se queda sin título por falta de traducción.
 */
function tituloSegunIdioma(en: string | null, es: string | null | undefined, idioma: Idioma): string | null {
  const tes = es ?? null
  if (idioma === 'es') return tes ?? en
  if (idioma === 'ambos' && en && tes) return `${en} · ${tes}`
  return en ?? tes
}

const OPCIONES_IDIOMA: { v: Idioma; etiqueta: string }[] = [
  { v: 'en', etiqueta: 'EN' },
  { v: 'es', etiqueta: 'ES' },
  { v: 'ambos', etiqueta: 'Ambos' },
]

/**
 * Selector de idioma. No usa el SegmentedControl del repo porque este caso
 * necesita opciones DESHABILITADAS con explicación (cuando es.json no cargó,
 * ES y Ambos quedan apagados con un `title` que dice por qué) y el componente
 * compartido no las modela. Mismo contrato accesible: radiogroup real con
 * flechas y roving tabindex.
 */
function SelectorIdioma({ valor, onChange, sinTraduccion }: {
  valor: Idioma
  onChange: (v: Idioma) => void
  /** es.json falló: el módulo sigue solo en inglés. */
  sinTraduccion: boolean
}) {
  const grupoRef = useRef<HTMLDivElement>(null)
  const efectivo: Idioma = sinTraduccion ? 'en' : valor
  const motivo = 'La traducción al español no se pudo cargar — el módulo sigue disponible en inglés.'

  const mover = (dir: 1 | -1) => {
    if (sinTraduccion) return // solo EN habilitado: no hay a dónde moverse
    const i = OPCIONES_IDIOMA.findIndex(o => o.v === efectivo)
    const sig = (i + dir + OPCIONES_IDIOMA.length) % OPCIONES_IDIOMA.length
    onChange(OPCIONES_IDIOMA[sig].v)
    // El foco sigue a la selección (roving tabindex): sin esto, el botón que
    // lo tenía pasa a tabIndex=-1 al redibujar y la flecha siguiente muere.
    requestAnimationFrame(() => {
      grupoRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[sig]?.focus()
    })
  }

  return (
    <div
      ref={grupoRef}
      role="radiogroup"
      aria-label="Idioma de las reglas"
      title={sinTraduccion ? motivo : undefined}
      className="flex gap-1 p-1 rounded-xl bg-swu-bg border border-swu-border mt-2.5"
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
      }}
    >
      {OPCIONES_IDIOMA.map(o => {
        const deshabilitada = sinTraduccion && o.v !== 'en'
        const activa = o.v === efectivo
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={activa}
            disabled={deshabilitada}
            title={deshabilitada ? motivo : undefined}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(o.v)}
            // `min-w-0` + `truncate`: a 320px las tres opciones caben, pero si
            // el sistema agranda la fuente, que ceda la etiqueta y no la fila.
            className={`flex-1 min-w-0 min-h-8 px-2 rounded-lg text-[11px] font-semibold
                        inline-flex items-center justify-center transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${activa ? 'bg-swu-surface text-swu-text' : 'text-swu-muted hover:text-swu-text'}`}
          >
            <span className="truncate min-w-0">{o.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Resalta los tokens buscados dentro de un texto (insensible a mayúsculas). */
function Resaltado({ texto, tokens }: { texto: string; tokens: string[] }) {
  const limpios = tokens.filter(Boolean)
  if (limpios.length === 0) return <>{texto}</>
  const escapados = limpios.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escapados.join('|')})`, 'gi')
  const partes = texto.split(re)
  return (
    <>
      {partes.map((p, i) =>
        // Con un grupo de captura en el split, los índices impares SON las
        // coincidencias — sin re-testear (el regex /g/ es de estado mutable).
        i % 2 === 1
          ? <mark key={i} className="bg-swu-cyan/20 text-swu-cyan rounded-sm px-0.5">{p}</mark>
          : <span key={i}>{p}</span>,
      )}
    </>
  )
}

/** Viñetas («• …») y ejemplos («For example… / Por ejemplo…») llevan su estilo. */
function claseDeParrafo(p: string): string {
  if (/^(for example|por ejemplo)/i.test(p)) return 'text-swu-muted italic border-l-2 border-swu-border pl-3'
  if (p.startsWith('•')) return 'text-swu-text pl-3'
  return 'text-swu-text'
}

/**
 * Párrafos del texto oficial: vienen separados por \n, con las viñetas y los
 * ejemplos como párrafos propios.
 *
 * Con traducción, el idioma manda: en «Ambos» cada párrafo inglés lleva
 * DEBAJO su español con estilo propio (muted + borde izquierdo) para que
 * nunca se confundan cuál es el normativo; en «ES» va solo el español. Los
 * párrafos se emparejan por posición — la traducción conserva la estructura
 * de \n del original — y si algo no cuadra, el sobrante se muestra igual en
 * vez de perderse. Sin traducción disponible, inglés, siempre.
 */
function Parrafos({ texto, textoEs, idioma = 'en', tokens = [] }: {
  texto: string
  textoEs?: string | null
  idioma?: Idioma
  tokens?: string[]
}) {
  const pEn = texto.split('\n')
  const pEs = textoEs ? textoEs.split('\n') : []

  if (idioma === 'es' && pEs.length > 0) {
    return (
      <div className="space-y-2">
        {pEs.map((p, i) => (
          <p key={i} className={`text-[13px] leading-relaxed ${claseDeParrafo(p)}`}>
            <Resaltado texto={p} tokens={tokens} />
          </p>
        ))}
      </div>
    )
  }

  if (idioma === 'ambos' && pEs.length > 0) {
    const filas = Math.max(pEn.length, pEs.length)
    return (
      <div className="space-y-2.5">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="space-y-1">
            {pEn[i] !== undefined && (
              <p className={`text-[13px] leading-relaxed ${claseDeParrafo(pEn[i])}`}>
                <Resaltado texto={pEn[i]} tokens={tokens} />
              </p>
            )}
            {pEs[i] !== undefined && (
              <p className="text-[12px] leading-relaxed text-swu-muted border-l-2 border-swu-cyan/25 pl-3">
                <Resaltado texto={pEs[i]} tokens={tokens} />
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pEn.map((p, i) => (
        <p key={i} className={`text-[13px] leading-relaxed ${claseDeParrafo(p)}`}>
          <Resaltado texto={p} tokens={tokens} />
        </p>
      ))}
    </div>
  )
}

/**
 * Botón que copia la cita oficial: «CR 7.4.2 — texto». Copia lo que se VE:
 * en «EN» el inglés, en «ES» el español (con el inglés de respaldo si no hay
 * traducción) y en «Ambos», los dos — el inglés primero, que es el normativo.
 */
function BotonCopiarCita({ id, texto, textoEs, idioma = 'en' }: {
  id: string
  texto: string
  textoEs?: string | null
  idioma?: Idioma
}) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    const en = texto.replace(/\n/g, ' ')
    const es = (textoEs ?? '').replace(/\n/g, ' ')
    const cita =
      idioma === 'es' && es ? `CR ${id} — ${es}`
        : idioma === 'ambos' && es ? `CR ${id} — ${en}\nES: ${es}`
          : `CR ${id} — ${en}`
    try {
      await navigator.clipboard.writeText(cita)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer; el texto está en
      // pantalla y se puede seleccionar a mano.
    }
  }
  return (
    <button
      onClick={copiar}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-swu-border
                 text-[11px] font-mono text-swu-muted hover:text-swu-text hover:bg-swu-surface-hover
                 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      {copiado ? <Check size={12} className="text-swu-green" /> : <Copy size={12} />}
      {copiado ? 'Copiada' : `Copiar CR ${id}`}
    </button>
  )
}

const ESTILO_ESTADO: Record<EstadoModelado, { punto: string; texto: string; rotulo: string }> = {
  modelada: { punto: 'bg-swu-green', texto: 'text-swu-green', rotulo: 'SWUSIM la modela' },
  parcial: { punto: 'bg-swu-amber', texto: 'text-swu-amber', rotulo: 'SWUSIM la modela parcialmente' },
  no: { punto: 'bg-swu-red', texto: 'text-swu-red', rotulo: 'SWUSIM no la modela' },
}

/**
 * «¿Y el simulador?» — el puente de lectura hacia SWUSIM. Es un dato
 * declarado (REGLAS.md del motor), no una promesa: por eso lleva la nota de
 * auditoría en curso siempre visible.
 */
function PuenteSimulador({ sim, mecanica }: { sim: EstadoSimulador | null; mecanica: string }) {
  const info = sim?.mecanicas[mecanica]
  if (!info) return null
  const estilo = ESTILO_ESTADO[info.estado]
  return (
    <div className="mt-4 rounded-xl border border-swu-border bg-swu-surface p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <FlaskConical size={13} className="text-swu-muted" />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted">¿Y el simulador?</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${estilo.punto}`} />
        <span className={`text-xs font-semibold ${estilo.texto}`}>{estilo.rotulo}</span>
      </div>
      <p className="text-[11px] text-swu-muted mt-1 leading-relaxed">{info.nota}</p>
      <p className="text-[10px] text-swu-muted/60 mt-1.5 italic">{sim?.nota}</p>
    </div>
  )
}

// ─── Pantalla ───

export function RulingsPage() {
  const [datos, setDatos] = useState<DatosRulings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sim, setSim] = useState<EstadoSimulador | null>(null)
  const [trad, setTrad] = useState<DatosTraducciones | null>(null)
  /** es.json terminó en fallo: el selector se deshabilita en ES/Ambos. */
  const [tradFallo, setTradFallo] = useState(false)
  /** cartas.json: aclaraciones por carta + suspendidas + nota CR8→CR9. */
  const [cartasCR, setCartasCR] = useState<DatosRulingsCartas | null>(null)
  const [idioma, setIdioma] = useState<Idioma>(leerIdiomaGuardado)

  const [params, setParams] = useSearchParams()
  const reglaSel = params.get('regla')
  const mecSel = params.get('mec')

  const [consulta, setConsulta] = useState('')
  const [consultaLenta, setConsultaLenta] = useState('')
  /** Las cartas viajan CON su consulta: un resultado viejo se ignora al
   *  renderizar en vez de limpiarse con un setState síncrono en el efecto. */
  const [cartasRes, setCartasRes] = useState<{ consulta: string; lista: CartaConMecanicas[] } | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [glosarioAbierto, setGlosarioAbierto] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Carga inicial (una vez; el servicio cachea las promesas). Las CUATRO
  // peticiones salen EN PARALELO — ninguna espera a otra: solo index.json es
  // obligatorio; es.json, simulador.json y cartas.json son mejora progresiva,
  // no dependencias. En cascada, un cartas.json de 461 KB retrasaría la
  // pantalla entera para algo que casi nunca es lo que se vino a buscar.
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vivo = true
    cargarRulings()
      .then(d => { if (vivo) setDatos(d) })
      .catch(() => { if (vivo) setError('No se pudieron cargar las reglas. Revisá la conexión e intentá de nuevo.') })
    cargarSimulador().then(s => { if (vivo) setSim(s) })
    cargarTraducciones().then(t => {
      if (!vivo) return
      if (t) { setTrad(t); setTradFallo(false) } else { setTradFallo(true) }
    })
    cargarRulingsCartas().then(c => { if (vivo) setCartasCR(c) })
    return () => { vivo = false }
  }, [intento])

  const cambiarIdioma = (v: Idioma) => {
    setIdioma(v)
    try { localStorage.setItem(CLAVE_IDIOMA, v) } catch { /* Safari privado: la preferencia no persiste, nada más */ }
  }

  // Sin traducción (cargando todavía o fallida) todo se lee en inglés,
  // SIN tocar la preferencia guardada: si es.json llega tarde, el modo
  // elegido revive solo.
  const idiomaVisible: Idioma = trad ? idioma : 'en'

  // Debounce del buscador: 250 ms alcanzan para que no busque por tecla.
  useEffect(() => {
    const t = setTimeout(() => setConsultaLenta(consulta), 250)
    return () => clearTimeout(t)
  }, [consulta])

  // Resultados de reglas (síncronos sobre el JSON en memoria)
  const resultados: ResultadoBusqueda[] = useMemo(() => {
    if (!datos || consultaLenta.trim().length < 2) return []
    // La búsqueda cubre los DOS idiomas siempre que la traducción esté
    // cargada, sin importar el modo visible: «derrotar» encuentra la regla
    // de defeated aunque se esté leyendo en inglés.
    return buscarEnReglas(datos, consultaLenta, trad)
  }, [datos, consultaLenta, trad])

  // Coincidencia directa por número: «7.4.2» ofrece ir derecho a la regla.
  const idDirecto = useMemo(() => {
    if (!datos) return null
    const id = comoIdDeRegla(consultaLenta)
    return id && datos.entradas[id] ? id : null
  }, [datos, consultaLenta])

  // Cartas (asincrónico y SECUNDARIO: puede disparar la descarga de la base
  // de Dexie en un dispositivo virgen — jamás bloquea la búsqueda de reglas).
  useEffect(() => {
    if (!datos || consultaLenta.trim().length < 3 || comoIdDeRegla(consultaLenta)) return
    let vivo = true
    cartasConMecanicas(datos, consultaLenta)
      // Se muestra la carta si aporta ALGO: mecánicas que llevan a una regla,
      // aclaraciones oficiales, o un estado (suspendida / afectada por la nota
      // transicional). Antes el corte era solo por mecánicas, y buscar una
      // carta con 5 rulings y ninguna keyword indexada no devolvía nada.
      .then(cs => {
        if (!vivo) return
        const lista = cs.filter(c =>
          c.mecanicas.length > 0 || c.rulings.length > 0 || !!c.suspendida || c.transicion)
        setCartasRes({ consulta: consultaLenta, lista })
      })
      .catch(() => { if (vivo) setCartasRes({ consulta: consultaLenta, lista: [] }) })
    return () => { vivo = false }
  }, [datos, consultaLenta])

  // Solo cuentan las cartas de ESTA consulta; las de la anterior se ignoran.
  const cartas = cartasRes && cartasRes.consulta === consultaLenta ? cartasRes.lista : []

  const tokens = useMemo(
    () => normalizeSearch(consultaLenta).split(/\s+/).filter(t => t.length >= 2),
    [consultaLenta],
  )

  const irARegla = (id: string) => setParams({ regla: id })
  const irAMecanica = (m: string) => setParams({ mec: m })
  const irAlIndice = () => setParams({})

  const alternarAbierto = (id: string) => {
    setAbiertos(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  // ── Estados de carga y error ──

  if (error) {
    return (
      <div className="min-h-screen bg-swu-bg px-4 pt-6 max-w-3xl mx-auto">
        <div className="rounded-xl border border-swu-red/30 bg-swu-red/10 p-4 text-center">
          <p className="text-sm text-swu-text mb-3">{error}</p>
          <button
            onClick={() => { setError(null); setIntento(n => n + 1) }}
            className="px-4 py-2 rounded-lg bg-swu-surface border border-swu-border text-sm font-semibold
                       text-swu-text hover:bg-swu-surface-hover transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!datos) {
    // El JSON pesa 303 KB: en 3G se nota. Esqueleto en vez de pantalla vacía.
    return (
      <div className="min-h-screen bg-swu-bg px-4 pt-4 max-w-3xl mx-auto space-y-3">
        <div className="h-14 rounded-xl bg-swu-surface animate-pulse" />
        <div className="h-11 rounded-xl bg-swu-surface animate-pulse" />
        <div className="h-8 rounded-xl bg-swu-surface animate-pulse w-3/4" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-swu-surface animate-pulse" />
        ))}
      </div>
    )
  }

  // Object.hasOwn y no acceso directo: `?regla=__proto__` (o constructor,
  // toString…) alcanzaba propiedades heredadas de Object.prototype, pasaba el
  // truthy check y reventaba más abajo con pantalla blanca. Un enlace
  // compartido no puede tumbar la vista.
  const entradaSel = reglaSel && Object.hasOwn(datos.entradas, reglaSel)
    ? datos.entradas[reglaSel]
    : null

  return (
    <div className="min-h-screen bg-swu-bg px-4 pt-4 pb-24 max-w-3xl mx-auto">
      {/* ── Atribución: es material de FFG, somos un índice de consulta ── */}
      <div className="rounded-xl border border-swu-border bg-swu-surface px-3.5 py-3 mb-3">
        <div className="flex items-center gap-2.5">
          <BookMarked size={18} className="text-swu-cyan flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-extrabold text-swu-text leading-tight">RULLINGS</h1>
            <p className="text-[10px] text-swu-muted font-mono leading-snug">
              Comprehensive Rules v{datos.meta.version} · {datos.meta.fecha} · Fantasy Flight Games
            </p>
          </div>
          <a
            href={datos.meta.pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-swu-cyan hover:underline flex-shrink-0"
          >
            PDF oficial <ExternalLink size={10} />
          </a>
        </div>
        <p className="text-[10px] text-swu-muted/70 mt-1.5 leading-snug">
          El texto normativo es el inglés; el español es traducción de cortesía. © & ™ Lucasfilm Ltd. / FFG.
          {/* Las aclaraciones por carta son OTRA fuente que el PDF y con otra
              fecha: se declara acá para que la atribución esté a la vista en
              toda la pantalla, no solo dentro de la sección desplegada. */}
          {cartasCR && (
            <> Aclaraciones por carta: {cartasCR.meta.fuente} (FFG), descargadas el{' '}
              <span className="font-mono">{cartasCR.meta.descargado}</span>.</>
          )}
        </p>
        <SelectorIdioma valor={idioma} onChange={cambiarIdioma} sinTraduccion={tradFallo} />
      </div>

      {/* ── Aviso permanente en modo ES: acá el normativo no está a la vista ── */}
      {idiomaVisible === 'es' && trad && (
        <div className="rounded-xl border border-swu-amber/30 bg-swu-amber/10 px-3.5 py-2 mb-3">
          <p className="text-[11px] text-swu-amber leading-snug">{trad.meta.aviso}</p>
        </div>
      )}

      {/* ── Buscador ── */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={consulta}
          onChange={e => {
            setConsulta(e.target.value)
            // Tipear con un detalle abierto VUELVE a los resultados: si no,
            // el input recibía el texto nuevo pero la vista seguía clavada en
            // la regla anterior. `replace` para no ensuciar el historial con
            // una entrada por tecla.
            if (reglaSel || mecSel) setParams({}, { replace: true })
          }}
          onKeyDown={e => {
            // Enter con un número de regla va DIRECTO: es el caso del juez
            // que ya sabe qué cita necesita.
            if (e.key === 'Enter' && idDirecto) irARegla(idDirecto)
          }}
          placeholder="Regla (7.4.2), texto o carta…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-swu-surface border border-swu-border
                     text-sm text-swu-text placeholder:text-swu-muted/60
                     focus:outline-none focus:border-swu-cyan/50 focus:ring-1 focus:ring-swu-cyan/30"
        />
        {consulta && (
          <button
            onClick={() => { setConsulta(''); inputRef.current?.focus() }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-swu-muted hover:text-swu-text"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Chips de mecánicas ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-4 px-4">
        {Object.keys(datos.indice).map(m => (
          <button
            key={m}
            onClick={() => (mecSel === m ? irAlIndice() : irAMecanica(m))}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
              mecSel === m
                ? 'bg-swu-cyan/15 border-swu-cyan/40 text-swu-cyan'
                : 'bg-swu-surface border-swu-border text-swu-muted hover:text-swu-text'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Vista según la URL: detalle de regla, mecánica, o índice ── */}
      {entradaSel ? (
        <DetalleEntrada
          datos={datos}
          entrada={entradaSel}
          sim={sim}
          trad={trad}
          idioma={idiomaVisible}
          tokens={tokens}
          irARegla={irARegla}
          volver={irAlIndice}
        />
      ) : reglaSel ? (
        // ?regla= con un id que no existe (enlace viejo o tipeado a mano)
        <div className="rounded-xl border border-swu-border bg-swu-surface p-4 text-center">
          <p className="text-sm text-swu-text mb-1">La regla «{reglaSel}» no existe en la CR v{datos.meta.version}.</p>
          <button onClick={irAlIndice} className="text-xs text-swu-cyan hover:underline">Volver al índice</button>
        </div>
      ) : mecSel && Object.hasOwn(datos.indice, mecSel) ? (
        <DetalleMecanica
          datos={datos} mecanica={mecSel} sim={sim} trad={trad} idioma={idiomaVisible}
          irARegla={irARegla} volver={irAlIndice}
        />
      ) : consultaLenta.trim().length >= 2 ? (
        <SeccionResultados
          datos={datos}
          consulta={consultaLenta}
          resultados={resultados}
          idDirecto={idDirecto}
          cartas={cartas}
          cartasCR={cartasCR}
          trad={trad}
          idioma={idiomaVisible}
          tokens={tokens}
          irARegla={irARegla}
          irAMecanica={irAMecanica}
        />
      ) : (
        <ArbolIndice
          datos={datos}
          cartasCR={cartasCR}
          trad={trad}
          idioma={idiomaVisible}
          abiertos={abiertos}
          alternar={alternarAbierto}
          glosarioAbierto={glosarioAbierto}
          setGlosarioAbierto={setGlosarioAbierto}
          irARegla={irARegla}
        />
      )}
    </div>
  )
}

// ─── Resultados de búsqueda ───

function SeccionResultados({
  datos, consulta, resultados, idDirecto, cartas, cartasCR, trad, idioma, tokens, irARegla, irAMecanica,
}: {
  datos: DatosRulings
  consulta: string
  resultados: ResultadoBusqueda[]
  idDirecto: string | null
  cartas: CartaConMecanicas[]
  /** Puede ser null: cartas.json es mejora progresiva. */
  cartasCR: DatosRulingsCartas | null
  trad: DatosTraducciones | null
  idioma: Idioma
  tokens: string[]
  irARegla: (id: string) => void
  irAMecanica: (m: string) => void
}) {
  // Sugerencias cuando no hay nada: términos del glosario que compartan
  // algún token, más el recordatorio del formato numérico.
  const sinNada = resultados.length === 0 && !idDirecto && cartas.length === 0
  const sugerencias = sinNada
    ? datos.glosario.filter(g => tokens.some(t => normalizeSearch(g.termino).includes(t))).slice(0, 6)
    : []

  return (
    <div className="space-y-3">
      {/* Ir directo por número */}
      {idDirecto && (
        <button
          onClick={() => irARegla(idDirecto)}
          className="w-full flex items-center gap-2 rounded-xl border border-swu-cyan/40 bg-swu-cyan/10
                     px-3.5 py-3 text-left hover:bg-swu-cyan/15 transition-colors"
        >
          <ChevronRight size={16} className="text-swu-cyan flex-shrink-0" />
          <span className="text-sm text-swu-cyan font-semibold">Ir a CR {idDirecto}</span>
          <span className="text-[11px] text-swu-muted truncate">
            {tituloSegunIdioma(datos.entradas[idDirecto].titulo, traduccionDe(trad, idDirecto)?.titulo, idioma)
              ?? datos.entradas[idDirecto].texto.slice(0, 60)}
          </span>
        </button>
      )}

      {/* Cartas → mecánicas → reglas, + lo que FFG aclaró de esa carta */}
      {cartas.length > 0 && (
        <div>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-1.5 px-1">
            Cartas: mecánicas y aclaraciones
          </h3>
          <div className="space-y-1.5">
            {cartas.map(c => (
              <FilaCarta
                key={c.carta.id}
                datos={datos}
                info={c}
                transicion={cartasCR?.transicion ?? null}
                descargado={cartasCR?.meta.descargado ?? null}
                fuente={cartasCR?.meta.fuente ?? null}
                irAMecanica={irAMecanica}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reglas */}
      {resultados.length > 0 && (
        <div>
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-1.5 px-1">
            {resultados.length} regla{resultados.length === 1 ? '' : 's'}
          </h3>
          <div className="space-y-1.5">
            {resultados.map(({ entrada }) => (
              <FilaResultado
                key={entrada.id} datos={datos} entrada={entrada} trad={trad} idioma={idioma}
                tokens={tokens} alTocar={() => irARegla(entrada.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sin resultados */}
      {sinNada && (
        <div className="rounded-xl border border-swu-border bg-swu-surface p-4">
          <p className="text-sm text-swu-text">Sin resultados para «{consulta}».</p>
          <p className="text-[11px] text-swu-muted mt-1">
            Probá con el término en inglés («shield», «overwhelm»), el número exacto (7.4.2) o el nombre de una carta.
          </p>
          {sugerencias.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {sugerencias.map(g => (
                <button
                  key={g.termino}
                  onClick={() => irARegla(g.id)}
                  className="px-2 py-1 rounded-full bg-swu-bg border border-swu-border text-[10px]
                             text-swu-muted hover:text-swu-text transition-colors"
                >
                  {g.termino}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Una carta encontrada por nombre: sus mecánicas (que llevan a la regla) y sus
 * aclaraciones oficiales, que es lo que FFG publicó SOBRE ESA CARTA.
 *
 * Los rulings van en INGLÉS aunque la pantalla esté en español: son texto
 * normativo, igual que las reglas. Traducirlos sería fabricar una versión que
 * ningún juez puede citar en una mesa.
 *
 * Se despliegan a un toque en vez de mostrarse siempre: hay cartas con 5, y
 * cuatro cartas abiertas de golpe sepultarían los resultados de reglas, que es
 * lo que la mayoría vino a buscar.
 */
function FilaCarta({
  datos, info, transicion, descargado, fuente, irAMecanica,
}: {
  datos: DatosRulings
  info: CartaConMecanicas
  transicion: NotaTransicion | null
  descargado: string | null
  fuente: string | null
  irAMecanica: (m: string) => void
}) {
  const { carta, mecanicas, rulings, suspendida } = info
  const [abierta, setAbierta] = useState(false)
  const idPanel = `rulings-carta-${carta.id}`

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5">
      <div className="flex items-start gap-2">
        <p className="text-xs font-semibold text-swu-text leading-tight flex-1 min-w-0">
          {carta.name}{carta.subtitle ? <span className="text-swu-muted font-normal"> · {carta.subtitle}</span> : null}
          <span className="text-[10px] font-mono text-swu-muted/60 block">{carta.setCode} {carta.setNumber}</span>
        </p>
        {suspendida && (
          <span className="flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full bg-swu-red/15
                           border border-swu-red/40 text-[10px] font-bold text-swu-red">
            <Ban size={10} aria-hidden /> Suspendida · {suspendida.formato}
          </span>
        )}
      </div>

      {mecanicas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {mecanicas.map(m => (
            <button
              key={m}
              onClick={() => irAMecanica(m)}
              className="px-2 py-0.5 rounded-full bg-swu-cyan/10 border border-swu-cyan/30
                         text-[10px] font-semibold text-swu-cyan hover:bg-swu-cyan/20 transition-colors"
            >
              {m} → CR {datos.indice[m].def}
            </button>
          ))}
        </div>
      )}

      {/* La nota transicional cambia una regla del CR vigente: se muestra
          SIEMPRE en la carta afectada, sin tener que desplegar nada. */}
      {info.transicion && transicion && (
        <div className="mt-2 rounded-lg border border-swu-amber/35 bg-swu-amber/10 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-swu-amber mb-0.5">
            <AlertTriangle size={11} aria-hidden /> {transicion.titulo}
          </p>
          <p className="text-[11px] text-swu-text leading-snug">{transicion.texto}</p>
        </div>
      )}

      {rulings.length > 0 && (
        <>
          <button
            onClick={() => setAbierta(a => !a)}
            aria-expanded={abierta}
            aria-controls={idPanel}
            className="mt-2 w-full flex items-center gap-1.5 text-left
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent rounded"
          >
            <Gavel size={12} className="text-swu-cyan flex-shrink-0" aria-hidden />
            {/* El plural pierde la tilde: «aclaraciones», no «aclaraciónes». */}
            <span className="text-[11px] font-semibold text-swu-cyan flex-1">
              {rulings.length === 1 ? '1 aclaración oficial' : `${rulings.length} aclaraciones oficiales`}
            </span>
            {abierta
              ? <ChevronDown size={12} className="text-swu-cyan" aria-hidden />
              : <ChevronRight size={12} className="text-swu-cyan/70" aria-hidden />}
          </button>
          {abierta && (
            <div id={idPanel} className="mt-1.5 pl-1 space-y-1.5">
              {rulings.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[10px] font-mono text-swu-cyan/60 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p lang="en" className="text-[11px] text-swu-text/90 leading-relaxed">{r}</p>
                </div>
              ))}
              <p className="text-[10px] text-swu-muted/70 leading-snug pt-1">
                Texto oficial en inglés (es el normativo).
                {fuente && <> Fuente: {fuente} · FFG</>}
                {descargado && <> · descargado <span className="font-mono">{descargado}</span></>}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Recorta un texto alrededor de la PRIMERA coincidencia, no del arranque:
 * en reglas largas la coincidencia podía quedar fuera del fragmento.
 */
function recortarFragmento(crudo: string, tokens: string[]): { frag: string; conToken: boolean } {
  const texto = crudo.replace(/\n/g, ' ')
  if (!texto) return { frag: '', conToken: false }
  const bajo = normalizeSearch(texto)
  let pos = -1
  for (const t of tokens) {
    const p = bajo.indexOf(t)
    if (p >= 0 && (pos < 0 || p < pos)) pos = p
  }
  const inicio = Math.max(0, (pos < 0 ? 0 : pos) - 40)
  const corte = texto.slice(inicio, inicio + 180)
  return {
    frag: (inicio > 0 ? '…' : '') + corte + (inicio + 180 < texto.length ? '…' : ''),
    conToken: pos >= 0,
  }
}

function FilaResultado({
  datos, entrada, trad, idioma, tokens, alTocar,
}: {
  datos: DatosRulings
  entrada: EntradaRegla
  trad: DatosTraducciones | null
  idioma: Idioma
  tokens: string[]
  alTocar: () => void
}) {
  const tr = traduccionDe(trad, entrada.id)

  // El fragmento sale del idioma donde ESTÁ la coincidencia: buscar
  // «derrotar» puede matchear solo en el español, y un fragmento inglés sin
  // resaltado parecería un resultado equivocado. En «ES» manda el español;
  // en «EN»/«Ambos», el inglés — y el otro idioma es el plan B.
  const fragmento = useMemo(() => {
    const es = tr?.texto ?? ''
    const fuentes = idioma === 'es' ? [es, entrada.texto] : [entrada.texto, es]
    let primero = ''
    for (const f of fuentes) {
      if (!f) continue
      const r = recortarFragmento(f, tokens)
      if (r.conToken) return r.frag
      if (!primero) primero = r.frag
    }
    return primero
  }, [entrada.texto, tr, idioma, tokens])

  const titulo = tituloSegunIdioma(entrada.titulo, tr?.titulo, idioma)
    ?? (entrada.padre
      ? tituloSegunIdioma(
        datos.entradas[entrada.padre]?.titulo ?? null,
        traduccionDe(trad, entrada.padre)?.titulo,
        idioma,
      )
      : null)
    ?? ''

  return (
    <button
      onClick={alTocar}
      className="w-full text-left rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5
                 hover:bg-swu-surface-hover active:scale-[0.99] transition-all
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-swu-cyan flex-shrink-0">CR {entrada.id}</span>
        <span className="text-[10px] text-swu-muted/70 uppercase tracking-wider flex-shrink-0">{NOMBRE_TIPO[entrada.tipo]}</span>
        {titulo && (
          <span className="text-[11px] text-swu-muted truncate">
            <Resaltado texto={titulo} tokens={tokens} />
          </span>
        )}
      </div>
      {fragmento && (
        <p className="text-[12px] text-swu-text/85 mt-1 leading-snug">
          <Resaltado texto={fragmento} tokens={tokens} />
        </p>
      )}
    </button>
  )
}

// ─── Detalle de una entrada (capítulo, sección, regla o letra) ───

function DetalleEntrada({
  datos, entrada, sim, trad, idioma, tokens, irARegla, volver,
}: {
  datos: DatosRulings
  entrada: EntradaRegla
  sim: EstadoSimulador | null
  trad: DatosTraducciones | null
  idioma: Idioma
  tokens: string[]
  irARegla: (id: string) => void
  volver: () => void
}) {
  const migas = rutaDeMigas(datos, entrada.id)
  const tr = traduccionDe(trad, entrada.id)
  const tituloVisible = tituloSegunIdioma(entrada.titulo, tr?.titulo, idioma)

  // Si esta regla es el ANCLA de definición de una mecánica del índice, el
  // puente al simulador se muestra acá también (no solo en la vista de chip).
  const mecanicaDeEsta = Object.entries(datos.indice).find(([, v]) => v.def === entrada.id)?.[0]

  // Al navegar entre reglas, volver arriba: el detalle nuevo puede quedar
  // renderizado con el scroll de la regla anterior, a mitad del texto.
  useEffect(() => { window.scrollTo({ top: 0 }) }, [entrada.id])

  return (
    <div>
      {/* Migas: 1 › 1.2 › 1.2.3 */}
      <div className="flex items-center gap-1 flex-wrap mb-3 text-[11px] font-mono">
        <button onClick={volver} className="flex items-center gap-1 text-swu-muted hover:text-swu-text mr-1">
          <ArrowLeft size={12} /> Índice
        </button>
        {migas.map((m, i) => (
          <span key={m.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-swu-muted/40">›</span>}
            {i < migas.length - 1 ? (
              <button onClick={() => irARegla(m.id)} className="text-swu-cyan hover:underline">{m.id}</button>
            ) : (
              <span className="text-swu-text font-bold">{m.id}</span>
            )}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-swu-border bg-swu-surface p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-swu-text leading-tight">
              CR {entrada.id}{tituloVisible ? ` — ${tituloVisible}` : ''}
            </h2>
            <p className="text-[10px] font-mono text-swu-muted mt-0.5">
              {NOMBRE_TIPO[entrada.tipo]} · pág. {entrada.pagina} · CR v{datos.meta.version}
            </p>
          </div>
        </div>

        {entrada.texto && (
          <>
            <Parrafos texto={entrada.texto} textoEs={tr?.texto} idioma={idioma} tokens={tokens} />
            <div className="mt-3">
              <BotonCopiarCita id={entrada.id} texto={entrada.texto} textoEs={tr?.texto} idioma={idioma} />
            </div>
          </>
        )}

        <Referencias datos={datos} trad={trad} idioma={idioma} refs={entrada.refs} irARegla={irARegla} />
      </div>

      {/* Hijos: las letras de una regla van EN la misma lectura; las reglas
          de una sección también (leer una sección entera es el caso de uso);
          de un capítulo solo se listan sus secciones. */}
      {entrada.tipo === 'capitulo' ? (
        <div className="mt-3 space-y-1.5">
          {entrada.hijos.map(h => {
            const s = datos.entradas[h]
            return (
              <button
                key={h}
                onClick={() => irARegla(h)}
                className="w-full flex items-center gap-2 rounded-xl border border-swu-border bg-swu-surface
                           px-3 py-2.5 text-left hover:bg-swu-surface-hover transition-colors"
              >
                <span className="font-mono text-[11px] font-bold text-swu-cyan">{h}</span>
                <span className="text-xs text-swu-text flex-1 truncate">
                  {tituloSegunIdioma(s?.titulo ?? null, traduccionDe(trad, h)?.titulo, idioma)}
                </span>
                <ChevronRight size={14} className="text-swu-muted flex-shrink-0" />
              </button>
            )
          })}
        </div>
      ) : (
        entrada.hijos.length > 0 && (
          <div className="mt-3 space-y-2">
            {entrada.hijos.map(h => {
              const hijo = datos.entradas[h]
              if (!hijo) return null
              const trHijo = traduccionDe(trad, h)
              const tituloHijo = tituloSegunIdioma(hijo.titulo, trHijo?.titulo, idioma)
              return (
                <div key={h} className="rounded-xl border border-swu-border bg-swu-surface p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <button onClick={() => irARegla(h)} className="font-mono text-[11px] font-bold text-swu-cyan hover:underline text-left">
                      CR {h}{tituloHijo ? ` — ${tituloHijo}` : ''}
                    </button>
                  </div>
                  {hijo.texto && <Parrafos texto={hijo.texto} textoEs={trHijo?.texto} idioma={idioma} tokens={tokens} />}
                  {/* Nietos (las letras de una regla dentro de una sección) */}
                  {hijo.hijos.map(n => {
                    const nieto = datos.entradas[n]
                    if (!nieto?.texto) return null
                    return (
                      <div key={n} className="mt-2 pl-3 border-l-2 border-swu-border">
                        <button onClick={() => irARegla(n)} className="font-mono text-[10px] font-bold text-swu-cyan/80 hover:underline">
                          {n}
                        </button>
                        <Parrafos texto={nieto.texto} textoEs={traduccionDe(trad, n)?.texto} idioma={idioma} tokens={tokens} />
                      </div>
                    )
                  })}
                  <Referencias datos={datos} trad={trad} idioma={idioma} refs={hijo.refs} irARegla={irARegla} />
                </div>
              )
            })}
          </div>
        )
      )}

      {mecanicaDeEsta && <PuenteSimulador sim={sim} mecanica={mecanicaDeEsta} />}
    </div>
  )
}

/** Referencias cruzadas («See 8.16. Modifiers») como enlaces tocables. */
function Referencias({ datos, trad, idioma, refs, irARegla }: {
  datos: DatosRulings
  trad: DatosTraducciones | null
  idioma: Idioma
  refs: string[]
  irARegla: (id: string) => void
}) {
  if (refs.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      <span className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60">Ver también</span>
      {refs.map(r => {
        // En el chip, con UN idioma alcanza («Ambos» duplicaría el largo):
        // el español si se está leyendo español, el inglés en el resto.
        const titulo = idioma === 'es'
          ? traduccionDe(trad, r)?.titulo ?? datos.entradas[r]?.titulo
          : datos.entradas[r]?.titulo
        return (
          <button
            key={r}
            onClick={() => irARegla(r)}
            className="px-2 py-0.5 rounded-full bg-swu-bg border border-swu-border text-[10px] font-mono
                       text-swu-cyan hover:bg-swu-surface-hover transition-colors"
          >
            {r}{titulo ? ` ${titulo}` : ''}
          </button>
        )
      })}
    </div>
  )
}

// ─── Detalle de una mecánica (chip del índice) ───

function DetalleMecanica({
  datos, mecanica, sim, trad, idioma, irARegla, volver,
}: {
  datos: DatosRulings
  mecanica: string
  sim: EstadoSimulador | null
  trad: DatosTraducciones | null
  idioma: Idioma
  irARegla: (id: string) => void
  volver: () => void
}) {
  const info = datos.indice[mecanica]
  const def = datos.entradas[info.def]
  const trDef = traduccionDe(trad, info.def)
  const relacionadas = [...info.reglas].sort(compararIds).filter(r => r !== info.def)

  return (
    <div>
      <button onClick={volver} className="flex items-center gap-1 text-[11px] font-mono text-swu-muted hover:text-swu-text mb-3">
        <ArrowLeft size={12} /> Índice
      </button>

      <div className="rounded-xl border border-swu-cyan/30 bg-swu-surface p-4">
        <h2 className="text-base font-extrabold text-swu-cyan leading-tight mb-0.5">{mecanica}</h2>
        <p className="text-[10px] font-mono text-swu-muted mb-2.5">Definida en CR {info.def} · pág. {def?.pagina}</p>
        {def?.texto
          ? <Parrafos texto={def.texto} textoEs={trDef?.texto} idioma={idioma} />
          : (
            // Algunas anclas son reglas contenedoras sin párrafo propio: el
            // texto vive en sus letras.
            def && def.hijos.length > 0 && (
              <div className="space-y-2">
                {def.hijos.map(h => {
                  const hijo = datos.entradas[h]
                  return hijo?.texto
                    ? <Parrafos key={h} texto={hijo.texto} textoEs={traduccionDe(trad, h)?.texto} idioma={idioma} />
                    : null
                })}
              </div>
            )
          )}
        <div className="mt-3 flex items-center gap-2">
          {def?.texto && <BotonCopiarCita id={info.def} texto={def.texto} textoEs={trDef?.texto} idioma={idioma} />}
          <button onClick={() => irARegla(info.def)} className="text-[11px] font-mono text-swu-cyan hover:underline">
            Abrir CR {info.def} completa →
          </button>
        </div>
      </div>

      <PuenteSimulador sim={sim} mecanica={mecanica} />

      {relacionadas.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-1.5 px-1">
            {relacionadas.length} reglas que la mencionan
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {relacionadas.map(r => (
              <button
                key={r}
                onClick={() => irARegla(r)}
                className="px-2.5 py-1 rounded-lg bg-swu-surface border border-swu-border text-[11px]
                           font-mono text-swu-text hover:bg-swu-surface-hover transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Estado del formato: suspendidas + nota transicional ───

/**
 * Formatos sobre los que se afirma algo.
 *
 * La lista de suspendidas de FFG es ÚNICA y cubre todos los formatos, así que
 * un formato que no aparece en ella tiene cero cartas suspendidas. Por eso se
 * puede escribir «Premier: ninguna» — y hay que escribirlo: el silencio no
 * distingue «lo miramos y está limpio» de «no lo miramos». Premier es donde
 * juega casi todo el mundo y es justo el que hoy no tiene ninguna.
 *
 * Un formato que aparezca en los datos y no esté acá se muestra igual (ver
 * abajo): que salga un formato nuevo no puede hacer desaparecer sus cartas.
 */
const FORMATOS_VIGILADOS = ['Premier', 'Eternal']

function EstadoDelFormato({ datos }: { datos: DatosRulingsCartas }) {
  const suspendidas = datos.suspendidas ?? []
  // Los declarados primero y en orden fijo; después cualquier formato que los
  // datos traigan y la constante no conozca.
  const formatos = [
    ...FORMATOS_VIGILADOS,
    ...[...new Set(suspendidas.map(s => s.formato))].filter(f => !FORMATOS_VIGILADOS.includes(f)),
  ]

  return (
    <div className="rounded-xl border border-swu-border bg-swu-surface p-3.5 mb-2 space-y-3">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 mb-2">
          <Ban size={11} className="text-swu-red" aria-hidden /> Cartas suspendidas
        </p>
        <div className="space-y-1.5">
          {formatos.map(f => {
            const enFormato = suspendidas.filter(s => s.formato === f)
            return (
              <div key={f} className="flex items-start gap-2.5">
                <span className="text-[11px] font-bold text-swu-text w-16 flex-shrink-0">{f}</span>
                {enFormato.length === 0 ? (
                  <span className="text-[11px] text-swu-green">Ninguna</span>
                ) : (
                  <span className="text-[11px] text-swu-red leading-snug">
                    {enFormato.map((s, i) => (
                      <span key={`${s.set}-${s.num}`}>
                        {i > 0 && ' · '}
                        {s.nombre}{' '}
                        <span className="font-mono text-swu-muted/70">{s.set} {s.num}</span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {datos.transicion && (
        <div className="rounded-lg border border-swu-amber/35 bg-swu-amber/10 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-swu-amber mb-1">
            <AlertTriangle size={11} aria-hidden /> {datos.transicion.titulo}
          </p>
          <p className="text-[11px] text-swu-text leading-snug">{datos.transicion.texto}</p>
          {datos.transicion.afecta.length > 0 && (
            <p className="text-[10px] text-swu-muted mt-1.5">
              Afecta a{' '}
              <span className="font-mono text-swu-amber">{datos.transicion.afecta.join(' · ')}</span>
              {' '}— buscá la carta acá arriba para verla en su ficha.
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-swu-muted/70 leading-snug">
        {datos.meta.cartasConRulings} cartas con aclaraciones oficiales ({datos.meta.rulingsTotales} en total).
        Fuente: {datos.meta.fuente} · Fantasy Flight Games · descargado{' '}
        <span className="font-mono">{datos.meta.descargado}</span>.
      </p>
    </div>
  )
}

// ─── Índice navegable (árbol de capítulos) ───

function ArbolIndice({
  datos, cartasCR, trad, idioma, abiertos, alternar, glosarioAbierto, setGlosarioAbierto, irARegla,
}: {
  datos: DatosRulings
  cartasCR: DatosRulingsCartas | null
  trad: DatosTraducciones | null
  idioma: Idioma
  abiertos: Set<string>
  alternar: (id: string) => void
  glosarioAbierto: boolean
  setGlosarioAbierto: (v: boolean) => void
  irARegla: (id: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {/* ── Estado del formato: lo que cambió DESPUÉS del PDF ──
          Va arriba del índice a propósito. El CR es un documento fijo; estas
          dos cosas (qué está suspendido, qué regla ya no aplica) son las que
          lo dejan desactualizado, y son justo las que nadie va a encontrar
          navegando capítulos. */}
      {cartasCR && <EstadoDelFormato datos={cartasCR} />}

      <h3 className="text-[10px] font-mono tracking-[0.2em] uppercase text-swu-muted/60 px-1 pt-1">
        Índice · {datos.meta.totales.reglas} reglas en {datos.meta.totales.secciones} secciones
      </h3>

      {datos.capitulos.map(c => {
        const cap = datos.entradas[c]
        if (!cap) return null
        const abierto = abiertos.has(c)
        return (
          <div key={c} className="rounded-xl border border-swu-border bg-swu-surface overflow-hidden">
            <button
              onClick={() => alternar(c)}
              className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-swu-surface-hover transition-colors"
            >
              {abierto
                ? <ChevronDown size={14} className="text-swu-cyan flex-shrink-0" />
                : <ChevronRight size={14} className="text-swu-muted flex-shrink-0" />}
              <span className="font-mono text-[11px] font-bold text-swu-cyan w-5 flex-shrink-0">{c}</span>
              <span className="text-xs font-semibold text-swu-text flex-1 truncate">
                {tituloSegunIdioma(cap.titulo, traduccionDe(trad, c)?.titulo, idioma)}
              </span>
              <span className="text-[10px] font-mono text-swu-muted/60 flex-shrink-0">{cap.hijos.length}</span>
            </button>

            {abierto && (
              <div className="border-t border-swu-border">
                {cap.hijos.map(s => {
                  const sec = datos.entradas[s]
                  if (!sec) return null
                  const secAbierta = abiertos.has(s)
                  return (
                    <div key={s}>
                      <button
                        onClick={() => alternar(s)}
                        className="w-full flex items-center gap-2 pl-7 pr-3 py-2 text-left hover:bg-swu-surface-hover transition-colors"
                      >
                        {secAbierta
                          ? <ChevronDown size={12} className="text-swu-cyan flex-shrink-0" />
                          : <ChevronRight size={12} className="text-swu-muted/60 flex-shrink-0" />}
                        <span className="font-mono text-[10px] text-swu-cyan/80 flex-shrink-0">{s}</span>
                        <span className="text-[11px] text-swu-text truncate">
                          {tituloSegunIdioma(sec.titulo, traduccionDe(trad, s)?.titulo, idioma)}
                        </span>
                      </button>
                      {secAbierta && sec.hijos.map(r => {
                        const regla = datos.entradas[r]
                        if (!regla) return null
                        const trR = traduccionDe(trad, r)
                        // Sin título propio, la primera línea del texto hace
                        // de resumen — en el idioma que se está leyendo.
                        const resumen = tituloSegunIdioma(regla.titulo, trR?.titulo, idioma)
                          ?? (idioma === 'es' && trR?.texto ? trR.texto : regla.texto).split('\n')[0].slice(0, 70)
                        return (
                          <button
                            key={r}
                            onClick={() => irARegla(r)}
                            className="w-full flex items-baseline gap-2 pl-12 pr-3 py-1.5 text-left hover:bg-swu-surface-hover transition-colors"
                          >
                            <span className="font-mono text-[10px] text-swu-muted flex-shrink-0">{r}</span>
                            <span className="text-[11px] text-swu-muted truncate">{resumen}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Glosario derivado (cap. 8 + keywords de 7.5): atajo alfabético */}
      <div className="rounded-xl border border-swu-border bg-swu-surface overflow-hidden">
        <button
          onClick={() => setGlosarioAbierto(!glosarioAbierto)}
          className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-swu-surface-hover transition-colors"
        >
          {glosarioAbierto
            ? <ChevronDown size={14} className="text-swu-cyan flex-shrink-0" />
            : <ChevronRight size={14} className="text-swu-muted flex-shrink-0" />}
          <span className="text-xs font-semibold text-swu-text flex-1">Glosario de términos</span>
          <span className="text-[10px] font-mono text-swu-muted/60">{datos.glosario.length}</span>
        </button>
        {glosarioAbierto && (
          <div className="border-t border-swu-border p-3 flex flex-wrap gap-1.5">
            {datos.glosario.map(g => (
              <button
                key={`${g.termino}-${g.id}`}
                onClick={() => irARegla(g.id)}
                className="px-2 py-1 rounded-full bg-swu-bg border border-swu-border text-[10px]
                           text-swu-muted hover:text-swu-text transition-colors"
              >
                {g.termino}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
