/**
 * Los íconos de las misiones — propios, vectoriales, uno por OBJETIVO.
 *
 * ── Por qué se fueron los emoji ───────────────────────────────────────
 *
 * El catálogo llevaba 27 emoji distintos, y un emoji **lo dibuja el sistema
 * operativo**: 🛰️ en un iPhone y en un Android son dos dibujos que no se
 * parecen, y en algunos Android ni siquiera existe y sale el cuadrito. O sea
 * que la única superficie donde la app no controlaba su propio aspecto era
 * justo la lista que se abre todos los días.
 *
 * ── Uno por OBJETIVO, no uno por misión ───────────────────────────────
 *
 * Antes «abrir 1 sobre» era 📦 y «abrir 3 sobres» 🎁: dos dibujos para la
 * MISMA acción. El ícono ahora dice QUÉ HAY QUE HACER, y cuántas veces ya lo
 * dice el contador de al lado. Son 16 objetivos y 16 íconos.
 *
 * ── Y casi todos ya existían ──────────────────────────────────────────
 *
 * El ícono de una misión es el de LA PANTALLA donde se hace: quien ve el
 * sobre de Sobredosis sabe adónde va sin leer. Eso es identificar, no
 * decorar (§ del inventario de íconos). Acá solo viven los cinco que no
 * tenían dueño todavía; el resto se toma de `SWIcons` y `SWUIcons`.
 */

import type { SVGProps } from 'react'
/** La misma base que `SWIcons`: 24×24, trazo de 1,5 y color heredado. */
function base(size: number, className: string): SVGProps<SVGSVGElement> {
  return {
    'aria-hidden': true,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  }
}

interface P { size?: number; className?: string }

/**
 * BALIZA — «pasar lista», entrar hoy.
 *
 * Un mástil con tres arcos que salen. No es un satélite (ese es 🛰️ y ya
 * significa transmisión en esta app): una baliza es algo que se enciende
 * cuando llegás, que es exactamente lo que la misión premia.
 */
export function BalizaIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 21v-7" />
      <path d="M9.5 21h5" />
      <circle cx="12" cy="11.5" r="2.5" fill="currentColor" fillOpacity="0.25" />
      <path d="M8 8.2a5.4 5.4 0 0 1 8 0" opacity="0.85" />
      <path d="M5.6 5.4a8.8 8.8 0 0 1 12.8 0" opacity="0.5" />
    </svg>
  )
}

/**
 * APOYO — dar corazón a una publicación.
 *
 * Corazón FACETADO, con dos aristas rectas y una punta marcada. El del
 * sistema es blando y redondo; este se parece al resto de la chapa de la app.
 */
export function ApoyoIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 20.5 4.8 13a4.6 4.6 0 0 1 0-6.5 4.4 4.4 0 0 1 6.3 0L12 7.4l.9-.9a4.4 4.4 0 0 1 6.3 0 4.6 4.6 0 0 1 0 6.5z"
        fill="currentColor" fillOpacity="0.15"
      />
      <path d="M12 20.5 4.8 13a4.6 4.6 0 0 1 0-6.5 4.4 4.4 0 0 1 6.3 0L12 7.4l.9-.9a4.4 4.4 0 0 1 6.3 0 4.6 4.6 0 0 1 0 6.5z" />
      {/* La arista que lo vuelve una placa y no una gota. */}
      <path d="M12 7.4V20.5" opacity="0.35" />
    </svg>
  )
}

/**
 * CARTA + — sumar una carta a la colección.
 *
 * La carta va inclinada y el «+» sale de la esquina, en su propio disco: a 14
 * px un signo encima del rectángulo se lee como una raya de más.
 */
export function CartaMasIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="4" y="3.5" width="11" height="15" rx="1.6" fill="currentColor" fillOpacity="0.12" />
      <rect x="4" y="3.5" width="11" height="15" rx="1.6" />
      <path d="M7 7.5h5" opacity="0.5" />
      <circle cx="17.5" cy="16.5" r="4" fill="currentColor" fillOpacity="0.18" />
      <circle cx="17.5" cy="16.5" r="4" />
      <path d="M17.5 14.8v3.4M15.8 16.5h3.4" />
    </svg>
  )
}

/**
 * ETIQUETA — poner una carta en venta.
 *
 * Etiqueta con el agujero del hilo. El emoji 🏷️ apunta para el otro lado en
 * la mitad de los sistemas; acá siempre mira igual.
 */
export function EtiquetaIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M11.6 3.2H19a1.8 1.8 0 0 1 1.8 1.8v7.4a1.8 1.8 0 0 1-.53 1.27l-6.6 6.6a1.8 1.8 0 0 1-2.55 0l-6.6-6.6a1.8 1.8 0 0 1 0-2.55l6.6-6.6a1.8 1.8 0 0 1 1.27-.53z"
        fill="currentColor" fillOpacity="0.13"
      />
      <path d="M11.6 3.2H19a1.8 1.8 0 0 1 1.8 1.8v7.4a1.8 1.8 0 0 1-.53 1.27l-6.6 6.6a1.8 1.8 0 0 1-2.55 0l-6.6-6.6a1.8 1.8 0 0 1 0-2.55l6.6-6.6a1.8 1.8 0 0 1 1.27-.53z" />
      <circle cx="16.4" cy="7.6" r="1.7" />
    </svg>
  )
}

