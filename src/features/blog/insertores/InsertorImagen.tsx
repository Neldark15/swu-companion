/**
 * InsertorImagen — subir una foto al bucket y dejar `![pie](url)` bien puesto.
 *
 * Lo que arregla respecto del botón «Insertar foto» de hoy:
 *  - La línea queda SOLA y con línea en blanco alrededor. Hoy se inserta
 *    `\n![](url)\n`, y si el cursor estaba dentro de un bloque `[[…]]` esa
 *    línea entra al CUERPO del bloque y lo tumba entero.
 *  - Valida la URL con la misma regla que el renderizador. `urlSegura` devuelve
 *    null para cualquier cosa que no sea http(s) y entonces Articulo.tsx NO
 *    pinta nada: la línea DESAPARECE del artículo sin decir por qué.
 *  - Prohíbe `]` en el pie y `)` en la URL, que son los dos caracteres que
 *    rompen `/^!\[([^\]]*)\]\(([^)]+)\)$/`.
 *  - Dice lo que pesa. Las imágenes del artículo NO pasan por `/api/img`
 *    (api/img.ts solo acepta el CDN del juego), así que se sirven al tamaño
 *    con que se subieron, hasta 5 MB.
 */

import { useRef, useState } from 'react'
import { Check, ImagePlus, AlertTriangle } from 'lucide-react'
import { Sheet } from '../../../components/ui/Sheet'
import { Button } from '../../../components/ui/Button'
import { subirImagen } from '../../../services/blogService'

/** Articulo.tsx:63 — solo http(s); lo demás no se pinta. */
function urlAceptable(u: string): boolean {
  const s = u.trim()
  if (!s || s.includes(')') || /[\r\n]/.test(s)) return false
  try {
    const p = new URL(s, window.location.origin)
    return p.protocol === 'http:' || p.protocol === 'https:'
  } catch {
    return false
  }
}

export interface InsertorImagenProps {
  onCerrar: () => void
  onAplicar: (texto: string) => void
  /** Id de la persona que sube; la ruta del bucket es `userId/uuid.ext`. */
  userId: string | null
  /** Imagen ya escrita bajo el cursor, para editarla. */
  inicial?: { pie: string; url: string } | null
}

export function InsertorImagen({ onCerrar, onAplicar, userId, inicial = null }: InsertorImagenProps) {
  const [url, setUrl] = useState(inicial?.url ?? '')
  const [pie, setPie] = useState(inicial?.pie ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [peso, setPeso] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  const subir = async (archivo: File) => {
    if (!userId) { setError('Hay que iniciar sesión para subir.'); return }
    setSubiendo(true)
    setError(null)
    const r = await subirImagen(archivo, userId)
    setSubiendo(false)
    if (!r.ok) { setError(r.error); return }
    setPeso(archivo.size)
    setUrl(r.url)
  }

  const valida = urlAceptable(url)
  const texto = `![${pie.trim()}](${url.trim()})`
  // La misma expresión del renderizador, sobre el texto ya montado.
  const formaOk = /^!\[([^\]]*)\]\(([^)]+)\)$/.test(texto)
  const pesada = peso !== null && peso > 700 * 1024

  return (
    <Sheet open onClose={onCerrar} title={inicial ? 'Editar la imagen' : 'Insertar una imagen'}>
      <div className="space-y-3 p-4">
        <Button block size="sm" variant="secondary" loading={subiendo} onClick={() => archivoRef.current?.click()}>
          <ImagePlus size={14} aria-hidden /> Subir una foto
        </Button>
        <input
          ref={archivoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void subir(f)
          }}
        />

        <input
          value={url}
          onChange={e => { setUrl(e.target.value.replace(/[\r\n]/g, '')); setPeso(null) }}
          placeholder="…o pegá una dirección https://"
          inputMode="url"
          className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[13px] text-swu-text
                     placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
        />

        <input
          value={pie}
          /* Un `]` en el pie rompe la línea entera y la imagen no se pinta. */
          onChange={e => setPie(e.target.value.replace(/[\]\r\n]/g, ''))}
          placeholder="Pie de la imagen (opcional, se lee debajo)"
          className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[13px] text-swu-text
                     placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
        />

        {url && valida && (
          <img src={url} alt="" className="mx-auto block h-auto max-h-48 max-w-full rounded-lg" />
        )}

        {url && !valida && (
          <p className="flex items-start gap-1.5 text-[12px] text-swu-red-texto">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden />
            Esa dirección no sirve: tiene que ser http(s) y no puede llevar un «)». Tal como está, la imagen no se pintaría y la línea desaparecería del artículo.
          </p>
        )}
        {pesada && (
          <p className="flex items-start gap-1.5 text-[11px] text-swu-amber">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
            Pesa {(peso! / 1024 / 1024).toFixed(1)} MB y se sirve tal cual: las fotos del artículo no pasan por el redimensionador de cartas.
          </p>
        )}
        {error && <p className="text-[12px] text-swu-red-texto">{error}</p>}

        <pre className="overflow-x-auto rounded-lg border border-swu-border bg-swu-bg px-3 py-2 font-mono text-[10px] text-swu-text">
          {texto}
        </pre>

        <Button block size="sm" disabled={!valida || !formaOk} onClick={() => { onAplicar(texto); onCerrar() }}>
          <Check size={14} aria-hidden /> {inicial ? 'Reemplazar' : 'Insertar'}
        </Button>
      </div>
    </Sheet>
  )
}
