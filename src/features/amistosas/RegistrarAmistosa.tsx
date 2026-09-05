/**
 * Anotar una partida que YA se jugó.
 *
 * El Contador cubre «estoy en la mesa ahora». Este formulario cubre el caso
 * que en la práctica es más común: se jugó, se guardaron las cartas, y recién
 * después alguien se acuerda de dejar constancia. Sin esto, todo lo que no se
 * contó en vivo se pierde — que es exactamente lo que venía pasando.
 *
 * Se pide líder Y base de los dos lados porque un duelo se identifica por el
 * LÍDER: «base azul» describe dos mazos que no se parecen en nada.
 */

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ElegirCarta } from '../../components/ElegirCarta'
import { PlayerSearchInput } from '../events/components/PlayerSearchInput'
import { ensureCards } from '../../services/swuApi'
import { registrarAmistosa } from '../../services/amistosas'
import { misMazos, type MazoCompartible } from '../../services/galaxiaCompartir'
import { aISOdesdeSV, diaCalendarioSV } from '../../services/horaSV'
import { cargarIndice, claveDeCarta, type IndiceCartas } from './cartasAmistosas'
import type { Card } from '../../types'

interface Props {
  miId: string
  onListo: () => void
  onCancelar: () => void
}

/** Marcador 0–2: el check de la tabla es `between 0 and 2`. */
function Marcador({ valor, onCambiar, etiqueta }: { valor: number; onCambiar: (n: number) => void; etiqueta: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onCambiar(n)}
          aria-label={`${etiqueta}: ${n}`}
          aria-pressed={valor === n}
          className={`h-9 w-9 rounded-lg border font-mono text-sm font-black transition-colors ${
            valor === n
              ? 'border-swu-accent bg-swu-accent/20 text-swu-accent-texto'
              : 'border-swu-border bg-swu-bg text-swu-muted'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function RegistrarAmistosa({ miId, onListo, onCancelar }: Props) {
  const [indice, setIndice] = useState<IndiceCartas | null>(null)
  const [rivalNombre, setRivalNombre] = useState('')
  const [rivalId, setRivalId] = useState<string | undefined>(undefined)
  const [miLider, setMiLider] = useState<Card | null>(null)
  const [miBase, setMiBase] = useState<Card | null>(null)
  const [suLider, setSuLider] = useState<Card | null>(null)
  const [suBase, setSuBase] = useState<Card | null>(null)
  const [mias, setMias] = useState(0)
  const [suyas, setSuyas] = useState(0)
  // Hoy EN EL SALVADOR, no en la zona del aparato: si alguien anota un duelo a
  // las 11 de la noche, la fecha por defecto tiene que ser la de hoy acá.
  const [fecha, setFecha] = useState(() => diaCalendarioSV(new Date()))
  const [mazos, setMazos] = useState<MazoCompartible[]>([])
  const [miMazoId, setMiMazoId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      // Sin esto la base local puede estar vacía y los buscadores saldrían
      // vacíos SIN decir por qué.
      await ensureCards()
      const ix = await cargarIndice()
      if (vivo) setIndice(ix)
      // Mis mazos, para poder adjuntar el que usé. El del RIVAL no se ofrece:
      // se lo adjunta él mismo al confirmar. Nadie publica el mazo de otro.
      const lista = await misMazos(miId)
      if (vivo) setMazos(lista)
    })()
    return () => { vivo = false }
  }, [miId])

  const puedeGuardar = rivalNombre.trim().length > 0 && !guardando

  async function guardar() {
    setGuardando(true)
    setError(null)
    const r = await registrarAmistosa(miId, {
      rivalId: rivalId ?? null,
      rivalNombre,
      miLider: miLider ? claveDeCarta(miLider) : '',
      miBase: miBase?.name ?? '',
      suLider: suLider ? claveDeCarta(suLider) : '',
      suBase: suBase?.name ?? '',
      misVictorias: mias,
      susVictorias: suyas,
      miMazoId: miMazoId || null,
      // La fecha se ancla en hora de El Salvador; sin esto se guardaría en la
      // zona del aparato y un duelo de la noche saltaría al día siguiente.
      cuando: (() => {
        const iso = aISOdesdeSV(fecha, '20:00')
        return iso ? new Date(iso) : null
      })(),
    })
    setGuardando(false)
    if (r.ok) onListo()
    else setError(r.error ?? 'No se pudo guardar.')
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Contra quién</p>
        <PlayerSearchInput
          value={rivalNombre}
          linkedUserId={rivalId}
          placeholder="Buscá el jugador o escribí un nombre"
          onChange={(name, id) => { setRivalNombre(name); setRivalId(id) }}
        />
        {rivalNombre.trim() && !rivalId && (
          <p className="mt-1 text-[10px] text-swu-muted">
            Sin cuenta enlazada: el duelo se guarda igual, queda solo en tu historial y no cuenta para el meta.
          </p>
        )}
        {rivalId && (
          <p className="mt-1 text-[10px] text-swu-accent-texto">
            Le va a llegar para que confirme. Hasta que acepte, la partida es privada.
          </p>
        )}
      </div>

      {/* ── Mi mazo ──
          Solo el MÍO. El del rival se lo adjunta él al confirmar: adjuntar el
          mazo de otro sería publicar su lista sin preguntarle. */}
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
          Mi mazo (opcional)
        </p>
        <select
          value={miMazoId}
          onChange={(e) => setMiMazoId(e.target.value)}
          className="w-full rounded-xl border border-swu-border bg-swu-bg p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
        >
          <option value="">Sin adjuntar</option>
          {mazos.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-swu-muted">
          {mazos.length === 0
            ? 'Todavía no tenés mazos guardados en la nube.'
            : 'Si la partida se publica, se va a poder ver esta lista desde ahí.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-swu-border bg-swu-surface p-2.5">
          <p className="text-[11px] font-black uppercase tracking-widest text-swu-accent-texto">Vos</p>
          <ElegirCarta etiqueta="Tu líder" opciones={indice?.lideres ?? []} valor={miLider} onElegir={setMiLider} />
          <ElegirCarta etiqueta="Tu base" opciones={indice?.bases ?? []} valor={miBase} onElegir={setMiBase} />
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Juegos que ganaste</p>
            <Marcador valor={mias} onCambiar={setMias} etiqueta="Tus juegos" />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-swu-border bg-swu-surface p-2.5">
          <p className="truncate text-[11px] font-black uppercase tracking-widest text-swu-amber">
            {rivalNombre.trim() || 'El rival'}
          </p>
          <ElegirCarta etiqueta="Su líder" opciones={indice?.lideres ?? []} valor={suLider} onElegir={setSuLider} />
          <ElegirCarta etiqueta="Su base" opciones={indice?.bases ?? []} valor={suBase} onElegir={setSuBase} />
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Juegos que ganó</p>
            <Marcador valor={suyas} onCambiar={setSuyas} etiqueta="Sus juegos" />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Cuándo</p>
        <input
          type="date"
          value={fecha}
          max={diaCalendarioSV(new Date())}
          onChange={e => setFecha(e.target.value)}
          className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2 text-[13px] text-swu-text
                     focus:border-swu-accent focus:outline-none"
        />
      </div>

      {mias === 0 && suyas === 0 && (
        <p className="rounded-lg border border-swu-border bg-swu-bg px-3 py-2 text-[11px] text-swu-muted">
          Sin marcador el duelo se guarda como «sin resultado» — se ve en el historial, pero no cuenta
          como victoria ni derrota en el cara a cara.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-swu-red/15 px-3 py-2 text-[12px] text-swu-red">{error}</p>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" block onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button variant="primary" block onClick={() => void guardar()} disabled={!puedeGuardar} loading={guardando}>
          Guardar duelo
        </Button>
      </div>
    </div>
  )
}
