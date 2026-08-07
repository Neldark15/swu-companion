/**
 * RULLINGS — servicio de las Comprehensive Rules oficiales.
 *
 * Los datos viajan CON la app: `public/datos-cr/index.json` (303 KB, generado
 * por scripts/build-rulings.py desde el PDF oficial de FFG) se baja UNA vez
 * y se cachea en memoria. No hay API, no hay IA, no hay red después de la
 * primera carga: un juez en un torneo con mal internet sigue pudiendo citar
 * una regla.
 *
 * El texto NORMATIVO de las reglas sigue siendo el inglés tal cual viene del
 * documento. Desde v8.0 viaja además `public/datos-cr/es.json` (246 KB, 935
 * traducciones validadas contra glosario oficial): una traducción DE CORTESÍA
 * que se carga EN PARALELO con el índice y es mejora progresiva — si falta o
 * falla, el módulo entero sigue funcionando solo en inglés.
 *
 * Y desde v8.0 viaja un TERCER archivo, `public/datos-cr/cartas.json` (461 KB):
 * las aclaraciones oficiales POR CARTA (978 cartas, 1.638 rulings) que FFG
 * publica en `api.swuapi.com` como `additionalRulings`, más la lista de cartas
 * suspendidas y la nota transicional CR8→CR9. Mismo trato que la traducción:
 * se pide EN PARALELO, nunca en cascada, y si falla resuelve `null` sin
 * arrastrar a nadie.
 */

import { normalizeSearch, searchCards } from './swuApi'
import type { Card } from '../types'

// ─── Tipos del JSON (la forma exacta que emite build-rulings.py) ───

export type TipoEntrada = 'capitulo' | 'seccion' | 'regla' | 'letra'

export interface EntradaRegla {
  id: string
  tipo: TipoEntrada
  /** Los capítulos y secciones siempre lo traen; reglas y letras casi nunca. */
  titulo: string | null
  /** Párrafos separados por \n. Vacío en capítulos y secciones. */
  texto: string
  pagina: number
  padre: string | null
  hijos: string[]
  /** Ids válidos detectados en «See 8.16. Modifiers», «specified in 11.3», etc. */
  refs: string[]
}

export interface MetaRulings {
  titulo: string
  version: string
  fecha: string
  fechaTexto: string
  idiomaReglas: string
  fuente: string
  pdf: string
  copyright: string
  generado: string
  introduccion: string
  totales: { capitulos: number; secciones: number; reglas: number; letras: number; refs: number }
}

export interface MecanicaIndexada {
  /** Regla que la define (ancla del detalle). */
  def: string
  /** Toda regla que la menciona. */
  reglas: string[]
}

export interface DatosRulings {
  meta: MetaRulings
  capitulos: string[]
  entradas: Record<string, EntradaRegla>
  indice: Record<string, MecanicaIndexada>
  glosario: { termino: string; id: string }[]
}

// ─── Traducción de cortesía (public/datos-cr/es.json) ───

export interface TraduccionEntrada {
  titulo: string | null
  texto: string
}

export interface DatosTraducciones {
  meta: { version: string; idioma: string; aviso: string }
  traducciones: Record<string, TraduccionEntrada>
}

// ─── Estado del simulador por mecánica (public/datos-cr/simulador.json) ───

export type EstadoModelado = 'modelada' | 'parcial' | 'no'

export interface EstadoSimulador {
  fuente: string
  nota: string
  generado: string
  mecanicas: Record<string, { estado: EstadoModelado; nota: string }>
}

// ─── Carga (una vez, cacheada en memoria) ───

let _promesaDatos: Promise<DatosRulings> | null = null

export function cargarRulings(): Promise<DatosRulings> {
  if (!_promesaDatos) {
    _promesaDatos = fetch('/datos-cr/index.json')
      .then(r => {
        if (!r.ok) throw new Error(`rulings/index.json → HTTP ${r.status}`)
        return r.json() as Promise<DatosRulings>
      })
      .catch(err => {
        // Se limpia la promesa para que «Reintentar» de la pantalla vuelva a
        // pedir el archivo en vez de re-lanzar el mismo error cacheado.
        _promesaDatos = null
        throw err
      })
  }
  return _promesaDatos
}

let _promesaTrad: Promise<DatosTraducciones | null> | null = null

/**
 * La traducción es OPCIONAL y se pide EN PARALELO con el índice (la pantalla
 * dispara las dos cargas en el mismo efecto; ninguna espera a la otra). Si el
 * archivo falta, está roto o no hay red, resuelve `null` y el módulo sigue
 * completo en inglés: mejora progresiva, no dependencia.
 */
