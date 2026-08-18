/**
 * Traductor de Aurebesh — escribí en latino, leelo en galáctico.
 *
 * Decisiones que vale explicar:
 *
 * 1. **Traduce en el aparato, sin red.** El Aurebesh es una sustitución uno a
 *    uno con el alfabeto latino, así que «traducir» es cambiar cada letra por
 *    su glifo. No hay nada que preguntarle a un servidor, y por eso funciona
 *    sin señal — que es justo donde se usa: en una mesa de torneo enseñándole
 *    a alguien cómo se escribe su nombre.
 *
 * 2. **Es PÚBLICO.** No pide cuenta. Un traductor con muro de registro no lo
 *    usa nadie, y esto es lo más compartible que tiene la app: alguien manda
 *    el enlace por WhatsApp y del otro lado se ve su nombre en Aurebesh.
 *
 * 3. **El texto viaja en la URL.** `/aurebesh?t=…` deja compartir la
 *    traducción hecha, no la pantalla vacía. Se lee UNA vez al montar (no en
 *    cada render, que devolvería al texto del enlace cada vez que tecleás) y
 *    se actualiza con `replaceState` para no llenar el historial de pasos
 *    intermedios — un «atrás» tiene que salir del traductor, no deshacer letra
 *    por letra.
 *
 * 4. **Se puede DESCARGAR como SVG.** Es lo que la gente va a querer hacer con
 *    esto: ponerlo en un playmat, un sticker, un tatuaje. SVG y no PNG porque
 *    escala sin pixelarse, y el archivo lo arma el navegador con un Blob —
 *    cero servidor, cero dependencias.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Download, Check, Type } from 'lucide-react'
import {
  GLIFOS, DIGRAFOS, PUNTUACION, GLIFO_ALTO, GLIFO_ANCHO, sinAcentos, aGlifos,
  type UnidadAurebesh,
} from '../credencial/aurebeshGlifos'

/** Cuánto respira entre glifo y glifo, en unidades de la caja del glifo. */
const AIRE = 3
/** Ancho del espacio entre palabras. */
const ESPACIO = GLIFO_ANCHO * 0.8

// La partición del texto vive en `aurebeshGlifos.ts` (`aGlifos`), no acá.
// Antes esta pantalla tenía su propia versión que solo miraba `GLIFOS`, así que
// los DÍGRAFOS y la PUNTUACIÓN existían en el módulo y no los dibujaba nadie —
// código muerto que compilaba y pasaba lint justamente porque nadie lo usaba.
type Unidad = UnidadAurebesh

/** Arma el SVG entero como cadena — sirve para pintarlo Y para descargarlo. */
function construirSVG(
  unidades: Unidad[],
  opciones: { color: string; fondo: string | null; grosor: number },
): { svg: string; ancho: number; alto: number } {
  const { color, fondo, grosor } = opciones
  const margen = 6
  let cursor = 0
  const trazos: string[] = []

  for (const u of unidades) {
    if (u.path === null) { cursor += ESPACIO; continue }
    trazos.push(
      `<path d="${u.path}" transform="translate(${cursor.toFixed(2)} 0)" fill="none" ` +
      `stroke="${color}" stroke-width="${grosor}" stroke-linecap="square" stroke-linejoin="miter"/>`,
    )
    cursor += GLIFO_ANCHO + AIRE
  }

  // El último glifo no necesita el aire de la derecha.
  const anchoTexto = Math.max(cursor - AIRE, GLIFO_ANCHO)
  const ancho = anchoTexto + margen * 2
  const alto = GLIFO_ALTO + margen * 2

  const rectFondo = fondo ? `<rect width="${ancho}" height="${alto}" fill="${fondo}"/>` : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho.toFixed(2)} ${alto.toFixed(2)}">` +
    rectFondo +
    `<g transform="translate(${margen} ${margen})">${trazos.join('')}</g>` +
    `</svg>`

  return { svg, ancho, alto }
}

