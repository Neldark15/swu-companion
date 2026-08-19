/**
 * ReversoCarta — el dorso, redibujado a partir del real.
 *
 * ── Por qué está dibujado y no es una foto ───────────────────────────
 *
 * Porque NO existe una imagen del dorso oficial que se pueda usar. Comprobado
 * una por una:
 *
 *   · El CDN del juego devuelve **403** a toda clave que no venga referenciada
 *     (`/card_back.png`, `/cardback.png`, `/card_Back_of_Card.png`), y las
 *     claves reales llevan un hash aleatorio de Strapi: no se adivinan.
 *   · El sitio oficial no la menciona en ninguno de sus 26 chunks de JS, y el
 *     listado de archivos de su Strapi está cerrado (403).
 *   · `Card.backImageUrl` NO es el dorso: es la SEGUNDA CARA de una carta de
 *     doble cara. 461 de las 9.185 filas del catálogo la tienen (459 líderes y
 *     2 bases), y las 461 URLs son distintas entre sí.
 *   · La única foto descargable es la de Wikipedia, 250×349 y marcada «fair
 *     use / no libre». En pantalla la carta se pinta a 286×400 CSS —572×800 en
 *     un teléfono— así que además de la licencia se vería lavada.
 *
 * Así que se redibuja. Los números de abajo salen de muestrear esa foto píxel
 * a píxel, y la proporción coincide con la del juego (250/349 = 0,716 contra
 * el viewBox 286/400 = 0,715).
 *
 * ── Lo que a propósito NO se copia ───────────────────────────────────
 *
 * El logotipo de STAR WARS. Se puede extraer limpio del asset de otro sitio de
 * fans, pero eso sería redistribuir una marca de Lucasfilm desde el asset de un
 * tercero, en un repo PÚBLICO. El rótulo va con la tipografía de la app: el
 * dorso se reconoce por el campo de estrellas, la estrella fugaz y el horizonte
 * del planeta, que son la firma real de este dorso.
 *
 * ── La rareza no pinta el dorso ──────────────────────────────────────
 *
 * El color de la impresión que viene se cuela solo en el HALO del horizonte y
 * en el filo interior. Si tiñera el fondo entero dejaría de ser un dorso —y
 * todo el sentido de esta cara es que las cinco cartas del sobre se vean
 * iguales hasta que se giran.
 */

import { useId } from 'react'

/** Estrellas fijas: el cielo no se puede mover entre repintados. */
const ESTRELLAS = (() => {
  // FNV-1a con la avalancha de murmur3, el mismo generador que ya usan la
  // credencial y la miniatura del blog. Semilla fija = mismo cielo siempre.
  let h = 0x811c9dc5
  const rnd = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
  return Array.from({ length: 72 }, () => ({
    x: rnd() * 286,
    y: rnd() * 400,
    r: 0.5 + rnd() * 0.9,
    o: 0.25 + rnd() * 0.65,
    azul: rnd() > 0.62,
  }))
})()

interface Props {
  /** El color de la impresión que hay del otro lado. Solo tiñe el halo. */
  color: string
  /** Late y le pasa un barrido de luz: algo grande viene. */
  misterio?: boolean
}

