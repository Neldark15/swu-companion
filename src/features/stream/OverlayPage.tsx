/**
 * OVERLAY — lo que ve OBS.
 *
 * Reglas que gobiernan este archivo:
 *
 *  · CSS puro. Nada de framer-motion ni three: cada chunk nuevo lo bajan al
 *    instalar todos los usuarios de la PWA, y `medir-precache` es criterio duro.
 *  · Lienzo FIJO de 1920×1080 escalado con `transform`. El layout es
 *    pixel-exacto, y funciona igual con un canvas de 1280×720 (plan B de red)
 *    sin tocar una línea.
 *  · No consulta ninguna base de cartas. El panel escribe nombre, imagen, HP y
 *    aspectos ya resueltos; acá solo se pintan.
 *  · Tipografía dimensionada para leerse a 720p y sobrevivir a 480p, que es lo
 *    que de verdad ve la gente en el teléfono.
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
 * Azul cobalto y blanco: la bandera de El Salvador, no el juego. Dorado
 * para la iniciativa, rojo solo para TIEMPO. Cero elementos de marca de
 * FFG, Asmodee o Lucasfilm — la cobertura es de fans y lo dice en pantalla. */
const COBALTO = '#0A2E6E'
const COBALTO_OSCURO = '#061B42'
const DORADO = '#E8B849'
const ROJO = '#C1332A'
const BLANCO = '#F4F7FB'

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
@media (prefers-reduced-motion: reduce) {
  .ov-fundido { animation: none }
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
   * {duracionMs, iniciadoEn} y acá se resta. Una escritura para arrancar,
   * una para pausar. ── */
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
          /* Silencio a propósito: el overlay conserva lo último bueno.
             Dejar de pintar por un fallo de red sería peor que quedarse
             unos segundos con el marcador anterior. */
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
        {estado.tickerVisible && <BarraNoticias texto={estado.ticker} />}
        {estado.escena === 'juego' ? (
          <>
            <BarraSuperior estado={estado} restante={restante} />
            <PanelJugador lado={estado.lados[0]} alineado="izq" activo={estado.iniciativa === 0} estado={estado} />
            <PanelJugador lado={estado.lados[1]} alineado="der" activo={estado.iniciativa === 1} estado={estado} />
            {estado.tiempoExtra && <BannerTiempo />}
            {estado.enRevision && <BannerRevision />}
            {cartaVisible && <CartaDestacadaVista carta={cartaVisible} />}
          </>
        ) : (
          <EscenaOpaca estado={estado} restante={restante} />
        )}
        <FranjaLegal patrocinio={estado.patrocinio} />
      </div>
    </>
  )
}

/* ── Barra superior ─────────────────────────────────────────────────── */

function BarraSuperior({ estado, restante }: { estado: EstadoOverlay; restante: number | null }) {
  const porTerminar = restante !== null && restante <= 5 * 60 * 1000
  const agotado = restante !== null && restante === 0

  /* El reloj va sobre un bloque sólido, no sobre el mismo fondo que el texto:
     es el dato que más se consulta y así conserva contraste aunque el stream
     baje a 480p, donde los grises finos se deshacen con la compresión. */
  const fondoReloj = agotado || estado.tiempoExtra ? ROJO : porTerminar ? DORADO : BLANCO
  const textoReloj = agotado || estado.tiempoExtra ? BLANCO : COBALTO_OSCURO

  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        top: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'stretch',
        height: 78,
        borderRadius: 10,
        overflow: 'hidden',
        border: `2px solid ${DORADO}77`,
        boxShadow: '0 10px 38px rgba(0,0,0,.55)',
      }}
    >
      {/* Ronda — el rótulo del momento del torneo */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 30px',
          background: `linear-gradient(180deg, ${COBALTO}F5, ${COBALTO_OSCURO}F8)`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '.28em',
            color: DORADO,
            lineHeight: 1,
            marginBottom: 5,
          }}
        >
          RONDA
        </span>
        <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, letterSpacing: '.02em' }}>
          {estado.etiquetaRonda.replace(/^RONDA\s*/i, '')}
        </span>
      </div>

      <span style={{ width: 2, background: `${DORADO}44` }} />

      {/* Juego de la serie */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 26px',
          background: `linear-gradient(180deg, ${COBALTO}F5, ${COBALTO_OSCURO}F8)`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '.28em',
            color: DORADO,
            lineHeight: 1,
            marginBottom: 5,
          }}
        >
          JUEGO
        </span>
        <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{estado.juego}</span>
      </div>

      {restante !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 190,
            padding: '0 26px',
            background: fondoReloj,
            color: textoReloj,
          }}
        >
          <span
            style={{
              fontSize: 46,
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '.01em',
              lineHeight: 1,
            }}
          >
            {formatearReloj(restante)}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Panel de jugador ───────────────────────────────────────────────── */