const COLORES = [
  { id: 'ambar',  nombre: 'Ámbar',   valor: '#F0B323' },
  { id: 'blanco', nombre: 'Blanco',  valor: '#E8ECF2' },
  { id: 'rojo',   nombre: 'Rojo',    valor: '#E03A3A' },
  { id: 'azul',   nombre: 'Azul',    valor: '#4FA8E8' },
  { id: 'verde',  nombre: 'Verde',   valor: '#3FBF6F' },
  { id: 'violeta',nombre: 'Violeta', valor: '#A78BFA' },
] as const

export function TraductorPage() {
  const navigate = useNavigate()

  // El texto del enlace se lee UNA vez. En cada render devolvería al texto
  // compartido cada vez que tecleás una letra.
  const [texto, setTexto] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    return t ? t.slice(0, 200) : ''
  })
  const [color, setColor] = useState<string>(COLORES[0].valor)
  const [copiado, setCopiado] = useState<'no' | 'enlace' | 'svg'>('no')
  const [rotulos, setRotulos] = useState(true)
  /**
   * Usar las ligaduras (CH, SH, TH…).
   *
   * Encendido por defecto porque es como se escribe el Aurebesh cuando alguien
   * lo escribe en serio. Se puede apagar porque el canon dice que NUNCA son
   * obligatorias: quien esté aprendiendo a leerlo prefiere ver letra por letra.
   */
  const [digrafos, setDigrafos] = useState(true)

  const unidades = useMemo(() => aGlifos(texto, digrafos), [texto, digrafos])
  const conGlifo = unidades.filter(u => u.path !== null).length

  // El enlace se mantiene al día SIN apilar historial: cada tecla sería un paso
  // atrás, y salir del traductor exigiría veinte toques.
  useEffect(() => {
    const url = texto.trim()
      ? `${window.location.pathname}?t=${encodeURIComponent(texto)}`
      : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [texto])

  const { svg } = useMemo(
    () => construirSVG(unidades, { color, fondo: null, grosor: 0.5 }),
    [unidades, color],
  )

  const contenedor = useRef<HTMLDivElement>(null)

  const avisar = useCallback((que: 'enlace' | 'svg') => {
    setCopiado(que)
    window.setTimeout(() => setCopiado('no'), 1600)
  }, [])

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      avisar('enlace')
    } catch { /* sin portapapeles no se puede hacer nada útil */ }
  }

  function descargarSVG() {
    // Con fondo transparente y trazo del color elegido: así se puede poner
    // sobre cualquier cosa. El Blob lo arma el navegador — sin servidor.
    const { svg: paraArchivo } = construirSVG(unidades, { color, fondo: null, grosor: 0.5 })
    const blob = new Blob([paraArchivo], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const limpio = sinAcentos(texto).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40) || 'aurebesh'
    a.download = `${limpio}.svg`
    a.click()
    URL.revokeObjectURL(url)
    avisar('svg')
  }

  return (
    <div className="min-h-screen bg-swu-bg pb-10">
      <header className="sticky top-0 z-40 border-b border-swu-border bg-swu-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 lg:max-w-3xl lg:px-6">
          <button onClick={() => navigate(-1)} aria-label="Volver" className="flex-shrink-0 text-swu-muted">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-swu-text lg:text-lg">Aurebesh</h1>
            <p className="truncate font-mono text-[10px] tracking-wider text-swu-muted">
              Traductor a la escritura galáctica
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4 lg:max-w-3xl lg:px-6">
        <div>
          <label htmlFor="texto" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-swu-muted">
            Tu texto
          </label>
          <textarea
            id="texto"
            value={texto}
            onChange={e => setTexto(e.target.value.slice(0, 200))}
            rows={2}
            autoFocus
            placeholder="Escribí tu nombre…"
            className="w-full resize-none rounded-xl border border-swu-border bg-swu-surface px-3 py-2.5
                       text-base text-swu-text placeholder:text-swu-muted/60 focus:border-swu-amber focus:outline-none"
          />
          <p className="mt-1 text-right font-mono text-[10px] text-swu-muted">{texto.length}/200</p>
        </div>

        {/* El resultado */}
        <div
          ref={contenedor}
          className="overflow-x-auto rounded-2xl border border-swu-border bg-swu-surface p-5"
        >
          {conGlifo === 0 ? (
            <div className="py-8 text-center">
              <Type size={30} className="mx-auto mb-2 text-swu-muted/30" />
              <p className="text-[12px] text-swu-muted">
                Escribí arriba y acá lo vas a ver en Aurebesh
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* El SVG se inyecta como cadena — es EL MISMO que se descarga,
                  así que lo que ves es exactamente lo que te llevás. */}
              <div
                className="min-w-full [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              {rotulos && (
                <p className="break-words text-center font-mono text-[10px] tracking-[0.3em] text-swu-muted">
                  {sinAcentos(texto).toUpperCase()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Color */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-swu-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORES.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.valor)}
                aria-label={c.nombre}
                aria-pressed={color === c.valor}
                className={`h-9 w-9 rounded-lg border-2 transition-transform ${
                  color === c.valor ? 'scale-110 border-swu-text' : 'border-swu-border'
                }`}
                style={{ background: c.valor }}
              />
            ))}
            <button
              onClick={() => setDigrafos(v => !v)}
              title="CH, SH, TH… se escriben con un glifo propio"
              className={`rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
                digrafos
                  ? 'border-swu-amber/40 bg-swu-amber/10 text-swu-amber'
                  : 'border-swu-border text-swu-muted'
              }`}
            >
              {digrafos ? 'Con ligaduras' : 'Letra por letra'}
            </button>
            <button
              onClick={() => setRotulos(v => !v)}
              className={`rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
                rotulos
                  ? 'border-swu-amber/40 bg-swu-amber/10 text-swu-amber'
                  : 'border-swu-border text-swu-muted'
              }`}
            >
              {rotulos ? 'Con texto latino' : 'Solo Aurebesh'}
            </button>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void copiarEnlace()}
            disabled={conGlifo === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-swu-border
                       bg-swu-surface py-2.5 text-[12px] font-bold text-swu-text disabled:opacity-40"
          >
            {copiado === 'enlace' ? <><Check size={14} className="text-swu-green" /> Copiado</> : <><Copy size={14} /> Copiar enlace</>}
          </button>
          <button
            onClick={descargarSVG}
            disabled={conGlifo === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-swu-amber py-2.5
                       text-[12px] font-extrabold text-black disabled:opacity-40"
          >
            {copiado === 'svg' ? <><Check size={14} /> Descargado</> : <><Download size={14} /> Descargar SVG</>}
          </button>
        </div>

        {/* El abecedario, para aprenderlo */}
        <section className="rounded-2xl border border-swu-border bg-swu-surface p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-swu-muted">
            El alfabeto
          </p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {[...Object.keys(GLIFOS), ...Object.keys(DIGRAFOS), ...Object.keys(PUNTUACION)].map(letra => (
              <button
                key={letra}
                onClick={() => setTexto(t => (t + letra).slice(0, 200))}
                title={`Agregar ${letra}`}
                className="flex flex-col items-center gap-1 rounded-lg border border-swu-border
                           bg-swu-bg p-1.5 transition-colors hover:border-swu-amber/40"
              >
                <svg viewBox={`0 0 ${GLIFO_ANCHO} ${GLIFO_ALTO}`} className="h-6 w-6">
                  <path
                    d={GLIFOS[letra] ?? DIGRAFOS[letra] ?? PUNTUACION[letra]}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={0.6}
                    strokeLinecap="square"
                    className="text-swu-amber"
                  />
                </svg>
                <span className="font-mono text-[9px] text-swu-muted">{letra}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-swu-muted">
            El Aurebesh sustituye letra por letra al alfabeto latino, así que lo que
            escribas se lee igual — solo cambia cómo se ve. CH, AE, EO, KH, NG, OO, SH
            y TH tienen glifo propio (las ligaduras), pero en el canon nunca son
            obligatorias: podés apagarlas arriba. Los trazos están dibujados a mano
            contra la lámina de referencia, no son una fuente.
          </p>
        </section>
      </div>
    </div>
  )
}
