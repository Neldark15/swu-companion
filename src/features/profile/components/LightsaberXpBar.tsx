/**
 * LightsaberXpBar — XP progress bar styled as a lightsaber blade
 * with customizable color, glow effects, and hilt.
 *
 * ── La empuñadura es LA TUYA, en 3D ───────────────────────────────────
 *
 * Nel: «esta barra podría ser la empuñadura que uno hace en el Taller Kyber…
 * no esa que parece dibujo, que se vea 3D». La empuñadura ya no es el SVG
 * genérico: es una FOTO del mango del propio usuario —sus piezas forjadas, o
 * las de fábrica si nunca forjó— renderizada con el motor del taller
 * (`miniaturaSable3D`, importado DINÁMICO para no meterle three al Home) y
 * cacheada en localStorage. El SVG queda de repuesto para navegadores sin
 * WebGL y para el primer cuadro antes de que exista el caché.
 *
 * La barra siempre es del usuario logueado (Home, Perfil y Ajustes le pasan
 * `currentProfile`), así que leer SU `sable_diseno` acá no miente nunca.
 */
import { useEffect, useState } from 'react'
import { calculateLevel } from '../../../services/gamification'
import { useSettings, SABER_COLORS } from '../../../hooks/useSettings'
import { POR_DEFECTO } from '../../sable/partesSable'
import { fotoDelMango, mangoCacheado } from '../../sable/mangoBarra'
import { miDisenoSable } from '../../../services/sableService'

interface LightsaberXpBarProps {
  xp: number
}

