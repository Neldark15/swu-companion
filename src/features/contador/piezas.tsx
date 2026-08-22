/**
 * piezas — los dos componentes que comparten el Contador de dos y el de mesa.
 *
 * Se extrajeron de `ContadorPage` SIN cambiarles una línea cuando apareció el
 * modo de MESA (Twin Suns, 3 o 4 jugadores). Copiar el panel de jugador
 * habría sido copiar el mantener-presionado, la vibración, los colores de
 * vida y el 3D de la base: cuatro comportamientos que se separarían en cuanto
 * alguien tocara uno solo de los dos archivos.
 *
 * Van en archivo propio y no exportados desde `ContadorPage` para no arrastrar
 * las 1.200 líneas de esa pantalla al chunk del modo de mesa.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Layers, Plus, Minus } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { Carta3D } from '../../components/Carta3D'
import { Avatar } from '../../components/ui/Avatar'
import { db } from '../../services/db'
import type { MazoDeAlguien } from '../../services/amistosas'
import type { Card } from '../../types'
import { type LadoDuelo, vibrar } from './estado'

/* ── La mitad de un jugador ──────────────────────────────── */

export function MitadJugador({
  lado, invertida, conIniciativa, compacta = false,
  onVida, onIniciativa, onVictorias, onDesplegarLider,
}: {
  lado: LadoDuelo
  invertida: boolean
  conIniciativa: boolean
  /**
   * Media pantalla en vez de media altura.
   *
   * En el duelo de dos cada panel ocupa el ANCHO entero y los tercios táctiles
   * miden ~125 px, así que los círculos de 80 px entran de sobra. En una mesa
   * de cuatro el panel es la mitad de ancho: el tercio baja a ~62 px y los
   * mismos círculos se salen — medido, el botón de sumar quedaba cortado por
   * el borde. Compacta encoge círculos, cifra y adornos; **no** encoge las
   * zonas tocables, que siguen siendo el tercio entero.
   */
  compacta?: boolean
  onVida: (delta: number) => void
  onIniciativa: () => void
  onVictorias: (n: number) => void
  onDesplegarLider: () => void
}) {
  const pct = lado.vidaInicial > 0 ? lado.vida / lado.vidaInicial : 0
  const colorVida = lado.vida === 0 ? 'text-swu-red' : pct <= 0.34 ? 'text-swu-coral' : pct <= 0.67 ? 'text-swu-amber' : 'text-white'

  // Mantener presionado repite. `pointerdown` aplica el primer cambio al
  // instante; si el dedo sigue, a los 450 ms arranca la ráfaga. Todo se corta
  // en up/leave/cancel — sin esto, un dedo que se desliza deja el botón
  // «pegado» restando vida solo.
  const temporizador = useRef<{ espera?: number; rafaga?: number }>({})
  const empezar = useCallback((delta: number) => {
    // Vibra en cada cambio: con el teléfono lejos y reflejos de luz no siempre
    // se ve si el toque entró, y el pulso lo confirma sin mirar.
    vibrar()
    onVida(delta)
    temporizador.current.espera = window.setTimeout(() => {
      temporizador.current.rafaga = window.setInterval(() => { vibrar(8); onVida(delta) }, 140)
    }, 450)
  }, [onVida])
  const parar = useCallback(() => {
    window.clearTimeout(temporizador.current.espera)
    window.clearInterval(temporizador.current.rafaga)
  }, [])
  useEffect(() => parar, [parar])

  return (
    <div className={`relative flex-1 min-h-0 overflow-hidden ${invertida ? 'rotate-180' : ''}`}>
      {/* La base, en 3D y de fondo. `alAbrir` le da el reflejo de presentación
          y el brillo de reposo — es la misma carta física que está en la mesa. */}
      <div className="absolute inset-2 flex items-center justify-center">
        <Carta3D alAbrir brillo className="w-full max-w-md">
          <div className="relative">
            <CardImage
              src={lado.baseImg ?? undefined}
              alt={lado.baseNombre}
              orientacion="apaisada"
              fit="cover"
              className="w-full aspect-[400/286] rounded-2xl opacity-80"
            />
            {/* Velo para que la cifra gane SIEMPRE el contraste sobre el arte.
                El velo plano al 35 % alcanzaba con artes oscuras y no con las
                claras: la vida en ámbar sobre la roca beige de Coaxium Mine
                quedaba casi ilegible. Encima va una cama radial centrada donde
                vive la cifra —oscura en el centro, nula en los bordes—, así el
                número tiene fondo garantizado sea cual sea la base y el arte
                se sigue viendo alrededor. */}
            <div className="absolute inset-0 rounded-2xl bg-black/35" />
            <div className="absolute inset-0 rounded-2xl
                            bg-[radial-gradient(ellipse_42%_52%_at_50%_50%,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.45)_55%,transparent_100%)]" />
          </div>
        </Carta3D>
      </div>

      {/* Nombre de la base + vida inicial, como el rótulo de la carta. */}
      <div className={`absolute inset-x-0 flex items-center justify-center gap-2 pointer-events-none ${compacta ? 'top-1' : 'top-2'}`}>
        <span className={`rounded-full bg-black/60 font-bold text-white backdrop-blur ${compacta ? 'max-w-[70%] truncate px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[11px]'}`}>
          {lado.baseNombre}
        </span>
        <span className="rounded-full bg-swu-cyan/25 border border-swu-cyan/50 px-2 py-1 text-[11px] font-mono font-bold text-swu-cyan backdrop-blur">
          {lado.vidaInicial}
        </span>
      </div>

      {/* Victorias del duelo (mejor de 3): dos puntos que se tocan. En una
          mesa de Twin Suns no hay mejor-de-3, así que no se dibujan. */}
      <div className={`absolute top-2 right-2 flex gap-1.5 ${compacta ? 'hidden' : ''}`}>
        {[1, 2].map(n => (
          <button
            key={n}
            aria-label={`Marcar ${n} partida${n > 1 ? 's' : ''} ganada${n > 1 ? 's' : ''}`}
            onClick={() => onVictorias(lado.victorias === n ? n - 1 : n)}
            className={`h-4 w-4 rounded-full border transition-colors ${
              lado.victorias >= n ? 'bg-swu-amber border-swu-amber' : 'border-white/40 bg-black/40'
            }`}
          />
        ))}
      </div>

      {/* − VIDA + .
          La zona TOCABLE es el tercio entero de cada lado, no el botón: con el
          teléfono en el medio de la mesa se toca de lejos y en ángulo, y un
          blanco de 80 px se falla. El círculo queda de señal visual (no recibe
          eventos: los toma el tercio que lo contiene). El tercio del medio no
          es tocable a propósito — ahí vive la cifra y un toque suelto no debe
          mover la vida de nadie. */}
      <div className="absolute inset-0 flex">
        <button
          aria-label="Restar vida"
          onPointerDown={() => empezar(-1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="flex-1 flex items-center justify-center active:bg-white/5 transition-colors"
        >
          {/* El rojo va en el MENOS. `--color-swu-red` está documentado en
              index.css como «destructivo», y lo destructivo acá es perder vida;
              además es el botón que se toca casi siempre, así que el color
              fuerte tiene que estar donde va el pulgar, no en la corrección. */}
          <span className={`pointer-events-none rounded-full border-4 border-swu-red/80 bg-black/45 text-swu-red
                           flex items-center justify-center backdrop-blur-sm ${compacta ? 'h-11 w-11' : 'h-20 w-20'}`}>
            <Minus size={compacta ? 20 : 34} strokeWidth={3} />
          </span>
        </button>
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <span className={`${compacta ? 'text-[44px]' : 'text-[88px]'} leading-none font-black tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] ${colorVida}`}>
            {lado.vida}
          </span>
        </div>
        <button
          aria-label="Sumar vida"
          onPointerDown={() => empezar(1)}
          onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
          className="flex-1 flex items-center justify-center active:bg-white/5 transition-colors"
        >
          <span className={`pointer-events-none rounded-full border-4 border-white/70 bg-black/45 text-white
                           flex items-center justify-center backdrop-blur-sm ${compacta ? 'h-11 w-11' : 'h-20 w-20'}`}>
            <Plus size={compacta ? 20 : 34} strokeWidth={3} />
          </span>
        </button>
      </div>

      {/* Avatar + ficha de iniciativa, en la esquina que mira al centro.
          El avatar es la FOTO DE PERFIL (la propia o la del rival elegido);
          el arte del líder queda de respaldo si el lado vino de un mazo. */}
      <div className={`absolute flex items-center gap-2 ${compacta ? 'bottom-1 left-1' : 'bottom-2 left-2'}`}>
        <div className={`rounded-full overflow-hidden border-2 border-swu-cyan/60 bg-swu-bg ${compacta ? 'h-8 w-8' : 'h-11 w-11'}`}>
          {lado.avatar
            ? <Avatar avatar={lado.avatar} size={40} caja="redondeada" />
            : lado.liderImg
              ? <img src={lado.liderImg} alt="" className="h-full w-full object-cover object-left" />
              : <Avatar avatar={lado.etiqueta === 'Vos' ? '🧑‍🚀' : '⚔️'} size={40} caja="redondeada" />}
        </div>
        {/* La ficha de iniciativa del juego real: el chip oscuro con el logo.
            Quien la tiene la ve encendida; un toque la toma o la suelta. */}
        <button
          // La ficha y la ronda se tocan SIN mirar —el teléfono está plano en la
          // mesa y vos estás viendo cartas—, así que son las dos que más
          // necesitan el acuse al tacto. Eran justo las dos que no lo tenían.
          onClick={() => { vibrar(); onIniciativa() }}
          aria-label="Tomar la iniciativa"
          className={`relative h-12 w-12 rounded-xl border-2 overflow-hidden
                      transition-[border-color,box-shadow,opacity] duration-150
                      bg-[#0a1020] flex items-center justify-center ${
            conIniciativa
              ? 'border-swu-amber shadow-[0_0_14px_rgba(245,158,11,0.55)] opacity-100'
              : 'border-white/20 opacity-40'
          }`}
        >
          <img src="/swu-logo-title.png" alt="Ficha de iniciativa" className="h-9 w-9 object-contain" />
        </button>
        {/* El líder, si el lado vino de un mazo. Un toque lo despliega: es el
            momento que cambia la partida y el que más se olvida de marcar. */}
        {lado.liderNombre && (
          <button
            onClick={() => { vibrar(); onDesplegarLider() }}
            aria-label={lado.liderDesplegado ? 'Replegar el líder' : 'Desplegar el líder'}
            // `transition-all` animaba trece propiedades —los cuatro radios y
            // los cuatro paddings incluidos— cuando lo único que cambia es
            // color, sombra y opacidad. Se nombran las que cambian.
            className={`flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ${
              lado.liderDesplegado
                ? 'border-swu-cyan bg-swu-cyan/20 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'border-white/20 bg-black/40 opacity-60'
            }`}
          >
            {lado.liderImg
              ? <img src={lado.liderImg} alt="" className="h-6 w-6 rounded-full object-cover object-left" />
              : <span className="h-6 w-6 rounded-full bg-swu-bg" />}
            <span className={`text-[9px] font-bold ${lado.liderDesplegado ? 'text-swu-cyan' : 'text-white/60'}`}>
              {lado.liderDesplegado ? 'EN MESA' : 'LÍDER'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Elegir base o mazo para un lado ─────────────────────── */

export function SelectorLado({
  titulo, bases, decks, elegido, onElegir,
}: {
  titulo: string
  bases: Card[]
  /* Los mazos de QUIEN corresponde a este lado, ya normalizados. Antes esto
     recibía `Deck[]` locales y los dos lados recibían los MISMOS: para elegir
     la base del rival te ofrecía los tuyos. */
  decks: MazoDeAlguien[]
  elegido: { base: Card; lider: Card | null } | null
  onElegir: (base: Card, lider: Card | null) => void
}) {
  const [pestana, setPestana] = useState<'base' | 'mazo'>('base')
  const [filtro, setFiltro] = useState('')

  const filtradas = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    const lista = f ? bases.filter(b => b.name.toLowerCase().includes(f)) : bases
    return lista.slice(0, 24)
  }, [bases, filtro])

  return (
    <div className="rounded-2xl border border-swu-border bg-swu-surface p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-swu-text">{titulo}</p>
        {elegido && (
          <span className="text-[11px] font-mono text-swu-cyan truncate">
            {elegido.base.name} · {elegido.base.hp} de vida
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {([['base', 'Buscar base', Search], ['mazo', 'Mis mazos', Layers]] as const).map(([id, rotulo, Icono]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              pestana === id ? 'border-swu-cyan/60 bg-swu-cyan/15 text-swu-cyan' : 'border-swu-border text-swu-muted'
            }`}
          >
            <Icono size={11} /> {rotulo}
          </button>
        ))}
      </div>

      {pestana === 'base' && (
        <>
          <input
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Nombre de la base…"
            className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-sm text-swu-text
                       placeholder:text-swu-muted focus:outline-none focus:ring-2 focus:ring-swu-accent"
          />
          <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {filtradas.map(b => (
              <button
                key={b.id}
                onClick={() => onElegir(b, null)}
                className={`relative rounded-lg overflow-hidden border-2 text-left ${
                  elegido?.base.id === b.id ? 'border-swu-cyan' : 'border-transparent'
                }`}
              >
                <CardImage src={b.imageUrl} alt={b.name} orientacion="apaisada" fit="cover"
                  className="w-full aspect-[400/286]" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[9px] text-white truncate">
                  {b.name} · {b.hp}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {pestana === 'mazo' && (
        decks.length === 0
          ? <p className="text-[12px] text-swu-muted">Sin mazos guardados.</p>
          : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {decks.map(d => (
                <button
                  key={d.id}
                  onClick={async () => {
                    // Del mazo solo viaja el id de la base y del líder; la carta
                    // completa (imagen, vida impresa) sale de la base LOCAL. Por
                    // eso da igual que el mazo sea de otra persona: su receta
                    // nunca hizo falta.
                    const base = await db.cards.get(d.baseId)
                    const lider = d.liderId ? await db.cards.get(d.liderId) : null
                    if (base) onElegir(base, lider ?? null)
                  }}
                  className="w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-left"
                >
                  <p className="text-[13px] font-semibold text-swu-text truncate">{d.nombre}</p>
                  <p className="text-[10px] text-swu-muted truncate">
                    {d.lider ?? '—'} · {d.base ?? 'sin base'}
                  </p>
                </button>
              ))}
            </div>
          )
      )}
    </div>
  )
}
