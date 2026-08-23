/**
 * Anotar un préstamo: qué carta, a quién, cuántas y hasta cuándo.
 *
 * ── La carta sale de TU colección ─────────────────────────────────────
 *
 * No es un buscador del catálogo entero (9.185 impresiones): prestás lo que
 * tenés. Igual el servidor NO exige tenerla registrada —si prestaste una carta
 * que nunca cargaste, la app no tiene por qué llamarte mentiroso— así que hay
 * un campo libre por si tu colección no está al día.
 *
 * ── A quién ───────────────────────────────────────────────────────────
 *
 * Se busca entre las cuentas de la app y, si no aparece, se escribe el nombre
 * a mano. En una comunidad de 38 que se conocen en persona, prestarle una
 * carta a alguien que todavía no se registró es normal, no un borde.
 *
 * Cuando la persona SÍ tiene cuenta, el nombre que se guarda lo pone el
 * servidor desde su perfil, no lo que se teclee acá: la fila la ve ella, y
 * poder escribirle el nombre a mano sería poder anotar «Fulano me debe» con el
 * nombre cambiado.
 */

import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, UserPlus, X } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Avatar } from '../../components/ui/Avatar'
import { CardImage } from '../../components/CardImage'
import { useAuth } from '../../hooks/useAuth'
import { getMyCollection } from '../../services/collectionService'
import { getCardsByIds } from '../../services/swuApi'
import { searchProfiles, type SearchableProfile } from '../../services/playerSearch'
import { prestarCarta } from '../../services/prestamos'
import type { Card } from '../../types'

interface Props {
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
}