/**
 * MAZO COMPARTIDO — sacar la hoja del mazo y mandarla.
 *
 * Mazo con una flecha que SALE. La flecha va fuera del contorno para que a
 * tamaño chico no se confunda con una carta más del montón.
 */
export function MazoCompartidoIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="3.5" y="7" width="10" height="13.5" rx="1.6" fill="currentColor" fillOpacity="0.12" />
      <rect x="3.5" y="7" width="10" height="13.5" rx="1.6" />
      <path d="M6.5 4.5h8a1.6 1.6 0 0 1 1.6 1.6v11" opacity="0.45" />
      <path d="M15.5 8.5h5v5" />
      <path d="M20.5 8.5 14 15" />
    </svg>
  )
}

/**
 * REGALO — enviar un regalo a alguien.
 *
 * No se puede reusar `GiftIcon`: ese exige un `type` (qué regalo es) y dibuja
 * uno distinto por clase. Acá hace falta el gesto, no el contenido.
 *
 * La cinta cruza ENTERA, arriba y abajo, y el lazo son dos arcos. Con un
 * lazo relleno, a 14 px la caja se lee como un botón.
 */
export function RegaloIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <rect x="3.5" y="9.5" width="17" height="11" rx="1.6" fill="currentColor" fillOpacity="0.12" />
      <rect x="3.5" y="9.5" width="17" height="11" rx="1.6" />
      <path d="M2.5 6.5h19v3h-19z" fill="currentColor" fillOpacity="0.2" />
      <path d="M2.5 6.5h19v3h-19z" />
      <path d="M12 6.5v14" />
      <path d="M12 6.5C12 6.5 10.8 3 8.8 3a2 2 0 0 0 0 3.5z" />
      <path d="M12 6.5C12 6.5 13.2 3 15.2 3a2 2 0 0 1 0 3.5z" />
    </svg>
  )
}

/**
 * SOBRE — abrir un sobre.
 *
 * NO se reusa `SobreIcon` de la navegación: a 22 px se lee como un
 * CALENDARIO. Su propio comentario cuenta que la primera versión parecía un
 * bloc de notas y le quitaron los renglones, pero el dentado de arriba más la
 * banda diagonal siguen dando «hoja arrancada» cuando el ícono es chico y no
 * lleva la palabra «Sobredosis» al lado.
 *
 * Lo que lo vuelve inconfundible es la CARTA SALIENDO: un sobre cerrado es un
 * rectángulo, un sobre abierto es un rectángulo con algo asomando. Y la tira
 * de apertura va separada por una línea, no por dientes.
 */
export function SobreMisionIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      {/* La carta que asoma, primero: queda por detrás del envoltorio. */}
      <path d="M9 6.5h6v4H9z" fill="currentColor" fillOpacity="0.35" />
      <path d="M9 6.5h6v4" />
      {/* El envoltorio. */}
      <path d="M5 9.5h14v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z"
            fill="currentColor" fillOpacity="0.14" />
      <path d="M5 9.5h14v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      {/* La tira de apertura. */}
      <path d="M5 12.5h14" opacity="0.55" />
    </svg>
  )
}

/**
 * CHAT — escribir en una sala.
 *
 * `SalasIcon` es un grafo de nodos: a 15 px se lee como una MOLÉCULA, no como
 * hablar. Un bocadillo con cola es el dibujo que todo el mundo reconoce; lo
 * que lo vuelve de esta app son los tres puntos alineados y el corte recto de
 * la esquina, en vez de un óvalo blando.
 */
export function ChatMisionIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6.6A1.6 1.6 0 0 1 5.6 5h12.8A1.6 1.6 0 0 1 20 6.6v8.3a1.6 1.6 0 0 1-1.6 1.6H10l-4.6 3.4v-3.4h-.2A1.2 1.2 0 0 1 4 15.3z"
            fill="currentColor" fillOpacity="0.14" />
      <path d="M4 6.6A1.6 1.6 0 0 1 5.6 5h12.8A1.6 1.6 0 0 1 20 6.6v8.3a1.6 1.6 0 0 1-1.6 1.6H10l-4.6 3.4v-3.4h-.2A1.2 1.2 0 0 1 4 15.3z" />
      <circle cx="8.6" cy="10.8" r="1.05" fill="currentColor" />
      <circle cx="12" cy="10.8" r="1.05" fill="currentColor" />
      <circle cx="15.4" cy="10.8" r="1.05" fill="currentColor" />
    </svg>
  )
}

