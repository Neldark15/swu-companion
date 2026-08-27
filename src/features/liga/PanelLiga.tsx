/**
 * PANEL DE LA LIGA — `/liga/:code/panel`, la trastienda de quien organiza.
 *
 * Cuatro herramientas, cada una contra un problema concreto que se vio:
 *
 *  1 · INSCRITOS — «que se pueda verificar y ordenar mejor» (Nel, textual).
 *      Ordenable por nombre, tier, zona y horas declaradas, y con el mapa de
 *      calor de las 168 franjas: eso es lo que contesta a qué hora conviene
 *      programar, que es la única pregunta que se hace de verdad al armar.
 *  2 · TEMPORADA Y GRUPOS — con ENSAYO obligatorio antes de escribir.
 *  3 · LA COLA — lo vencido y lo disputado, con el laudo y su motivo.
 *  4 · LA SEMILLA — el número del que sale el calendario, a la vista.
 *
 * ── Por qué el ensayo existe ──────────────────────────────────────────
 *
 * Armar 15 grupos toca ~120 filas de un saque. Un reparto equivocado ahí no
 * da error: da una liga plausible con gente en el tier que no es, y se
 * descubre cuando alguien reclama en la jornada 3. `liga_plan_grupos` no
 * escribe NADA — dice cuántos hay, cuántos grupos salen y, sobre todo,
 * cuántos no declararon disponibilidad. Recién después aparece el botón.
 *
 * ── Va FUERA del caparazón ────────────────────────────────────────────
 *
 * Como `/admin` y `/temporada`: sin Header, sin TabBar, sin puerta de
 * instalación. El precio de estar fuera es que nadie llamó a `initAuth()` por
 * nosotros, y sin sesión `auth.uid()` llega nulo a las RPC — el panel diría
 * «no sos staff» hasta al dueño (la misma trampa que documenta `/estudio`).
 * Por eso se llama acá.
 *
 * ── Y la puerta de verdad está en Postgres ────────────────────────────
 *
 * `esStaff` es una CORTINA para no pintar botones que no van a funcionar. Lo
 * que cierra son las policies y el guardia dentro de `liga_panel` /
 * `liga_corregir`. De ahí la regla de los TRES estados: mientras no se sabe,
 * no se echa a nadie. `verPanel` devolviendo `null` puede ser «no te toca» o
 * puede ser el metro sin señal, y expulsar por una barra de cobertura es
 * peor que mostrar un botón de reintentar.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarPlus, Check, ClipboardCheck, Copy, Gavel,
  KeyRound, RefreshCw, ShieldCheck, Users,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { HudPanel } from '../../components/Hud'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { TONO_POR_RAREZA } from '../../services/filtrosCarta'
import {
  verLiga, verPanel, planDeGrupos, armarGrupos, sembrarGrupo, abrirTemporada, corregir,
  TIERS, NOMBRE_TIER,
  type LigaCompleta, type PanelLiga as DatosPanel, type PlanGrupos, type InscritoPanel,
} from '../../services/ligaService'

/* ── El reloj, UNA vez y en el módulo ──────────────────────────────────
 *
 * `new Date()` dentro de una función declarada en el cuerpo del componente
 * rompe la regla de pureza (el mismo render devolvería cosas distintas). Y
 * para lo que se usa acá —el desfase de una zona y dos fechas por defecto—
 * el instante da igual: capturarlo al cargar el módulo alcanza y sobra. */
const AHORA = new Date()

/** La zona de quien organiza. El mapa de calor se dibuja en SU reloj. */
const MI_ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Fecha en `YYYY-MM-DD`. En UTC: sumar días sobre una fecha local cruza el
 *  cambio de horario y devuelve el día anterior dos veces al año. */
function fechaISO(dias: number): string {
  return new Date(AHORA.getTime() + dias * 86400000).toISOString().slice(0, 10)
}
const HOY = fechaISO(0)
const EN_DOS_MESES = fechaISO(60)

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const FRANJAS = 7 * 24

/**
 * Los tiers de la liga están en español y `TONO_POR_RAREZA` está en inglés.
 * La traducción vive ACÁ, en un solo sitio: copiar el mapa de tonos sería
 * garantizar que algún día el Raro de la liga y el Rare de las cartas dejen
 * de ser el mismo color sin que nadie lo note.
 */
const RAREZA_DE_TIER: Record<string, string> = {
  comun: 'Common', infrecuente: 'Uncommon', raro: 'Rare', legendario: 'Legendary',
}
function tonoDeTier(tier: string) {
  return TONO_POR_RAREZA[RAREZA_DE_TIER[tier] ?? 'Common'] ?? 'default'
}

/**
 * Las franjas declaradas, como índices 0..167.
 *
 * El formato canónico es el que escribe `RejillaDisponibilidad`: 168
 * caracteres '0'/'1', índice = día×24 + hora, LUNES a las 00:00 primero y en
 * hora local de pared de quien la llenó. La segunda rama —lista de índices—
 * es una red: si el campo llega en otra forma, acá se ve vacío o crudo en vez
 * de dibujar un mapa de calor inventado, que es el fallo caro porque un mapa
 * equivocado se lee igual de bien que uno correcto.
 */
