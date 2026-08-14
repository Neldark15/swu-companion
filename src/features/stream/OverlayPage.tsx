/**
 * OVERLAY — lo que ve OBS.
 *
 * Diseño «HUD holográfico»: barras horizontales arriba (jugador 2 + ronda y
 * reloj) y abajo (jugador 1), paneles azul metalizado con chaflanes, filos
 * dorados y luces cian. El CENTRO queda libre para la cámara cenital — las
 * barras solo pisan los bordes del cuadro, donde no hay cartas.
 *
 * Reglas que gobiernan este archivo:
 *
 *  · CSS puro. Nada de framer-motion ni three: cada chunk nuevo lo bajan al
 *    instalar todos los usuarios de la PWA, y `medir-precache` es criterio duro.
 *  · Lienzo FIJO de 1920×1080 escalado con `transform`. El layout es
 *    pixel-exacto, y funciona igual con un canvas de 1280×720 (plan B de red)
 *    sin tocar una línea.
 *  · Los chaflanes van con `clip-path`; como el recorte también recorta las
 *    sombras, cada panel vive dentro de un envoltorio con `filter:
 *    drop-shadow`, que sí sigue la silueta recortada.
 *  · No consulta ninguna base de cartas. El panel escribe nombre, imagen, HP y
 *    aspectos ya resueltos; acá solo se pintan.
 *  · Tipografía dimensionada para leerse a 720p y sobrevivir a 480p.
 *
 * La ruta vive FUERA de `AppLayout` (ver App.tsx), así no se monta
 * `UpdatePrompt` — el único sitio del repo que registra el service worker.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ESTADO_INICIAL,
  formatearReloj,
  mensajesTicker,
  restanteReloj,
  type EstadoOverlay,
  type LadoOverlay,
} from '../../types/stream'
import { leerOverlay, suscribirOverlay } from '../../services/streamOverlay'

/* ── Identidad ────────────────────────────────────────────────────────
 * Azul cobalto y dorado con luces cian, sobre la bandera de El Salvador.
 * Rojo solo para TIEMPO y el punto de EN JUEGO. */
const COBALTO_OSCURO = '#061B42'
const DORADO = '#E8B849'
const ROJO = '#C1332A'
const BLANCO = '#F4F7FB'
const CIAN = '#3FB6FF'

/** Gradiente metalizado de los paneles. */
const METAL = 'linear-gradient(180deg, #2B4F92 0%, #16305F 46%, #081A3E 100%)'
/** Relieve interior: filo de luz arriba, sombra abajo. */
const RELIEVE =
  'inset 0 1px 0 rgba(255,255,255,.22), inset 0 -10px 22px rgba(0,0,0,.4), inset 0 12px 26px rgba(90,150,255,.12)'

/** Chaflán octogonal parametrizado. */
const chaflan = (px: number) =>
  `polygon(${px}px 0, calc(100% - ${px}px) 0, 100% ${px}px, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, ${px}px 100%, 0 calc(100% - ${px}px), 0 ${px}px)`

const AVISO_LEGAL =
  'COBERTURA COMUNITARIA · HECHA POR FANS · NO OFICIAL · NO AFILIADA A FANTASY FLIGHT GAMES, ASMODEE NI LUCASFILM'

/** El poll de respaldo. Un WebSocket que muere en silencio no avisa. */
const POLL_MS = 10_000

const ESTILOS = `
@keyframes ovFundido { from { opacity: 0 } to { opacity: 1 } }
.ov-fundido { animation: ovFundido .4s ease both; }
/* Barra de noticias: el contenido se duplica y se desplaza un 50%, así el
   bucle es continuo y no se ve el salto. */
@keyframes ovCorre { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.ov-corre { display: inline-flex; white-space: nowrap; animation: ovCorre 40s linear infinite; }
@keyframes ovLatido { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
.ov-latido { animation: ovLatido 1.6s ease-in-out infinite; }
@keyframes ovNeon { 0%,100% { opacity: .9 } 50% { opacity: .45 } }
.ov-neon { animation: ovNeon 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ov-fundido, .ov-latido, .ov-neon { animation: none }
  .ov-corre { animation: none }
}
`