export function NuevoPrestamo({ abierto, onCerrar, onGuardado }: Props) {
  const { supabaseUser, currentProfileId } = useAuth()

  const [misCartas, setMisCartas] = useState<{ card: Card; qty: number }[]>([])
  const [cargandoCartas, setCargandoCartas] = useState(false)
  const [filtro, setFiltro] = useState('')

  const [cardId, setCardId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [devolverEn, setDevolverEn] = useState('')
  const [nota, setNota] = useState('')

  const [buscaGente, setBuscaGente] = useState('')
  const [gente, setGente] = useState<SearchableProfile[]>([])
  const [elegido, setElegido] = useState<SearchableProfile | null>(null)
  const [nombreLibre, setNombreLibre] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La colección se baja al ABRIR, no al montar: el panel vive en la pantalla
  // aunque esté cerrado, y bajarla en cada visita sería pagarla sin usarla.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    void (async () => {
      // El `setState` va DENTRO del IIFE: la regla `set-state-in-effect` veta
      // llamarlo en el cuerpo del efecto, y este es el patrón que pasa.
      setCargandoCartas(true)
      const items = await getMyCollection(currentProfileId ?? undefined)
      const mapa = await getCardsByIds(items.map(i => i.cardId))
      if (!vivo) return
      setMisCartas(
        items
          .map(i => ({ card: mapa.get(i.cardId), qty: i.quantity }))
          .filter((x): x is { card: Card; qty: number } => !!x.card)
          .sort((a, b) => a.card.name.localeCompare(b.card.name)),
      )
      setCargandoCartas(false)
    })()
    return () => { vivo = false }
  }, [abierto, currentProfileId])

  // Antirrebote de 300 ms: sin él, cada tecla es una consulta a Supabase.
  useEffect(() => {
    const q = buscaGente.trim()
    // Todo pasa por el temporizador, incluido el vaciado: llamar a `setGente`
    // en el cuerpo del efecto lo veta `react-hooks/set-state-in-effect`, y de
    // paso escribir dos letras y borrarlas no dispara dos renders.
    const t = setTimeout(() => {
      if (q.length < 2) { setGente([]); return }
      void searchProfiles(q).then(setGente)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaGente])

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    const base = q ? misCartas.filter(c => c.card.name.toLowerCase().includes(q)) : misCartas
    return base.slice(0, 40)
  }, [misCartas, filtro])

  const elegida = misCartas.find(c => c.card.id === cardId)
  const maxCantidad = elegida?.qty ?? 99

  const limpiar = () => {
    setCardId(''); setCantidad(1); setDevolverEn(''); setNota('')
    setBuscaGente(''); setGente([]); setElegido(null); setNombreLibre('')
    setFiltro(''); setError(null)
  }

  const guardar = async () => {
    if (!supabaseUser) return
    if (!cardId.trim()) { setError('Elegí la carta.'); return }
    if (!elegido && !nombreLibre.trim()) { setError('Decime a quién se la prestaste.'); return }

    setGuardando(true)
    setError(null)
    const r = await prestarCarta({
      cardId: cardId.trim(),
      cantidad,
      recibeNombre: elegido?.name ?? nombreLibre.trim(),
      recibeId: elegido?.id ?? null,
      devolverEn: devolverEn || null,
      nota: nota.trim() || null,
    })
    setGuardando(false)

    if (!r.ok) { setError(r.mensaje); return }
    limpiar()
    onGuardado()
  }

  return (
    <Sheet open={abierto} onClose={onCerrar} title="Anotar un préstamo">
      <div className="space-y-4 p-4">
        {/* ── Qué carta ── */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-swu-text">¿Qué carta prestaste?</p>
          {elegida ? (
            <div className="flex items-center gap-2 rounded-xl border border-swu-accent/40 bg-swu-accent/10 p-2">
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-swu-bg">
                <CardImage src={elegida.card.imageUrl} alt="" className="h-full w-full" />
              </div>
              <span className="min-w-0 flex-1 truncate text-[13px] text-swu-text">{elegida.card.name}</span>
              <button onClick={() => setCardId('')} className="rounded-lg p-1.5 text-swu-muted">
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                <input
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  placeholder="Buscar en tu colección…"
                  className="w-full rounded-xl border border-swu-border bg-swu-bg py-2.5 pl-9 pr-3 text-sm text-swu-text outline-none focus:border-swu-accent"
                />
              </div>
              {cargandoCartas ? (
                <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-swu-muted" /></div>
              ) : visibles.length === 0 ? (
                <div className="mt-2">
                  <p className="mb-1.5 text-[11px] text-swu-muted">
                    {misCartas.length === 0
                      ? 'Tu colección está vacía en este aparato. Escribí el código de la carta.'
                      : 'Ninguna carta tuya coincide. Escribí el código a mano.'}
                  </p>
                  <input
                    value={cardId}
                    onChange={e => setCardId(e.target.value)}
                    placeholder="Ej. SOR_010"
                    className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
                  />
                </div>
              ) : (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-swu-border bg-swu-bg p-1.5">
                  {visibles.map(({ card, qty }) => (
                    <button
                      key={card.id}
                      onClick={() => { setCardId(card.id); setCantidad(1) }}
                      className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-swu-surface"
                    >
                      <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-swu-surface">
                        <CardImage src={card.imageUrl} alt="" className="h-full w-full" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-swu-text">{card.name}</span>
                      <span className="shrink-0 text-[11px] text-swu-muted">×{qty}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── A quién ── */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-swu-text">¿A quién?</p>
          {elegido ? (
            <div className="flex items-center gap-2 rounded-xl border border-swu-accent/40 bg-swu-accent/10 p-2">
              <Avatar avatar={elegido.avatar} size={28} anillo={elegido.id} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-swu-text">{elegido.name}</span>
              <button onClick={() => setElegido(null)} className="rounded-lg p-1.5 text-swu-muted">
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <input
                value={buscaGente}
                onChange={e => setBuscaGente(e.target.value)}
                placeholder="Buscar por nombre…"
                className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
              />
              {gente.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-swu-border bg-swu-bg p-1.5">
                  {gente.filter(p => p.id !== supabaseUser?.id).map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setElegido(p); setNombreLibre(''); setBuscaGente('') }}
                      className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-swu-surface"
                    >
                      <Avatar avatar={p.avatar} size={24} anillo={p.id} />
                      <span className="truncate text-[12px] text-swu-text">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <UserPlus size={13} className="shrink-0 text-swu-muted" />
                <input
                  value={nombreLibre}
                  onChange={e => setNombreLibre(e.target.value)}
                  maxLength={60}
                  placeholder="…o escribí el nombre (sin cuenta)"
                  className="min-w-0 flex-1 rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Cuántas y hasta cuándo ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-swu-text">Copias</p>
            <input
              type="number" min={1} max={maxCantidad} value={cantidad}
              onChange={e => setCantidad(Math.max(1, Math.min(maxCantidad, Number(e.target.value) || 1)))}
              className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-swu-text">Devolver (opcional)</p>
            <input
              type="date" value={devolverEn}
              onChange={e => setDevolverEn(e.target.value)}
              className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-swu-text">Nota (opcional)</p>
          <input
            value={nota} onChange={e => setNota(e.target.value)} maxLength={120}
            placeholder="Ej. se la llevó del torneo del sábado"
            className="w-full rounded-xl border border-swu-border bg-swu-bg p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent"
          />
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={onCerrar} className="rounded-xl px-3 py-2.5 text-[12px] font-semibold text-swu-muted">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-swu-accent px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Anotar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