/**
 * AMISTOSA — registrar un duelo.
 *
 * `IconDualBlades` a 15 px es un aspa suelta: no se ve dónde empieza cada
 * hoja. Acá las dos empuñaduras están MARCADAS —cada sable es mango grueso +
 * hoja fina— así que a tamaño chico se lee «dos cosas cruzadas» y no «una X».
 */
export function AmistosaIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      {/* Empuñaduras, gruesas. */}
      <path d="M4.4 19.6 7 17" strokeWidth="3" opacity="0.85" />
      <path d="M19.6 19.6 17 17" strokeWidth="3" opacity="0.85" />
      {/* Hojas, finas y más largas. */}
      <path d="M7.6 16.4 17.4 6.6" />
      <path d="M16.4 16.4 6.6 6.6" />
      {/* Los dos remates: sin esto las hojas se ven cortadas al aire. */}
      <circle cx="17.9" cy="6.1" r="1.3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="6.1" cy="6.1" r="1.3" fill="currentColor" fillOpacity="0.3" />
    </svg>
  )
}

/**
 * LA BUSCO — marcar una carta que se anda buscando.
 *
 * `BountyIcon` es un casco: en la navegación funciona porque significa
 * «Contrabando», pero acá la misión es «marcá una carta que querés» y un
 * casco no dice eso. Una MIRA sobre una carta sí: es buscar algo concreto.
 */
export function LaBuscoIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      {/* La carta a la izquierda y la mira a la derecha, SIN pisarse.
          El primer intento montaba la mira encima con un relleno del color de
          fondo para tapar el borde de la carta — y eso ata el ícono a un fondo
          concreto: sobre la chapa clara el disco salía oscuro y se comía la
          cruz. Un ícono que solo funciona sobre un color no es un ícono. */}
      <rect x="3" y="5" width="9" height="12.5" rx="1.5" fill="currentColor" fillOpacity="0.14" />
      <rect x="3" y="5" width="9" height="12.5" rx="1.5" />
      <path d="M5.6 8.2h3.8" opacity="0.5" />

      <circle cx="16.8" cy="14.8" r="4.2" />
      <circle cx="16.8" cy="14.8" r="1.15" fill="currentColor" />
      <path d="M16.8 8.8v2.1M16.8 18.7v2.1M10.8 14.8h2.1M20.7 14.8h2.1" />
    </svg>
  )
}

// ─── Íconos de la INTERFAZ de Misiones ────────────────────────────────
//
// Los seis que traía la pantalla eran de `lucide-react`: una biblioteca de
// terceros, con su propio trazo y sus propios remates. Al lado de los íconos
// del juego se notaba que venían de otro lado — y son los que encabezan cada
// sección, o sea los más grandes de la pantalla.

/** DIANA — el encabezado de Misiones. Retícula de puntería, no un blanco. */
export function DianaIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </svg>
  )
}

/** RELOJ DE RONDA — cuánto falta para el reinicio. Con muescas, no numerado. */
export function RelojIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.1" />
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
      <path d="M12 3.5v1.4M20.5 12h-1.4M12 20.5v-1.4M3.5 12h1.4" opacity="0.55" />
    </svg>
  )
}

/** COBRAR — la recompensa lista. Cofre con la tapa entreabierta. */
export function CobrarIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3.5 11h17v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" fill="currentColor" fillOpacity="0.14" />
      <path d="M3.5 11h17v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      {/* La tapa levantada: dos aguas, no un arco — la chapa de esta app no
          tiene curvas blandas. */}
      <path d="M4.5 11 12 5.5 19.5 11" />
      <path d="M10 11v3.5h4V11" />
    </svg>
  )
}

/** HECHO — misión ya cobrada. Sello con el visto adentro. */
export function SelloHechoIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 2.5 19 6v6.2c0 4.3-2.9 7.9-7 9.3-4.1-1.4-7-5-7-9.3V6z"
        fill="currentColor" fillOpacity="0.16"
      />
      <path d="M12 2.5 19 6v6.2c0 4.3-2.9 7.9-7 9.3-4.1-1.4-7-5-7-9.3V6z" />
      <path d="m8.6 12 2.3 2.4 4.5-4.8" strokeWidth="2" />
    </svg>
  )
}

/** SIEMPRE — las hazañas no se reinician. Un lazo cerrado, dibujado a mano. */
export function SiempreIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M8.4 8.6a4.8 4.8 0 1 0 0 6.8L15.6 8.6a4.8 4.8 0 1 1 0 6.8z" />
      <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

/** IR — el botón que lleva a la pantalla donde se hace. Punta de nave. */
export function IrIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12h11" />
      <path d="M13.5 7.5 19.5 12l-6 4.5v-9z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  )
}

/** CARGANDO — reemplaza al spinner genérico. Tres arcos que giran. */
export function CargandoIcon({ size = 24, className = '' }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" strokeWidth="2" />
      <path d="M20.5 12A8.5 8.5 0 0 1 12 20.5" opacity="0.45" />
      <path d="M12 20.5A8.5 8.5 0 0 1 3.5 12" opacity="0.2" />
    </svg>
  )
}
