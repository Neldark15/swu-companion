/**
 * PARTIDAS POR CONFIRMAR — el consentimiento del rival.
 *
 * Una amistosa la anota una persona, pero la jugaron DOS. Publicarla sin
 * preguntarle al otro sería contar su mazo, su resultado y con quién juega sin
 * que haya dicho que sí. Así que acá le cae, y hasta que responda la partida
 * es privada: la ven los dos y nadie más.
 *
 * Al aceptar puede además CORREGIR SU LADO y adjuntar su mazo. Es el momento
 * natural: quien anotó lo hizo de memoria y muchas veces no sabe el líder
 * exacto del otro, o lo deja en blanco. Sin esta pantalla, la mitad de los
 * datos del meta serían de segunda mano.
 *
 * «Rechazar» no borra nada. La partida se jugó y sigue en el historial de los
 * dos; lo único que cambia es que no se publica. Negarse a publicar no es
 * negar que pasó.
 */

import { useEffect, useState } from 'react'
import { Check, X, ChevronDown } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { confirmarAmistosa, pendientesDeConfirmar, type DueloVisto } from '../../services/amistosas'
import { misMazos, type MazoCompartible } from '../../services/galaxiaCompartir'
import { ensureCards } from '../../services/swuApi'
import { cargarIndice, claveDeCarta, type IndiceCartas } from './cartasAmistosas'
import { fechaCorta } from '../../services/horaSV'

interface Props {
  miId: string
  /** Se llama cuando algo cambió, para que el historial se recargue. */
  alCambiar: () => void
}

