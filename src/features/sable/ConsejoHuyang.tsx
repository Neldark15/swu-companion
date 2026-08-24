/**
 * EL ARQUITECTO — el droide que aconseja mientras armás tu sable.
 *
 * Referencia fan a Huyang, el droide arquitecto de sables con veinticinco mil
 * años de servicio. El ÍCONO es dibujo propio (unas líneas: casco, cara, ojos
 * encendidos) — no se copia ningún arte ajeno, igual que el dorso de carta se
 * redibujó en vez de copiarse (§3i).
 *
 * ── Un consejo por paso, y rota al VOLVER al paso ─────────────────────
 *
 * El texto se elige en el MONTAJE con un contador a nivel de módulo, y el padre
 * lo monta con `key={paso}`: cambiar de paso desmonta y remonta, y el contador
 * avanza. Así no hay `setState` dentro de un efecto —que en este repo es error
 * de lint y ya hubo que corregirlo dos veces hoy— y el consejo no parpadea en
 * cada render.
 *
 * Los consejos son cortos y de VOZ, no tutoriales: el droide opina como quien
 * lleva mil años haciendo esto. La información dura (precios, deltas, saldo) ya
 * vive en las tarjetas; repetirla acá sería ruido con sombrero.
 */

import type { Paso } from './kyber'

export function HuyangIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {/* El casco abombado con su remache, la cara angosta y la barbilla:
          silueta de droide de protocolo viejo, sin copiar ningún diseño. */}
      <path d="M5.5 9.5c0-4 2.9-6.5 6.5-6.5s6.5 2.5 6.5 6.5" />
      <path d="M4 9.5h16l-1.5 2H5.5Z" />
      <path d="M8 11.5v4.2L12 20l4-4.3v-4.2" />
      <circle cx="9.7" cy="13.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="13.4" r="1.15" fill="currentColor" stroke="none" />
      <path d="M10.6 17h2.8" strokeLinecap="round" />
      <circle cx="12" cy="4.6" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

const CONSEJOS: Record<Paso, string[]> = {
  piezas: [
    'Llevo mil años ayudando a armar sables y no he visto dos iguales. El tuyo tampoco se va a repetir.',
    'La empuñadura no se elige con los ojos: se elige con la mano. Rotálo y mirálo por todos lados.',
    'No compres por rareza. Comprá lo que a TU sable le falta — los números de cada pieza te lo dicen.',
    'Un buen pomo equilibra la hoja. Quien lo ignora termina peleando contra su propio sable.',
  ],
  cristal: [
    'El cristal es el corazón. Todo lo demás es metal bien puesto alrededor.',
    'En mi experiencia, el cristal te elige a vos. Acá te dejamos elegir igual — no se lo cuentes a nadie.',
    'Cada cristal canta con su propio tono. Cuando enciendas la hoja, escuchalo.',
  ],
  color: [
    'El color no es un adorno: es lo que tu hoja dice de vos antes de que hables.',
    'Los sables rojos no se eligen: se hacen, sangrando un cristal. Ese es otro capítulo, y no uno alegre.',
  ],
  prueba: [
    'Un sable no se termina: se conoce.',
    'Ponéle nombre. Las cosas con nombre se cuidan más.',
    'El zumbido te va a parecer fuerte. Esperá a oír el silencio cuando lo apagues.',
  ],
}

/* El contador vive a nivel de módulo: sobrevive a los desmontajes, así que
   volver a un paso enseña el consejo SIGUIENTE, no siempre el primero. */
const vistos: Partial<Record<Paso, number>> = {}
function siguiente(paso: Paso): number {
  vistos[paso] = (vistos[paso] ?? -1) + 1
  return vistos[paso]
}

export function ConsejoHuyang({ paso }: { paso: Paso }) {
  // Inicializador de useState: corre UNA vez por montaje, y el padre remonta
  // con key={paso}. Sin estado que sincronizar, sin efecto que lo escriba.
  const lista = CONSEJOS[paso]
  const texto = lista[siguiente(paso) % lista.length]

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-swu-border bg-swu-surface/70 px-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-swu-cyan/10 text-swu-cyan">
        <HuyangIcon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-swu-cyan">
          El Arquitecto
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-swu-text">{texto}</p>
      </div>
    </div>
  )
}
