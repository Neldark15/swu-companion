/**
 * /prestamos — «¿quién tiene mis cartas?» y «¿qué le debo a quién?».
 *
 * ── Por qué existe esta pantalla ──────────────────────────────────────
 *
 * La comunidad se presta cartas en la mesa todos los sábados y la única
 * memoria era la de cada uno. Es el caso de uso más viejo del grupo y el
 * único que no tenía ni una fila en la app.
 *
 * ── Dos listas, no una con filtro ─────────────────────────────────────
 *
 * «Me deben» y «Le debo» son dos preguntas distintas con dos acciones
 * distintas: de la primera podés cancelar la anotación, de la segunda
 * disputarla. Un filtro sobre una sola lista obligaría a leer cada fila para
 * saber qué botones tiene.
 *
 * ── El vencido es TEXTO y color, no solo color ────────────────────────
 *
 * Igual que el calendario (§3h-quater): si «vencido» fuera solo un borde
 * rojo, no se distinguiría de cualquier otro acento en una lista de doce.
 */

import { useEffect, useState } from 'react'
import { HandCoins, Plus, Loader2, AlertTriangle, Check, X, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { EmptyState } from '../../components/ui/EmptyState'
import { CardImage } from '../../components/CardImage'
import { getCardsByIds } from '../../services/swuApi'
import type { Card } from '../../types'
import {
  listarPrestamos, cerrarPrestamo, type PrestamoConLado,
} from '../../services/prestamos'
import { NuevoPrestamo } from './NuevoPrestamo'

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!p) return ''
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${Number(p[3])} ${meses[Number(p[2]) - 1]}`
}

export function PrestamosPage() {
  const { supabaseUser } = useAuth()
  const miId = supabaseUser?.id ?? ''

  const [lista, setLista] = useState<PrestamoConLado[]>([])
  const [cartas, setCartas] = useState<Map<string, Card>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [abriendo, setAbriendo] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  /* La carga vive DENTRO del efecto, con un contador para volver a pedirla.
   *
   * Sacarla a un `useCallback` y llamarlo desde el efecto no pasa la regla
   * `react-hooks/set-state-in-effect`: el linter no puede seguir la promesa
   * hacia adentro y ve los setState como síncronos. El IIFE adentro del efecto
   * es el único patrón que pasa, y ya está probado en el resto del repo. */
  const [tick, setTick] = useState(0)
  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let vivo = true
    void (async () => {
      if (!miId) { if (vivo) setCargando(false); return }
      const filas = await listarPrestamos(miId)
      if (!vivo) return
      setLista(filas)
      /* Los nombres de las cartas salen de Dexie, no de Postgres: no hay tabla
         `cards` en Supabase, el catálogo vive solo en el navegador (§2y). */
      const ids = [...new Set(filas.map(f => f.card_id))]
      if (ids.length) {
        const mapa = await getCardsByIds(ids)
        if (!vivo) return
        setCartas(mapa)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [miId, tick])

  const cerrar = async (id: string, como: 'devuelto' | 'disputado' | 'cancelado') => {
    if (ocupado) return
    setOcupado(id)
    setAviso(null)
    const r = await cerrarPrestamo(id, como)
    if (!r.ok) setAviso(r.mensaje)
    else recargar()
    setOcupado(null)
  }

  const activos = lista.filter(p => p.estado === 'activo')
  const meDeben = activos.filter(p => p.lado === 'presté')
  const leDebo = activos.filter(p => p.lado === 'recibí')
  const cerrados = lista.filter(p => p.estado !== 'activo')
  const vencidos = activos.filter(p => p.vencido).length

  const Fila = ({ p }: { p: PrestamoConLado }) => {
    const carta = cartas.get(p.card_id)
    const cerrado = p.estado !== 'activo'
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-2.5 ${
        cerrado ? 'border-swu-border/40 bg-swu-surface/30 opacity-60'
          : p.vencido ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-swu-border bg-swu-surface/60'
      }`}>
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-swu-bg">
          <CardImage src={carta?.imageUrl} alt={carta?.name ?? ''} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-swu-text">
            {carta?.name ?? p.card_id}
            {p.cantidad > 1 && <span className="text-swu-muted"> ×{p.cantidad}</span>}
          </p>
          <p className="truncate text-[11px] text-swu-muted">
            {p.lado === 'presté' ? `A ${p.recibe_nombre}` : 'Te la prestaron'}
            {p.devolver_en && ` · devolver ${fechaCorta(p.devolver_en)}`}
          </p>
          {p.nota && <p className="truncate text-[10px] text-swu-muted/70">{p.nota}</p>}
          {/* El vencido se DICE, no solo se pinta. */}
          {p.vencido && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-400">
              <AlertTriangle size={10} /> Vencido
            </p>
          )}
          {cerrado && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-swu-muted">
              {p.estado}
            </p>
          )}
        </div>

        {!cerrado && (
          <div className="flex shrink-0 items-center gap-1">
            {ocupado === p.id ? (
              <Loader2 size={16} className="animate-spin text-swu-muted" />
            ) : (
              <>
                <button
                  onClick={() => cerrar(p.id, 'devuelto')}
                  title="Ya se devolvió"
                  className="rounded-lg border border-green-500/30 bg-green-500/15 p-2 text-green-300"
                >
                  <Check size={14} />
                </button>
                {/* Cancelar SOLO quien prestó; disputar SOLO quien recibió.
                    Los botones siguen a esa regla en vez de mostrarse los dos
                    y dejar que el servidor rechace: un botón que siempre falla
                    se lee como que la app está rota. */}
                {p.lado === 'presté' ? (
                  <button
                    onClick={() => cerrar(p.id, 'cancelado')}
                    title="Borrar esta anotación"
                    className="rounded-lg border border-swu-border p-2 text-swu-muted"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => cerrar(p.id, 'disputado')}
                    title="Esto no me lo prestaron"
                    className="rounded-lg border border-swu-border p-2 text-swu-muted"
                  >
                    <Ban size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-swu-accent/15">
          <HandCoins size={20} className="text-swu-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-swu-text">Préstamos</h1>
          <p className="text-[11px] text-swu-muted">
            Quién tiene tus cartas y a quién le debés vos. Es un recordatorio:
            la carta sigue siendo tuya y no se mueve de tu colección.
          </p>
        </div>
      </header>

      <button
        onClick={() => setAbriendo(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-swu-accent px-4 py-3 text-sm font-bold text-white"
      >
        <Plus size={16} /> Anotar un préstamo
      </button>

      {vencidos > 0 && (
        <p className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
          <AlertTriangle size={13} />
          {vencidos === 1 ? 'Hay 1 préstamo vencido.' : `Hay ${vencidos} préstamos vencidos.`}
        </p>
      )}

      {aviso && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {aviso}
        </p>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-swu-muted" /></div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<HandCoins size={28} />}
          title="Todavía no anotaste ningún préstamo"
          hint="Anotá a quién le prestaste una carta y dejá de acordarte de memoria."
        />
      ) : (
        <>
          <Seccion titulo="Me deben" filas={meDeben} Fila={Fila} />
          <Seccion titulo="Le debo" filas={leDebo} Fila={Fila} />
          {cerrados.length > 0 && (
            <Seccion titulo="Cerrados" filas={cerrados} Fila={Fila} />
          )}
        </>
      )}

      <NuevoPrestamo
        abierto={abriendo}
        onCerrar={() => setAbriendo(false)}
        onGuardado={() => { setAbriendo(false); recargar() }}
      />
    </div>
  )
}

function Seccion({ titulo, filas, Fila }: {
  titulo: string
  filas: PrestamoConLado[]
  Fila: (p: { p: PrestamoConLado }) => React.ReactElement
}) {
  if (filas.length === 0) return null
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">{titulo}</span>
        <span className="rounded-full bg-swu-surface px-2 py-0.5 text-[10px] text-swu-muted">{filas.length}</span>
      </div>
      {filas.map(p => <Fila key={p.id} p={p} />)}
    </section>
  )
}
