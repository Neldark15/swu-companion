/**
 * Compartir la credencial: la imagen a un chat y el texto para pegar.
 *
 * ── La verdad de cada red, que es la que manda el diseño ──────────────
 *
 * No todas las redes se pueden abrir con un enlace, y fingir que sí es lo que
 * hace que un botón no haga nada y la gente crea que la app está rota:
 *
 * - **WhatsApp y Telegram** tienen intent web (`wa.me`, `t.me/share`) pero
 *   SOLO llevan TEXTO. La imagen no viaja por ahí: hay que adjuntarla aparte.
 * - **Facebook** solo acepta una URL; el texto lo pone él.
 * - **Instagram y Discord no tienen intent web NINGUNO.** Para esos, el único
 *   camino real es la hoja del sistema (`navigator.share` con archivos), que
 *   solo existe en el teléfono, o descargar y subir a mano.
 *
 * Por eso el botón grande es **Compartir**, que abre la hoja del sistema con
 * la imagen Y el texto juntos: es el único camino que llega a las cinco redes
 * de una. Los botones por red están debajo como respaldo, y cada uno dice qué
 * lleva.
 *
 * ── Dos pasos, y no es capricho ───────────────────────────────────────
 *
 * Primero se genera la imagen y se ve; después se comparte. Safari exige que
 * `navigator.share()` salga de una activación del usuario, y generar el PNG
 * lleva un `await` (bajar la fuente y las imágenes). Encadenado en un solo
 * botón, Safari tira `NotAllowedError` justo en el teléfono donde la hoja del
 * sistema es el único camino que sirve. Es la misma lección que ya está
 * escrita en CompartirArticulo.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2, Copy, Check, Download, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { exportarCredencial, type Exportada } from './exportarCredencial'

interface Props {
  /** De dónde sacar el SVG: el mismo que se ve en pantalla. */
  contenedor: () => SVGSVGElement | null
  /** Para el texto. */
  nombre: string
  rango: string
  nivel?: number
}

const SITIO = 'https://www.swusv.com'

/** ¿Este aparato puede compartir ARCHIVOS? Es la diferencia real entre
 *  teléfono y escritorio, y hay que preguntarlo con un archivo de verdad:
 *  `canShare` sin `files` responde otra cosa. */
function puedeCompartirArchivos(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([new Uint8Array([0])], 'p.png', { type: 'image/png' })] })
  } catch { return false }
}

function textoPromo(nombre: string, rango: string, nivel?: number): string {
  const linea = nivel ? `${rango} · Nivel ${nivel}` : rango
  return [
    `Esta es mi credencial de HOLOCRON SWU 🪪`,
    ``,
    `${nombre} — ${linea}`,
    ``,
    `Es la app de la comunidad de Star Wars: Unlimited:`,
    `colección, mazos, torneos, el meta nacional y tu propia placa.`,
    ``,
    `Hacé la tuya gratis en ${SITIO}`,
  ].join('\n')
}