export function LightsaberXpBar({ xp }: LightsaberXpBarProps) {
  const { level, rank, xpCurrent, xpNeeded, progress } = calculateLevel(xp)
  const { saberColor } = useSettings()
  const { core, glow } = SABER_COLORS[saberColor]

  /* El caché se lee SÍNCRONO en el estado inicial: si hay foto, el primer
     cuadro ya sale con ella y el SVG de repuesto ni parpadea. */
  const [mango, setMango] = useState<string | null>(() => mangoCacheado()?.png ?? null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const propio = await miDisenoSable()
      // `fotoDelMango` resuelve del caché, o renderiza UNA vez aunque haya
      // varias barras montadas (vuelo único — ver mangoBarra.ts).
      const png = await fotoDelMango(propio ?? POR_DEFECTO)
      if (vivo && png) setMango(png)
    })()
    return () => { vivo = false }
  }, [])

  const pct = Math.max(progress * 100, 3)

  return (
    <div className="space-y-2">
      {/* Level + Rank */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${rank.bgColor} ${rank.color} ${rank.borderColor} border`}>
            Nv. {level}
          </span>
          <span className={`text-sm font-bold ${rank.color}`}>{rank.name}</span>
        </div>
        <span className="text-[11px] text-swu-muted font-mono">{xpCurrent}/{xpNeeded} XP</span>
      </div>

      {/* El sable.
          
          La hoja medía 16 px de grosor, y a lo ancho de una tarjeta de móvil
          eso daba una proporción de ~11:1: se leía como una pastilla luminosa
          con un adorno a la izquierda, no como una hoja. Un sable de verdad
          ronda 30:1 —larguísimo y delgado— y esa proporción es TODA la
          diferencia entre las dos lecturas.

          Por eso la hoja baja a 8 px y la empuñadura se encoge con ella: si la
          empuñadura se quedaba en 24 px de alto, pasaba a ser tres veces más
          gruesa que la hoja y parecía un martillo. Los colores no se tocan. */}
      <div className="relative flex items-center h-5">
        {/* Empuñadura.
            Más LARGA que alta (46×14): una empuñadura real es un cilindro
            alargado, y la versión corta se leía como un botón cuadrado pegado
            a la hoja. El largo extra va en el cuerpo del mango — más estrías,
            más zona de agarre — no en el emisor. */}
        <div className="relative z-20 flex-shrink-0">
          {mango ? (
            /* La foto 3D del mango propio: 216×66 de render para 72×22 de CSS
               (3×), que es lo que la deja nítida en retina. El emisor queda a
               la DERECHA, tocando la hoja, porque así se renderizó. */
            <img
              src={mango}
              alt=""
              aria-hidden
              draggable={false}
              className="block h-[22px] w-[72px] select-none object-contain"
            />
          ) : (
          <svg width="46" height="14" viewBox="0 0 46 14" fill="none" aria-hidden>
            {/* Pomo, con su anillo */}
            <rect x="0" y="4" width="5" height="6" rx="1" fill="#222" stroke="#555" strokeWidth="0.5" />
            <line x1="6.5" y1="3.5" x2="6.5" y2="10.5" stroke="#555" strokeWidth="1" />
            {/* Cuerpo largo */}
            <rect x="8" y="2.5" width="28" height="9" rx="1.5" fill="#2A2A2E" stroke="#555" strokeWidth="0.8" />
            {/* Estrías del agarre */}
            <line x1="14" y1="3.2" x2="14" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="17" y1="3.2" x2="17" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="20" y1="3.2" x2="20" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="23" y1="3.2" x2="23" y2="10.8" stroke="#444" strokeWidth="0.8" />
            <line x1="26" y1="3.2" x2="26" y2="10.8" stroke="#444" strokeWidth="0.8" />
            {/* Botón de encendido, del color del sable elegido */}
            <circle cx="11" cy="7" r="1.5" fill={core} opacity="0.85">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Guarda entre agarre y emisor */}
            <rect x="36" y="3" width="2.5" height="8" rx="0.5" fill="#1c1c20" stroke="#555" strokeWidth="0.5" />
            {/* Emisor: se estrecha hacia la hoja, que es de donde sale */}
            <rect x="39" y="3.8" width="7" height="6.4" rx="0.8" fill="#3A3A3E" stroke="#666" strokeWidth="0.5" />
          </svg>
          )}
        </div>

        {/* La hoja */}
        <div className="flex-1 relative h-2 -ml-2">
          {/* Background track */}
          <div className="absolute inset-0 rounded-r-full bg-black/60 border border-white/5" />

          {/* Blade (filled portion) */}
          <div
            className="absolute inset-y-0 left-0 rounded-r-full transition-all duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${glow} 0%, ${core} 30%, ${core} 90%, white 100%)`,
              boxShadow: `0 0 8px ${core}, 0 0 16px ${core}80, 0 0 32px ${glow}40, inset 0 1px 2px rgba(255,255,255,0.3)`,
            }}
          >
            {/* El núcleo blanco. En una hoja de 8 px no cabe un `inset-y-0.5`
                por lado: quedaba una línea de 1 px que no se veía. Va como una
                banda central, que es donde de verdad está el núcleo caliente. */}
            <div
              className="absolute inset-x-0 top-0 h-1/2 rounded-tr-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
              }}
            />
            {/* Animated shimmer */}
            <div
              className="absolute inset-0 rounded-r-full overflow-hidden"
              style={{ opacity: 0.3 }}
            >
              <div
                className="xp-shimmer w-6 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                style={{
                  animation: 'shimmer 3s ease-in-out infinite',
                }}
              />
            </div>
            {/* La punta. Una hoja de sable no termina en un corte plano:
                termina en un punto blanco incandescente. Con la hoja delgada,
                una bola de 12 px la deformaba — ahora es proporcional. */}
            {pct > 5 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: 'white',
                  boxShadow: `0 0 5px white, 0 0 11px ${core}`,
                  opacity: 0.85,
                }}
              />
            )}
          </div>

          {/* Percentage marks */}
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${tick}%`, background: 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </div>
      </div>

      {/* Total XP */}
      <div className="flex justify-between text-[10px] text-swu-muted">
        <span>XP Total: {xp.toLocaleString()}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>

      {/* Shimmer keyframes (injected via style tag).
          El barrido recorre la barra entera, así que es de los que hay que
          apagar cuando se pide menos movimiento. La compuerta va acá y no en
          index.css porque la animación se declara acá: medido, era una de las
          dos que seguían corriendo con `prefers-reduced-motion: reduce`. */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(400%); }
          100% { transform: translateX(400%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .xp-shimmer { animation: none !important; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
