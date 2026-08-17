/**
 * ProfileFrame — el marco de la fotografía: cuadrado, y GANADO por nivel.
 *
 * El dibujo ya no vive acá: sale del catálogo MARCOS de personalizacion.ts,
 * el mismo que consume Ajustes para el picker. Este componente solo resuelve
 * QUÉ marco corresponde y lo pinta.
 *
 * - Sin `marcoId` (o con uno inválido o no ganado) se cae a 'auto': el marco
 *   más alto que el nivel ya alcanzó — la conducta de siempre. Por eso los
 *   usos existentes no necesitan pasar nada nuevo.
 * - Con `marcoId` ganado se respeta la elección: ganado es ganado, aunque
 *   el nivel haya subido más.
 *
 * ── Rendimiento (esto se pinta en LISTAS: comunidad, espionaje) ──────────
 *
 * Nada de filter/blur ni sombras animadas. El glow es un box-shadow ESTÁTICO
 * —se pinta una vez y no vuelve a costar—, y las únicas animaciones, solo en
 * los marcos altos (raros en una lista), tocan transform/opacity: la
 * respiración es `animate-pulse` (opacity) y el eco del marco máximo un
 * `animate-ping` lento (scale+opacity). Con `prefers-reduced-motion` se
 * quedan quietas. El marco además tiene NOMBRE: acá va en `title` (tooltip
 * de escritorio; en táctil no aparece) y en Ajustes el nombre es texto
 * visible bajo cada miniatura — el color nunca es el único portador de
 * significado.
 */

import type { ReactNode } from 'react'
import { esMarcoElegido, resolverMarco, MARCOS } from '../../../services/personalizacion'
import { MarcoHud, RECORTE_HUD } from './MarcoHud'

interface ProfileFrameProps {
  level: number
  children: ReactNode
  size?: number
  /**
   * El marco ELEGIDO por la persona (normalmente `marcoElegido` de
   * useSettings). Llega como string porque puede venir de datos guardados:
   * acá se valida, y `resolverMarco` ya se encarga de caer a 'auto' si la
   * elección no está ganada.
   */
  marcoId?: string
}

export function ProfileFrame({ level, children, size = 80, marcoId }: ProfileFrameProps) {
  const marco = resolverMarco(esMarcoElegido(marcoId) ? marcoId : 'auto', level)

  // El nivel del panel (1..7) sale del ORDEN del catálogo: es la misma escala
  // que ya define qué marco se gana con qué nivel, así que no hay una segunda
  // fuente de verdad que se pueda desincronizar.
  const tier = Math.max(1, MARCOS.findIndex(m => m.id === marco.id) + 1)

  const grosor = marco.esquinas ? 3 : 2
  const exterior = size + grosor * 2

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{
        width: exterior,
        height: exterior,
        padding: grosor,
        /* Ojo: acá NO va `clip-path`.
         *
         * Recortar este contenedor parecía lo correcto para que la sombra
         * siguiera la silueta, pero `clip-path` recorta TODO lo que hay dentro
         * —incluido el SVG del marco— y además elimina el `box-shadow` por
         * completo. Se veía: el eco exterior del marco máximo y el resplandor
         * desaparecían contra el borde de la caja.
         *
         * El halo lo hace ahora el propio SVG con un trazo ancho translúcido,
         * que sigue la silueta de verdad y no cuesta un desenfoque. */
      }}
      title={`Marco «${marco.nombre}»`}
    >
      {/* La foto/ícono toma la MISMA silueta del panel: es lo que hace que el
          marco se sienta parte de la pieza y no una calcomanía encima. */}
      <div
        className="relative overflow-hidden bg-swu-bg z-10"
        style={{ width: size, height: size, clipPath: RECORTE_HUD }}
      >
        {children}
      </div>

      {/* El panel HUD, por encima de la foto */}
      <MarcoHud
        tier={tier}
        borde={marco.borde}
        brillo={marco.brillo}
        lado={exterior}
        animado={marco.animado}
      />

      {/* Las esquinas, la respiración y el eco los dibuja ahora MarcoHud dentro
          del propio SVG: viven con la silueta octogonal en vez de pelearse con
          un `rounded-xl` que ya no existe. */}
    </div>
  )
}
