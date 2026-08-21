import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, FileJson, FileText, FileSpreadsheet, Image as ImageIcon, Loader2, Share2 } from 'lucide-react'
import { exportDeckAsSwudbJson, exportDeckAsMeleeText, exportDeckAsSwudbCsv } from '../../services/deckImportExport'
import { generarImagenMazo, nombreArchivoMazo, entregarImagen } from '../../services/deckImagen'
import { useAuth } from '../../hooks/useAuth'
import type { Deck } from '../../types'

interface Props {
  open: boolean
  deck: Deck | null
  onClose: () => void
}

/* 'imagen' no es un formato de texto como los otros tres: no llena el área de
   texto, produce un ARCHIVO. Por eso el cuerpo del modal cambia de forma en vez
   de meter un PNG en un textarea. */
type Format = 'json' | 'csv' | 'melee' | 'imagen'

export function ExportDeckModal({ open, deck, onClose }: Props) {
  const [format, setFormat] = useState<Format>('json')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [generandoImg, setGenerandoImg] = useState(false)
  const [avisoImg, setAvisoImg] = useState<string | null>(null)
  const { currentProfile } = useAuth()

  useEffect(() => {
    // La imagen no se genera sola al elegir la pestaña: son ~30 descargas de
    // arte y varios MB. Se hace cuando la piden, no por pasar por encima.
    if (!open || !deck || format === 'imagen') { setText(''); return }
    setLoading(true)
    setCopied(false)
    ;(async () => {
      try {
        const result = format === 'json'
          ? await exportDeckAsSwudbJson(deck)
          : format === 'csv'
            ? await exportDeckAsSwudbCsv(deck)
            : exportDeckAsMeleeText(deck)
        setText(result)
      } catch {
        setText('Error al exportar')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, deck, format])

  if (!open || !deck) return null

  const generarImagen = async () => {
    setGenerandoImg(true)
    setAvisoImg(null)
    try {
      const blob = await generarImagenMazo(deck, currentProfile?.name ?? '')
      const como = await entregarImagen(blob, nombreArchivoMazo(deck), deck.name)
      setAvisoImg(como === 'compartida' ? '¡Listo, compartida!' : 'Imagen descargada.')
    } catch (e) {
      setAvisoImg(e instanceof Error ? e.message : 'No se pudo generar la imagen.')
    } finally {
      setGenerandoImg(false)
    }
  }

  /**
   * Copiar, con dos redes debajo.
   *
   * Antes esto era un `try` con un `catch` VACÍO, y el comentario decía que no
   * hacía falta avisar porque el texto seguía a la vista. Pero desde el lado de
   * quien mira, un botón que no hace absolutamente nada al tocarlo no se lee
   * como «copialo a mano»: se lee como que la app está rota. Y `writeText`
   * falla más de lo que parece — el navegador lo rechaza si el documento no
   * tiene el foco, y en algunos navegadores embebidos directamente no existe.
   *
   * Así que: se intenta el camino moderno; si falla se selecciona el texto y se
   * usa `execCommand`, que está obsoleto pero no pide permiso y funciona en
   * todos lados; y si eso TAMBIÉN falla, el texto queda seleccionado y se dice
   * con qué teclas terminarlo. Las tres ramas dejan a la persona con su mazo.
   */
  const handleCopy = async () => {
    setAvisoCopia(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    } catch { /* sigue por la red de abajo */ }

    const area = areaRef.current
    if (!area) { setAvisoCopia('No se pudo copiar. Seleccioná el texto a mano.'); return }
    area.focus()
    area.select()
    let listo = false
    try { listo = document.execCommand('copy') } catch { listo = false }
    if (listo) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    setAvisoCopia('El texto quedó seleccionado: copialo con Ctrl+C (o ⌘+C).')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-swu-surface border border-swu-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col"
           style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-swu-border flex-shrink-0">
          <h3 className="text-base font-bold text-swu-text truncate pr-2">Exportar: {deck.name}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg bg-swu-bg text-swu-muted active:scale-95">
            <X size={16} />
          </button>
        </div>

        {/* Format toggle */}
        <div className="px-4 pt-3 flex gap-2 flex-shrink-0">
          <button
            onClick={() => setFormat('json')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'json'
                ? 'bg-swu-accent/15 border-swu-accent/40 text-swu-accent-texto'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <FileJson size={14} /> JSON
          </button>
          <button
            onClick={() => setFormat('csv')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'csv'
                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button
            onClick={() => setFormat('melee')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'melee'
                ? 'bg-swu-amber/15 border-swu-amber/40 text-swu-amber'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <FileText size={14} /> Melee
          </button>
          <button
            onClick={() => setFormat('imagen')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
              format === 'imagen'
                ? 'bg-swu-cyan/15 border-swu-cyan/40 text-swu-cyan'
                : 'bg-swu-bg border-swu-border text-swu-muted'
            }`}
          >
            <ImageIcon size={14} /> Imagen
          </button>
        </div>

        {/* Body — texto para los tres formatos, o la hoja de mazo para 'imagen' */}
        <div className="p-4 flex-1 min-h-0 overflow-hidden">
          {format === 'imagen' ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <ImageIcon size={30} className="text-swu-cyan" />
              <div>
                <p className="text-sm font-bold text-swu-text">Una imagen con todo el mazo</p>
                <p className="mt-1 text-xs text-swu-muted">
                  Líder, base, mazo principal y banquillo, con las cantidades.
                  Para mandarlo por WhatsApp sin que el otro tenga la app.
                </p>
              </div>
              <button
                onClick={generarImagen}
                disabled={generandoImg}
                className="flex items-center gap-2 rounded-xl bg-swu-cyan px-4 py-2.5 text-sm font-bold
                           text-black active:scale-95 disabled:opacity-60"
              >
                {generandoImg
                  ? <><Loader2 size={15} className="animate-spin" /> Armando la hoja…</>
                  : <><Share2 size={15} /> Generar y compartir</>}
              </button>
              {/* Se avisa que tarda: son ~30 imágenes de carta y con datos
                  móviles se nota. Callarlo hace pensar que se colgó. */}
              <p className="text-[11px] text-swu-muted">
                {avisoImg ?? 'Tarda unos segundos: se descarga el arte de cada carta.'}
              </p>
            </div>
          ) : (
            <textarea
              ref={areaRef}
              readOnly
              value={loading ? 'Generando...' : text}
              className="w-full h-full min-h-[200px] p-3 bg-swu-bg border border-swu-border rounded-xl text-xs text-swu-text font-mono resize-none focus:outline-none"
            />
          )}
        </div>

        {/* Footer */}
        {avisoCopia && (
          <p className="px-4 pb-1 text-[11px] leading-snug text-swu-amber">{avisoCopia}</p>
        )}
        <div className="p-4 border-t border-swu-border flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-swu-border text-swu-muted text-sm font-bold active:scale-95"
          >
            Cerrar
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || !text}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all ${
              copied
                ? 'bg-swu-green/20 text-swu-green border border-swu-green/40'
                : 'bg-swu-accent text-white'
            }`}
          >
            {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
