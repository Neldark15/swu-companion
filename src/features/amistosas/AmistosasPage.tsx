/**
 * AMISTOSAS — el historial de los duelos que no cuentan para nada.
 *
 * Y que no cuenten es el punto. La app ya lleva el ranking, el XP, los logros
 * y los torneos; lo que no llevaba era el registro de las partidas que se
 * juegan de verdad: las de la mesa del sábado, las de probar un mazo nuevo,
 * las que se juegan esperando a que llegue el resto. Esas quedaban en la
 * memoria de nadie.
 *
 * Los datos existen desde que existe el Contador —`duelos_amistosos` tiene
 * filas desde el 9 de agosto— pero solo se veían dentro de un panel plegable
 * del propio Contador, que es la última pantalla donde uno los buscaría.
 *
 * ── Lo que esta pantalla se niega a hacer ────────────────────────────
 *
 * · No convierte 0-0 en «empate». De los duelos que hay hoy, casi todos están
 *   en 0-0 porque se usó el Contador para llevar la VIDA y nadie marcó quién
 *   ganó. Decir «empate» sería inventar un resultado.
 * · No muestra `rondas`: el Contador lo reinicia a 1 en cada juego, así que no
 *   es la duración del duelo.
 * · No da XP ni toca el ranking. La tabla no tiene triggers y esta pantalla
 *   tampoco los invoca.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Swords, Plus, RefreshCw, Search, X, Trophy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { Avatar } from '../../components/ui/Avatar'
import { CardImage } from '../../components/CardImage'
import { useAuth } from '../../hooks/useAuth'
import { fechaCorta } from '../../services/horaSV'
import { ensureCards } from '../../services/swuApi'
import {
  listarAmistosas, agruparCaraACara, rankingAmistosas, winrateAmistosas,
  type DueloVisto, type CaraACara, type FilaRankingAmistosas,
} from '../../services/amistosas'
import { RegistrarAmistosa } from './RegistrarAmistosa'
import { PorConfirmar } from './PorConfirmar'
import { cargarIndice, resolver, nombreCorto, type IndiceCartas } from './cartasAmistosas'

type Pestana = 'historial' | 'cara' | 'ranking'

/** El color y la palabra de cada resultado, en un solo sitio. */
const RESULTADO: Record<DueloVisto['resultado'], { texto: string; clase: string }> = {
  gane: { texto: 'Ganaste', clase: 'text-swu-green' },
  perdi: { texto: 'Perdiste', clase: 'text-swu-red' },
  empate: { texto: 'Empate', clase: 'text-swu-amber' },
  'sin-marcador': { texto: 'Sin marcador', clase: 'text-swu-muted' },
}