export function OverlayPage() {
  /* En mayúsculas desde el borde: el servicio ya normaliza antes de tocar la
     base, pero este `code` también arma la URL que se copia a OBS y el rótulo
     en pantalla. Sin esto, entrar por `/estudio/sv01` funcionaba pero mostraba
     y copiaba un enlace en minúsculas — el mismo sitio con dos caras. */
  const { code: codeCrudo = '' } = useParams<{ code: string }>()
  const code = codeCrudo.trim().toUpperCase()
  const [params] = useSearchParams()
  const fondoOscuro = params.get('fondo') === 'oscuro'
  const debug = params.get('debug') === '1'

  const [estado, setEstado] = useState<EstadoOverlay>(debug ? ESTADO_DEMO : ESTADO_INICIAL)
  const [escala, setEscala] = useState(1)
  const [ahora, setAhora] = useState(() => Date.now())

  /* ── Fondo transparente ──
   * Estilos INLINE en los tres nodos. `index.css` les pone
   * `background-color: var(--color-swu-bg)` a html, body y #root; inline gana
   * sin `!important` y sin depender del orden de las hojas, y se restaura al
   * desmontar para no romper el resto de la app. */
  useEffect(() => {
    const nodos = [
      document.documentElement,
      document.body,
      document.getElementById('root'),
    ].filter((n): n is HTMLElement => n !== null)

    const previos = nodos.map(n => n.style.background)
    const fondo = fondoOscuro ? '#0B1220' : 'transparent'
    nodos.forEach(n => {
      n.style.background = fondo
    })

    return () => {
      nodos.forEach((n, i) => {
        n.style.background = previos[i]
      })
    }
  }, [fondoOscuro])

  /* ── Escalado del lienzo ── */
  useEffect(() => {
    const medir = () => {
      setEscala(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  /* ── Reloj local. El tic NUNCA viaja por la red: se guarda
   * {duracionMs, iniciadoEn} y acá se resta. ── */
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  /* ── Datos: realtime + poll de respaldo ── */
  useEffect(() => {
    if (!code || debug) return

    let vivo = true

    const releer = () => {
      leerOverlay(code)
        .then(r => {
          if (vivo) setEstado(r.estado)
        })
        .catch(() => {
          /* Silencio a propósito: el overlay conserva lo último bueno. */
        })
    }

    releer()
    const cortar = suscribirOverlay(code, r => {
      if (vivo) setEstado(r.estado)
    })
    const id = window.setInterval(releer, POLL_MS)

    return () => {
      vivo = false
      cortar()
      window.clearInterval(id)
    }
  }, [code, debug])

  const restante = useMemo(() => restanteReloj(estado.reloj, ahora), [estado.reloj, ahora])
  const cartaVisible = estado.carta && estado.carta.hasta > ahora ? estado.carta : null

  const lienzo: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 1920,
    height: 1080,
    transform: `scale(${escala})`,
    transformOrigin: 'top left',
    fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
    color: BLANCO,
    overflow: 'hidden',
  }

  return (
    <>
      <style>{ESTILOS}</style>
      <div style={lienzo}>
        {estado.escena === 'juego' ? (
          <>
            <BarraArriba estado={estado} restante={restante} />
            <BarraAbajo estado={estado} />
            {estado.tiempoExtra && <BannerTiempo />}
            {estado.enRevision && <BannerRevision />}
            {cartaVisible && <CartaDestacadaVista carta={cartaVisible} />}
          </>
        ) : (
          <EscenaOpaca estado={estado} restante={restante} />
        )}
        {estado.tickerVisible && <BarraNoticias texto={estado.ticker} />}
        <FranjaLegal patrocinio={estado.patrocinio} />
      </div>
    </>
  )
}

/* ── Piezas del HUD ─────────────────────────────────────────────────── */

/** Envoltorio con sombra que sigue el chaflán (clip-path recorta box-shadow). */
function Chapa({
  recorte = 16,
  brillo = false,
  style,
  children,
}: {
  recorte?: number
  brillo?: boolean
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        filter: brillo
          ? `drop-shadow(0 0 16px rgba(63,182,255,.3)) drop-shadow(0 10px 22px rgba(0,0,0,.55))`
          : 'drop-shadow(0 10px 22px rgba(0,0,0,.55))',
        ...style,
      }}
    >
      <div
        style={{
          background: METAL,
          border: `1.5px solid ${DORADO}59`,
          boxShadow: RELIEVE,
          clipPath: chaflan(recorte),
          height: '100%',
          display: 'flex',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Luces de neón en los filos, como la plantilla. */
function Luces({ lado }: { lado: 'izq' | 'der' }) {
  const comun: React.CSSProperties = {
    position: 'absolute',
    width: 5,
    height: 44,
    top: '50%',
    transform: 'translateY(-50%)',
    background: `linear-gradient(180deg, transparent, ${CIAN}, transparent)`,
    boxShadow: `0 0 12px ${CIAN}`,
    pointerEvents: 'none',
  }
  return (
    <>
      <span className="ov-neon" style={{ ...comun, [lado === 'izq' ? 'left' : 'right']: 3 }} />
      <span
        style={{
          position: 'absolute',
          top: 8,
          [lado === 'izq' ? 'right' : 'left']: 14,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#FF5A3C',
          boxShadow: '0 0 8px #FF5A3C',
        }}
      />
    </>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '.22em',
        color: DORADO,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function Celda({ children, sinBorde }: { children: React.ReactNode; sinBorde?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7,
        padding: '0 20px',
        borderLeft: sinBorde ? 'none' : `1px solid ${DORADO}30`,
      }}
    >
      {children}
    </div>
  )
}

function IconoAspecto({ aspecto, tam = 30 }: { aspecto: string; tam?: number }) {
  const [falló, setFalló] = useState(false)
  if (falló) return null
  return (
    <img
      src={`/icons/aspects/${aspecto.toLowerCase()}.webp`}
      alt={aspecto}
      onError={() => setFalló(true)}
      style={{ width: tam, height: tam, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }}
    />
  )
}

function Retrato({ lado }: { lado: LadoOverlay }) {
  const [falló, setFalló] = useState(false)
  const src = lado.liderImg ? `/api/img?u=${encodeURIComponent(lado.liderImg)}&w=448` : ''

  return (
    <div
      style={{
        position: 'relative',
        width: 186,
        height: '100%',
        flex: '0 0 auto',
        clipPath: chaflan(12),
        border: `2px solid ${lado.liderDesplegado ? DORADO : `${DORADO}55`}`,
        boxShadow: lado.liderDesplegado ? `inset 0 0 18px ${DORADO}66` : 'none',
        background: COBALTO_OSCURO,
      }}
    >
      {src && !falló ? (
        <img
          src={src}
          alt=""
          onError={() => setFalló(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '.14em',
            color: `${BLANCO}55`,
          }}
        >
          SIN LÍDER
        </div>
      )}
      {lado.liderDesplegado && (
        <span
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '3px 10px',
            background: `linear-gradient(180deg, ${DORADO}, #C9982F)`,
            color: COBALTO_OSCURO,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.12em',
            clipPath: chaflan(5),
            whiteSpace: 'nowrap',
          }}
        >
          DESPLEGADO
        </span>
      )}
    </div>
  )
}

/** El bloque completo de un jugador. `invertido` lo refleja para la barra de arriba. */
function BloqueJugador({
  lado,
  rival,
  invertido,
  conIniciativa,
}: {
  lado: LadoOverlay
  rival: LadoOverlay
  invertido: boolean
  conIniciativa: boolean
}) {
  const vida = Math.max(0, lado.hpMax - lado.dano)
  const derrotado = vida === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: invertido ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        height: '100%',
      }}
    >
      <Retrato lado={lado} />

      {/* Identidad */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 5,
          padding: '0 20px',
          minWidth: 200,
          maxWidth: 250,
        }}
      >
        <Etiqueta>LÍDER</Etiqueta>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '.02em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 2px 8px rgba(0,0,0,.55)',
          }}
        >
          {lado.nombre || '—'}
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: `${BLANCO}B8`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lado.liderNombre || 'Sin líder'}
        </span>
        {lado.liderAspectos.length > 0 && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {lado.liderAspectos.map((a, i) => (
              <IconoAspecto key={`${a}-${i}`} aspecto={a} tam={26} />
            ))}
          </div>
        )}
      </div>

      {/* Base */}
      <Celda>
        <Etiqueta>BASE</Etiqueta>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MiniBase img={lado.baseImg} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 150 }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                lineHeight: 1.15,
                textTransform: 'uppercase',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {lado.baseNombre || 'Sin base'}
            </span>
            {lado.baseAspectos.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {lado.baseAspectos.map((a, i) => (
                  <IconoAspecto key={`${a}-${i}`} aspecto={a} tam={20} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Celda>

      {/* Vida */}
      <Celda>
        <Etiqueta>VIDA BASE</Etiqueta>
        <span
          style={{
            fontSize: 52,
            fontWeight: 900,
            lineHeight: 0.9,
            fontVariantNumeric: 'tabular-nums',
            color: derrotado ? ROJO : BLANCO,
            textShadow: derrotado ? `0 0 16px ${ROJO}` : '0 2px 10px rgba(0,0,0,.6)',
          }}
        >
          {vida}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: `${BLANCO}88`, whiteSpace: 'nowrap' }}>
          DAÑO {lado.dano} / {lado.hpMax} MÁX
        </span>
      </Celda>

      {/* Recursos */}
      <Celda>
        <Etiqueta>RECURSOS</Etiqueta>
        <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {lado.recursos}
        </span>
      </Celda>

      {/* Serie */}
      <Celda>
        <Etiqueta>SERIE</Etiqueta>
        <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {lado.juegosGanados}—{rival.juegosGanados}
        </span>
      </Celda>

      {conIniciativa && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px' }}>
          <span
            style={{
              padding: '14px 30px',
              background: `linear-gradient(180deg, #F5CF6B, ${DORADO} 55%, #B8862B)`,
              color: COBALTO_OSCURO,
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: '.2em',
              clipPath: chaflan(9),
              boxShadow: `0 0 18px ${DORADO}66`,
              whiteSpace: 'nowrap',
            }}
          >
            INICIATIVA
          </span>
        </div>
      )}
    </div>
  )
}

