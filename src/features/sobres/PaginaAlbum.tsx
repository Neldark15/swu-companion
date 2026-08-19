/**
 * PÁGINA DEL ÁLBUM — una hoja de nueve bolsillos, con su número impreso.
 *
 * ── La hoja SIEMPRE dibuja nueve ─────────────────────────────────────
 *
 * Es la regla de la que dependen todas las demás. Medido sobre el pool real
 * (2.669 casillas, 33 secciones, 311 hojas): 13 de las 33 secciones terminan
 * con 1 a 3 casillas en su última hoja, y tres de ellas —las tres familias de
 * 46 cartas de LOF— terminan con UNA sola. Si la última hoja pintara solo sus
 * casillas reales, pasar de la hoja 5 a la 6 encogería la página de 471,8 px a
 * 150,6 px: 321 px de brinco a mitad del gesto. Eso es lo que se ve roto, no el
 * vacío. En todo el álbum sobran 130 celdas y las 130 se dibujan como CIERRE.
 *
 * ── Los tres estados de celda son tres cosas distintas ───────────────
 *
 *   LLENA   la tenés.
 *   HUECO   existe en el álbum y no la tenés. Tiene número, tiene nombre y se
 *           puede tocar. Es una promesa, no un candado — nada la traba, solo
 *           no ha salido todavía.
 *   CIERRE  no existe: la sección se acabó antes. Sin borde, sin número y
 *           `aria-hidden`. Nunca cuenta en «X de N».
 *
 * Y no es un caso de borde: la población es CERO (0 filas en
 * `cartas_desbloqueadas`), así que hoy el álbum entero son HUECOS. Esta
 * pantalla hay que juzgarla vacía, no llena.
 *
 * ── Un solo bolsillo, 286/400, para todo ─────────────────────────────
 *
 * Aunque la carta sea apaisada. Medido: 24 hojas del álbum llevan al menos una
 * carta apaisada y **7 son MIXTAS** —apaisada y vertical en la misma hoja—. Con
 * el bolsillo siguiendo la forma de cada carta, esas 7 hojas quedan con filas
 * de distinta altura y el 3×3 deja de leerse como un binder. Con bolsillo fijo
 * la carta apaisada se acomoda dentro (`CardImage` ya rellena el sobrante con
 * su propio arte desenfocado) y las 311 hojas miden exactamente lo mismo.
 *
 * Además es lo que pasa en el cartón: un líder mide lo mismo que una unidad y
 * entra vertical en el bolsillo, con su arte acostado (ver `caraCarta.ts`).
 *
 * ── Por qué el hueco NO lleva un `ReversoCarta` ──────────────────────
 *
 * Sería lo bonito y son dos problemas. Uno: `ReversoCarta` declara seis ids
 * fijos (`dorso-cielo`, `dorso-fugaz`, `dorso-limbo`, `dorso-nucleo`,
 * `dorso-halo`, `dorso-recorte`) y nueve copias en el DOM comparten id, así que
 * las nueve resuelven `url(#…)` contra la primera. Hoy no rompe nada porque
 * nunca se pinta más de uno a la vez (comprobado: `AperturaSobre` uno,
 * `BinderDigital` uno en la lupa, `BancoSobres` uno) — y esta pantalla no es
 * quien va a romper esa condición. Dos: son 72 `<circle>` por dorso, o sea 648
 * círculos por hoja para dibujar nueve veces lo mismo. El hueco lleva una
 * silueta plana; el dorso de verdad aparece en la lupa, donde hay uno solo.
 */

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Hash } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { COLOR_RAREZA, NOMBRE_RAREZA, ACABADO, esApaisada, type SeccionAlbum, type CasillaAlbum, type Rareza } from '../../services/sobres'
import { Acabado } from './Acabado'

/** Bolsillos por hoja, como en un binder de verdad. */
export const POR_HOJA = 9

/** Cuánto tiene que correr el dedo para que cuente como pasar de hoja. */
const ARRASTRE_MINIMO = 56

interface Props {
  seccion: SeccionAlbum
  /** Las casillas de TODA la sección. `null` mientras carga. */
  casillas: CasillaAlbum[] | null
  hoja: number
  alCambiarHoja: (hoja: number) => void
  /** Abre la lupa. Recibe también los huecos: mirar lo que falta es la mitad de la gracia. */
  alAbrir: (casilla: CasillaAlbum) => void
  /** Si está, la última hoja ofrece saltar. */
  alSiguienteSeccion?: () => void
  /** El nombre de la sección siguiente, para que el botón diga a dónde va. */
  siguienteSeccion?: string
}