function franjasDe(s: string | null): number[] {
  const t = (s ?? '').trim()
  if (!t) return []
  const out: number[] = []
  if (/^[01]+$/.test(t)) {
    for (let i = 0; i < Math.min(t.length, FRANJAS); i++) if (t[i] === '1') out.push(i)
    return out
  }
  for (const trozo of t.split(/[^0-9]+/)) {
    if (!trozo) continue
    const n = Number(trozo)
    if (Number.isInteger(n) && n >= 0 && n < FRANJAS) out.push(n)
  }
  return out
}

/** Desfase de una zona IANA contra UTC, en horas. `null` = no se pudo saber. */
const DESFASE = new Map<string, number>()
function desfaseUTC(zona: string | null): number | null {
  if (!zona) return null
  const guardado = DESFASE.get(zona)
  if (guardado !== undefined) return guardado
  try {
    const parte = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
      .formatToParts(AHORA).find(p => p.type === 'timeZoneName')?.value ?? ''
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(parte)
    // «GMT» pelado, sin signo, es UTC: 0 es la respuesta correcta, no un fallo.
    const h = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] || 0) / 60) : 0
    DESFASE.set(zona, h)
    return h
  } catch {
    // Una zona que este navegador no conoce. Se cuenta cruda y se dice cuántas.
    return null
  }
}

interface Calor { cuenta: number[]; sinZona: number; conFranjas: number }

/**
 * Las 168 franjas sumadas sobre todos los inscritos, **movidas al reloj de
 * quien organiza**.
 *
 * Sumarlas crudas es la trampa obvia: cada quien declara en SU zona, así que
 * un mapa sin convertir dice «las 20:00» sin decir de quién, y con dos husos
 * de por medio el pico se parte en dos y no se ve. Quien no tiene zona
 * legible se cuenta igual pero sin mover, y la pantalla dice cuántos son.
 */
function mapaDeCalor(inscritos: InscritoPanel[], zonaDestino: string | null): Calor {
  const cuenta = new Array<number>(FRANJAS).fill(0)
  const destino = desfaseUTC(zonaDestino)
  let sinZona = 0
  let conFranjas = 0
  for (const i of inscritos) {
    const slots = franjasDe(i.franjas)
    if (!slots.length) continue
    conFranjas++
    const propio = desfaseUTC(i.zona)
    let delta = 0
    if (destino !== null && propio !== null) delta = Math.round(destino - propio)
    else sinZona++
    // El módulo se hace sobre la SEMANA entera, no sobre el día: mover una
    // franja de las 23:00 una hora la lleva al día siguiente, y el domingo
    // dobla al lunes. Es una semana circular.
    for (const s of slots) cuenta[((s + delta) % FRANJAS + FRANJAS) % FRANJAS]++
  }
  return { cuenta, sinZona, conFranjas }
}

function etiquetaFranja(i: number): string {
  return `${DIAS[Math.floor(i / 24)]} ${String(i % 24).padStart(2, '0')}:00`
}

type Bloque = { tier: string; orden: number; inscripciones: string[] }

/**
 * El reparto: gente del ensayo → grupos del tamaño objetivo, por tier.
 *
 * Dos decisiones que no se adivinan:
 * · El `orden` arranca en 1 DENTRO de cada tier («Raro 1», «Raro 2»), no
 *   corrido por toda la liga: es lo que la gente va a decir en voz alta.
 * · Un sobrante de UNA persona no forma grupo propio — se pega al anterior.
 *   Un grupo de uno es alguien con cero partidas en toda la temporada, y eso
 *   no da error en ningún lado: da una persona esperando un rival que no
 *   existe. Mejor un grupo de 9 que un fantasma.
 */
function repartir(
  detalle: PlanGrupos['inscritos_detalle'], tamano: number,
): Bloque[] {
  const paso = Math.max(2, tamano)
  const out: Bloque[] = []
  for (const tier of TIERS) {
    const gente = detalle.filter(d => d.tier === tier)
    if (!gente.length) continue
    const trozos: string[][] = []
    for (let i = 0; i < gente.length; i += paso) {
      trozos.push(gente.slice(i, i + paso).map(d => d.inscId))
    }
    const ultimo = trozos[trozos.length - 1]
    if (trozos.length > 1 && ultimo.length < 2) {
      trozos.pop()
      trozos[trozos.length - 1].push(...ultimo)
    }
    trozos.forEach((ids, i) => out.push({ tier, orden: i + 1, inscripciones: ids }))
  }
  return out
}

type Aviso = { ok: boolean; texto: string }
type Pestana = 'inscritos' | 'grupos' | 'cola' | 'semilla'

