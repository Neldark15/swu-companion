/**
 * REJILLA DE DISPONIBILIDAD — «¿cuándo podés jugar?»
 *
 * De este dato cuelga el armado de grupos entero: si es odioso de llenar, la
 * gente marca cualquier cosa con tal de pasar de pantalla y el cálculo queda
 * envenenado con horas mentira. Así que el control tiene que resolver el caso
 * normal en dos toques y solo entonces dejar afinar.
 *
 * ── 168 por dentro, 28 por fuera ──────────────────────────────────────
 *
 * El servidor guarda 168 caracteres '0'/'1' = 7 días × 24 horas en HORA LOCAL
 * DE PARED, arrancando el LUNES a las 00:00 (índice = dia*24 + hora). Esa es
 * la unidad del motor y no se toca.
 *
 * La pantalla NO enseña 168 casillas: enseña 28 —7 días × madrugada / mañana /
 * tarde / noche— y las expande al guardar. 168 casillas en un teléfono son un
 * formulario que nadie termina; 28 más presets caben en una mano.
 *
 * La proyección es LOSSY a propósito y por eso `aBloques` decide por MAYORÍA
 * (≥3 de las 6 horas): con «alguna hora» una franja suelta pintaba seis al
 * volver a guardar, y con «todas» una franja a medias se borraba sola al
 * abrir la pantalla. Con mayoría, lo que escribió esta rejilla vuelve igual
 * —que es el 100 % de los datos reales— y lo de fuera se redondea a lo que
 * más se le parece, no a cero.
 *
 * ── La zona es una SUGERENCIA, no un veredicto ────────────────────────
 *
 * `Intl` se prellena, pero el aparato miente: §3d documenta un Pixel 8
 * reportando `platform` «MacIntel». Y España tiene dos husos, así que ni
 * siquiera «está en España» alcanza. Por eso la zona se puede cambiar a mano
 * (pasá `zona` + `onZona` y la rejilla enseña el desplegable).
 *
 * Esta rejilla NO guarda: solo llama `onCambio` con los 168 caracteres. Quien
 * la monta decide cuándo llamar a `guardarDisponibilidad`.
 */

/* eslint-disable react-refresh/only-export-components --
   Las cuatro funciones de abajo son la CONVERSIÓN entre los 168 caracteres del
   servidor y las 28 casillas de la pantalla, y viven acá pegadas al único
   control que las usa: partirlas a otro módulo deja la regla contenta y deja
   la definición de «madrugada» en dos sitios que algún día no coinciden.
   Lo que se pierde es el refresco en caliente de ESTE archivo al editarlo. */

import { useMemo, useRef, type PointerEvent as PunteroReact } from 'react'
import { Moon, MoonStar, Sun, Sunrise, Check, Globe2, Eraser } from 'lucide-react'

/** Semana entera en cero: 7 días × 24 horas. */
export const FRANJAS_VACIAS = '0'.repeat(168)

/** Lo que el servidor exige por semana. Acá solo se INFORMA (valida él). */
const MINIMO_HORAS = 6

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Las cuatro franjas del día, en el orden en que se pintan. 6 horas cada una. */
const BLOQUES = [
  { nombre: 'Madrugada', corto: '00–06', desde: 0, hasta: 6, Icono: MoonStar },
  { nombre: 'Mañana', corto: '06–12', desde: 6, hasta: 12, Icono: Sunrise },
  { nombre: 'Tarde', corto: '12–18', desde: 12, hasta: 18, Icono: Sun },
  { nombre: 'Noche', corto: '18–24', desde: 18, hasta: 24, Icono: Moon },
] as const

const TOTAL_BLOQUES = 7 * BLOQUES.length

// ── Las cuentas. Fuera del componente: son puras y se prueban solas ──

/** Los 168 caracteres → las 28 casillas que se pintan. Mayoría de 6 horas. */
export function aBloques(franjas: string): boolean[] {
  const s = (franjas || '').padEnd(168, '0')
  const salida: boolean[] = []
  for (let dia = 0; dia < 7; dia++) {
    for (const b of BLOQUES) {
      let marcadas = 0
      for (let h = b.desde; h < b.hasta; h++) if (s[dia * 24 + h] === '1') marcadas++
      salida.push(marcadas * 2 >= b.hasta - b.desde)
    }
  }
  return salida
}

