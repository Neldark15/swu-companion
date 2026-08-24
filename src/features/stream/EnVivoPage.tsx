/**
 * EN VIVO — la pantalla pública donde la comunidad ve la transmisión.
 *
 * Acá se cierra el círculo del sistema:
 *   cámara → OBS → YouTube → esta página.
 *
 * La página NO recibe video de la cámara (un navegador no puede recibir una
 * cámara ajena); incrusta el directo de YouTube, que es donde OBS ya publicó
 * la mezcla de cámara + marcador. Debajo repite el marcador en vivo, que llega
 * por el mismo canal de tiempo real que el overlay: así el que mira desde el
 * teléfono ve los números grandes aunque el video vaya a 480p.
 *
 * Es PÚBLICA a propósito: sin sesión, sin AuthGate. Un espectador no se loguea.
 */

import { useEffect, useMemo, useState } from 'react'
import { Radio, Youtube } from 'lucide-react'
import {
  ESTADO_INICIAL,
  formatearReloj,
  mensajesTicker,
  restanteReloj,
  urlIncrustarYoutube,
  type EstadoOverlay,
  type LadoOverlay,
} from '../../types/stream'
import { leerOverlay, suscribirOverlay } from '../../services/streamOverlay'
import { imgCarta } from '../../services/streamCartas'
import { TransmisionDestacada } from './TransmisionDestacada'

/** Mismo código que usa el estudio y el overlay. */
const CODIGO = 'SV01'
const POLL_MS = 15_000

export function EnVivoPage() {
  const [estado, setEstado] = useState<EstadoOverlay>(ESTADO_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let vivo = true

    const releer = () =>
      leerOverlay(CODIGO)
        .then(r => {
          if (!vivo) return
          setEstado(r.estado)
          setCargando(false)
        })
        .catch(() => {
          if (vivo) setCargando(false)
        })

    releer()
    const cortar = suscribirOverlay(CODIGO, r => {
      if (vivo) setEstado(r.estado)
    })
    const id = window.setInterval(releer, POLL_MS)

    return () => {
      vivo = false
      cortar()
      window.clearInterval(id)
    }
  }, [])

  const src = useMemo(
    () => urlIncrustarYoutube(estado.youtube, typeof window !== 'undefined' ? window.location.origin : undefined),
    [estado.youtube]
  )
  const restante = useMemo(() => restanteReloj(estado.reloj, ahora), [estado.reloj, ahora])
  const hayTransmision = estado.envivo && src !== null
  const mensajes = useMemo(() => mensajesTicker(estado.ticker), [estado.ticker])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${
            hayTransmision ? 'bg-red-600 text-white' : 'bg-swu-surface text-swu-muted'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${hayTransmision ? 'animate-pulse bg-white' : 'bg-swu-muted'}`} />
          {hayTransmision ? 'En vivo' : 'Fuera del aire'}
        </span>
        <h1 className="text-lg font-black tracking-tight">Transmisión</h1>
      </header>

      {/* ── La transmisión DESTACADA ──
          Un directo de fuera (el «Meta Check-In» de Fantasy Flight, por
          ejemplo), con su cuenta atrás. Va ARRIBA de la nuestra a propósito:
          cuando la nuestra está fuera del aire —que es casi siempre, porque
          solo transmitimos en torneos— esta pantalla no tenía nada que
          enseñar, y ahora sí. Se esconde sola cuando no hay ninguna a la
          vista, así que en día de torneo no le roba el sitio al marcador. */}
      <TransmisionDestacada />

      {/* ── El video ── */}
      {hayTransmision ? (
        <div className="overflow-hidden rounded-2xl border border-swu-border bg-black">
          <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              key={src}
              src={src}
              title="Transmisión en vivo"
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-swu-border bg-swu-surface px-6 py-12 text-center">
          <Youtube size={36} className="text-swu-muted" />
          <p className="text-base font-bold">
            {cargando ? 'Cargando…' : 'No hay transmisión en este momento'}
          </p>
          <p className="max-w-sm text-sm text-swu-muted">
            Cuando haya un torneo al aire, el video aparece acá junto al marcador en vivo.
          </p>
        </div>
      )}

      {/* ── Marcador en vivo ──
          Se repite fuera del video a propósito: en el celular el video baja de
          resolución y los números del overlay se vuelven ilegibles. Acá son
          texto de verdad, nítido a cualquier tamaño. */}
      {(hayTransmision || estado.lados[0].nombre || estado.lados[1].nombre) && (
        <section className="rounded-2xl border border-swu-border bg-swu-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-swu-muted">
              {estado.etiquetaRonda} · Juego {estado.juego}
            </span>
            {restante !== null && (
              <span className="font-mono text-xl font-black tabular-nums">{formatearReloj(restante)}</span>
            )}
          </div>

          {estado.tiempoExtra && (
            <p className="mb-3 rounded-lg bg-red-600 px-3 py-2 text-center text-xs font-black uppercase tracking-widest text-white">
              Tiempo — fase de acción adicional
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {([0, 1] as const).map(i => (
              <LadoPublico
                key={i}
                lado={estado.lados[i]}
                iniciativa={estado.iniciativa === i}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Mensajes de la comunidad ── */}
      {estado.tickerVisible && mensajes.length > 0 && (
        <section className="rounded-2xl border border-swu-border bg-swu-surface p-4">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
            <Radio size={13} />
            Comunidad
          </p>
          <ul className="flex flex-col gap-1.5">
            {mensajes.map((m, i) => (
              <li key={i} className="text-sm text-swu-text">
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-4 text-center text-[11px] leading-relaxed text-swu-muted">
        Cobertura comunitaria hecha por fans. No oficial, no afiliada a Fantasy Flight Games,
        Asmodee ni Lucasfilm.
      </p>
    </div>
  )
}

function LadoPublico({ lado, iniciativa }: { lado: LadoOverlay; iniciativa: boolean }) {
  const vida = Math.max(0, lado.hpMax - lado.dano)
  const porcentaje = lado.hpMax > 0 ? (vida / lado.hpMax) * 100 : 0
  const critico = porcentaje <= 25

  return (
    <div
      className={`rounded-xl border p-3 ${
        iniciativa ? 'border-swu-amber/60 bg-swu-amber/5' : 'border-swu-border bg-swu-bg'
      }`}
    >
      <div className="flex items-center gap-3">
        {lado.liderImg ? (
          <img
            src={imgCarta(lado.liderImg, 128)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="h-14 w-14 shrink-0 rounded-lg bg-swu-surface-hover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black">{lado.nombre || '—'}</p>
          <p className="truncate text-xs text-swu-muted">{lado.liderNombre || 'Sin líder'}</p>
          {lado.baseNombre && (
            <p className="truncate text-[11px] text-swu-muted">{lado.baseNombre}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`block font-mono text-3xl font-black leading-none tabular-nums ${
              vida === 0 ? 'text-red-500' : critico ? 'text-swu-amber' : 'text-swu-text'
            }`}
          >
            {vida}
          </span>
          <span className="text-[10px] text-swu-muted">de {lado.hpMax}</span>
        </div>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-swu-surface-hover">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            vida === 0 ? 'bg-red-600' : critico ? 'bg-swu-amber' : 'bg-emerald-500'
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-swu-muted">
        <span>Recursos {lado.recursos}</span>
        {iniciativa && (
          <span className="font-black uppercase tracking-wider text-swu-amber">Iniciativa</span>
        )}
      </div>
    </div>
  )
}
