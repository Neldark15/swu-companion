/**
 * EncuestaSheet — la encuesta, de a una pregunta por pantalla.
 *
 * ── Por qué de a una y no todo junto ─────────────────────────────────
 *
 * Es el mismo criterio que ya rescató al asistente de perfil: ahí la
 * personalización «no la usaba NADIE» —bio, banner, vitrina y nombre de
 * planeta en 0 de 23— y lo que lo cambió fue pedir de a UN dato por paso.
 * Doce preguntas en una sola página se ven como un formulario de banco; de a
 * una, cada paso se resuelve con uno o dos toques.
 *
 * ── Lo que se guarda mientras tanto ──────────────────────────────────
 *
 * El borrador vive en `localStorage`, NO en la nube. No es pereza: mandar
 * respuestas parciales al servidor obligaría a guardarlas junto a quién las
 * escribió para poder continuarlas, y ahí se acabó el anonimato que hace
 * honesta la pregunta del precio. Se manda todo junto, una vez, o no se manda.
 *
 * ── La barra de arriba dice cuánto falta, no cuánto llevás ───────────
 *
 * «Faltan 4» empuja; «vas por la 8» informa. Con doce preguntas la diferencia
 * es quién termina.
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Check, Send, Loader2 } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import {
  PREGUNTAS, responderEncuesta, type Pregunta, type Respuestas,
} from '../../services/encuesta'

const CLAVE_BORRADOR = 'encuesta_borrador'

interface Props {
  open: boolean
  clave: string
  titulo: string
  descripcion: string | null
  onCerrar: () => void
  onEnviada: () => void
}

export function EncuestaSheet({ open, clave, titulo, descripcion, onCerrar, onEnviada }: Props) {
  const [i, setI] = useState(0)
  const [resp, setResp] = useState<Respuestas>(() => {
    try { return JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? '{}') as Respuestas }
    catch { return {} }
  })
  const [ayuda, setAyuda] = useState(false)
  const [contacto, setContacto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  // El borrador se escribe en cada cambio, no al avanzar: quien cierre la hoja
  // a mitad de una pregunta no pierde lo que ya tocó.
  useEffect(() => {
    try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(resp)) } catch { /* sin sitio */ }
  }, [resp])

  const ultima = i >= PREGUNTAS.length
  const p = PREGUNTAS[i]
  const contestadas = useMemo(
    () => PREGUNTAS.filter(q => tieneRespuesta(q, resp[q.id])).length,
    [resp],
  )

  const poner = (id: string, valor: unknown) => setResp(r => ({ ...r, [id]: valor }))

  const puedeSeguir = ultima || !!p.opcional || tieneRespuesta(p, resp[p.id])

  const enviar = async () => {
    setEnviando(true)
    setFallo(null)
    const r = await responderEncuesta(clave, resp, ayuda, contacto)
    setEnviando(false)
    if (!r.ok) { setFallo(r.mensaje); return }
    try { localStorage.removeItem(CLAVE_BORRADOR) } catch { /* da igual */ }
    onEnviada()
  }

  return (
    <Sheet open={open} onClose={onCerrar} title={titulo}>
      {/* La hoja no trae aire lateral: lo pone quien la llena. Sin esto las
          opciones quedan pegadas a los dos bordes y el contador se corta. */}
      <div className="flex flex-col gap-4 px-4 pb-2">
        {/* ── Cuánto falta ── */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-swu-bg">
            <div
              className="h-full rounded-full bg-swu-cyan transition-[width] duration-300"
              style={{ width: `${(contestadas / PREGUNTAS.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-swu-muted">
            {ultima ? 'Listo' : `Faltan ${PREGUNTAS.length - contestadas}`}
          </span>
        </div>

        {i === 0 && descripcion && (
          <p className="text-[12px] leading-snug text-swu-muted">{descripcion}</p>
        )}

        {ultima ? (
          <Cierre
            ayuda={ayuda} setAyuda={setAyuda}
            contacto={contacto} setContacto={setContacto}
            sinContestar={PREGUNTAS.length - contestadas}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[15px] font-black leading-tight text-swu-text">{p.enunciado}</h3>
            {p.pista && <p className="text-[11px] leading-snug text-swu-muted">{p.pista}</p>}
            <Cuerpo pregunta={p} valor={resp[p.id]} onCambiar={v => poner(p.id, v)} />
          </div>
        )}

        {fallo && (
          <p className="rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] text-swu-red-texto">{fallo}</p>
        )}

        {/* ── Navegación ── */}
        <div className="flex items-center gap-2 pt-1">
          {i > 0 && (
            <button
              onClick={() => setI(n => n - 1)}
              className="flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-[12px]
                         font-bold text-swu-muted"
            >
              <ChevronLeft size={15} /> Atrás
            </button>
          )}
          <div className="flex-1" />
          {ultima ? (
            <Button onClick={enviar} disabled={enviando}>
              {enviando
                ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                : <><Send size={15} /> Enviar</>}
            </Button>
          ) : (
            <Button onClick={() => setI(n => n + 1)} disabled={!puedeSeguir}>
              {p.opcional && !tieneRespuesta(p, resp[p.id]) ? 'Saltar' : 'Siguiente'}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/** ¿Esta pregunta está contestada? Cada tipo lo define distinto. */
function tieneRespuesta(p: Pregunta, v: unknown): boolean {
  if (v === undefined || v === null) return false
  switch (p.tipo) {
    case 'varias':
      return Array.isArray(v) && v.length > 0
    case 'escalera':
      // Todos los peldaños contestados: media escalera no da una curva.
      return typeof v === 'object' &&
        (p.peldanos ?? []).every(x => (v as Record<string, unknown>)[String(x.valor)] !== undefined)
    case 'reparto': {
      // Tiene que SUMAR el total. Un reparto que no suma no obligó a elegir,
      // que es lo único que esta pregunta vino a hacer.
      const m = v as Record<string, number>
      return Object.values(m).reduce((s, n) => s + (Number(n) || 0), 0) === (p.total ?? 100)
    }
    case 'rejilla':
      return typeof v === 'object' &&
        (p.opciones ?? []).every(o => (v as Record<string, unknown>)[o.id] !== undefined)
    case 'texto':
      return typeof v === 'string' && v.trim().length > 0
    default:
      return typeof v === 'string' && v.length > 0
  }
}

function Cuerpo({ pregunta, valor, onCambiar }: {
  pregunta: Pregunta; valor: unknown; onCambiar: (v: unknown) => void
}) {
  switch (pregunta.tipo) {
    case 'una':
      return (
        <div className="flex flex-col gap-1.5">
          {(pregunta.opciones ?? []).map(o => (
            <Opcion key={o.id} texto={o.texto} marcada={valor === o.id}
                    onTocar={() => onCambiar(o.id)} />
          ))}
        </div>
      )

    case 'varias': {
      const lista = Array.isArray(valor) ? (valor as string[]) : []
      return (
        <div className="flex flex-col gap-1.5">
          {(pregunta.opciones ?? []).map(o => (
            <Opcion key={o.id} texto={o.texto} cuadrada marcada={lista.includes(o.id)}
                    onTocar={() => onCambiar(
                      lista.includes(o.id) ? lista.filter(x => x !== o.id) : [...lista, o.id])} />
          ))}
        </div>
      )
    }

    case 'escalera': {
      const m = (valor ?? {}) as Record<string, boolean>
      return (
        <div className="flex flex-col gap-1.5">
          {(pregunta.peldanos ?? []).map(pel => (
            <div key={pel.valor}
                 className="flex items-center gap-2 rounded-xl bg-swu-bg px-3 py-2">
              <span className="w-12 font-mono text-[15px] font-black tabular-nums text-swu-amber">
                ${pel.valor}
              </span>
              <span className="flex-1 text-[11px] text-swu-muted">{pel.nota}</span>
              {[true, false].map(si => (
                <button
                  key={String(si)}
                  onClick={() => onCambiar({ ...m, [pel.valor]: si })}
                  aria-pressed={m[pel.valor] === si}
                  className={`min-h-[44px] min-w-[52px] rounded-lg border text-[12px] font-bold
                              transition-colors ${
                    m[pel.valor] === si
                      ? si ? 'border-swu-green/60 bg-swu-green/20 text-swu-green'
                           : 'border-swu-border bg-swu-surface text-swu-muted'
                      : 'border-swu-border text-swu-muted/60'
                  }`}
                >
                  {si ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          ))}
        </div>
      )
    }

    case 'reparto': {
      const m = (valor ?? {}) as Record<string, number>
      const total = pregunta.total ?? 100
      const puesto = Object.values(m).reduce((s, n) => s + (Number(n) || 0), 0)
      const queda = total - puesto
      return (
        <div className="flex flex-col gap-2">
          <div className={`rounded-lg px-3 py-1.5 text-center font-mono text-[12px] tabular-nums ${
            queda === 0 ? 'bg-swu-green/15 text-swu-green' : 'bg-swu-bg text-swu-muted'}`}>
            {queda === 0 ? '¡Listo! Suma 100' : `Te quedan $${queda} por repartir`}
          </div>
          {(pregunta.opciones ?? []).map(o => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="flex-1 text-[12px] text-swu-text">{o.texto}</span>
              {/* Botones y no un campo de texto: repartir cien en el teclado
                  numérico de un teléfono es donde la gente abandona. */}
              <button
                onClick={() => onCambiar({ ...m, [o.id]: Math.max(0, (m[o.id] ?? 0) - 10) })}
                className="h-11 w-11 rounded-lg bg-swu-bg text-swu-muted"
                aria-label={`Quitar 10 a ${o.texto}`}
              >−</button>
              <span className="w-9 text-center font-mono text-[13px] font-bold tabular-nums text-swu-text">
                {m[o.id] ?? 0}
              </span>
              <button
                onClick={() => onCambiar({ ...m, [o.id]: (m[o.id] ?? 0) + Math.min(10, Math.max(0, queda)) })}
                disabled={queda <= 0}
                className="h-11 w-11 rounded-lg bg-swu-bg text-swu-muted disabled:opacity-40"
                aria-label={`Sumar 10 a ${o.texto}`}
              >+</button>
            </div>
          ))}
        </div>
      )
    }

    case 'rejilla': {
      const m = (valor ?? {}) as Record<string, string>
      return (
        <div className="flex flex-col gap-1.5">
          {(pregunta.opciones ?? []).map(o => (
            <div key={o.id} className="rounded-xl bg-swu-bg px-3 py-2">
              <p className="mb-1.5 text-[12px] leading-snug text-swu-text">{o.texto}</p>
              <div className="flex gap-1.5">
                {(pregunta.columnas ?? []).map(c => (
                  <button
                    key={c.id}
                    onClick={() => onCambiar({ ...m, [o.id]: c.id })}
                    aria-pressed={m[o.id] === c.id}
                    className={`min-h-[44px] flex-1 rounded-lg border text-[11px] font-bold
                                transition-colors ${
                      m[o.id] === c.id
                        ? 'border-swu-cyan/60 bg-swu-cyan/15 text-swu-cyan'
                        : 'border-swu-border text-swu-muted/70'
                    }`}
                  >
                    {c.texto}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    case 'texto':
      return (
        <div className="flex flex-col gap-1">
          <textarea
            value={typeof valor === 'string' ? valor : ''}
            onChange={e => onCambiar(e.target.value.slice(0, pregunta.maximo ?? 160))}
            rows={3}
            className="w-full rounded-xl border border-swu-border bg-swu-bg p-3 text-[13px]
                       text-swu-text focus:outline-none focus:ring-2 focus:ring-swu-accent"
            placeholder="Lo que se te ocurra…"
          />
          <span className="self-end font-mono text-[10px] tabular-nums text-swu-muted">
            {(typeof valor === 'string' ? valor.length : 0)}/{pregunta.maximo ?? 160}
          </span>
        </div>
      )
  }
}

function Opcion({ texto, marcada, cuadrada = false, onTocar }: {
  texto: string; marcada: boolean; cuadrada?: boolean; onTocar: () => void
}) {
  return (
    <button
      onClick={onTocar}
      aria-pressed={marcada}
      className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left
                  transition-colors ${
        marcada ? 'border-swu-cyan/60 bg-swu-cyan/10' : 'border-swu-border bg-swu-bg'
      }`}
    >
      <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center border
                        ${cuadrada ? 'rounded-[4px]' : 'rounded-full'} ${
        marcada ? 'border-swu-cyan bg-swu-cyan text-swu-bg' : 'border-swu-border'
      }`}>
        {marcada && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="text-[13px] leading-snug text-swu-text">{texto}</span>
    </button>
  )
}

/** El último paso: la casilla que rompe el anonimato, y la rompe a propósito. */
function Cierre({ ayuda, setAyuda, contacto, setContacto, sinContestar }: {
  ayuda: boolean; setAyuda: (v: boolean) => void
  contacto: string; setContacto: (v: string) => void
  sinContestar: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[15px] font-black leading-tight text-swu-text">Ya está</h3>
      <p className="text-[12px] leading-snug text-swu-muted">
        {sinContestar > 0
          ? `Dejaste ${sinContestar} sin contestar. Se puede enviar igual — o volvé atrás.`
          : 'Contestaste las doce. Gracias, de verdad.'}
      </p>

      {/* Va separada, al final y opcional. El anonimato es lo que hace honesta
          la pregunta del precio; esta casilla es lo que convierte la encuesta
          en una lista de gente dispuesta. Juntas no se puede tener las dos. */}
      <div className="rounded-xl border border-swu-amber/30 bg-swu-amber/5 p-3">
        <button
          onClick={() => setAyuda(!ayuda)}
          aria-pressed={ayuda}
          className="flex min-h-[44px] w-full items-center gap-2.5 text-left"
        >
          <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center
                            rounded-[4px] border ${
            ayuda ? 'border-swu-amber bg-swu-amber text-swu-bg' : 'border-swu-border'}`}>
            {ayuda && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="text-[13px] font-bold text-swu-text">Quiero ayudar a organizar</span>
        </button>
        {ayuda && (
          <input
            value={contacto}
            onChange={e => setContacto(e.target.value.slice(0, 120))}
            placeholder="Tu nombre o WhatsApp"
            className="mt-2 w-full rounded-lg border border-swu-border bg-swu-bg px-3 py-2
                       text-[13px] text-swu-text focus:outline-none focus:ring-2 focus:ring-swu-accent"
          />
        )}
        <p className="mt-2 text-[10px] leading-snug text-swu-muted">
          Es lo ÚNICO que lleva tu nombre. Tus respuestas van por otro lado y no
          se pueden unir con vos — ni yo puedo saber quién dijo qué.
        </p>
      </div>
    </div>
  )
}