export function CompartirCredencial({ contenedor, nombre, rango, nivel }: Props) {
  const [png, setPng] = useState<Exportada | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [conHoja] = useState(puedeCompartirArchivos)
  const ultimaUrl = useRef<string | null>(null)

  const texto = textoPromo(nombre, rango, nivel)

  // La URL del objeto se revoca cuando se reemplaza y al desmontar: cada PNG
  // son ~700 KB y sin esto se acumulan en memoria a cada regeneración.
  useEffect(() => () => { if (ultimaUrl.current) URL.revokeObjectURL(ultimaUrl.current) }, [])

  const generar = useCallback(async () => {
    setGenerando(true)
    setError(null)
    try {
      const svg = contenedor()
      if (!svg) throw new Error('No se encontró la credencial en pantalla.')
      const r = await exportarCredencial(svg, `credencial-${nombre.toLowerCase().replace(/\s+/g, '-')}`)
      if (ultimaUrl.current) URL.revokeObjectURL(ultimaUrl.current)
      ultimaUrl.current = r.url
      setPng(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la imagen.')
    } finally {
      setGenerando(false)
    }
  }, [contenedor, nombre])

  /** Sin un solo `await` antes de `navigator.share`: ver la cabecera. */
  function compartir() {
    if (!png || typeof navigator.share !== 'function') return
    navigator.share({ files: [png.archivo], text: texto }).catch(() => {
      // Cancelar la hoja del sistema lanza AbortError. No es un fallo y no se
      // le avisa a nadie.
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      setError('El navegador no dejó copiar. Seleccioná el texto a mano.')
    }
  }

  function descargar() {
    if (!png) return
    const a = document.createElement('a')
    a.href = png.url
    a.download = png.archivo.name
    a.click()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-swu-border bg-swu-surface p-4">
      <div>
        <h2 className="text-sm font-bold text-swu-text">Compartir mi credencial</h2>
        <p className="text-[11px] text-swu-muted">
          Se exporta solo la placa, con fondo transparente y firmada con el sitio.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 rounded-xl border border-swu-amber/40 bg-swu-amber/10 px-3 py-2 text-[12px] text-swu-amber">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {!png ? (
        <Button variant="primary" block onClick={() => void generar()} disabled={generando}>
          {generando ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
          {generando ? 'Generando…' : 'Generar la imagen'}
        </Button>
      ) : (
        <>
          {/* Se VE antes de mandarla. Y el segundo clic es una activación
              nueva, que es lo que Safari exige para abrir la hoja. */}
          <div className="overflow-hidden rounded-xl bg-[repeating-conic-gradient(#2a2a30_0_25%,#1e1e24_0_50%)] bg-[length:16px_16px] p-2">
            <img src={png.url} alt="Vista previa de la credencial" className="w-full" />
          </div>

          {conHoja ? (
            <Button variant="primary" block onClick={compartir}>
              <Share2 size={15} /> Compartir imagen y texto
            </Button>
          ) : (
            <p className="rounded-xl border border-swu-border bg-swu-bg/50 px-3 py-2 text-[11px] text-swu-muted">
              En la computadora no hay hoja de compartir: descargá el PNG y adjuntalo en el chat.
              Desde el teléfono, un solo botón lo manda a WhatsApp, Instagram, Telegram o Discord.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void copiar()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-swu-border px-3 py-2.5 text-[12px] font-bold text-swu-text active:scale-95"
            >
              {copiado ? <Check size={14} className="text-swu-green" /> : <Copy size={14} />}
              {copiado ? 'Copiado' : 'Copiar el texto'}
            </button>
            <button
              onClick={descargar}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-swu-border px-3 py-2.5 text-[12px] font-bold text-swu-text active:scale-95"
            >
              <Download size={14} /> Descargar PNG
            </button>
          </div>

          {/* Los intents por red. Cada uno dice qué lleva de verdad: los tres
              llevan TEXTO, no la imagen — eso solo lo hace la hoja del
              sistema. Prometer lo contrario es el bug clásico de esta feature. */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
              O mandá solo el texto
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Red etiqueta="WhatsApp" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} />
              <Red etiqueta="Telegram" href={`https://t.me/share/url?url=${encodeURIComponent(SITIO)}&text=${encodeURIComponent(texto)}`} />
              <Red etiqueta="Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITIO)}`} />
            </div>
            <p className="mt-1.5 text-[10px] text-swu-muted">
              Instagram y Discord no aceptan enlaces de compartir: para esos, usá el botón de arriba
              desde el teléfono, o pegá la imagen descargada.
            </p>
          </div>

          <button
            onClick={() => void generar()}
            disabled={generando}
            className="w-full text-center text-[11px] text-swu-muted underline underline-offset-2"
          >
            Volver a generar
          </button>
        </>
      )}
    </div>
  )
}

function Red({ etiqueta, href }: { etiqueta: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border border-swu-border px-2 py-2 text-center text-[11px] font-bold text-swu-text active:scale-95"
    >
      {etiqueta}
    </a>
  )
}