/** Un lado del duelo: arte del líder, nombre y base. */
function LadoCarta({
  indice, lider, base, titulo, acento,
}: {
  indice: IndiceCartas | null
  lider: string
  base: string
  titulo: string
  acento: string
}) {
  const cartaLider = resolver(indice, lider)
  const cartaBase = resolver(indice, base)

  return (
    <div className="min-w-0 flex-1">
      <p className={`truncate text-[10px] font-black uppercase tracking-widest ${acento}`}>{titulo}</p>

      <div className="mt-1 flex items-center gap-1.5">
        {cartaLider
          ? <CardImage src={cartaLider.imageUrl} alt="" className="h-9 w-12 shrink-0 rounded" orientacion="apaisada" />
          : <div className="h-9 w-12 shrink-0 rounded border border-swu-border bg-swu-bg" />}
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-swu-text">
            {lider ? nombreCorto(lider) : '—'}
          </p>
          <p className="truncate text-[10px] text-swu-muted">
            {base || 'base sin anotar'}
            {cartaBase?.hp != null && <span className="ml-1 font-mono">{cartaBase.hp}</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

function TarjetaDuelo({ d, indice }: { d: DueloVisto; indice: IndiceCartas | null }) {
  const r = RESULTADO[d.resultado]
  return (
    <li className="rounded-xl border border-swu-border bg-swu-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`text-[11px] font-black uppercase tracking-widest ${r.clase}`}>{r.texto}</span>
        <span className="font-mono text-lg font-black tabular-nums text-swu-text">
          {d.yo.victorias}–{d.rival.victorias}
        </span>
        <span className="shrink-0 text-[10px] text-swu-muted">{fechaCorta(d.cuando)}</span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        {/* 24 px era demasiado chico para reconocer a nadie de un vistazo, y
            sin anillo la fila era un círculo negro más. El anillo sale del id
            del rival —o de su nombre si no tiene cuenta— así que es el MISMO
            color en todas las pantallas. */}
        <Avatar
          avatar={d.rival.avatar}
          size={40}
          anillo={d.rival.perfilId ?? d.rival.nombre}
        />
        {d.rival.perfilId
          ? (
            <Link to={`/u/${d.rival.perfilId}`} className="truncate text-[12px] font-bold text-swu-accent-texto">
              {d.rival.nombre}
            </Link>
          )
          // Sin perfil no hay a dónde ir: un enlace a /u/null sería un enlace roto.
          : <span className="truncate text-[12px] font-bold text-swu-muted">{d.rival.nombre}</span>}
      </div>

      <div className="flex items-stretch gap-2">
        <LadoCarta indice={indice} lider={d.yo.lider} base={d.yo.base} titulo="Vos" acento="text-swu-accent-texto" />
        <div className="w-px shrink-0 bg-swu-border" />
        <LadoCarta indice={indice} lider={d.rival.lider} base={d.rival.base} titulo={d.rival.nombre} acento="text-swu-amber" />
      </div>
    </li>
  )
}

function FilaCaraACara({ c }: { c: CaraACara }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-swu-border bg-swu-surface p-3">
      <Avatar avatar={c.avatar} size={48} anillo={c.rivalId ?? c.nombre} />
      <div className="min-w-0 flex-1">
        {c.rivalId
          ? <Link to={`/u/${c.rivalId}`} className="truncate text-[13px] font-bold text-swu-accent-texto">{c.nombre}</Link>
          : <p className="truncate text-[13px] font-bold text-swu-muted">{c.nombre}</p>}
        <p className="text-[10px] text-swu-muted">
          {c.duelos} {c.duelos === 1 ? 'duelo' : 'duelos'}
          {c.sinMarcador > 0 && ` · ${c.sinMarcador} sin marcador`}
        </p>
        {/* Al historial COMPLETO de esa persona, no solo lo que jugó conmigo.
            Sin cuenta no hay a dónde ir: un invitado sin perfil solo existe
            como nombre en mis propias filas. */}
        {c.rivalId && (
          <Link
            to={`/amistosas/${c.rivalId}`}
            className="mt-0.5 inline-block text-[10px] text-swu-cyan underline underline-offset-2"
          >
            Ver todas sus amistosas
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 font-mono text-sm font-black tabular-nums">
        <span className="text-swu-green">{c.ganados}</span>
        <span className="text-swu-muted">–</span>
        <span className="text-swu-red">{c.perdidos}</span>
        {c.empatados > 0 && <span className="text-swu-amber">·{c.empatados}</span>}
      </div>
    </li>
  )
}

/**
 * El ranking de las partidas de mesa.
 *
 * NO se titula «Ranking» a secas ni acá ni en la pestaña de al lado: el ranking
 * de la app es UNO —`/rank`— y ya cuenta estas amistosas a 1 punto. Este
 * responde otra pregunta. Este proyecto ya pagó tener 14 tablas de posiciones
 * sin nombre propio (§3c de CLAUDE.md), y la forma de no repetirlo es que cada
 * tabla diga de qué es y a dónde está la otra.
 */
function TablaRanking({ filas }: { filas: FilaRankingAmistosas[] | null }) {
  if (filas === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-swu-surface" />)}
      </div>
    )
  }

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={26} />}
        title="Todavía no hay nada que ordenar"
        hint="Acá entran las amistosas que el rival CONFIRMÓ. Anotá una y pedile que la acepte: cuenta para los dos."
      />
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] leading-snug text-swu-muted">
        Solo partidas de mesa que el rival confirmó. El ranking general de la app está en{' '}
        <Link to="/rank" className="text-swu-cyan underline underline-offset-2">Ranking</Link>.
      </p>

      <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
        {filas.map((f, i) => {
          const wr = winrateAmistosas(f)
          return (
            <li key={f.userId}>
              <Link to={`/amistosas/${f.userId}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-swu-surface-hover">
                <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-swu-muted">
                  {i + 1}
                </span>
                <Avatar avatar={f.avatar} size={32} anillo={f.userId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-swu-text">{f.nombre}</span>
                  <span className="block text-[11px] text-swu-muted tabular-nums">
                    {f.ganados}-{f.perdidos}
                    {f.empatados > 0 && `-${f.empatados}`}
                    {' · '}{f.duelos} {f.duelos === 1 ? 'duelo' : 'duelos'}
                    {f.rivales > 1 && ` · ${f.rivales} rivales`}
                  </span>
                </span>
                {/* El porcentaje se CALLA si no hay partidas marcadas. Un 0%
                    sacado de duelos que nadie marcó es una mentira con cara de
                    dato — y hoy 6 de 12 están en 0-0. */}
                <span className="shrink-0 text-right">
                  {wr !== null ? (
                    <span className="text-base font-black tabular-nums text-swu-green">{wr}%</span>
                  ) : (
                    <span className="text-[10px] text-swu-muted">sin marcador</span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AmistosasPage() {
  const navigate = useNavigate()
  const supabaseUser = useAuth(s => s.supabaseUser)
  const miId = supabaseUser?.id ?? ''

  const [pestana, setPestana] = useState<Pestana>('historial')
  const [duelos, setDuelos] = useState<DueloVisto[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const [indice, setIndice] = useState<IndiceCartas | null>(null)
  const [registrando, setRegistrando] = useState(false)
  /* El buscador filtra sobre lo que YA se leyó: los duelos propios están todos
   * en memoria (tope 100), así que una consulta por tecleo sería tráfico por
   * nada y además parpadearía. */
  const [busca, setBusca] = useState('')
  const [ranking, setRanking] = useState<FilaRankingAmistosas[] | null>(null)
  /** Se sube para forzar otra consulta: reintentar, o volver de guardar. */
  const [recarga, setRecarga] = useState(0)

  /* La carga vive DENTRO del efecto, no en un `useCallback` que el efecto
   * llame. Dos razones, y ninguna es de estilo:
   *
   *  1. `react-hooks/set-state-in-effect` rastrea el callback y marca error:
   *     desde el efecto, ese `setState` es una escritura síncrona.
   *  2. La guarda `vivo`. Sin ella, una respuesta lenta que llega después de
   *     que la pantalla se cerró escribe estado sobre un componente muerto.
   *
   * Para volver a pedir (reintentar, o después de guardar un duelo) se sube
   * `recarga`, que es una dependencia real del efecto. */
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await listarAmistosas(miId)
      if (!vivo) return
      if (r.ok) { setDuelos(r.datos); setFallo(null) }
      else { setDuelos([]); setFallo(r.mensaje) }
    })()
    return () => { vivo = false }
  }, [miId, recarga])

  /* El ranking se pide solo al abrir SU pestaña: es una consulta al servidor y
   * la mayoría entra a ver su historial, no la tabla. */
  useEffect(() => {
    if (pestana !== 'ranking' || ranking !== null) return
    let vivo = true
    void (async () => {
      const r = await rankingAmistosas()
      if (vivo) setRanking(r.ok ? r.datos : [])
    })()
    return () => { vivo = false }
  }, [pestana, ranking])

  // El arte se resuelve contra la base local. Va aparte de los duelos: si la
  // base de cartas todavía no bajó, el historial igual se lee — sale sin arte,
  // no sale vacío.
  useEffect(() => {
    let vivo = true
    void (async () => {
      await ensureCards()
      const ix = await cargarIndice()
      if (vivo) setIndice(ix)
    })()
    return () => { vivo = false }
  }, [])

  /* Se compara sin acentos y en minúscula: «Nicolás» y «nicolas» tienen que
   * encontrar lo mismo, o el buscador falla justo con los nombres de acá. */
  const normaliza = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  const duelosFiltrados = useMemo(() => {
    const q = normaliza(busca)
    if (!q) return duelos ?? []
    return (duelos ?? []).filter(d => normaliza(d.rival.nombre).includes(q))
  }, [duelos, busca])

  const cara = useMemo(() => agruparCaraACara(duelos ?? []), [duelos])

  const caraFiltrada = useMemo(() => {
    const q = normaliza(busca)
    if (!q) return cara
    return cara.filter(c => normaliza(c.nombre).includes(q))
  }, [cara, busca])


  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4 pb-10">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="rounded-lg p-1 text-swu-muted hover:text-swu-text">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight text-swu-text">Amistosas</h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted">
            Partidas entre amigos · no cuentan para el ranking
          </p>
        </div>
      </header>

      {/* Lo que ESPERA MI RESPUESTA va arriba de todo: es lo único de esta
          pantalla donde alguien más está esperando algo mío. Se dibuja sola
          solo si hay algo; con la bandeja vacía no ocupa ni un píxel. */}
      <PorConfirmar miId={miId} alCambiar={() => setRecarga(n => n + 1)} />

      <Button variant="primary" block onClick={() => setRegistrando(true)}>
        <Plus size={15} /> Registrar partida
      </Button>

      <SegmentedControl<Pestana>
        label="Vista de amistosas"
        value={pestana}
        onChange={setPestana}
        options={[
          { value: 'historial', label: 'Historial' },
          { value: 'cara', label: 'Cara a cara' },
          { value: 'ranking', label: 'Ranking' },
        ]}
      />

      {/* El buscador solo aparece donde hay algo que buscar. En el ranking no:
          hoy son dos filas y un buscador ahí sería un control que estorba. */}
      {pestana !== 'ranking' && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-swu-muted" />
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por oponente…"
            aria-label="Buscar duelos por nombre del oponente"
            className="w-full rounded-lg border border-swu-border bg-swu-surface py-2 pr-9 pl-9 text-sm
                       text-swu-text placeholder:text-swu-muted/70
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swu-cyan"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Borrar la búsqueda"
              className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-swu-muted hover:text-swu-text"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {duelos === null && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-swu-surface" />)}
        </div>
      )}

      {/* Un fallo de red NO se puede ver igual que «todavía no jugaste». */}
      {duelos !== null && fallo && (
        <EmptyState
          icon={<RefreshCw size={26} />}
          title="No se pudieron cargar los duelos"
          hint={fallo}
          action={<Button variant="secondary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>}
        />
      )}

      {duelos !== null && !fallo && duelos.length === 0 && (
        <EmptyState
          icon={<Swords size={26} />}
          title="Todavía no hay duelos amistosos"
          hint="Anotá una partida que ya jugaste, o llevá la próxima desde el Contador: al cerrarla queda acá sola."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setRegistrando(true)}>Registrar partida</Button>
              <Button variant="ghost" onClick={() => navigate('/contador')}>Abrir el Contador</Button>
            </div>
          }
        />
      )}

      {duelos !== null && !fallo && duelos.length > 0 && pestana === 'historial' && (
        duelosFiltrados.length > 0 ? (
          <ul className="space-y-2">
            {duelosFiltrados.map(d => <TarjetaDuelo key={d.id} d={d} indice={indice} />)}
          </ul>
        ) : (
          <p className="rounded-xl bg-swu-surface px-4 py-6 text-center text-sm text-swu-muted">
            Ningún duelo contra «{busca}».
          </p>
        )
      )}

      {duelos !== null && !fallo && duelos.length > 0 && pestana === 'cara' && (
        caraFiltrada.length > 0 ? (
          <ul className="space-y-2">
            {caraFiltrada.map(c => <FilaCaraACara key={c.rivalId ?? `n:${c.nombre}`} c={c} />)}
          </ul>
        ) : (
          <p className="rounded-xl bg-swu-surface px-4 py-6 text-center text-sm text-swu-muted">
            Nunca jugaste contra «{busca}».
          </p>
        )
      )}

      {pestana === 'ranking' && <TablaRanking filas={ranking} />}

      <Sheet open={registrando} onClose={() => setRegistrando(false)} title="Registrar partida">
        {miId
          ? (
            <RegistrarAmistosa
              miId={miId}
              onCancelar={() => setRegistrando(false)}
              onListo={() => { setRegistrando(false); setRecarga(n => n + 1) }}
            />
          )
          : <p className="text-[13px] text-swu-muted">Iniciá sesión para anotar duelos.</p>}
      </Sheet>
    </div>
  )
}