function PanelJugador({
  lado,
  alineado,
  activo,
  estado,
}: {
  lado: LadoOverlay
  alineado: 'izq' | 'der'
  activo: boolean
  estado: EstadoOverlay
}) {
  const restanteHp = Math.max(0, lado.hpMax - lado.dano)
  const derrotado = restanteHp === 0
  /* En fase de acción adicional el resultado del partido ES el HP restante
     (y la iniciativa para desempatar), así que se resalta. */
  const resaltar = estado.tiempoExtra

  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        top: 132,
        [alineado === 'izq' ? 'left' : 'right']: 30,
        width: 360,
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: `linear-gradient(180deg, ${COBALTO}F0, ${COBALTO_OSCURO}F5)`,
        border: `2px solid ${activo ? DORADO : `${BLANCO}22`}`,
        borderRadius: 10,
        boxShadow: activo
          ? `0 0 0 3px ${DORADO}44, 0 10px 36px rgba(0,0,0,.5)`
          : '0 10px 36px rgba(0,0,0,.5)',
      } as React.CSSProperties}
    >
      <RetratoLider lado={lado} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>
          {lado.nombre || '—'}
        </span>
        <span style={{ fontSize: 24, fontWeight: 600, color: `${BLANCO}B0`, lineHeight: 1.2 }}>
          {lado.liderNombre || 'Sin líder'}
        </span>
      </div>

      {lado.liderAspectos.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {lado.liderAspectos.map((a, i) => (
            <IconoAspecto key={`${a}-${i}`} aspecto={a} />
          ))}
        </div>
      )}

      {/* El HP restante es el número más grande de la pantalla. A 480p sigue
          midiendo 53 px, que es lo único que se lee sí o sí. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span
          style={{
            fontSize: 118,
            fontWeight: 900,
            lineHeight: 0.9,
            fontVariantNumeric: 'tabular-nums',
            color: derrotado ? ROJO : resaltar ? DORADO : BLANCO,
            textShadow: '0 3px 12px rgba(0,0,0,.6)',
          }}
        >
          {restanteHp}
        </span>
        <span style={{ fontSize: 22, fontWeight: 600, color: `${BLANCO}99` }}>
          {lado.dano} daño / {lado.hpMax}
        </span>
      </div>

      <span style={{ fontSize: 21, fontWeight: 600, color: `${BLANCO}A0`, lineHeight: 1.2 }}>
        {lado.baseNombre || 'Sin base'}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 30, fontWeight: 700 }}>
          <span style={{ color: `${BLANCO}88`, fontSize: 20, fontWeight: 600 }}>RECURSOS </span>
          {lado.recursos}
        </span>
        <PuntosSerie ganados={lado.juegosGanados} />
      </div>

      {activo && (
        <div
          style={{
            marginTop: 2,
            padding: '7px 0',
            textAlign: 'center',
            background: DORADO,
            color: COBALTO_OSCURO,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '.14em',
            borderRadius: 5,
          }}
        >
          INICIATIVA
        </div>
      )}
    </div>
  )
}

function RetratoLider({ lado }: { lado: LadoOverlay }) {
  const [falló, setFalló] = useState(false)
  const src = lado.liderImg ? `/api/img?u=${encodeURIComponent(lado.liderImg)}&w=448` : ''

  const marco: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 190,
    borderRadius: 7,
    overflow: 'hidden',
    background: `${COBALTO_OSCURO}`,
    border: `2px solid ${lado.liderDesplegado ? DORADO : `${BLANCO}1A`}`,
  }

  return (
    <div style={marco}>
      {/* Una silueta de respaldo, no un hueco: un arte que no carga deja un
          agujero en pantalla y se nota más que una caja con el nombre. */}
      {src && !falló ? (
        <img
          src={src}
          alt=""
          onError={() => setFalló(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: `${BLANCO}55`,
            letterSpacing: '.1em',
          }}
        >
          SIN LÍDER
        </div>
      )}
      {lado.liderDesplegado && (
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            padding: '4px 10px',
            background: DORADO,
            color: COBALTO_OSCURO,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '.1em',
            borderRadius: 4,
          }}
        >
          DESPLEGADO
        </span>
      )}
    </div>
  )
}

function IconoAspecto({ aspecto }: { aspecto: string }) {
  const [falló, setFalló] = useState(false)
  const archivo = aspecto.toLowerCase()
  if (falló) return null
  return (
    <img
      src={`/icons/aspects/${archivo}.webp`}
      alt={aspecto}
      onError={() => setFalló(true)}
      style={{ width: 44, height: 44, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))' }}
    />
  )
}

function PuntosSerie({ ganados }: { ganados: number }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {[0, 1].map(i => (
        <span
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: i < ganados ? DORADO : 'transparent',
            border: `2px solid ${i < ganados ? DORADO : `${BLANCO}44`}`,
          }}
        />
      ))}
    </div>
  )
}

/* ── Capas ──────────────────────────────────────────────────────────── */

function BannerTiempo() {
  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '11px 0',
        textAlign: 'center',
        background: ROJO,
        fontSize: 30,
        fontWeight: 900,
        letterSpacing: '.16em',
      }}
    >
      TIEMPO — FASE DE ACCIÓN ADICIONAL
    </div>
  )
}