export function cargarTraducciones(): Promise<DatosTraducciones | null> {
  if (!_promesaTrad) {
    _promesaTrad = fetch('/datos-cr/es.json')
      .then(r => (r.ok ? (r.json() as Promise<DatosTraducciones>) : null))
      .then(d => {
        // Validación mínima de forma: un JSON truncado o ajeno no puede
        // reventar la pantalla — simplemente no hay traducción.
        if (!d || typeof d !== 'object' || typeof d.traducciones !== 'object' || !d.traducciones) return null
        return d
      })
      .catch(() => null)
      .then(soltarSiFallo(() => { _promesaTrad = null }))
  }
  return _promesaTrad
}

/**
 * Si la carga opcional resolvió `null`, se suelta la promesa cacheada.
 *
 * `cargarRulings` ya limpiaba `_promesaDatos` en su `.catch` para que
 * «Reintentar» sirviera de algo; las tres cargas opcionales no, y cacheaban el
 * `null` **para toda la sesión**. Un 502 momentáneo de Vercel al pedir
 * `cartas.json` dejaba las 1.638 aclaraciones por carta apagadas hasta recargar
 * la app, y el botón «Reintentar» de la pantalla no las recuperaba. Peor: con
 * el índice en null, `rulingsDeCarta()` devuelve `null`, que la UI lee como
 * «esta carta no tiene aclaraciones» — un silencio que se lee como un hecho.
 */
function soltarSiFallo<T>(soltar: () => void): (v: T | null) => T | null {
  return (v) => { if (v === null) soltar(); return v }
}

/**
 * Traducción de una entrada por id. `Object.hasOwn` por la misma razón que
 * en la pantalla: un id venido de la URL (`?regla=__proto__`) no puede
 * alcanzar propiedades heredadas del prototipo.
 */
export function traduccionDe(trad: DatosTraducciones | null, id: string): TraduccionEntrada | null {
  if (!trad || !Object.hasOwn(trad.traducciones, id)) return null
  return trad.traducciones[id]
}

let _promesaSim: Promise<EstadoSimulador | null> | null = null

/**
 * El puente al simulador es OPCIONAL: si el archivo falta o está roto, el
 * módulo de reglas sigue completo y simplemente no se muestra la sección.
 */
export function cargarSimulador(): Promise<EstadoSimulador | null> {
  if (!_promesaSim) {
    _promesaSim = fetch('/datos-cr/simulador.json')
      .then(r => (r.ok ? (r.json() as Promise<EstadoSimulador>) : null))
      .catch(() => null)
      .then(soltarSiFallo(() => { _promesaSim = null }))
  }
  return _promesaSim
}

// ─── Aclaraciones oficiales POR CARTA (public/datos-cr/cartas.json) ───

/** Una carta retirada del formato. `num` viene numérico en el JSON. */
export interface CartaSuspendida {
  nombre: string
  set: string
  num: number
  /** 'Premier', 'Eternal'… El formato del que está fuera. */
  formato: string
}

/** Nota de FFG que cambia una regla del CR vigente antes de que salga el CR nuevo. */
export interface NotaTransicion {
  titulo: string
  texto: string
  /** Cartas a las que aplica, como «SET NUM» («ASH 161»). */
  afecta: string[]
}

export interface EntradaRulingsCarta {
  nombre: string
  set: string
  /** Número impreso, como cadena («1», «161»). */
  num: string
  /** TODAS las impresiones de la carta, empezando por la canónica. */
  ids: string[]
  /** Texto oficial, en inglés — es el normativo. */
  rulings: string[]
}

export interface MetaRulingsCartas {
  fuente: string
  descargado: string
  cartasConRulings: number
  rulingsTotales: number
}

export interface DatosRulingsCartas {
  meta: MetaRulingsCartas
  suspendidas: CartaSuspendida[]
  transicion: NotaTransicion
  /** Clavado por uuid CANÓNICO — ver `_indiceIds` para resolver variantes. */
  porId: Record<string, EntradaRulingsCarta>
}

/**
 * Índice invertido id → uuid canónico, construido UNA vez al cargar.
 *
 * `porId` está clavado por el uuid canónico de cada carta, pero una carta
 * tiene varias impresiones (Standard, Hyperspace, Foil, Showcase…) y el id que
 * llega desde cualquier pantalla es el de LA impresión que la persona está
 * mirando. Sin este índice, abrir la Hyperspace de The Armorer no encontraba
 * sus 5 aclaraciones: son 4.095 ids apuntando a 978 cartas, y solo 978 de
 * ellos son clave en `porId`.
 */