export function PorConfirmar({ miId, alCambiar }: Props) {
  const [pendientes, setPendientes] = useState<DueloVisto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [mazos, setMazos] = useState<MazoCompartible[]>([])
  const [indice, setIndice] = useState<IndiceCartas | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)

  /* La carga vive DENTRO del efecto y no en un `useCallback` que el efecto
   * llame: el lint del compilador de React rastrea el callback y marca el
   * `setState` como escritura síncrona desde el efecto. Misma forma que ya
   * usa AmistosasPage. Para volver a pedir se sube `recarga`, que sí es una
   * dependencia de verdad. */
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await pendientesDeConfirmar(miId)
      if (!vivo) return
      if (r.ok) { setPendientes(r.datos); setError(null) } else setError(r.mensaje)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [miId, recarga])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const lista = await misMazos(miId)
      if (vivo) setMazos(lista)
      await ensureCards()
      const ix = await cargarIndice()
      if (vivo) setIndice(ix)
    })()
    return () => { vivo = false }
  }, [miId])

  async function responder(duelo: DueloVisto, acepta: boolean, mazoId: string, liderId: string) {
    setTrabajando(duelo.id)
    const lider = indice?.lideres.find((c) => claveDeCarta(c) === liderId)
    const r = await confirmarAmistosa(duelo.id, acepta, {
      lider: liderId || null,
      base: null,
      mazoId: mazoId || null,
    })
    setTrabajando(null)
    if (!r.ok) {
      setError(r.error ?? 'No se pudo responder.')
      // Se vuelve a pedir la lista: el error típico acá es «esta partida ya
      // está confirmada», que pasa cuando respondiste desde otro aparato. En
      // ese caso lo correcto es refrescar, no dejar la fila zombi en pantalla.
      setRecarga((n) => n + 1)
      return
    }
    // Fuera de la lista al toque: dejarla ahí un segundo más hace que la gente
    // toque dos veces y el segundo intento falle con «ya está confirmada».
    setPendientes((p) => p.filter((d) => d.id !== duelo.id))
    void lider
    alCambiar()
  }

  if (cargando) return null
  if (!error && pendientes.length === 0) return null

  return (
    <section className="rounded-2xl border border-swu-accent/40 bg-swu-accent/5 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-swu-accent px-1.5 text-[11px] font-black text-swu-accent-fg">
          {pendientes.length}
        </span>
        <h2 className="text-sm font-bold text-swu-text">
          {pendientes.length === 1 ? 'Una partida espera tu confirmación' : 'Partidas que esperan tu confirmación'}
        </h2>
      </div>
      <p className="mb-3 text-[11px] text-swu-muted">
        Alguien anotó una partida que jugaron juntos. Si aceptás, se publica y cuenta para el meta.
        Si no, se queda privada — pero no se borra.
      </p>

      {error && (
        <p className="mb-3 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-2 text-[12px] text-swu-red">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {pendientes.map((d) => (
          <FilaPendiente
            key={d.id}
            duelo={d}
            mazos={mazos}
            indice={indice}
            abierto={abierto === d.id}
            ocupado={trabajando === d.id}
            alAbrir={() => setAbierto(abierto === d.id ? null : d.id)}
            alResponder={(acepta, mazoId, liderId) => void responder(d, acepta, mazoId, liderId)}
          />
        ))}
      </ul>
    </section>
  )
}

interface FilaProps {
  duelo: DueloVisto
  mazos: MazoCompartible[]
  indice: IndiceCartas | null
  abierto: boolean
  ocupado: boolean
  alAbrir: () => void
  alResponder: (acepta: boolean, mazoId: string, liderId: string) => void
}

function FilaPendiente({ duelo, mazos, indice, abierto, ocupado, alAbrir, alResponder }: FilaProps) {
  // El líder que el creador anotó de mi lado, para poder corregirlo.
  const [lider, setLider] = useState(duelo.yo.lider)
  const [mazoId, setMazoId] = useState('')

  return (
    <li className="rounded-xl border border-swu-border bg-swu-surface p-3">
      <div className="flex items-center gap-3">
        <Avatar avatar={duelo.rival.avatar ?? ''} size={36} caja="redondeada" anillo={duelo.rival.nombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-swu-text">{duelo.rival.nombre}</p>
          <p className="text-[11px] text-swu-muted">
            {fechaCorta(duelo.cuando)} · {duelo.rival.victorias}–{duelo.yo.victorias} a su favor
            {duelo.resultado === 'sin-marcador' && ' (sin marcador)'}
          </p>
        </div>
        <button
          onClick={alAbrir}
          aria-expanded={abierto}
          className="rounded-lg p-1.5 text-swu-muted active:scale-95"
          aria-label="Ver y corregir mi lado"
        >
          <ChevronDown size={18} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {abierto && (
        <div className="mt-3 space-y-2.5 border-t border-swu-border/60 pt-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
              Mi líder en esa partida
            </p>
            <select
              value={lider}
              onChange={(e) => setLider(e.target.value)}
              className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            >
              <option value="">Sin especificar</option>
              {(indice?.lideres ?? []).map((c) => {
                const k = claveDeCarta(c)
                return <option key={k} value={k}>{k}</option>
              })}
            </select>
            {duelo.yo.lider && (
              <p className="mt-1 text-[10px] text-swu-muted">
                {duelo.rival.nombre} anotó «{duelo.yo.lider}». Corregilo si no era ese.
              </p>
            )}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
              Adjuntar mi mazo (opcional)
            </p>
            <select
              value={mazoId}
              onChange={(e) => setMazoId(e.target.value)}
              className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            >
              <option value="">Sin adjuntar</option>
              {mazos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => alResponder(true, mazoId, lider)}
          disabled={ocupado}
          className="flex-1"
        >
          <Check size={15} /> Aceptar y publicar
        </Button>
        <button
          onClick={() => alResponder(false, '', '')}
          disabled={ocupado}
          className="rounded-xl border border-swu-border px-3 py-2 text-[12px] font-bold text-swu-muted active:scale-95 disabled:opacity-50"
        >
          <X size={15} className="inline" /> No
        </button>
      </div>
    </li>
  )
}