export function ReversoCarta({ color, misterio = false }: Props) {
  /* Ids ÚNICOS por instancia. Con ids fijos, dos dorsos en la misma pantalla
   * resuelven sus `url(#…)` contra el primero y el segundo sale sin degradados
   * —negro plano— sin ningún error en consola. Hoy nunca se pinta más de uno a
   * la vez, pero eso es una condición que cualquier pantalla nueva puede romper
   * sin enterarse. */
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 286 400"
      className="h-full w-full"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Viñeta: #0d0d2c en el centro, #03031e en las esquinas. Medido. */}
        <radialGradient id={`dorso-cielo-${uid}`} cx="0.5" cy="0.42" r="0.78">
          <stop offset="0%" stopColor="#0d0d2c" />
          <stop offset="62%" stopColor="#070726" />
          <stop offset="100%" stopColor="#03031e" />
        </radialGradient>

        {/* La estrella fugaz: nace cian y muere blanca. */}
        <linearGradient id={`dorso-fugaz-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#35a8e0" stopOpacity="0" />
          <stop offset="55%" stopColor="#35a8e0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>

        {/* El limbo del planeta: azul que se apaga hacia el fondo. */}
        <radialGradient id={`dorso-limbo-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor="#07133f" stopOpacity="0" />
          <stop offset="82%" stopColor="#3b549f" stopOpacity="0.85" />
          <stop offset="94%" stopColor="#07133f" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#07133f" stopOpacity="0" />
        </radialGradient>

        {/* El núcleo blanco de donde salen los rayos. */}
        <radialGradient id={`dorso-nucleo-${uid}`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#c9d9e2" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c9d9e2" stopOpacity="0" />
        </radialGradient>

        {/* Acá y SOLO acá entra la rareza. */}
        <radialGradient id={`dorso-halo-${uid}`}>
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        <clipPath id={`dorso-recorte-${uid}`}>
          <rect x="0" y="0" width="286" height="400" rx="14" />
        </clipPath>
      </defs>

      <rect width="286" height="400" rx="14" fill="#06061f" />
      <rect width="286" height="400" rx="14" fill={`url(#dorso-cielo-${uid})`} />

      <g clipPath={`url(#dorso-recorte-${uid})`}>
        {/* Campo de estrellas */}
        {ESTRELLAS.map((e, i) => (
          <circle
            key={i}
            cx={e.x}
            cy={e.y}
            r={e.r}
            fill={e.azul ? '#9fc4ff' : '#ffffff'}
            opacity={e.o}
          />
        ))}

        {/* Estrella fugaz: de (37,32) a (223,88), medido sobre el original */}
        <line x1="37" y1="32" x2="223" y2="88" stroke={`url(#dorso-fugaz-${uid})`} strokeWidth="1.3" />
        <g transform="translate(223 88)">
          <path
            d="M 0 -9 L 1.6 -1.6 L 9 0 L 1.6 1.6 L 0 9 L -1.6 1.6 L -9 0 L -1.6 -1.6 Z"
            fill="#ffffff"
            opacity="0.95"
          />
        </g>

        {/* El horizonte del planeta, abajo */}
        <ellipse cx="143" cy="470" rx="215" ry="152" fill={`url(#dorso-limbo-${uid})`} />
        <ellipse cx="143" cy="470" rx="215" ry="152" fill={`url(#dorso-halo-${uid})`} opacity="0.7" />
        <ellipse cx="143" cy="320" rx="86" ry="26" fill={`url(#dorso-nucleo-${uid})`} opacity="0.75" />

        {/* Los dos rayos cruzados sobre el núcleo: es lo que hace que se lea
            como ESTE dorso y no como una carta oscura cualquiera. */}
        <g opacity="0.72">
          <line x1="143" y1="320" x2="-46" y2="232" stroke="#36b3d6" strokeWidth="2" />
          <line x1="143" y1="320" x2="332" y2="232" stroke="#36b3d6" strokeWidth="2" />
          <line x1="143" y1="320" x2="-30" y2="300" stroke="#6acee5" strokeWidth="1" opacity="0.6" />
          <line x1="143" y1="320" x2="316" y2="300" stroke="#6acee5" strokeWidth="1" opacity="0.6" />
        </g>

        {/* El rótulo. Con la tipografía de la app, no con el logotipo oficial
            (ver la cabecera): el dorso se reconoce por el cielo y el planeta. */}
        <text
          x="143" y="176"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="34"
          fontWeight="900"
          letterSpacing="2"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          STAR WARS
        </text>
        <line x1="58" y1="196" x2="228" y2="196" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
        <text
          x="143" y="224"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="17"
          fontWeight="300"
          letterSpacing="7.5"
          opacity="0.92"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          UNLIMITED
        </text>

        {/* El barrido del misterio. Es un <rect> que se desplaza: solo
            `transform`, nada que repintar. */}
        {misterio && (
          <rect
            className="dorso-barrido"
            x="-120" y="0" width="120" height="400"
            fill="#ffffff"
            fillOpacity="0.09"
            transform="skewX(-14)"
          />
        )}
      </g>

      {/* Filo interior teñido con la rareza: el anuncio sin espóiler. */}
      <rect
        x="1" y="1" width="284" height="398" rx="14"
        fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="2"
      />
    </svg>
  )
}
