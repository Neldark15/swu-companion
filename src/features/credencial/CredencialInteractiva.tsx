/**
 * La credencial en 3D: se agarra y se gira con el dedo.
 *
 * POR QUÉ ASÍ
 * Una placa metálica se reconoce por cómo le corre la luz al moverla. Estática
 * es un dibujo; inclinándola, el brillo barre la superficie y se lee como
 * metal. Por eso el giro no es un adorno: es lo que hace creíble el material.
 *
 * MÓVIL PRIMERO
 * - `touch-action: pan-y` — el arrastre HORIZONTAL gira la tarjeta y el
 *   VERTICAL sigue haciendo scroll de la página. Con `none` la placa se comía
 *   el scroll y quedabas atrapado al pasar el dedo por encima, que es el error
 *   clásico de estos widgets en el teléfono.
 * - El movimiento se escribe DIRECTO en el `style` del nodo, sin estado de
 *   React. Un `setState` por cada `pointermove` son ~60 renders por segundo
 *   arrastrando: en un teléfono de gama media eso se siente pegajoso.
 * - Al soltar, la tarjeta se acomoda a la cara más cercana (frente o dorso).
 *   Quedarse a medio girar mostraría un canto ilegible.
 *
 * Con `prefers-reduced-motion` no se inclina ni gira sola: queda el botón de
 * girar, que es un cambio de estado y no un movimiento continuo.
 */