/** Las 28 casillas → los 168 caracteres que entiende el servidor. */
export function aFranjas(bloques: boolean[]): string {
  const s = new Array<string>(168).fill('0')
  for (let dia = 0; dia < 7; dia++) {
    BLOQUES.forEach((b, i) => {
      if (!bloques[dia * BLOQUES.length + i]) return
      for (let h = b.desde; h < b.hasta; h++) s[dia * 24 + h] = '1'
    })
  }
  return s.join('')
}

/** Horas semanales marcadas. Se cuenta sobre los 168, que es lo que se guarda. */
export function horasDe(franjas: string): number {
  let n = 0
  for (const c of franjas || '') if (c === '1') n++
  return n
}

/**
 * La zona del aparato, como PUNTO DE PARTIDA.
 *
 * Nunca tira: en un WebView viejo `resolvedOptions().timeZone` puede venir
 * vacío. Si viene 'UTC' se respeta tal cual —mentirle al usuario poniéndole
 * San Salvador sería peor que enseñarle una zona rara que puede corregir—.
 */
export function zonaDelAparato(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/El_Salvador'
  } catch {
    return 'America/El_Salvador'
  }
}

/**
 * Las zonas de la comunidad. No es el catálogo IANA entero (600 y pico
 * entradas en un desplegable de teléfono no se navegan): son los sitios donde
 * hay gente jugando —SV y Centroamérica, México, España con SUS DOS husos,
 * el Cono Sur y las costas de EE. UU.—. Si el aparato reporta otra, se le
 * agrega arriba: nadie se queda sin poder decir dónde está.
 */
const ZONAS: Array<[string, string]> = [
  ['America/El_Salvador', 'El Salvador'],
  ['America/Guatemala', 'Guatemala'],
  ['America/Tegucigalpa', 'Honduras'],
  ['America/Managua', 'Nicaragua'],
  ['America/Costa_Rica', 'Costa Rica'],
  ['America/Panama', 'Panamá'],
  ['America/Mexico_City', 'México · Ciudad de México'],
  ['America/Cancun', 'México · Cancún'],
  ['America/Tijuana', 'México · Tijuana'],
  ['America/Bogota', 'Colombia'],
  ['America/Lima', 'Perú'],
  ['America/Santiago', 'Chile'],
  ['America/Argentina/Buenos_Aires', 'Argentina'],
  ['America/Montevideo', 'Uruguay'],
  ['America/Sao_Paulo', 'Brasil · São Paulo'],
  ['Europe/Madrid', 'España · península'],
  ['Atlantic/Canary', 'España · Canarias'],
  ['America/New_York', 'EE. UU. · Este'],
  ['America/Chicago', 'EE. UU. · Centro'],
  ['America/Denver', 'EE. UU. · Montaña'],
  ['America/Los_Angeles', 'EE. UU. · Pacífico'],
]

/**
 * Los cuatro atajos. Cada uno REEMPLAZA lo marcado en vez de sumarse: unir
 * deja al que tocó el preset equivocado teniendo que buscar cuál casilla
 * sobra, y reemplazar se deshace tocando otro. Todos llevan escrito su rango
 * horario, para que ninguno sea una sorpresa después de tocarlo.
 */
const PRESETS: Array<{ id: string; rotulo: string; detalle: string; cubre: (dia: number, bloque: number) => boolean }> = [
  { id: 'noches', rotulo: 'Noches', detalle: '18–24 h', cubre: (_d, b) => b === 3 },
  { id: 'tardes', rotulo: 'Tardes', detalle: '12–18 h', cubre: (_d, b) => b === 2 },
  { id: 'finde', rotulo: 'Fin de semana', detalle: 'sáb y dom, 06–24 h', cubre: (d, b) => d >= 5 && b >= 1 },
  { id: 'todos', rotulo: 'Todos los días', detalle: '12–24 h', cubre: (_d, b) => b >= 2 },
]

function bloquesDePreset(cubre: (dia: number, bloque: number) => boolean): boolean[] {
  const salida: boolean[] = []
  for (let dia = 0; dia < 7; dia++) for (let b = 0; b < BLOQUES.length; b++) salida.push(cubre(dia, b))
  return salida
}

