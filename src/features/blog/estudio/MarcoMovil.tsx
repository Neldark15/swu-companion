/**
 * MarcoMovil — el teléfono dentro del escritorio.
 *
 * El porqué del iframe (con las tres mediciones que lo obligan) está en
 * puentePrevia.ts. Acá solo está el manejo del marco.
 *
 * ── El antirrebote no es cosmético ────────────────────────────────────
 *
 * Cada `[[carta:]]` del artículo monta un `CartaIncrustada` cuyo efecto hace
 * `db.cards.filter(...)` — un barrido COMPLETO de la tabla, con dependencias
 * `[nombre, set]`. Hoy son 9.185 filas (medido en el navegador contra la base
 * local) y el artículo más largo tiene 26 fichas. Mandar un sobre por tecla
 * sería pedir 26 barridos completos por pulsación.
 *
 * Y las claves de React del renderizador van por índice de línea
 * (`p${i}-c${j}`), así que agregar un renglón arriba corre todas las claves de
 * abajo y remonta las fichas siguientes: no alcanza con que React reconcilie.
 *
 * Por eso: 500 ms de antirrebote y solo se manda si el texto CAMBIÓ. El
 * arreglo de fondo es portar `traerPorNombre` de BloqueMazo.tsx —una consulta
 * indexada para todos los nombres en vez de N barridos— a `CartaIncrustada`;
 * mientras eso no esté, este antirrebote es lo único que separa la previa en
 * vivo de una pantalla trabada.
 */

import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { CANAL, esSaludo, ANCHOS, type IdAncho, type Sobre } from './puentePrevia'

const RETARDO_MS = 500

export function MarcoMovil({ sobre }: { sobre: Omit<Sobre, 'canal'> }) {
  const marcoRef = useRef<HTMLIFrameElement>(null)
  const [ancho, setAncho] = useState<IdAncho>('base')
  const listo = useRef(false)
  const ultimo = useRef<string | null>(null)

  // El saludo del marco. Va aparte del envío para que el primer sobre no se
  // pierda: hasta que el iframe no dice «listo», nadie está escuchando.
  const sobreRef = useRef(sobre)
  useEffect(() => { sobreRef.current = sobre })

  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.source !== marcoRef.current?.contentWindow) return
      if (!esSaludo(e.data)) return
      listo.current = true
      ultimo.current = null
      marcoRef.current?.contentWindow?.postMessage(
        { canal: CANAL, ...sobreRef.current }, window.location.origin,
      )
    }
    window.addEventListener('message', alRecibir)
    return () => window.removeEventListener('message', alRecibir)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!listo.current) return
      const firma = JSON.stringify(sobre)
      if (firma === ultimo.current) return
      ultimo.current = firma
      marcoRef.current?.contentWindow?.postMessage({ canal: CANAL, ...sobre }, window.location.origin)
    }, RETARDO_MS)
    return () => clearTimeout(t)
  }, [sobre])

  const px = ANCHOS.find(a => a.id === ancho)?.ancho ?? 390

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-shrink-0 items-center gap-2">
        <select
          value={ancho}
          onChange={e => setAncho(e.target.value as IdAncho)}
          aria-label="Ancho del teléfono"
          className="bg-swu-surface border border-swu-border rounded-lg px-2 py-1 text-[11px] text-swu-text"
        >
          {ANCHOS.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <button
          onClick={() => {
            // Recargar el marco: la única salida si el artículo dejó la base de
            // cartas a medias o si se quiere ver el arranque desde cero.
            listo.current = false
            ultimo.current = null
            // Mismo origen, así que se puede recargar por dentro. Reasignar
            // `src` metería una entrada en el historial del navegador.
            marcoRef.current?.contentWindow?.location.reload()
          }}
          className="flex items-center gap-1 text-[11px] text-swu-muted hover:text-swu-text"
        >
          <RotateCw size={12} aria-hidden /> Recargar
        </button>
      </div>

      {/* El marco NO se escala con `transform`. Escalar mantiene el viewport
          interno (las media queries seguirían bien) pero achica la letra, y
          entonces deja de servir para lo único que de verdad se revisa acá:
          si un título de 44 px cabe en dos renglones o en cuatro. */}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-swu-border bg-black/30 p-3">
        <iframe
          ref={marcoRef}
          src="/blog/previa"
          title="Vista previa en el teléfono"
          style={{ width: px }}
          className="mx-auto block h-full min-h-[520px] rounded-xl border border-swu-border bg-swu-bg"
        />
      </div>
    </div>
  )
}