let _indiceIds: Map<string, string> | null = null

function construirIndice(d: DatosRulingsCartas): Map<string, string> {
  const m = new Map<string, string>()
  for (const [canonico, entrada] of Object.entries(d.porId)) {
    // El canónico primero: si un id apareciera en dos entradas (no pasa hoy,
    // medido, pero el API puede cambiar), la clave manda sobre la variante.
    m.set(canonico, canonico)
    for (const id of entrada.ids) if (!m.has(id)) m.set(id, canonico)
  }
  return m
}

let _promesaCartas: Promise<DatosRulingsCartas | null> | null = null

/**
 * Las aclaraciones por carta son OPCIONALES y se piden EN PARALELO con el
 * índice y la traducción (la pantalla dispara las cargas en el mismo efecto).
 * Si el archivo falta, está truncado o no hay red, resuelve `null`: el módulo
 * de reglas y las fichas de carta siguen enteros, simplemente sin la sección.
 */
export function cargarRulingsCartas(): Promise<DatosRulingsCartas | null> {
  if (!_promesaCartas) {
    _promesaCartas = fetch('/datos-cr/cartas.json')
      .then(r => (r.ok ? (r.json() as Promise<DatosRulingsCartas>) : null))
      .then(d => {
        // Validación mínima de forma: un JSON truncado o ajeno no puede
        // reventar una ficha de carta.
        if (!d || typeof d !== 'object' || !d.porId || typeof d.porId !== 'object') return null
        _indiceIds = construirIndice(d)
        return d
      })
      .catch(() => null)
      .then(soltarSiFallo(() => { _promesaCartas = null }))
  }
  return _promesaCartas
}

/** Referencia impresa de una carta. Ver `rulingsDeCarta` para qué resuelve. */
export interface RefImpresa {
  setCode: string
  setNumber: number
}

export interface AclaracionesDeCarta {
  /** Texto oficial en inglés. Vacío si la carta no tiene ninguna. */
  rulings: string[]
  /** La nota CR8→CR9 solo cuando afecta a ESTA carta; si no, `null`. */
  transicion: NotaTransicion | null
  /** Suspensión vigente de esta carta, si la hay. */
  suspendida: CartaSuspendida | null
  /** De dónde salen y cuándo se bajaron — para la atribución visible. */
  meta: MetaRulingsCartas
}

/** «ASH 161», «ash 0161» → «ASH 161». */
function claveImpresa(setCode: string, num: string | number): string {
  const n = String(num).trim().replace(/^0+(?=\d)/, '')
  return `${setCode.trim().toUpperCase()} ${n}`
}

/**
 * Todo lo oficial que hay que decir sobre UNA carta.
 *
 * Devuelve `null` cuando no hay nada que mostrar — que es la mayoría: 978 de
 * las 9.057 impresiones tienen aclaraciones, así que dibujar «sin aclaraciones»
 * en las otras 8.000 sería puro ruido. Quien llama pinta la sección solo si
 * esto viene distinto de `null`.
 *
 * `ref` (set + número impreso) es opcional y resuelve lo que el id NO puede:
 * la nota transicional y la suspensión están clavadas por «SET NUM», y la
 * carta que afecta la nota (ASH 161) no tiene rulings propios, o sea que ni
 * siquiera aparece en `porId`. Se pasa desde la ficha, que ya tiene la carta
 * cargada — pedirla acá dispararía una consulta a Dexie por cada apertura.
 */
export async function rulingsDeCarta(
  cardId: string,
  ref?: RefImpresa,
): Promise<AclaracionesDeCarta | null> {
  const d = await cargarRulingsCartas()
  if (!d) return null

  const canonico = _indiceIds?.get(cardId)
  const rulings = canonico ? (d.porId[canonico]?.rulings ?? []) : []

  const clave = ref ? claveImpresa(ref.setCode, ref.setNumber) : null
  const transicion = clave && d.transicion?.afecta?.some(a => claveImpresa(...partirClave(a)) === clave)
    ? d.transicion
    : null
  const suspendida = clave
    ? (d.suspendidas?.find(s => claveImpresa(s.set, s.num) === clave) ?? null)
    : null

  if (rulings.length === 0 && !transicion && !suspendida) return null
  return { rulings, transicion, suspendida, meta: d.meta }
}

