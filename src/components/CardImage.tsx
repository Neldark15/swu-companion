/**
 * CardImage — cómo se ve una carta en toda la app.
 *
 * ── Qué hay que saber del arte oficial ────────────────────────────────
 *
 * Medido sobre los PNG de la CDN:
 *
 *   - Unidades, eventos y mejoras: 286x400  (vertical,  ratio 0.715)
 *   - Líderes y bases:             400x286  (APAISADAS, ratio 1.399)
 *   - Los dos son RGBA y traen **las esquinas ya recortadas** con su propio
 *     radio (~2,8% del ancho). La carta llega con su silueta hecha.
 *
 * De ahí salen las tres decisiones de este componente:
 *
 * 1. **La caja se adapta a la carta, no al revés.** Meter un líder apaisado
 *    en una celda vertical con `object-contain` lo dejaba ocupando el 40% de
 *    arriba y un hueco muerto debajo: la rejilla quedaba agujereada y la
 *    carta ilegible. Ahora la orientación decide la proporción de la caja.
 *
 * 2. **Cuando la celda no coincide con la carta, el hueco se rellena con el
 *    propio arte desenfocado.** Es lo que hacen las fichas de película: la
 *    carta nítida y centrada, y detrás su misma imagen ampliada y borrosa.
 *    Elimina el vacío sin inventar un marco ni recortar la carta.
 *
 * 3. **La profundidad va con `drop-shadow`, no con `box-shadow`.** Como las
 *    esquinas son transparentes, una sombra de caja dibuja un rectángulo por
 *    detrás de una carta redondeada y se ve el pico. `drop-shadow` sigue el
 *    alfa, así que la sombra tiene la forma de la carta.
 *
 * Y por eso NO se le pone fondo ni `rounded` propios: cualquier radio fijo
 * discrepa del que trae la imagen a todos los tamaños salvo por casualidad.
 */

import { useState, useRef, useEffect, memo } from 'react'
import { Package } from 'lucide-react'
import { anchoArte, artUrlOptimizada } from '../services/cardArt'

/** Proporciones reales del arte oficial. */
export const RATIO_VERTICAL = 286 / 400
export const RATIO_APAISADO = 400 / 286

export type Orientacion = 'vertical' | 'apaisada'

interface CardImageProps {
  src: string | undefined | null
  alt?: string
  className?: string
  /** Margen de precarga en px (por defecto 300) */
  rootMargin?: number
  /**
   * Cómo encaja la imagen en la caja.
   * - 'cover': recorta para llenar.
   * - 'contain': entra completa.
   *
   * Se mantiene por compatibilidad con quien ya lo pasa, pero lo normal es
   * NO pasarlo: con `orientacion` el componente ya sabe qué hacer.
   */
  fit?: 'cover' | 'contain'
  /**
   * Orientación de la carta. Si se indica, la caja reserva su proporción
   * desde el primer pintado —sin salto de layout— y el relleno desenfocado
   * sabe cuándo hace falta.
   */
  orientacion?: Orientacion
  /**
   * Elevación. `'plana'` para listas densas, `'realce'` cuando la carta es
   * protagonista. La sombra sigue la silueta de la carta.
   */
  elevacion?: 'plana' | 'realce'
  /** Marca de brillo holográfico, para las impresiones foil. */
  foil?: boolean
}