import { useCallback, useId, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { CredencialSVG, type DatosCredencial } from './CredencialSVG'
import { CredencialReverso } from './CredencialReverso'
import { SILUETA_BASE } from './geometriaCredencial'
import type { TemaCredencial, EmblemaCredencialId } from './credencialTemas'
import type { AcabadoCredencial } from './acabadosCredencial'

interface Props {
  datos: DatosCredencial
  tema: TemaCredencial
  emblema: EmblemaCredencialId
  acabado?: AcabadoCredencial
  /** El nivel del jugador: lo muestra el riel de identidad del anverso. */
  nivel?: number
  /** Ancho máximo del bloque (la altura sale de la proporción 512×320). */
  className?: string
  /** Muestra la pista «arrastrá para girar». En listas conviene apagarla. */
  conPista?: boolean
  /**
   * Qué hacer con un TOQUE (no un arrastre) sobre la placa. En Inicio lleva al
   * perfil. Va como callback y no envolviendo todo en un <button> porque un
   * botón dentro de otro botón —el de girar vive acá adentro— es HTML inválido
   * y los lectores de pantalla lo anuncian mal.
   */
  onTocar?: () => void
  /** Texto del botón equivalente al toque (para teclado y lector de pantalla). */
  etiquetaToque?: string
}

/** Cuánto se puede inclinar hacia adelante/atrás. Más se ve deformado. */
const TOPE_X = 16
/** Grados de giro por píxel arrastrado. Calibrado para que media pantalla de
 *  teléfono (~190 px) alcance a dar la vuelta completa. */
const GRADOS_POR_PX = 0.95

export function CredencialInteractiva({
  datos, tema, emblema, acabado, nivel, className, conPista = true, onTocar, etiquetaToque = 'Abrir',
}: Props) {
  const uid = useId()
  const escenaRef = useRef<HTMLDivElement>(null)
  const cajaRef = useRef<HTMLDivElement>(null)
  // El giro vive en un ref, no en estado: se lee y se escribe en cada
  // `pointermove` y no debe provocar render.
  const giro = useRef({ x: 0, y: 0 })
  const arrastre = useRef<{ id: number; px: number; py: number; movido: boolean } | null>(null)
  // Lo único que SÍ es estado: si la cara visible es el dorso. Cambia el texto
  // del botón y el `aria` — una vez por giro, no 60 veces por segundo.
  const [dorso, setDorso] = useState(false)

  const pintar = useCallback((conTransicion: boolean) => {
    const el = cajaRef.current
    if (!el) return
    el.style.transition = conTransicion ? 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    el.style.transform = `rotateX(${giro.current.x}deg) rotateY(${giro.current.y}deg)`
    // El reflejo sigue al giro: la luz entra por donde se inclinó la placa.
    escenaRef.current?.style.setProperty('--brillo-x', `${50 - giro.current.y * 0.9}%`)
    escenaRef.current?.style.setProperty('--brillo-y', `${50 + giro.current.x * 1.6}%`)
    // El punto duro se corre al doble: está al doble de profundidad.
    escenaRef.current?.style.setProperty('--luz-x', `${50 - giro.current.y * 1.8}%`)
    escenaRef.current?.style.setProperty('--luz-y', `${50 + giro.current.x * 3.2}%`)
  }, [])

  const alBajar = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // El botón de girar vive dentro de la escena: si el gesto arranca ahí,
    // no se secuestra como arrastre.
    if ((e.target as HTMLElement).closest('button')) return
    arrastre.current = { id: e.pointerId, px: e.clientX, py: e.clientY, movido: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const alMover = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    const dx = e.clientX - a.px
    const dy = e.clientY - a.py
    // Hasta que el gesto se define como horizontal, no se toca nada: si la
    // persona quería hacer scroll, la tarjeta no debe temblar bajo el dedo.
    if (!a.movido) {
      if (Math.abs(dx) < 6) return
      if (Math.abs(dy) > Math.abs(dx)) { arrastre.current = null; return }
      a.movido = true
      a.px = e.clientX
      a.py = e.clientY
      return
    }
    giro.current.y += (e.clientX - a.px) * GRADOS_POR_PX
    giro.current.x = Math.max(-TOPE_X, Math.min(TOPE_X, giro.current.x - (e.clientY - a.py) * 0.35))
    a.px = e.clientX
    a.py = e.clientY
    pintar(false)
  }, [pintar])

  const alSoltar = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    arrastre.current = null
    if (!a.movido) {
      // Fue un toque, no un giro: recién acá se sabe la diferencia, y por eso
      // la navegación no puede colgar del `onClick` del contenedor.
      onTocar?.()
      return
    }
    // Se acomoda a la MEDIA VUELTA MÁS CERCANA, conservando el signo.
    //
    // Antes esto normalizaba a 0 o 180 «a secas», y ahí estaba el error: al
    // soltar en -162° la tarjeta se iba a +180, o sea 342 grados de viaje para
    // corregir 18. Se veía como un tirón hacia el lado contrario al que
    // habías arrastrado. Ahora la cara se decide por la PARIDAD de la media
    // vuelta y el ángulo se queda donde está.
    const media = Math.round(giro.current.y / 180)
    giro.current.y = media * 180
    giro.current.x = 0
    pintar(true)
    setDorso(Math.abs(media % 2) === 1)
  }, [pintar, onTocar])

  const girar = useCallback(() => {
    // Media vuelta desde donde esté. Sumar y no fijar un valor absoluto es lo
    // que hace que el botón siga funcionando después de haber arrastrado la
    // placa: el ángulo puede ser 540 o -360 y la cara sale de la paridad.
    giro.current.y += 180
    giro.current.x = 0
    pintar(true)
    setDorso(Math.abs(Math.round(giro.current.y / 180) % 2) === 1)
  }, [pintar])

  return (
    <div className="w-full" style={{ maxWidth: '36rem' }}>
      <div
        ref={escenaRef}
        className={`relative touch-pan-y select-none ${className ?? ''}`}
        style={{
          perspective: '1100px',
          ['--brillo-x' as string]: '50%', ['--brillo-y' as string]: '50%',
          ['--luz-x' as string]: '50%', ['--luz-y' as string]: '50%',
        }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <div
          ref={cajaRef}
          className="relative motion-reduce:!transition-none"
          style={{ transformStyle: 'preserve-3d', aspectRatio: '512 / 320' }}
        >
          {/* ── El CANTO ──
              El espesor de la tarjeta: al inclinarla se ve el borde, y eso es
              lo que separa un objeto de una calcomanía.

              VA COMO CONTORNO, NO COMO RELLENO, y ahí está toda la historia.
              El canto de una tarjeta ES solo el borde; rellenarlo era el error
              de fondo. Con relleno, cada capa es una losa opaca del tamaño de
              la placa, y en cuanto la tarjeta gira media vuelta esas losas
              quedan por delante de la cara de atrás y la tapan entera: el dorso
              «se perdía».

              Se probaron dos arreglos de ordenamiento antes de ver el error de
              concepto —mover las caras a las superficies externas, y duplicar
              el canto con `backfaceVisibility` por lado— y ninguno sirvió:
              medido en el navegador, el compositor no ordena por profundidad
              entre los <svg> del canto y los <div> de las caras.

              Como contorno el problema no existe: el interior queda
              transparente, así que ninguna capa puede tapar a ninguna cara,
              mire desde donde mire, y no hace falta que nadie ordene nada. */}
          {[2, 4, 6, 8].map((z, i) => (
            <svg
              key={z}
              aria-hidden
              viewBox="0 0 512 320"
              className="pointer-events-none absolute inset-0 h-full w-full print:hidden"
              style={{ transform: `translateZ(-${z}px)` }}
            >
              <path
                d={SILUETA_BASE}
                fillRule="evenodd"
                fill="none"
                stroke={tema.base}
                // Grueso: cada contorno tiene que solaparse con el siguiente o
                // el canto se ve como cuatro líneas sueltas en vez de macizo.
                strokeWidth="7"
                // Se va oscureciendo hacia el fondo: a la ranura le entra menos
                // luz que al borde de afuera.
                style={{ filter: `brightness(${0.7 - i * 0.15})` }}
              />
            </svg>
          ))}

          {/* Frente. Va PRIMERO en el DOM porque la impresión toma el primer
              svg de la zona (ver `imprimirCredencial`). */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <CredencialSVG
              datos={datos} tema={tema} emblema={emblema} acabado={acabado} nivel={nivel}
              className="w-full drop-shadow-[0_14px_30px_rgba(0,0,0,0.6)]"
            />
          </div>
          {/* Dorso: girado media vuelta, así queda de frente cuando la caja
              llega a 180°. */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <CredencialReverso
              datos={datos} tema={tema} emblema={emblema} acabado={acabado}
              className="w-full drop-shadow-[0_14px_30px_rgba(0,0,0,0.6)]"
            />
          </div>
          {/* ── Reflejos ──
              Flotan por DELANTE de la cara, y esa separación es la que produce
              el paralaje: al inclinar se corren respecto del metal en vez de ir
              pegados a él, y el ojo lee que hay un vidrio encima. Pegados a la
              cara se ven como manchas pintadas.

              Hay un juego POR CADA CARA. Antes había uno solo, colgado del
              frente: al girar la tarjeta se iba para atrás con él y el dorso
              quedaba mate y sucio, sin nada de luz. Cada juego lleva
              `backfaceVisibility: hidden`, así que solo se ve el de la cara que
              estás mirando y nunca se suman los dos. */}
          {[
            { lado: 'frente', giro: '' },
            { lado: 'dorso', giro: 'rotateY(180deg) ' },
          ].map(({ lado, giro }) => (
            <div key={lado} className="contents">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-soft-light print:hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: `${giro}translateZ(20px)`,
                  background:
                    'radial-gradient(60% 90% at var(--brillo-x) var(--brillo-y), rgba(255,255,255,0.55), rgba(255,255,255,0.06) 55%, transparent 72%)',
                }}
              />
              {/* El punto duro: la luz que se desliza en una tarjeta laminada.
                  Va más adelante todavía y por eso se mueve al doble. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-overlay print:hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: `${giro}translateZ(32px)`,
                  background:
                    'radial-gradient(22% 34% at var(--luz-x) var(--luz-y), rgba(255,255,255,0.5), transparent 70%)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 print:hidden">
        <button
          onClick={girar}
          aria-pressed={dorso}
          className="flex items-center gap-1.5 rounded-full border border-swu-border bg-swu-surface px-3.5 py-1.5 text-[11px] font-bold text-swu-text active:scale-95 transition-transform"
        >
          <RotateCw size={13} /> {dorso ? 'Ver el frente' : 'Ver el dorso'}
        </button>
        {onTocar && (
          <button
            onClick={onTocar}
            className="flex items-center gap-1.5 rounded-full border border-swu-border bg-swu-surface px-3.5 py-1.5 text-[11px] font-bold text-swu-text active:scale-95 transition-transform"
          >
            {etiquetaToque}
          </button>
        )}
        {conPista && (
          <span className="text-[10px] text-swu-muted" id={`${uid}-pista`}>
            Arrastrá la placa para girarla
          </span>
        )}
      </div>
    </div>
  )
}