/** «ASH 161» → ['ASH', '161']. Lo que no tenga esa forma no matchea nada. */
function partirClave(a: string): [string, string] {
  const i = a.trim().lastIndexOf(' ')
  return i < 0 ? [a.trim(), ''] : [a.slice(0, i), a.slice(i + 1)]
}

/** Suspensión de una carta por su referencia impresa (para el buscador de /rulings). */
export function suspensionDe(
  d: DatosRulingsCartas | null,
  setCode: string,
  setNumber: number,
): CartaSuspendida | null {
  if (!d?.suspendidas) return null
  const clave = claveImpresa(setCode, setNumber)
  return d.suspendidas.find(s => claveImpresa(s.set, s.num) === clave) ?? null
}

/** ¿La nota transicional CR8→CR9 aplica a esta carta? */
export function transicionAplicaA(
  d: DatosRulingsCartas | null,
  setCode: string,
  setNumber: number,
): boolean {
  if (!d?.transicion?.afecta) return false
  const clave = claveImpresa(setCode, setNumber)
  return d.transicion.afecta.some(a => claveImpresa(...partirClave(a)) === clave)
}

// ─── Búsqueda ───

/**
 * ¿La consulta es un número de regla? «7.4.2», «1.5.6a», «8.1 » → id
 * normalizado (la letra en MAYÚSCULA, que es el formato de cita oficial).
 * Devuelve null si no tiene forma de id — la existencia la comprueba quien
 * llama contra `entradas`.
 */
export function comoIdDeRegla(consulta: string): string | null {
  const limpio = consulta.trim()
  const m = /^(\d+(?:\.\d+)*)\s*([a-zA-Z])?$/.exec(limpio)
  if (!m) return null
  return m[2] ? `${m[1]}${m[2].toUpperCase()}` : m[1]
}

export interface ResultadoBusqueda {
  entrada: EntradaRegla
  puntaje: number
}

/**
 * Blobs normalizados por entrada, calculados UNA vez en la primera búsqueda.
 * Normalizar 935 textos por tecleo (aun con debounce) es trabajo repetido
 * que se nota en un teléfono de gama baja.
 */
let _blobs: Map<string, { t: string; b: string }> | null = null
/** Con qué traducción se construyeron los blobs: cuando es.json llega (una
 *  vez, de null → datos) se reconstruyen para que la búsqueda cubra los dos
 *  idiomas sin recalcular nada por tecleo. */
let _blobsTrad: DatosTraducciones | null = null

function blobsDe(datos: DatosRulings, trad: DatosTraducciones | null): Map<string, { t: string; b: string }> {
  if (!_blobs || _blobsTrad !== trad) {
    _blobs = new Map()
    _blobsTrad = trad
    for (const [id, e] of Object.entries(datos.entradas)) {
      const tr = traduccionDe(trad, id)
      _blobs.set(id, {
        // EN + ES concatenados en el MISMO blob: «derrotar» encuentra la
        // regla de defeat con el mismo puntaje que si buscara en inglés
        // (normalizeSearch ya pliega los acentos: «háganlo» ≈ «haganlo»).
        t: normalizeSearch([e.titulo ?? '', tr?.titulo ?? ''].filter(Boolean).join(' ')),
        b: normalizeSearch([e.texto, tr?.texto ?? ''].filter(Boolean).join(' ')),
      })
    }
  }
  return _blobs
}

/**
 * Búsqueda local por texto libre sobre título + cuerpo de las 935 entradas,
 * EN LOS DOS IDIOMAS cuando la traducción está cargada: «derrotar» encuentra
 * la regla de defeated aunque el texto normativo diga defeat.
 *
 * Reglas del puntaje, de la más a la menos valiosa: frase exacta en el
 * título, frase exacta en el cuerpo, token suelto en el título, token suelto
 * en el cuerpo. TODOS los tokens tienen que aparecer (en título o cuerpo):
 * con «or» implícito, buscar «attack base» devolvía media biblia.
 */