function MiniBase({ img }: { img: string }) {
  const [falló, setFalló] = useState(false)
  const src = img ? `/api/img?u=${encodeURIComponent(img)}&w=224` : ''
  if (!src || falló) {
    return (
      <span
        style={{
          width: 96,
          height: 58,
          flex: '0 0 auto',
          clipPath: chaflan(8),
          background: COBALTO_OSCURO,
          border: `1.5px solid ${DORADO}44`,
        }}
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFalló(true)}
      style={{
        width: 96,
        height: 58,
        flex: '0 0 auto',
        objectFit: 'cover',
        clipPath: chaflan(8),
        border: `1.5px solid ${DORADO}66`,
      }}
    />
  )
}

/** Pestañita flotante con el rótulo del lado, como en la plantilla. */
function Pestania({ texto, arriba }: { texto: string; arriba: boolean }) {
  return (
    <span
      style={{
        position: 'absolute',
        [arriba ? 'bottom' : 'top']: -13,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '4px 22px',
        background: METAL,
        border: `1px solid ${DORADO}55`,
        clipPath: chaflan(7),
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: '.24em',
        color: `${BLANCO}D5`,
        whiteSpace: 'nowrap',
      }}
    >
      {texto}
    </span>
  )
}

/* ── Barra superior: ronda + reloj + jugador 2 ──────────────────────── */