export function PaginaAlbum({
  seccion, casillas, hoja, alCambiarHoja, alAbrir, alSiguienteSeccion, siguienteSeccion,
}: Props) {
  const color = COLOR_RAREZA[seccion.rareza]
  const hojas = Math.max(1, Math.ceil(seccion.total / POR_HOJA))
  const hojaReal = Math.min(Math.max(0, hoja), hojas - 1)
  const desde = hojaReal * POR_HOJA
  const enHoja = (casillas ?? []).slice(desde, desde + POR_HOJA)
  const ultima = hojaReal === hojas - 1

  /* Los números se rellenan al ancho del MAYOR de la sección, para que la
   * columna de chips no baile entre «3» y «517». */
  const ancho = String(
    (casillas ?? []).reduce((m, c) => (c.numero > m ? c.numero : m), 0) || 1,
  ).length

  // ── Pasar de hoja con el dedo ──────────────────────────────────────
  // Solo si el gesto es más horizontal que vertical: si no, se comería el
  // desplazamiento de la página, que es el gesto que más se usa.
  const toque = useRef<{ x: number; y: number } | null>(null)
  /* Se marca que el gesto FUE un arrastre, para tragarse el `click` que viene
   * detrás. Sin esto, arrastrar en el borde del álbum abre una carta al azar:
   * en la hoja 0 hacia la derecha, `alCambiarHoja(0)` recibe el mismo valor,
   * React descarta el render, los botones NO se remontan y el `click` que
   * sigue al `pointerup` dispara `alAbrir`. Igual en la última hoja hacia el
   * otro lado — o sea, justo en los dos bordes donde uno tantea. */
  const arrastrado = useRef(false)
  const empezar = (e: ReactPointerEvent) => {
    toque.current = { x: e.clientX, y: e.clientY }
    arrastrado.current = false
  }
  const soltar = (e: ReactPointerEvent) => {
    const t = toque.current
    toque.current = null
    if (!t) return
    const dx = e.clientX - t.x
    const dy = e.clientY - t.y
    if (Math.abs(dx) < ARRASTRE_MINIMO || Math.abs(dx) <= Math.abs(dy)) return
    arrastrado.current = true
    alCambiarHoja(dx < 0 ? Math.min(hojas - 1, hojaReal + 1) : Math.max(0, hojaReal - 1))
  }
  /* Va en la fase de CAPTURA: llega antes que el `onClick` de la casilla, que
   * es lo único que lo puede frenar a tiempo. */
  const tragarClic = (e: React.MouseEvent) => {
    if (!arrastrado.current) return
    arrastrado.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <div>
      {/* ── Encabezado: dónde estás, sin tener que contar ─────────────── */}
      <header className="mb-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-swu-muted">
          {seccion.setCode}
        </p>
        <h1 className="text-lg font-black tracking-tight" style={{ color }}>
          {NOMBRE_RAREZA[seccion.rareza]}
        </h1>
        <p className="mt-0.5 text-xs text-swu-muted tabular-nums">
          Hoja {hojaReal + 1} de {hojas}
          {enHoja.length > 0 && (
            <> · Nº {enHoja[0].numero}–{enHoja[enHoja.length - 1].numero}</>
          )}
        </p>
        <p className="mt-1 text-sm font-bold text-swu-text tabular-nums">
          {seccion.tenidas} <span className="font-normal text-swu-muted">de {seccion.total}</span>
        </p>
        <div className="mx-auto mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${seccion.total ? (seccion.tenidas / seccion.total) * 100 : 0}%`,
              background: color,
            }}
          />
        </div>
      </header>

      {/* ── La hoja ───────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-3 gap-2.5"
        onPointerDown={empezar}
        onPointerUp={soltar}
        onClickCapture={tragarClic}
        onPointerCancel={() => { toque.current = null }}
      >
        {casillas === null
          ? /* Cargando. Tiene que verse DISTINTO del hueco: con población 0 el
               álbum entero son huecos, y si el esqueleto se les pareciera nadie
               podría distinguir «cargando» de «todavía no te salió ninguna». El
               esqueleto barre; el hueco no se mueve y lleva número. */
            Array.from({ length: POR_HOJA }, (_, i) => (
              <div key={i} className="carta-esqueleto aspect-[286/400] rounded-lg" />
            ))
          : Array.from({ length: POR_HOJA }, (_, i) => {
              const c = enHoja[i]
              if (!c) return <Cierre key={`cierre-${i}`} />
              return c.tenida ? (
                <Llena key={c.posicion} casilla={c} color={color} ancho={ancho} rareza={seccion.rareza} alAbrir={alAbrir} />
              ) : (
                <Hueco key={c.posicion} casilla={c} color={color} ancho={ancho} alAbrir={alAbrir} />
              )
            })}
      </div>

      {/* ── Cruzar 27 hojas sin 27 toques ─────────────────────────────── */}
      {hojas > 1 && (
        <nav className="mt-4 flex items-center gap-2" aria-label="Hojas de la sección">
          <button
            type="button"
            onClick={() => alCambiarHoja(Math.max(0, hojaReal - 1))}
            disabled={hojaReal === 0}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-swu-muted disabled:opacity-25"
            aria-label="Hoja anterior"
          >
            <ChevronLeft size={20} />
          </button>

          {/* La sección más larga tiene 27 hojas: con solo dos flechas son 26
              toques para llegar al final. La barra cruza la sección de un
              arrastre y de paso dice en qué parte del set estás. */}
          <input
            type="range"
            min={0}
            max={hojas - 1}
            step={1}
            value={hojaReal}
            onChange={e => alCambiarHoja(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 cursor-pointer bg-transparent"
            style={{ accentColor: color }}
            aria-label={`Hoja ${hojaReal + 1} de ${hojas}`}
          />

          <button
            type="button"
            onClick={() => alCambiarHoja(Math.min(hojas - 1, hojaReal + 1))}
            disabled={ultima}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-swu-muted disabled:opacity-25"
            aria-label="Hoja siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </nav>
      )}

      {/* ── El pie de sección ─────────────────────────────────────────── */}
      {/* Va pegado a la ÚLTIMA hoja a propósito: el peor caso del álbum es una
          hoja con 1 casilla y 8 cierres (las tres familias de 46 de LOF), y con
          el pie debajo se lee como el final del capítulo en vez de como una
          página fallada. */}
      {ultima && casillas !== null && (
        <footer className="mt-5 border-t border-swu-border pt-4 text-center">
          <p className="text-sm font-bold text-swu-text">
            {seccion.tenidas === seccion.total
              ? 'Sección completa'
              : `Te faltan ${seccion.total - seccion.tenidas}`}
          </p>
          <p className="mt-0.5 text-xs text-swu-muted">
            {seccion.setCode} · {NOMBRE_RAREZA[seccion.rareza]}
          </p>
          {alSiguienteSeccion && (
            <button
              type="button"
              onClick={alSiguienteSeccion}
              className="mx-auto mt-3 flex min-h-11 items-center gap-1 rounded-lg border border-swu-border px-4 text-sm font-bold text-swu-text active:bg-swu-surface-hover"
            >
              {siguienteSeccion ?? 'Siguiente sección'}
              <ChevronRight size={16} />
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * LOS TRES ESTADOS DE CELDA
 * ═══════════════════════════════════════════════════════════════════ */

/** El número impreso del bolsillo, relleno al ancho de la sección. */
function Numero({
  n, ancho, className, style,
}: {
  n: number
  ancho: number
  className: string
  style?: CSSProperties
}) {
  return <span className={className} style={style}>{String(n).padStart(ancho, '0')}</span>
}

/** LLENA — la tenés. */
function Llena({
  casilla, color, ancho, rareza, alAbrir,
}: {
  casilla: CasillaAlbum
  color: string
  ancho: number
  /** La lleva la SECCIÓN: todas sus casillas comparten impresión. */
  rareza: Rareza
  alAbrir: (c: CasillaAlbum) => void
}) {
  return (
    <button
      type="button"
      onClick={() => alAbrir(casilla)}
      className="group relative block aspect-[286/400] w-full rounded-lg text-left
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swu-cyan"
      aria-label={`Ver ${casilla.carta?.name ?? 'carta'}, número ${casilla.numero}`}
    >
      {/* `radio-carta` y no `rounded-lg`: la carta trae su esquina en el alfa
          a 2,8% del ancho (~3 px en una celda de 108), así que una sombra con
          radio fijo de 8 px asoma el pico por detrás. */}
      <div
        className="radio-carta relative h-full w-full transition-transform duration-200 group-active:scale-95"
        style={{ boxShadow: `0 0 12px ${color}45` }}
      >
        {/* `casilla.arte`, NO `carta.imageUrl`: la lámina foil del API trae los
            destellos QUEMADOS en el archivo y el brillo lo pone la app (ver
            `sobresArte.ts`). El respaldo es la propia impresión. */}
        <CardImage
          src={casilla.arte || casilla.carta?.imageUrl}
          alt={casilla.carta?.name ?? ''}
          orientacion={esApaisada(casilla.carta) ? 'apaisada' : 'vertical'}
          className="h-full w-full"
        />
        {/* Nueve a la vez: acabado BARATO, un degradado sin `mix-blend-mode`.
            El bueno se ve al abrir la carta. */}
        <Acabado acabado={ACABADO[rareza]} calidad="plano" apaisada={esApaisada(casilla.carta)} />
      </div>

      <Numero
        n={casilla.numero}
        ancho={ancho}
        className="absolute top-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-black tabular-nums text-white/85"
      />
      {casilla.cantidad > 1 && (
        <span className="absolute top-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-black text-white">
          ×{casilla.cantidad}
        </span>
      )}
      {casilla.serializada && (
        <span
          className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black text-white"
          style={{ background: COLOR_RAREZA.serializada }}
        >
          <Hash size={9} />
          ÚNICA
        </span>
      )}
    </button>
  )
}

/**
 * HUECO — existe y no la tenés.
 *
 * Lleva tres cosas y las tres hacen falta:
 *
 *   · el NÚMERO, grande y en el color de la sección. Un hueco anónimo se lee
 *     como relleno; con número es un sitio concreto que falta.
 *   · el NOMBRE de la carta. Es la invitación: «te falta Darth Vader» tira
 *     mucho más que un bolsillo gris. Sale del catálogo local, así que no
 *     cuesta ni una petición (ver el cambio en `casillasDeSeccion`).
 *   · la silueta del bolsillo, con borde punteado. Es lo que dice «acá va
 *     algo» sin prometer una carta que no existe.
 *
 * Y NO lleva candado. Un candado dice «no podés»; acá se puede, simplemente no
 * ha salido. Es la diferencia entre un álbum y un muro de pago.
 *
 * NO lleva el arte, aunque el catálogo lo tenga a mano: enseñar la carta que no
 * tenés le quita el sentido a abrirla.
 */
function Hueco({
  casilla, color, ancho, alAbrir,
}: {
  casilla: CasillaAlbum
  color: string
  ancho: number
  alAbrir: (c: CasillaAlbum) => void
}) {
  const nombre = casilla.carta?.name
  return (
    <button
      type="button"
      onClick={() => alAbrir(casilla)}
      className="relative flex aspect-[286/400] w-full flex-col items-center justify-center gap-1
                 rounded-lg border border-dashed border-swu-border bg-swu-surface/70 px-1
                 transition-colors active:bg-swu-surface/50
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swu-cyan"
      aria-label={nombre ? `Te falta ${nombre}, número ${casilla.numero}` : `Casilla ${casilla.numero}, vacía`}
    >
      {/* El número va en el color de la sección, no en gris: es lo que hace
          que la hoja vacía se lea como un álbum esperando y no como una carga
          fallida.

          Pero NO se apaga con `opacity` para que «quede por debajo» de una
          carta de verdad: al 45% daba 2,76:1 sobre el fondo real, por debajo
          del mínimo legible, y es la misma regresión que este repo ya pagó una
          vez. Que quede por debajo se consigue con el TAMAÑO y con que la
          celda no tenga arte, no bajando el alfa. */}
      <Numero
        n={casilla.numero}
        ancho={ancho}
        className="text-[15px] font-black tabular-nums leading-none"
        style={{ color }}
      />
      {nombre && (
        <span className="line-clamp-2 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-swu-muted/80">
          {nombre}
        </span>
      )}
      <span
        aria-hidden
        className="absolute inset-0 rounded-lg"
        style={{ boxShadow: `inset 0 0 0 1px ${color}14` }}
      />
    </button>
  )
}

/**
 * CIERRE — no hay casilla. Solo en la última hoja de la sección.
 *
 * Sin borde punteado y sin número, porque un borde punteado promete una carta.
 * Mantiene el ritmo del 3×3 y la altura de la hoja, que es lo único que tiene
 * que hacer. Nunca se cuenta en «X de N».
 */
function Cierre() {
  return (
    <div
      aria-hidden
      className="aspect-[286/400] rounded-lg bg-white/[0.03]"
    />
  )
}