export const CardImage = memo(function CardImage({
  src,
  alt = '',
  className = 'w-12 h-16',
  rootMargin = 300,
  fit,
  orientacion,
  elevacion = 'plana',
  foil = false,
}: CardImageProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  /** Orientación medida de la imagen ya cargada. Manda sobre la declarada:
   *  si un llamador se equivoca, la carta igual se ve bien. */
  const [medida, setMedida] = useState<Orientacion | null>(null)
  /**
   * La URL que de verdad se pide: la original recortada al tamaño de ESTA
   * caja, y a la vez la señal de «ya está cerca de la pantalla».
   *
   * Guarda JUNTO a la URL de quién es (`para`). Así, si la rejilla reusa este
   * componente para otra carta —cambia `src` sin desmontar—, la URL vieja
   * deja de valer sola, sin un efecto que la limpie y sin un fotograma
   * mostrando la carta anterior.
   *
   * `null` = todavía no toca pedir nada. Sin IntersectionObserver no hay a
   * qué esperar, así que arranca con el peldaño más grande. Va como estado
   * inicial y no como un `setState` dentro de un efecto: eso último provoca
   * un render en cascada por cada carta de la rejilla.
   */
  const [pedido, setPedido] = useState<{ para: string; url: string } | null>(() =>
    typeof IntersectionObserver === 'undefined' && src
      ? { para: src, url: artUrlOptimizada(src, anchoArte(Infinity, 1)) ?? src }
      : null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const urlPedida = pedido && pedido.para === src ? pedido.url : null
  const isVisible = urlPedida !== null

  /**
   * IntersectionObserver — solo carga cuando está cerca de la pantalla, y de
   * paso decide A QUÉ TAMAÑO pedirla.
   *
   * El tamaño se MIDE, no se declara en cada sitio: hay 23 archivos que
   * dibujan cartas y ninguno sabe a cuántos píxeles termina en el teléfono de
   * quien mira. El nodo sí lo sabe, y el propio observador ya trae la caja
   * medida en `entry.boundingClientRect`, así que sale gratis: ni un
   * `getBoundingClientRect` extra —que forzaría un cálculo de layout
   * sincrónico por carta— ni un efecto de más.
   */
  useEffect(() => {
    const el = containerRef.current
    if (!el || !src) return

    // El caso «no hay IntersectionObserver» ya lo resolvió el estado inicial.
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const ancho = entry.boundingClientRect.width
        const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
        // Sin ancho medible no se adivina: se pide el peldaño más grande, que
        // es lo que hacía la app antes y nunca se ve mal.
        const peldano = ancho > 0 ? anchoArte(ancho, dpr) : anchoArte(Infinity, 1)
        setPedido({ para: src, url: artUrlOptimizada(src, peldano) ?? src })
      },
      { rootMargin: `${rootMargin}px` },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [src, rootMargin])

  // Carga de la imagen.
  useEffect(() => {
    if (!isVisible || !src || !urlPedida) return

    let cancelled = false
    const img = new Image()
    // Los manejadores van ANTES de asignar `src`. Al revés, una imagen que ya
    // está en caché podía terminar de cargar antes de que existiera el
    // manejador: `load` no volvía a dispararse, el estado quedaba en 'loading'
    // y la carta se veía como un rectángulo vacío para siempre.
    const medir = () => {
      if (img.naturalWidth > 0) {
        setMedida(img.naturalWidth >= img.naturalHeight ? 'apaisada' : 'vertical')
      }
    }
    const listo = () => { if (!cancelled) { medir(); setState('loaded') } }
    const fallo = () => {
      if (cancelled) return
      // Primer fallo con recorte: se reintenta con la ORIGINAL. Que la url
      // pedida sea ya la original es justamente la señal de que este es el
      // segundo intento, o sea una carta que de verdad no está.
      if (urlPedida !== src) setPedido({ para: src, url: src })
      else setState('error')
    }

    // `decode()` descomprime el PNG/WebP FUERA del hilo principal y recién
    // entonces damos la carta por lista. Sin esto, la descompresión ocurría
    // dentro del fotograma en que la carta se pinta: medido, 149 ms de
    // fotograma al desplazar la lista y 100 ms en el binder, con tirones
    // largos de 109-155 ms. Es el mismo trabajo, hecho donde no se ve.
    if (typeof img.decode === 'function') {
      img.decoding = 'async'
      img.src = urlPedida
      img.decode().then(listo, () => {
        // `decode()` también rechaza si la imagen se reemplazó a media carga;
        // si en realidad llegó bien, no es un fallo.
        if (img.complete && img.naturalWidth > 0) listo()
        else fallo()
      })
    } else {
      img.onload = listo
      img.onerror = fallo
      img.src = urlPedida
    }

    // Red de seguridad: si ya está resuelta, no hay ningún evento que esperar.
    // Va en un microtask —no en el cuerpo del efecto— porque un `setState`
    // síncrono ahí dispara un render en cascada por cada carta, y en una
    // rejilla de 200 eso se siente.
    queueMicrotask(() => {
      if (cancelled) return
      if (img.complete && img.naturalWidth > 0) { medir(); setState('loaded') }
      else setState('loading')
    })

    return () => { cancelled = true }
  }, [isVisible, src, urlPedida])

  const orient = medida ?? orientacion ?? 'vertical'

  // Sin imagen: hueco tranquilo, no un error a gritos.
  if (!src) {
    return (
      <div
        className={`${className} radio-carta bg-swu-surface/60 border border-swu-border/50 flex items-center justify-center flex-shrink-0`}
      >
        <Package size={16} className="text-swu-muted/30" />
      </div>
    )
  }

  const sombra = elevacion === 'realce' ? 'carta-realce' : 'carta-plana'
  // Radio en PORCENTAJE, no `rounded-lg`. Con 8px fijos una miniatura de 40px
  // recibía siete veces el radio real de la carta y el recorte se comía arte
  // opaco, no la esquina transparente. Solo hace falta cuando la imagen va
  // recortada ('cover'): con 'contain' la carta entra entera y ya trae su
  // propia curva hecha con el alfa.
  const radio = orient === 'apaisada' ? 'radio-carta-apaisada' : 'radio-carta'
  // `fit` explícito gana; si no, la orientación decide. La carta apaisada
  // dentro de una celda vertical va 'contain' —completa y centrada— y el
  // vacío lo tapa el relleno desenfocado de detrás.
  const ajuste = fit ?? (orient === 'apaisada' ? 'contain' : 'cover')

  return (
    <div
      ref={containerRef}
      className={`${className} overflow-hidden flex-shrink-0 relative isolate`}
    >
      {/* Esqueleto: un barrido suave en vez de un bloque que parpadea.
       *
       * El barrido solo corre si la carta está CERCA DE LA PANTALLA. Antes
       * dependía solo de `state`, que arranca en 'idle', así que se pintaba
       * aunque el IntersectionObserver no hubiera disparado nunca: al abrir
       * Mi Botín había 3 imágenes en el DOM y **200 animaciones infinitas**
       * corriendo (257 en el binder) para filas que estaban enteras fuera de
       * pantalla. Y `carta-barrido` anima `background-position`, que es
       * PINTADO —no compositor—, así que costaba de verdad.
       *
       * Fuera de pantalla queda la misma caja del mismo color: el hueco se
       * ve idéntico, sin nada que animar. */}
      {state !== 'loaded' && state !== 'error' && (
        <div className={`absolute inset-0 ${radio} ${isVisible ? 'carta-esqueleto' : 'carta-hueco'}`} />
      )}

      {isVisible && urlPedida && state !== 'error' && (
        <>
          {/* Relleno: la MISMA imagen ampliada y desenfocada rellena el hueco
              que deja una carta apaisada en una celda vertical. Es el mismo
              archivo —la misma URL, incluido el recorte— así que no cuesta
              una descarga extra. */}
          {ajuste === 'contain' && (
            <img
              src={urlPedida}
              alt=""
              aria-hidden
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover carta-relleno transition-opacity duration-500 ${
                state === 'loaded' ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          <img
            src={urlPedida}
            alt={alt}
            decoding="async"
            className={`relative w-full h-full ${
              ajuste === 'contain' ? 'object-contain' : `object-cover ${radio}`
            } ${sombra} transition-[opacity,transform] duration-300 ${
              state === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Brillo de foil: una banda diagonal muy tenue, por encima del arte
              pero sin taparlo. Solo cuando de verdad es foil. */}
          {foil && state === 'loaded' && (
            <span aria-hidden className={`pointer-events-none absolute inset-0 ${radio} carta-foil`} />
          )}
        </>
      )}

      {state === 'error' && (
        <div className={`absolute inset-0 flex items-center justify-center ${radio} bg-swu-surface/60 border border-swu-border/50`}>
          <Package size={16} className="text-swu-muted/30" />
        </div>
      )}
    </div>
  )
})