function BannerRevision() {
  return (
    <div
      className="ov-fundido"
      style={{
        position: 'absolute',
        top: 470,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '16px 46px',
        background: `${COBALTO_OSCURO}F2`,
        border: `3px solid ${DORADO}`,
        borderRadius: 9,
        fontSize: 34,
        fontWeight: 800,
        letterSpacing: '.12em',
      }}
    >
      PARTIDA EN REVISIÓN
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
        left: 420,
        bottom: 96,
        width: 1080,
        display: 'flex',
        gap: 24,
        padding: 22,
        background: `linear-gradient(180deg, ${COBALTO}F5, ${COBALTO_OSCURO}FA)`,
        border: `2px solid ${DORADO}88`,
        borderRadius: 10,
        boxShadow: '0 12px 44px rgba(0,0,0,.55)',
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          style={{ width: 200, height: 280, objectFit: 'cover', borderRadius: 7, flex: '0 0 auto' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1 }}>{carta.nombre}</span>
        {carta.subtitulo && (
          <span style={{ fontSize: 24, fontWeight: 600, color: `${BLANCO}A0` }}>{carta.subtitulo}</span>
        )}
        {/* Retipografiado a 30 px: la imagen digital de la carta tiene el mismo
            problema de escala que la carta física (~10 px de mayúscula). */}
        {carta.texto && (
          <span style={{ fontSize: 30, lineHeight: 1.32, color: `${BLANCO}EE` }}>{carta.texto}</span>
        )}
      </div>
    </div>
  )
}

/**
 * Barra de noticias de la comunidad.
 *
 * Va JUSTO ENCIMA de la franja legal (que nunca se tapa) y se dibuja por
 * encima de todas las escenas, así sirve igual en la partida y en los
 * descansos. El contenido se duplica para que el bucle no tenga costura.
 */
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
        background: `linear-gradient(90deg, ${COBALTO}F0, ${COBALTO_OSCURO}F0)`,
        borderTop: `2px solid ${DORADO}99`,
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          background: DORADO,
          color: COBALTO_OSCURO,
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: '.16em',
          zIndex: 1,
        }}
      >
        COMUNIDAD
      </span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="ov-corre">
          {/* Dos copias: la animación corre -50% y vuelve a empezar sin salto. */}
          <span style={{ paddingLeft: 28, fontSize: 26, fontWeight: 600, color: BLANCO }}>{tira}</span>
          <span style={{ paddingLeft: 28, fontSize: 26, fontWeight: 600, color: BLANCO }}>{tira}</span>
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
        background: `${COBALTO_OSCURO}D9`,
        borderTop: `1px solid ${BLANCO}1A`,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '.06em',
        color: `${BLANCO}99`,
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
        gap: 34,
        // El marco propio (volcán + El Salvador) va de fondo; una capa oscura
        // sutil encima asegura contraste del texto. El color sólido es el
        // respaldo si la imagen no cargara: nunca queda una pantalla en blanco.
        background: `linear-gradient(rgba(3,10,28,.28), rgba(3,10,28,.5)), url('/stream/fondo.jpg') center / cover no-repeat, ${COBALTO_OSCURO}`,
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.42em', color: DORADO }}>
        HOLOCRON SWU · EL SALVADOR
      </span>

      <span style={{ fontSize: 92, fontWeight: 900, letterSpacing: '.03em', textAlign: 'center' }}>
        {TITULOS[estado.escena] ?? ''}
      </span>

      {estado.escena === 'pronto' && restante !== null && (
        <span style={{ fontSize: 74, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: DORADO }}>
          {formatearReloj(restante)}
        </span>
      )}

      {hayMatchup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 8 }}>
          <span style={{ fontSize: 46, fontWeight: 800 }}>{l0.nombre || '—'}</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: DORADO, letterSpacing: '.2em' }}>VS</span>
          <span style={{ fontSize: 46, fontWeight: 800 }}>{l1.nombre || '—'}</span>
        </div>
      )}

      {estado.mensaje && (
        <span
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: `${BLANCO}C0`,
            maxWidth: 1200,
            textAlign: 'center',
            lineHeight: 1.35,
          }}
        >
          {estado.mensaje}
        </span>
      )}

      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.1em', color: `${BLANCO}88` }}>
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
  reloj: { duracionMs: 41 * 60 * 1000, iniciadoEn: Date.now(), restanteAlPausar: null },
  patrocinio: 'TIENDA ANFITRIONA',
  lados: [
    {
      ...ESTADO_INICIAL.lados[0],
      nombre: 'NELSON',
      liderNombre: 'Grand Admiral Thrawn',
      liderAspectos: ['Cunning', 'Villainy'],
      baseNombre: 'Command Center',
      hpMax: 30,
      dano: 12,
      recursos: 7,
      juegosGanados: 1,
    },
    {
      ...ESTADO_INICIAL.lados[1],
      nombre: 'RODRIGO',
      liderNombre: 'Luke Skywalker',
      liderAspectos: ['Vigilance', 'Heroism'],
      baseNombre: 'Dagobah Swamp',
      hpMax: 26,
      dano: 19,
      recursos: 6,
      juegosGanados: 0,
      liderDesplegado: true,
    },
  ],
}