function BarraArriba({ estado, restante }: { estado: EstadoOverlay; restante: number | null }) {
  const porTerminar = restante !== null && restante <= 5 * 60 * 1000
  const colorReloj = estado.tiempoExtra || restante === 0 ? ROJO : porTerminar ? DORADO : BLANCO

  return (
    <div
      className="ov-fundido"
      style={{ position: 'absolute', top: 16, left: 18, right: 18, height: 128, display: 'flex', gap: 14 }}
    >
      {/* Bloque de ronda y reloj */}
      <Chapa recorte={16} brillo style={{ flex: '0 0 auto' }}>
        <Luces lado="izq" />
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 26px 0 30px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
              {estado.etiquetaRonda}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: `${BLANCO}99`, whiteSpace: 'nowrap' }}>
              JUEGO {estado.juego}
            </span>
          </div>
          <span style={{ width: 1, height: 64, background: `${DORADO}35` }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 46,
                fontWeight: 900,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: colorReloj,
                textShadow: colorReloj === BLANCO ? '0 2px 10px rgba(0,0,0,.6)' : `0 0 18px ${colorReloj}88`,
              }}
            >
              {restante !== null ? formatearReloj(restante) : '--:--'}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '.26em',
                color: `${BLANCO}CC`,
              }}
            >
              EN JUEGO
              <span
                className="ov-latido"
                style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF3B30', boxShadow: '0 0 9px #FF3B30' }}
              />
            </span>
          </div>
        </div>
      </Chapa>

      <div style={{ flex: 1 }} />

      {/* Jugador 2, reflejado hacia el borde derecho */}
      <Chapa recorte={16} brillo style={{ flex: '0 0 auto', position: 'relative' }}>
        <Luces lado="der" />
        <Pestania texto="JUGADOR 2 · LADO DERECHO" arriba={false} />
        <BloqueJugador
          lado={estado.lados[1]}
          rival={estado.lados[0]}
          invertido
          conIniciativa={estado.iniciativa === 1}
        />
      </Chapa>
    </div>
  )
}