/** Qué casilla hay bajo el dedo. El arrastre táctil no dispara `pointerenter`. */
function bloqueBajo(x: number, y: number): number | null {
  const nodo = document.elementFromPoint(x, y)
  const attr = nodo?.closest('[data-bloque]')?.getAttribute('data-bloque')
  if (attr == null) return null
  const i = Number(attr)
  return Number.isInteger(i) && i >= 0 && i < TOTAL_BLOQUES ? i : null
}

export interface PropsRejilla {
  /** Los 168 caracteres. Es un control CONTROLADO: no guarda copia por dentro. */
  valor: string
  onCambio: (franjas: string) => void
  /**
   * La zona horaria, si quien monta la rejilla la lleva. Con `onZona` aparece
   * el desplegable; sin él se enseña como texto, porque un desplegable que no
   * cambia nada es peor que no tenerlo. Arrancala con `zonaDelAparato()`.
   */
  zona?: string
  onZona?: (zona: string) => void
}

export function RejillaDisponibilidad({ valor, onCambio, zona, onZona }: PropsRejilla) {
  const bloques = useMemo(() => aBloques(valor), [valor])
  const horas = horasDe(valor)
  const faltan = Math.max(0, MINIMO_HORAS - horas)

  const detectada = zonaDelAparato()
  const zonaActual = zona ?? detectada
  const zonas = useMemo(() => {
    const lista = [...ZONAS]
    // Lo que el aparato o el servidor digan y no esté en la lista se agrega
    // arriba con su nombre IANA crudo: perder la zona guardada al abrir el
    // desplegable sería cambiarle el horario a alguien sin que lo pidiera.
    for (const z of [zonaActual, detectada]) {
      if (z && !lista.some(([id]) => id === z)) lista.unshift([z, z])
    }
    return lista
  }, [zonaActual, detectada])

  /** El preset que coincide EXACTO con lo marcado, para poder resaltarlo. */
  const presetActivo = useMemo(
    () => PRESETS.find(p => aFranjas(bloquesDePreset(p.cubre)) === valor)?.id ?? null,
    [valor])

  /**
   * El arrastre.
   *
   * La copia de trabajo vive en la `ref` y no en el estado: entre dos
   * `pointermove` seguidos React todavía no repintó, así que leer `bloques`
   * daría el array viejo y cada casilla nueva borraría la anterior.
   */
  const arrastre = useRef<{ modo: boolean; desde: number; bloques: boolean[]; pinto: boolean } | null>(null)
  /** Hubo pintado de verdad → el `click` que viene detrás no debe alternar. */
  const pintoArrastrando = useRef(false)

  const empezar = (e: PunteroReact) => {
    const i = bloqueBajo(e.clientX, e.clientY)
    if (i === null) return
    pintoArrastrando.current = false
    // Todavía no se pinta nada: un toque simple lo resuelve el `onClick` del
    // botón, que es también el camino del teclado y del lector de pantalla.
    arrastre.current = { modo: !bloques[i], desde: i, bloques: [...bloques], pinto: false }
  }

  const mover = (e: PunteroReact) => {
    const a = arrastre.current
    if (!a) return
    const i = bloqueBajo(e.clientX, e.clientY)
    if (i === null) return
    if (i === a.desde && !a.pinto) return // seguimos sobre la de origen: sigue siendo un toque
    if (!a.pinto) {
      a.pinto = true
      a.bloques[a.desde] = a.modo
    } else if (a.bloques[i] === a.modo) {
      return
    }
    a.bloques[i] = a.modo
    pintoArrastrando.current = true
    onCambio(aFranjas(a.bloques))
  }

  const terminar = () => { arrastre.current = null }

  const alternar = (i: number) => {
    const n = [...bloques]
    n[i] = !n[i]
    onCambio(aFranjas(n))
  }

  const alternarDia = (dia: number) => {
    const base = dia * BLOQUES.length
    const todos = BLOQUES.every((_b, i) => bloques[base + i])
    const n = [...bloques]
    for (let i = 0; i < BLOQUES.length; i++) n[base + i] = !todos
    onCambio(aFranjas(n))
  }

  return (
    <div className="space-y-3">
      {/* ── La zona ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5">
        <label htmlFor="zona-disponibilidad" className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-swu-muted">
          <Globe2 size={11} /> Tu zona horaria
        </label>
        {onZona ? (
          <select
            id="zona-disponibilidad"
            value={zonaActual}
            onChange={e => onZona(e.target.value)}
            className="mt-1 w-full rounded-lg border border-swu-border bg-swu-bg px-2 py-2 text-[13px] font-bold text-swu-text"
          >
            {zonas.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}{id === detectada ? ' · detectada' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 text-[13px] font-bold text-swu-text">{zonaActual}</p>
        )}
        <p className="mt-1 text-[11px] leading-snug text-swu-muted">
          Marcá las horas de TU reloj. Si la zona está mal, todo lo de abajo se lee corrido.
        </p>
      </div>

      {/* ── Los atajos ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onCambio(aFranjas(bloquesDePreset(p.cubre)))}
            aria-pressed={presetActivo === p.id}
            className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
              presetActivo === p.id
                ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
                : 'border-swu-border bg-swu-surface text-swu-text'
            }`}
          >
            <span className="block text-[12px] font-black leading-tight">{p.rotulo}</span>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-swu-muted">{p.detalle}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onCambio(FRANJAS_VACIAS)}
          className="flex items-center gap-1 rounded-lg border border-swu-border bg-swu-surface px-2.5 py-1.5 text-[12px] font-black text-swu-muted"
        >
          <Eraser size={12} /> Limpiar
        </button>
      </div>

      {/* ── Las 28 casillas ───────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Horas en que podés jugar, por día y franja"
        className="grid select-none grid-cols-[2.6rem_repeat(4,minmax(0,1fr))] gap-1"
        /* `pan-y`: las filas son DÍAS y las columnas franjas, así que pintar es
           un gesto horizontal y el vertical le sigue tocando a la página. Con
           `none` la rejilla se comía el scroll y había que rodearla para bajar. */
        style={{ touchAction: 'pan-y' }}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
      >
        <div aria-hidden />
        {BLOQUES.map(b => (
          <div key={b.nombre} className="flex flex-col items-center gap-0.5 pb-0.5" aria-hidden>
            <b.Icono size={13} className="text-swu-muted" />
            <span className="text-[9px] font-bold tabular-nums tracking-tight text-swu-muted">{b.corto}</span>
          </div>
        ))}

        {DIAS.map((dia, d) => {
          const finde = d >= 5
          const base = d * BLOQUES.length
          return (
            <div key={dia} className="contents">
              <button
                type="button"
                onClick={() => alternarDia(d)}
                aria-pressed={BLOQUES.every((_b, i) => bloques[base + i])}
                aria-label={`Todo el ${dia.toLowerCase()}`}
                className={`flex h-11 items-center justify-start rounded-lg text-[11px] font-black ${
                  finde ? 'text-swu-amber' : 'text-swu-muted'
                }`}
              >
                {DIAS_CORTOS[d]}
              </button>
              {BLOQUES.map((b, i) => {
                const idx = base + i
                const marcado = bloques[idx]
                return (
                  <button
                    key={b.nombre}
                    type="button"
                    data-bloque={idx}
                    aria-pressed={marcado}
                    aria-label={`${dia} por la ${b.nombre.toLowerCase()}, de ${b.desde} a ${b.hasta} horas`}
                    onClick={() => {
                      // El arrastre ya dejó pintada esta casilla; el `click` que
                      // el navegador manda al soltar la volvería a alternar.
                      if (pintoArrastrando.current) { pintoArrastrando.current = false; return }
                      alternar(idx)
                    }}
                    className={`flex h-11 items-center justify-center rounded-lg border transition-colors ${
                      marcado
                        ? 'border-swu-accent bg-swu-accent text-white'
                        : 'border-swu-border bg-swu-bg'
                    }`}
                  >
                    {marcado && <Check size={15} aria-hidden />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── El contador. INFORMA, no bloquea: el que valida es el servidor ── */}
      <p aria-live="polite" className="text-[11px] leading-snug">
        <span className={`font-black tabular-nums ${faltan > 0 ? 'text-swu-amber' : 'text-swu-text'}`}>
          {horas} h por semana
        </span>
        <span className="text-swu-muted">
          {faltan > 0
            ? ` · faltan ${faltan} h para el mínimo de ${MINIMO_HORAS} h`
            : ' · alcanza para entrar a un grupo'}
        </span>
      </p>
      <p className="text-[10px] leading-snug text-swu-muted">
        Arrastrá el dedo para marcar varias de un tirón. Marcá solo cuando de verdad
        podrías jugar: con esto se arman los grupos y los rivales cuentan con ello.
      </p>
    </div>
  )
}
