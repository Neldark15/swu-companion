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
import { esMarcoElegido, resolverMarco } from '../../../services/personalizacion'

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

  // Los marcos con esquinas llevan borde más grueso; el glow estático solo
  // aparece de ahí hacia arriba y crece con el tier.
  const grosor = marco.esquinas ? 3 : 2
  const exterior = size + grosor * 2
  const glow = marco.animado
    ? `0 0 14px ${marco.brillo}66`
    : marco.esquinas
      ? `0 0 9px ${marco.brillo}44`
      : undefined

  return (
    <div
      className="relative inline-flex items-center justify-center rounded-xl"
      style={{
        width: exterior,
        height: exterior,
        padding: grosor,
        // El gradiente ES el borde: el hijo opaco deja ver solo el anillo.
        background: `linear-gradient(135deg, ${marco.borde}, ${marco.brillo}, ${marco.borde})`,
        boxShadow: glow,
      }}
      title={`Marco «${marco.nombre}»`}
    >
      {/* La foto/ícono, recortada al cuadrado siguiendo el radio del marco */}
      <div
        className="relative rounded-[10px] overflow-hidden bg-swu-bg z-10"
        style={{ width: size, height: size }}
      >
        {children}
      </div>

      {/* Esquinas dobles decorativas de los marcos altos — estáticas */}
      {marco.esquinas && (
        <>
          <span aria-hidden className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 rounded-tl-xl" style={{ borderColor: marco.brillo }} />
          <span aria-hidden className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-xl" style={{ borderColor: marco.brillo }} />
          <span aria-hidden className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 rounded-bl-xl" style={{ borderColor: marco.brillo }} />
          <span aria-hidden className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 rounded-br-xl" style={{ borderColor: marco.brillo }} />
        </>
      )}

      {/* Respiración sutil de los marcos altos — SOLO opacity */}
      {marco.animado && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl border-2 animate-pulse motion-reduce:animate-none pointer-events-none"
          style={{ borderColor: `${marco.brillo}55` }}
        />
      )}

      {/* El eco expansivo queda reservado al marco máximo — transform+opacity */}
      {marco.id === 'galactico' && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-xl border-2 animate-ping motion-reduce:animate-none opacity-10 pointer-events-none"
          style={{ borderColor: marco.brillo, animationDuration: '3s' }}
        />
      )}
    </div>
  )
}