/* ── Barra inferior: jugador 1 ──────────────────────────────────────── */

function BarraAbajo({ estado }: { estado: EstadoOverlay }) {
  /* Deja sitio a la barra de comunidad cuando está al aire: legal 46 +
     ticker 52 + margen. Sin ticker, pegada a la franja legal. */
  const abajo = estado.tickerVisible ? 108 : 56

  return (
    <div
      className="ov-fundido"
      style={{ position: 'absolute', bottom: abajo, left: 18, right: 18, height: 128, display: 'flex' }}
    >
      <Chapa recorte={16} brillo style={{ flex: '0 0 auto', position: 'relative' }}>
        <Luces lado="izq" />
        <Pestania texto="JUGADOR 1 · LADO IZQUIERDO" arriba />
        <BloqueJugador
          lado={estado.lados[0]}
          rival={estado.lados[1]}
          invertido={false}
          conIniciativa={estado.iniciativa === 0}
        />
      </Chapa>
      <div style={{ flex: 1 }} />
    </div>
  )
}

/* ── Capas ──────────────────────────────────────────────────────────── */

function BannerTiempo() {
  return (
    <div
      className="ov-fundido"
      style={{ position: 'absolute', top: 154, left: '50%', transform: 'translateX(-50%)', filter: `drop-shadow(0 0 22px ${ROJO}AA)` }}
    >
      <span
        style={{
          display: 'block',
          padding: '12px 44px',
          background: `linear-gradient(180deg, #E04A3F, ${ROJO} 60%, #8F241E)`,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: '.18em',
          clipPath: chaflan(12),
          whiteSpace: 'nowrap',
        }}
      >
        TIEMPO — FASE DE ACCIÓN ADICIONAL
      </span>
    </div>
  )
}