export function buscarEnReglas(
  datos: DatosRulings,
  consulta: string,
  trad: DatosTraducciones | null = null,
  limite = 40,
): ResultadoBusqueda[] {
  const frase = normalizeSearch(consulta)
  if (!frase) return []
  const tokens = frase.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const blobs = blobsDe(datos, trad)
  const resultados: ResultadoBusqueda[] = []

  for (const [id, e] of Object.entries(datos.entradas)) {
    // Los capítulos y secciones no llevan texto: solo cuentan si el título
    // coincide (p. ej. buscar «combat» encuentra la sección COMBAT).
    const { t, b } = blobs.get(id)!
    if (!t && !b) continue

    let puntaje = 0
    let todos = true
    for (const tok of tokens) {
      const enTitulo = t.includes(tok)
      const enCuerpo = b.includes(tok)
      if (!enTitulo && !enCuerpo) { todos = false; break }
      if (enTitulo) puntaje += 5
      if (enCuerpo) puntaje += 1
    }
    if (!todos) continue

    if (tokens.length > 1) {
      if (t.includes(frase)) puntaje += 8
      if (b.includes(frase)) puntaje += 3
    }
    // Las reglas y letras son la respuesta útil (texto citable); un título de
    // sección solo es mejor cuando coincide de lleno.
    if (e.tipo === 'regla' || e.tipo === 'letra') puntaje += 2

    resultados.push({ entrada: e, puntaje })
  }

  resultados.sort((a, b) => b.puntaje - a.puntaje || compararIds(a.entrada.id, b.entrada.id))
  return resultados.slice(0, limite)
}

/** Orden natural de ids de regla: 1.2 < 1.10, 7.5.11A < 7.5.11B. */
export function compararIds(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const xa = pa[i] ?? ''
    const xb = pb[i] ?? ''
    if (xa === xb) continue
    const na = parseInt(xa, 10)
    const nb = parseInt(xb, 10)
    if (na !== nb) return na - nb
    // Mismo número, distinta letra (7.5.11A vs 7.5.11B)
    return xa.localeCompare(xb)
  }
  return 0
}

/** Cadena de ancestros de una entrada, de la raíz hacia abajo (para migas). */
export function rutaDeMigas(datos: DatosRulings, id: string): EntradaRegla[] {
  const ruta: EntradaRegla[] = []
  let actual: EntradaRegla | undefined = datos.entradas[id]
  while (actual) {
    ruta.unshift(actual)
    actual = actual.padre ? datos.entradas[actual.padre] : undefined
  }
  return ruta
}

// ─── Puente carta → mecánicas ───

export interface CartaConMecanicas {
  carta: Card
  /** Nombres de mecánicas del índice presentes en la carta (keywords o texto). */
  mecanicas: string[]
  /** Aclaraciones oficiales de FFG para esta carta, en inglés. Casi siempre vacío. */
  rulings: string[]
  /** Suspendida en algún formato, si aplica. */
  suspendida: CartaSuspendida | null
  /** La nota transicional CR8→CR9 le pega a esta carta. */
  transicion: boolean
}

/**
 * Resuelve un nombre de carta contra la base LOCAL de Dexie (las mismas
 * 9,057 filas del buscador) y devuelve qué mecánicas del índice usa cada
 * una. Con eso la pantalla enlaza «Fireball → Ambush, Overwhelm» a las
 * reglas correspondientes sin tocar la red.
 *
 * Ojo: la primera vez en un dispositivo virgen esto puede disparar la
 * descarga de la base de cartas (searchCards espera a que esté completa).
 * Por eso la pantalla lo trata como resultado SECUNDARIO y asincrónico: la
 * búsqueda de reglas nunca espera a las cartas.
 */
export async function cartasConMecanicas(
  datos: DatosRulings,
  consulta: string,
  limite = 4,
): Promise<CartaConMecanicas[]> {
  // Las dos fuentes salen a la vez: el archivo de aclaraciones no espera a que
  // Dexie resuelva la búsqueda ni al revés (y las dos están cacheadas, así que
  // a partir de la segunda consulta esto no cuesta nada).
  const [{ cards }, porCarta] = await Promise.all([
    searchCards({ query: consulta, limit: limite, canonicalOnly: true }),
    cargarRulingsCartas(),
  ])
  const mecanicas = Object.keys(datos.indice)

  return cards.map(carta => {
    const kws = new Set(carta.keywords.map(k => normalizeSearch(k)))
    const texto = normalizeSearch(carta.text)
    const presentes = mecanicas.filter(m => {
      const nm = normalizeSearch(m)
      // La keyword es señal directa; el texto atrapa mecánicas que no son
      // keyword (Shield, Experience, Epic Action, Indirect Damage…).
      return kws.has(nm) || texto.includes(nm)
    })
    const canonico = _indiceIds?.get(carta.id)
    return {
      carta,
      mecanicas: presentes,
      rulings: canonico && porCarta ? (porCarta.porId[canonico]?.rulings ?? []) : [],
      suspendida: suspensionDe(porCarta, carta.setCode, carta.setNumber),
      transicion: transicionAplicaA(porCarta, carta.setCode, carta.setNumber),
    }
  })
}