const PESTANAS = [
  { value: 'inscritos' as const, label: 'Inscritos', icon: <Users size={13} /> },
  { value: 'grupos' as const, label: 'Grupos', icon: <CalendarPlus size={13} /> },
  { value: 'cola' as const, label: 'Cola', icon: <Gavel size={13} /> },
  { value: 'semilla' as const, label: 'Semilla', icon: <KeyRound size={13} /> },
]

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-swu-bg flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">{children}</div>
    </div>
  )
}

export function PanelLiga() {
  const { code } = useParams<{ code: string }>()
  const { initAuth, authListo, currentProfile } = useAuth()

  const [liga, setLiga] = useState<LigaCompleta | null>(null)
  const [panel, setPanel] = useState<DatosPanel | null>(null)
  /** ¿Contestó el servidor ALGUNA vez? Distinto de «hay datos». */
  const [leido, setLeido] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [pestana, setPestana] = useState<Pestana>('inscritos')

  useEffect(() => { initAuth() }, [initAuth])

  /* La carga vive DENTRO del efecto con bandera de vida: escribir estado en
   * cascada desde el cuerpo dispara renders de más y el lint lo rechaza, y la
   * bandera evita contestarle a una pantalla que ya se cerró. `recarga` es el
   * único disparador, así que hay UN camino de carga y no dos que se separen. */
  useEffect(() => {
    // Sin sesión no hay a quién preguntarle: la RPC contestaría vacío y se
    // leería como «no tenés permiso» en vez de «iniciá sesión».
    if (!code || !authListo || !currentProfile) return
    let vivo = true
    void (async () => {
      const l = await verLiga(code)
      if (!vivo) return
      setLiga(l)
      // El panel se pide con el ID; sin liga no hay ID que mandar.
      const p = l ? await verPanel(l.liga.id) : null
      if (!vivo) return
      setPanel(p)
      setLeido(true)
      setRefrescando(false)
    })()
    return () => { vivo = false }
  }, [code, authListo, currentProfile, recarga])

  function recargar() {
    setRefrescando(true)
    setRecarga(n => n + 1)
  }

  /** Toda acción termina igual: se dice qué pasó y se relee de la base. */
  function tras(r: { ok: boolean; mensaje?: string }, exito: string) {
    setAviso({ ok: r.ok, texto: r.ok ? exito : (r.mensaje ?? 'No se pudo') })
    if (r.ok) recargar()
  }

  if (!authListo) {
    return <Centrado><p className="text-sm text-swu-muted animate-pulse">Cargando…</p></Centrado>
  }

  if (!currentProfile) {
    return (
      <Centrado>
        <ShieldCheck size={32} className="mx-auto text-swu-muted" />
        <p className="font-semibold text-swu-text">Iniciá sesión para entrar al panel</p>
        <Link to="/profile" className="inline-block">
          <Button variant="primary" size="md">Iniciar sesión</Button>
        </Link>
      </Centrado>
    )
  }

  if (!leido) {
    return <Centrado><p className="text-sm text-swu-muted animate-pulse">Comprobando acceso…</p></Centrado>
  }

  // NO se expulsa: puede ser la red. Se ofrece reintentar y se dice por qué.
  if (!liga || !panel) {
    return (
      <Centrado>
        <AlertTriangle size={32} className="mx-auto text-swu-amber" />
        <p className="font-semibold text-swu-text">No se pudo leer el panel</p>
        <p className="text-xs text-swu-muted">
          Puede ser la conexión, o que esta liga no sea tuya. No se decide sin saber.
        </p>
        <Button variant="secondary" size="sm" onClick={recargar} loading={refrescando}>
          <RefreshCw size={14} /> Reintentar
        </Button>
        <Link to={`/liga/${code ?? ''}`} className="block text-xs text-swu-muted underline">
          Volver a la liga
        </Link>
      </Centrado>
    )
  }

  if (!liga.liga.esStaff) {
    return (
      <Centrado>
        <ShieldCheck size={32} className="mx-auto text-swu-muted" />
        <p className="font-semibold text-swu-text">Este panel es de quien organiza</p>
        <p className="text-xs text-swu-muted">
          La liga, la tabla y el calendario se ven completos desde la pantalla pública.
        </p>
        <Link to={`/liga/${liga.liga.code}`} className="inline-block">
          <Button variant="secondary" size="sm">Ir a {liga.liga.nombre}</Button>
        </Link>
      </Centrado>
    )
  }

  const temporada = panel.temporada ?? liga.temporada

  return (
    <div className="min-h-screen bg-swu-bg text-swu-text">
      <header className="sticky top-0 z-30 border-b border-swu-border/40 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5">
          <Link
            to={`/liga/${liga.liga.code}`}
            className="flex min-h-11 items-center gap-1.5 text-xs text-swu-muted"
          >
            <ArrowLeft size={14} /> Liga
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-swu-amber">Panel</p>
            <p className="truncate text-[13px] font-black text-swu-text">{liga.liga.nombre}</p>
          </div>
          <button
            onClick={recargar}
            aria-label="Recargar"
            className="flex min-h-11 w-11 items-center justify-center text-swu-muted"
          >
            <RefreshCw size={15} className={refrescando ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="mx-auto max-w-5xl px-3 pb-2">
          <SegmentedControl
            options={PESTANAS}
            value={pestana}
            onChange={setPestana}
            label="Herramienta del panel"
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        {aviso && (
          <div
            className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
              aviso.ok
                ? 'border-swu-green/40 bg-swu-green/10 text-swu-green'
                : 'border-swu-red/40 bg-swu-red/10 text-swu-red-texto'
            }`}
            role="status"
          >
            {aviso.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
            <p className="min-w-0 flex-1">{aviso.texto}</p>
            <button onClick={() => setAviso(null)} className="shrink-0 text-[11px] underline">cerrar</button>
          </div>
        )}

        {pestana === 'inscritos' && <Inscritos inscritos={panel.inscritos} />}

        {pestana === 'grupos' && (
          <Grupos
            liga={liga}
            temporadaId={temporada?.id ?? null}
            temporadaNombre={temporada?.nombre ?? null}
            tras={tras}
          />
        )}

        {pestana === 'cola' && <Cola liga={liga} cola={panel.cola} tras={tras} />}

        {pestana === 'semilla' && <Semilla temporada={panel.temporada} />}
      </main>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   1 · INSCRITOS
   ══════════════════════════════════════════════════════════════════════ */

type Col = 'nombre' | 'tier' | 'zona' | 'horas'

const COLUMNAS: Array<{ col: Col; rotulo: string }> = [
  { col: 'nombre', rotulo: 'Nombre' },
  { col: 'tier', rotulo: 'Tier' },
  { col: 'zona', rotulo: 'Zona' },
  { col: 'horas', rotulo: 'Horas' },
]

function comparar(a: InscritoPanel, b: InscritoPanel, col: Col): number {
  switch (col) {
    // El tier NO se ordena alfabéticamente: se ordena por la escalera
    // (`TIERS`), que es la única forma en que significa algo.
    case 'tier': return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.nombre.localeCompare(b.nombre)
    case 'zona': return (a.zona ?? '').localeCompare(b.zona ?? '') || a.nombre.localeCompare(b.nombre)
    case 'horas': return a.horas - b.horas || a.nombre.localeCompare(b.nombre)
    default: return a.nombre.localeCompare(b.nombre)
  }
}

function Inscritos({ inscritos }: { inscritos: InscritoPanel[] }) {
  const [col, setCol] = useState<Col>('tier')
  const [desc, setDesc] = useState(false)
  const [enMiHora, setEnMiHora] = useState(true)

  const filas = useMemo(() => {
    const copia = [...inscritos]
    copia.sort((a, b) => (desc ? -1 : 1) * comparar(a, b, col))
    return copia
  }, [inscritos, col, desc])

  const calor = useMemo(
    () => mapaDeCalor(inscritos, enMiHora ? MI_ZONA : null),
    [inscritos, enMiHora])

  const sinDisponibilidad = inscritos.filter(i => i.horas === 0).length
  const zonas = new Set(inscritos.map(i => i.zona).filter(Boolean)).size

  function ordenarPor(c: Col) {
    if (c === col) { setDesc(d => !d); return }
    setCol(c)
    // Las horas interesan de mayor a menor —quién puede más—; los nombres y
    // las zonas, alfabéticos. Que el primer clic ya deje lo útil arriba.
    setDesc(c === 'horas')
  }

  if (!inscritos.length) {
    return (
      <HudPanel tone="neutral">
        <p className="p-6 text-center text-sm text-swu-muted">
          Todavía no hay nadie inscrito.
        </p>
      </HudPanel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Inscritos', String(inscritos.length), 'text-swu-text'],
          ['Sin horas', String(sinDisponibilidad), sinDisponibilidad ? 'text-swu-red-texto' : 'text-swu-text'],
          ['Zonas', String(zonas), 'text-swu-text'],
        ].map(([rotulo, valor, tono]) => (
          <div key={rotulo} className="rounded-xl border border-swu-border bg-swu-surface px-2 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-swu-muted">{rotulo}</p>
            <p className={`text-[18px] font-black tabular-nums ${tono}`}>{valor}</p>
          </div>
        ))}
      </div>

      <MapaCalor calor={calor} enMiHora={enMiHora} onCambiarHora={setEnMiHora} />

      <HudPanel tone="neutral">
        <div className="overflow-x-auto barra-fina">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-swu-border/60">
                {COLUMNAS.map(c => (
                  <th key={c.col} className="p-0">
                    <button
                      onClick={() => ordenarPor(c.col)}
                      className={`flex w-full min-h-11 items-center gap-1 px-2.5 text-left font-mono text-[9px]
                                  uppercase tracking-widest transition-colors ${
                        col === c.col ? 'text-swu-amber' : 'text-swu-muted hover:text-swu-text'
                      }`}
                      aria-sort={col === c.col ? (desc ? 'descending' : 'ascending') : 'none'}
                    >
                      {c.rotulo}
                      <span aria-hidden className="text-[8px]">
                        {col === c.col ? (desc ? '▼' : '▲') : '·'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(i => (
                <tr key={i.inscId} className="border-b border-swu-border/30 last:border-0">
                  <td className="px-2.5 py-2">
                    <p className="font-bold text-swu-text">{i.nombre}</p>
                    {i.lider && (
                      <p className="truncate text-[10px] text-swu-muted">
                        {i.lider}{i.base ? ` · ${i.base}` : ''}
                      </p>
                    )}
                    {i.estado !== 'activa' && (
                      <span className="mt-0.5 inline-block font-mono text-[9px] uppercase tracking-widest text-swu-amber">
                        {i.estado}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <Badge variant={tonoDeTier(i.tier)}>{NOMBRE_TIER[i.tier] ?? i.tier}</Badge>
                  </td>
                  <td className="px-2.5 py-2 font-mono text-[10px] text-swu-muted">
                    {i.zona ?? '—'}
                  </td>
                  {/* Cero horas es el dato que decide si esta persona puede
                      entrar a un grupo: se ve de lejos o no se ve. */}
                  <td className={`px-2.5 py-2 text-right tabular-nums font-bold ${
                    i.horas === 0 ? 'text-swu-red-texto' : 'text-swu-text'
                  }`}>
                    {i.horas === 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle size={11} /> 0
                      </span>
                    ) : i.horas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HudPanel>
    </div>
  )
}

function MapaCalor({
  calor, enMiHora, onCambiarHora,
}: { calor: Calor; enMiHora: boolean; onCambiarHora: (v: boolean) => void }) {
  const max = Math.max(1, ...calor.cuenta)
  const mejores = calor.cuenta
    .map((n, i) => ({ n, i }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 3)

  return (
    <HudPanel tone="cyan">
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-swu-text">Cuándo puede la gente</h2>
          <button
            onClick={() => onCambiarHora(!enMiHora)}
            className="min-h-11 rounded-lg border border-swu-border px-2.5 font-mono text-[10px] text-swu-muted"
          >
            {enMiHora ? `en TU hora (${MI_ZONA})` : 'sin convertir'}
          </button>
        </div>

        {calor.conFranjas === 0 ? (
          <p className="py-4 text-center text-xs text-swu-muted">
            Nadie declaró disponibilidad todavía.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto barra-fina">
              <div className="min-w-[300px]">
                {/* Las horas van de 3 en 3: 24 rótulos en un teléfono no se leen. */}
                <div className="mb-0.5 flex pl-7">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center font-mono text-[7px] text-swu-muted">
                      {h % 3 === 0 ? h : ''}
                    </div>
                  ))}
                </div>
                {DIAS.map((dia, d) => (
                  <div key={dia} className="flex items-center gap-0.5">
                    <div className="w-7 shrink-0 font-mono text-[8px] uppercase text-swu-muted">{dia}</div>
                    <div className="flex flex-1 gap-px">
                      {Array.from({ length: 24 }, (_, h) => {
                        const n = calor.cuenta[d * 24 + h]
                        const pct = Math.round((n / max) * 100)
                        return (
                          <div
                            key={h}
                            title={`${etiquetaFranja(d * 24 + h)} · ${n}`}
                            className="h-3.5 flex-1 rounded-[1px] border border-swu-border/30"
                            style={{
                              // El token del proyecto, mezclado: así el mapa
                              // sigue al tema en vez de traer su propio azul.
                              background: n
                                ? `color-mix(in srgb, var(--color-swu-cyan) ${pct}%, transparent)`
                                : undefined,
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-swu-muted">Mejores:</span>
              {mejores.map(m => (
                <span key={m.i} className="rounded-md border border-swu-cyan/40 bg-swu-cyan/10 px-1.5 py-0.5 text-[11px] font-bold text-swu-cyan">
                  {etiquetaFranja(m.i)} · {m.n}
                </span>
              ))}
            </div>

            {enMiHora && calor.sinZona > 0 && (
              <p className="text-[10px] text-swu-amber">
                {calor.sinZona} {calor.sinZona === 1 ? 'persona no tiene' : 'personas no tienen'} zona
                horaria legible: sus franjas se cuentan sin convertir.
              </p>
            )}
          </>
        )}
      </div>
    </HudPanel>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   2 · TEMPORADA Y GRUPOS
   ══════════════════════════════════════════════════════════════════════ */

function Grupos({
  liga, temporadaId, temporadaNombre, tras,
}: {
  liga: LigaCompleta
  temporadaId: string | null
  temporadaNombre: string | null
  tras: (r: { ok: boolean; mensaje?: string }, exito: string) => void
}) {
  const [nombre, setNombre] = useState('Temporada 1')
  const [arranca, setArranca] = useState(HOY)
  const [cierra, setCierra] = useState(EN_DOS_MESES)
  const [plan, setPlan] = useState<PlanGrupos | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const tamano = liga.liga.tamanoGrupo || 8
  const bloques = useMemo(
    () => (plan ? repartir(plan.inscritos_detalle, plan.tamanoObjetivo || tamano) : []),
    [plan, tamano])

  async function ensayar() {
    if (!temporadaId) return
    setTrabajando('ensayo')
    const p = await planDeGrupos(temporadaId)
    setTrabajando(null)
    setPlan(p)
    if (!p) tras({ ok: false, mensaje: 'No se pudo hacer el ensayo' }, '')
  }

  async function armar() {
    if (!temporadaId || !bloques.length) return
    setTrabajando('armar')
    const r = await armarGrupos(temporadaId, bloques)
    setTrabajando(null)
    tras(r, `${bloques.length} grupos armados`)
    if (r.ok) setPlan(null)
  }

  async function sembrar(grupoId: string, etiqueta: string) {
    setTrabajando(grupoId)
    const r = await sembrarGrupo(grupoId)
    setTrabajando(null)
    tras(r, `Calendario sembrado en ${etiqueta}`)
  }

  if (!temporadaId) {
    return (
      <HudPanel tone="amber">
        <div className="space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-swu-text">
            <CalendarPlus size={15} className="text-swu-amber" /> Abrir temporada
          </h2>
          <p className="text-xs text-swu-muted">
            Sin temporada no hay grupos ni calendario: es el recipiente de todo lo demás.
          </p>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">Nombre</span>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-swu-border bg-swu-bg px-3 text-sm text-swu-text"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">Arranca</span>
              <input
                type="date" value={arranca} onChange={e => setArranca(e.target.value)}
                className="w-full min-h-11 rounded-xl border border-swu-border bg-swu-bg px-3 text-sm text-swu-text"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">Cierra</span>
              <input
                type="date" value={cierra} onChange={e => setCierra(e.target.value)}
                className="w-full min-h-11 rounded-xl border border-swu-border bg-swu-bg px-3 text-sm text-swu-text"
              />
            </label>
          </div>
          <Button
            variant="primary" size="md" block
            loading={trabajando === 'temporada'}
            disabled={!nombre.trim() || arranca >= cierra}
            onClick={async () => {
              setTrabajando('temporada')
              const r = await abrirTemporada(liga.liga.id, nombre.trim(), arranca, cierra)
              setTrabajando(null)
              tras(r, 'Temporada abierta')
            }}
          >
            Abrir temporada
          </Button>
          {arranca >= cierra && (
            <p className="text-[11px] text-swu-red-texto">La fecha de cierre va después del arranque.</p>
          )}
        </div>
      </HudPanel>
    )
  }

  return (
    <div className="space-y-4">
      <HudPanel tone="amber">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-swu-text">{temporadaNombre ?? 'Temporada'}</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">
              grupos de {tamano}
            </span>
          </div>

          {/* EL ENSAYO NO ESCRIBE NADA. Es el punto entero: armar toca ~120
              filas de un saque y un reparto malo no da error, da una liga
              plausible y equivocada. */}
          <Button variant="secondary" size="sm" block onClick={ensayar} loading={trabajando === 'ensayo'}>
            <ClipboardCheck size={14} /> Ensayar el reparto
          </Button>

          {plan && (
            <div className="space-y-3 rounded-xl border border-swu-border bg-swu-bg p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Inscritos', String(plan.inscritos)],
                  ['Grupos', String(bloques.length || plan.gruposPropuestos)],
                  ['Por grupo', String(plan.tamanoObjetivo || tamano)],
                ].map(([r, v]) => (
                  <div key={r} className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-swu-muted">{r}</p>
                    <p className="text-[18px] font-black tabular-nums text-swu-text">{v}</p>
                  </div>
                ))}
              </div>

              {plan.sinDisponibilidad > 0 && (
                <p className="flex items-start gap-1.5 rounded-lg border border-swu-red/40 bg-swu-red/10 p-2 text-[11px] text-swu-red-texto">
                  <AlertTriangle size={13} className="mt-px shrink-0" />
                  <span>
                    <b>{plan.sinDisponibilidad}</b> {plan.sinDisponibilidad === 1 ? 'inscrito no declaró' : 'inscritos no declararon'} disponibilidad.
                    Entran igual al reparto, pero no hay hora en la que se sepa que pueden.
                  </span>
                </p>
              )}

              <ul className="space-y-1">
                {bloques.map(b => (
                  <li key={`${b.tier}-${b.orden}`} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <Badge variant={tonoDeTier(b.tier)}>{NOMBRE_TIER[b.tier] ?? b.tier}</Badge>
                      <span className="text-swu-muted">grupo {b.orden}</span>
                    </span>
                    <span className="tabular-nums font-bold text-swu-text">{b.inscripciones.length}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="primary" size="md" block
                onClick={armar}
                loading={trabajando === 'armar'}
                disabled={!bloques.length}
              >
                Armar {bloques.length} {bloques.length === 1 ? 'grupo' : 'grupos'}
              </Button>
              <p className="text-[10px] text-swu-muted">
                Esto sí escribe. Lo de arriba es exactamente lo que se va a guardar.
              </p>
            </div>
          )}
        </div>
      </HudPanel>

      <HudPanel tone="neutral">
        <div className="space-y-2 p-4">
          <h2 className="text-sm font-bold text-swu-text">Grupos armados</h2>
          {!liga.grupos.length && (
            <p className="text-xs text-swu-muted">Todavía no hay grupos. Ensayá el reparto y armalos.</p>
          )}
          {liga.grupos.map(g => {
            const etiqueta = `${NOMBRE_TIER[g.tier] ?? g.tier} ${g.orden}`
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-swu-border bg-swu-bg p-2.5">
                <Badge variant={tonoDeTier(g.tier)}>{etiqueta}</Badge>
                <span className="text-[11px] text-swu-muted">
                  {g.plazas.length} plazas · {g.partidas.length} partidas · {g.estado}
                </span>
                <div className="ml-auto">
                  {/* Sembrar es POR GRUPO: el round-robin de un grupo de 8 son
                      28 partidas, y sembrar la liga entera de un botón mezcla
                      un error de un grupo con los otros catorce. */}
                  <Button
                    variant="secondary" size="xs"
                    onClick={() => sembrar(g.id, etiqueta)}
                    loading={trabajando === g.id}
                  >
                    {g.partidas.length ? 'Re-sembrar' : 'Sembrar calendario'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </HudPanel>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   3 · LA COLA
   ══════════════════════════════════════════════════════════════════════ */

type ItemCola = DatosPanel['cola'][number]

function Cola({
  liga, cola, tras,
}: {
  liga: LigaCompleta
  cola: ItemCola[]
  tras: (r: { ok: boolean; mensaje?: string }, exito: string) => void
}) {
  const nombreGrupo = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of liga.grupos) m.set(g.id, `${NOMBRE_TIER[g.tier] ?? g.tier} ${g.orden}`)
    return m
  }, [liga.grupos])

  // Por antigüedad: lo que vence primero se resuelve primero. Sin fecha va al
  // final —no se sabe cuán vieja es, y adivinar la pondría antes que casos
  // que sí están venciendo—.
  const ordenada = useMemo(
    () => [...cola].sort((a, b) => {
      if (a.venceEl && b.venceEl) return a.venceEl.localeCompare(b.venceEl) || a.jornada - b.jornada
      if (a.venceEl) return -1
      if (b.venceEl) return 1
      return a.jornada - b.jornada
    }),
    [cola])

  if (!ordenada.length) {
    return (
      <HudPanel tone="neutral">
        <div className="p-6 text-center">
          <Check size={26} className="mx-auto text-swu-green" />
          <p className="mt-2 text-sm text-swu-text">La cola está vacía.</p>
          <p className="text-xs text-swu-muted">Nada vencido y nada disputado.</p>
        </div>
      </HudPanel>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-swu-muted">
        {ordenada.length} {ordenada.length === 1 ? 'partida espera' : 'partidas esperan'} laudo.
        Lo más viejo primero.
      </p>
      {ordenada.map(item => (
        <FilaCola
          key={item.id}
          item={item}
          grupo={nombreGrupo.get(item.grupo) ?? item.grupo}
          tras={tras}
        />
      ))}
    </div>
  )
}

function FilaCola({
  item, grupo, tras,
}: {
  item: ItemCola
  grupo: string
  tras: (r: { ok: boolean; mensaje?: string }, exito: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [vl, setVl] = useState(String(item.vl))
  const [vv, setVv] = useState(String(item.vv))
  const [trabajando, setTrabajando] = useState<string | null>(null)

  // El motivo lo lee la comunidad: un laudo sin explicación es la organización
  // cambiando un resultado a puerta cerrada. Por eso el campo va ANTES de los
  // botones y los botones no existen hasta que hay texto.
  const listo = motivo.trim().length >= 6

  async function laudar(estado: string, exito: string, conMarcador: boolean) {
    setTrabajando(estado)
    const r = await corregir(
      item.id,
      conMarcador ? Number(vl) : null,
      conMarcador ? Number(vv) : null,
      estado,
      motivo.trim(),
    )
    setTrabajando(null)
    tras(r, exito)
  }

  return (
    <HudPanel tone={item.estado === 'disputada' ? 'red' : 'amber'}>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.estado === 'disputada' ? 'red' : 'amber'}>{item.estado}</Badge>
          <span className="font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            {grupo} · J{item.jornada}
          </span>
          {item.venceEl && (
            <span className="ml-auto font-mono text-[10px] text-swu-muted">
              venció {item.venceEl.slice(0, 10)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate font-bold text-swu-text">{item.local}</span>
          <span className="shrink-0 rounded-lg border border-swu-border bg-swu-bg px-2 py-0.5 font-black tabular-nums">
            {item.vl}–{item.vv}
          </span>
          <span className="min-w-0 flex-1 truncate text-right font-bold text-swu-text">{item.visita}</span>
        </div>

        {item.motivo && (
          <p className="rounded-lg border border-swu-border bg-swu-bg p-2 text-[11px] text-swu-muted">
            <span className="font-bold text-swu-text">Reclamo: </span>{item.motivo}
          </p>
        )}

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-swu-muted">
            Motivo del laudo · lo ve la comunidad
          </span>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            placeholder="Qué pasó y por qué se resuelve así"
            className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2 text-sm text-swu-text"
          />
        </label>

        {!listo && (
          <p className="text-[11px] text-swu-amber">
            Escribí el motivo para poder laudar.
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric" value={vl} onChange={e => setVl(e.target.value)}
              aria-label={`Games de ${item.local}`}
              className="w-14 min-h-11 rounded-xl border border-swu-border bg-swu-bg text-center text-sm font-black tabular-nums text-swu-text"
            />
            <span className="text-swu-muted">–</span>
            <input
              inputMode="numeric" value={vv} onChange={e => setVv(e.target.value)}
              aria-label={`Games de ${item.visita}`}
              className="w-14 min-h-11 rounded-xl border border-swu-border bg-swu-bg text-center text-sm font-black tabular-nums text-swu-text"
            />
            <Button
              variant="primary" size="sm" className="flex-1"
              disabled={!listo}
              loading={trabajando === 'confirmada'}
              onClick={() => laudar('confirmada', 'Marcador confirmado', true)}
            >
              <Gavel size={13} /> Confirmar {vl}–{vv}
            </Button>
          </div>

          {/* OJO CON EL NOMBRE: `wo_local` es el walkover DEL local —el que no
              se presentó—, así que el 2–0 se lo lleva la visita. Está
              verificado contra `tablaDe()`, que hace justo eso. Por eso los
              botones dicen quién GANA: con la etiqueta cruda, un laudo se
              equivoca de lado y nadie lo nota hasta el ascenso. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary" size="sm" disabled={!listo}
              loading={trabajando === 'wo_local'}
              onClick={() => laudar('wo_local', `Walkover: gana ${item.visita}`, false)}
            >
              WO · gana visita
            </Button>
            <Button
              variant="secondary" size="sm" disabled={!listo}
              loading={trabajando === 'wo_visita'}
              onClick={() => laudar('wo_visita', `Walkover: gana ${item.local}`, false)}
            >
              WO · gana local
            </Button>
          </div>
          <p className="text-[10px] text-swu-muted">
            «gana visita» = no se presentó <b>{item.local}</b> · «gana local» = no se presentó <b>{item.visita}</b>
          </p>

          <Button
            variant="danger" size="sm" block disabled={!listo}
            loading={trabajando === 'anulada'}
            onClick={() => laudar('anulada', 'Partida anulada', false)}
          >
            Anular la partida
          </Button>
        </div>
      </div>
    </HudPanel>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   4 · LA SEMILLA
   ══════════════════════════════════════════════════════════════════════ */

function Semilla({ temporada }: { temporada: DatosPanel['temporada'] }) {
  const [copiado, setCopiado] = useState(false)

  if (!temporada) {
    return (
      <HudPanel tone="neutral">
        <p className="p-6 text-center text-sm text-swu-muted">
          La semilla aparece cuando se abre la temporada.
        </p>
      </HudPanel>
    )
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      // Sin permiso de portapapeles el texto igual está a la vista y se
      // selecciona a mano: no se avisa de un fallo que no bloquea nada.
    }
  }

  return (
    <HudPanel tone="cyan">
      <div className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-swu-text">
          <KeyRound size={15} className="text-swu-cyan" /> La semilla de {temporada.nombre}
        </h2>

        <button
          onClick={() => void copiar(temporada.semilla)}
          className="flex w-full items-center gap-2 rounded-xl border border-swu-border bg-swu-bg p-3 text-left"
        >
          <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-swu-cyan">
            {temporada.semilla}
          </code>
          {copiado ? <Check size={15} className="shrink-0 text-swu-green" /> : <Copy size={15} className="shrink-0 text-swu-muted" />}
        </button>

        {/* La semilla se publica a propósito. El orden del calendario sale de
            `md5(semilla || plaza_id)`: con los dos números a la vista,
            cualquiera lo recalcula y comprueba que a nadie le tocó el
            calendario cómodo. Un sorteo que no se puede comprobar es una
            promesa, y una promesa no aguanta la primera queja. */}
        <p className="text-xs leading-relaxed text-swu-muted">
          El orden del calendario sale de <code className="font-mono text-swu-text">md5(semilla || plaza_id)</code>.
          Está publicada para que cualquiera lo recalcule: el sorteo se comprueba, no se cree.
        </p>

        <dl className="grid grid-cols-2 gap-2 text-[12px]">
          {[
            ['Temporada', `#${temporada.numero}`],
            ['Estado', temporada.estado],
            ['Arranca', temporada.arranca?.slice(0, 10) ?? '—'],
            ['Cierra', temporada.cierra?.slice(0, 10) ?? '—'],
          ].map(([r, v]) => (
            <div key={r} className="rounded-lg border border-swu-border bg-swu-bg px-2.5 py-1.5">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-swu-muted">{r}</dt>
              <dd className="font-bold text-swu-text">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </HudPanel>
  )
}