function BannerRevision() {
  return (
    <div
      className="ov-fundido"
      style={{ position: 'absolute', top: 470, left: '50%', transform: 'translateX(-50%)', filter: `drop-shadow(0 0 20px ${DORADO}66)` }}
    >
      <span
        style={{
          display: 'block',
          padding: '16px 46px',
          background: METAL,
          border: `2px solid ${DORADO}`,
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: '.14em',
          clipPath: chaflan(14),
          whiteSpace: 'nowrap',
        }}
      >
        PARTIDA EN REVISIÓN
      </span>
    </div>
  )
}

function CartaDestacadaVista({ carta }: { carta: NonNullable<EstadoOverlay['carta']> }) {
  const src = carta.img ? `/api/img?u=${encodeURIComponent(carta.img)}&w=448` : ''
  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 250,
        width: 1000,
        filter: 'drop-shadow(0 14px 40px rgba(0,0,0,.6)) drop-shadow(0 0 18px rgba(63,182,255,.25))',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: 22,
          background: METAL,
          border: `1.5px solid ${DORADO}66`,
          boxShadow: RELIEVE,
          clipPath: chaflan(16),
        }}
      >
        {src && (
          <img
            src={src}
            alt=""
            style={{ width: 190, height: 266, objectFit: 'cover', clipPath: chaflan(10), flex: '0 0 auto' }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>{carta.nombre}</span>
          {carta.subtitulo && (
            <span style={{ fontSize: 22, fontWeight: 700, color: `${BLANCO}A0` }}>{carta.subtitulo}</span>
          )}
          {carta.texto && (
            <span style={{ fontSize: 28, lineHeight: 1.32, color: `${BLANCO}EE` }}>{carta.texto}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Barra de comunidad ─────────────────────────────────────────────── */

function BarraNoticias({ texto }: { texto: string }) {
  const mensajes = useMemo(() => mensajesTicker(texto), [texto])
  if (mensajes.length === 0) return null

  const tira = mensajes.join('     ◆     ')

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 46,
        left: 0,
        right: 0,
        zIndex: 5,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: METAL,
        borderTop: `2px solid ${DORADO}99`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16)',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: `linear-gradient(180deg, #F5CF6B, ${DORADO} 55%, #B8862B)`,
          color: COBALTO_OSCURO,
          fontSize: 19,
          fontWeight: 900,
          letterSpacing: '.16em',
          zIndex: 1,
          clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)',
          paddingRight: 38,
        }}
      >
        COMUNIDAD
      </span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ov-corre">
          <span style={{ paddingLeft: 28, fontSize: 25, fontWeight: 600, color: BLANCO }}>{tira}</span>
          <span style={{ paddingLeft: 28, fontSize: 25, fontWeight: 600, color: BLANCO }}>{tira}</span>
        </div>
      </div>
    </div>
  )
}

function FranjaLegal({ patrocinio }: { patrocinio: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 46,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: `${COBALTO_OSCURO}E6`,
        borderTop: `1px solid ${BLANCO}1A`,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '.06em',
        color: `${BLANCO}99`,
        zIndex: 6,
      }}
    >
      <span>{AVISO_LEGAL}</span>
      {patrocinio && <span style={{ color: `${BLANCO}CC` }}>{patrocinio}</span>}
    </div>
  )
}

/* ── Escenas opacas ─────────────────────────────────────────────────── */

const TITULOS: Record<string, string> = {
  pronto: 'EMPEZAMOS PRONTO',
  descanso: 'DESCANSO',
  fin: 'GRACIAS POR VER',
}

function EscenaOpaca({ estado, restante }: { estado: EstadoOverlay; restante: number | null }) {
  const l0 = estado.lados[0]
  const l1 = estado.lados[1]
  const hayMatchup = Boolean(l0.nombre || l1.nombre)

  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
        // El marco propio (volcán + El Salvador) va de fondo; una capa oscura
        // sutil encima asegura contraste. El color sólido es el respaldo si la
        // imagen no cargara: nunca queda una pantalla en blanco.
        background: `linear-gradient(rgba(3,10,28,.24), rgba(3,10,28,.46)), url('/stream/fondo.jpg') center / cover no-repeat, ${COBALTO_OSCURO}`,
      }}
    >
      {/* El emblema de la comunidad preside la espera. */}
      <img
        src="/stream/logo.webp"
        alt=""
        style={{
          width: 330,
          height: 330,
          objectFit: 'contain',
          filter: `drop-shadow(0 0 34px rgba(63,182,255,.4)) drop-shadow(0 10px 26px rgba(0,0,0,.7))`,
        }}
      />

      <span
        style={{
          fontSize: 78,
          fontWeight: 900,
          letterSpacing: '.04em',
          textAlign: 'center',
          textShadow: '0 4px 22px rgba(0,0,0,.7)',
        }}
      >
        {TITULOS[estado.escena] ?? ''}
      </span>

      {estado.escena === 'pronto' && restante !== null && (
        <span
          style={{
            fontSize: 64,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: DORADO,
            textShadow: `0 0 26px ${DORADO}66`,
          }}
        >
          {formatearReloj(restante)}
        </span>
      )}

      {hayMatchup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 38 }}>
          <span style={{ fontSize: 42, fontWeight: 900, textTransform: 'uppercase' }}>{l0.nombre || '—'}</span>
          <span style={{ fontSize: 26, fontWeight: 900, color: DORADO, letterSpacing: '.22em' }}>VS</span>
          <span style={{ fontSize: 42, fontWeight: 900, textTransform: 'uppercase' }}>{l1.nombre || '—'}</span>
        </div>
      )}

      {estado.mensaje && (
        <span
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: `${BLANCO}CC`,
            maxWidth: 1200,
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {estado.mensaje}
        </span>
      )}

      <span
        style={{
          padding: '8px 26px',
          background: METAL,
          border: `1px solid ${DORADO}55`,
          clipPath: chaflan(8),
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '.16em',
          color: `${BLANCO}D5`,
        }}
      >
        {estado.etiquetaRonda}
      </span>
    </div>
  )
}

/* ── Estado de prueba (`?debug=1`) ──────────────────────────────────── */

const ESTADO_DEMO: EstadoOverlay = {
  ...ESTADO_INICIAL,
  escena: 'juego',
  etiquetaRonda: 'RONDA 3',
  juego: 2,
  iniciativa: 0,
  tickerVisible: true,
  ticker: 'Bienvenidos al primer torneo de SWU transmitido en vivo desde El Salvador',
  reloj: { duracionMs: 41 * 60 * 1000, iniciadoEn: Date.now(), restanteAlPausar: null },
  patrocinio: 'TIENDA ANFITRIONA',
  lados: [
    {
      ...ESTADO_INICIAL.lados[0],
      nombre: 'VARA',
      liderNombre: 'Lando Calrissian',
      liderImg: 'https://cdn.starwarsunlimited.com//card_04020265_EN_Lando_Calrissian_Leader_5c8816b151.png',
      liderAspectos: ['Vigilance', 'Heroism'],
      baseNombre: 'City in the Clouds',
      baseImg: 'https://cdn.starwarsunlimited.com//card_04010019_EN_City_in_the_Clouds_Base_08cd3755ae.png',
      baseAspectos: ['Vigilance'],
      hpMax: 30,
      dano: 12,
      recursos: 7,
      juegosGanados: 1,
    },
    {
      ...ESTADO_INICIAL.lados[1],
      nombre: 'NELSON',
      liderNombre: 'Cad Bane',
      liderImg: 'https://cdn.starwarsunlimited.com//card_08010011_EN_Cad_Bane_Leader_ec7bb7f9a7.png',
      liderAspectos: ['Aggression', 'Villainy'],
      baseNombre: 'Fortress of the Great Mothers',
      baseImg: 'https://cdn.starwarsunlimited.com//card_08010019_EN_Fortress_of_the_Great_Mothers_Base_88cb8bca99.png',
      baseAspectos: ['Vigilance'],
      hpMax: 30,
      dano: 19,
      recursos: 6,
      juegosGanados: 0,
      liderDesplegado: true,
    },
  ],
}
