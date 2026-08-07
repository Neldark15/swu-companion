/**
 * BloqueMazo — el mazo de un análisis, entero y copiable.
 *
 * La sintaxis con la que se escribe vive en sintaxisMazo.ts; acá se resuelve
 * contra la base local y se dibuja.
 *
 * ── El circuito completo ──────────────────────────────────────────────
 *
 * Hasta ahora un análisis de mazo terminaba en un callejón: la lista se leía
 * y ahí moría. Para probarla había que transcribirla carta por carta en Mis
 * Decks. Este bloque cierra el circuito dentro del artículo:
 *
 *     leer  →  copiar a Mis Decks  →  probar en el laboratorio
 *
 * Los dos destinos se ofrecen JUNTOS al terminar de copiar, no en un menú
 * aparte: el momento en que alguien quiere probar un mazo es el segundo
 * siguiente a haberlo copiado.
 *
 * ── Decisiones, todas deliberadas ─────────────────────────────────────
 *
 * - **El líder se muestra de FRENTE, y de frente es APAISADO.** `listFaceUrl`
 *   devuelve el reverso (el lado de unidad, vertical) porque en una lista
 *   conviene una carta vertical; acá el líder es protagonista y su cara es la
 *   que lleva la habilidad de la que habla el artículo. Se usa
 *   `isLandscapeFace(carta, false)`, igual que VitrinaShowcase.
 * - **Si una carta no resuelve, NO se copia nada.** Un mazo al que le faltan
 *   tres cartas y se guarda igual es un mazo roto en Mis Decks que nadie
 *   pidió. Se dice cuáles faltan y el botón queda deshabilitado.
 * - **El binder se cuenta por CARTA, no por impresión.** En SWU una
 *   Hyperspace y una Standard son la misma carta y las dos son legales:
 *   contar por impresión le diría «no la tenés» a quien la tiene. Se suman
 *   todas las impresiones con el mismo nombre y subtítulo.
 * - **La curva se CALCULA de la lista.** Los bloques de datos muestran lo que
 *   el autor escribe; acá la lista ES el dato, así que una curva escrita a
 *   mano solo podría contradecirla.
 * - **Nunca se duplica un nombre en silencio.** Si ya hay un mazo con ese
 *   nombre se pregunta antes de guardar y se dice con qué nombre quedó.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Copy, Check, Loader2, AlertTriangle, Library, FlaskConical, LogIn, Layers,
} from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { isLandscapeFace } from '../../services/cardArt'
import { db } from '../../services/db'
import { getMyCollection } from '../../services/collectionService'
import { validateDeck } from '../../services/deckValidator'
import { syncDeckToCloud } from '../../services/sync'
import { useAuth } from '../../hooks/useAuth'
import { CurvaCoste } from './BloquesEstadisticos'
import type { MazoDelArticulo, RefCarta } from './sintaxisMazo'
import type { Card, Deck, DeckCard } from '../../types'

// ── Resolución contra la base local ──────────────────────────────────

interface CartaResuelta {
  carta: Card
  cantidad: number
  /** Copias de ESTA carta en el binder, sumando todas sus impresiones. */
  enBinder: number
}

interface MazoResuelto {
  lider: CartaResuelta
  base: CartaResuelta
  main: CartaResuelta[]
  sideboard: CartaResuelta[]
  /** Nombres que la base local no supo resolver. Vacío = todo cuadra. */
  faltantes: string[]
}

/**
 * Entre impresiones de la misma carta se prefiere la Standard: es la que la
 * gente reconoce y la que el resto de la app trata como canónica. Misma
 * cadena de preferencia que `[[carta:…]]`, para que el bloque y la ficha
 * suelta nunca muestren cartas distintas.
 */
function elegirImpresion(candidatas: Card[], ref: RefCarta): Card | undefined {
  let todas = candidatas
  const m = ref.set ? /^([A-Za-z0-9]{2,5})(?:-(\d+))?$/.exec(ref.set) : null
  const setCode = m ? m[1].toUpperCase() : null
  const setNum = m?.[2] ?? null

  if (setCode) {
    const delSet = todas.filter(c => (c.setCode ?? '').toUpperCase() === setCode)
    // Un set que no existe se reporta como faltante en vez de dibujar en
    // silencio una carta distinta a la pedida.
    if (delSet.length === 0) return undefined
    todas = delSet
  }
  if (setNum) {
    const exacta = todas.filter(c => String(c.setNumber ?? '') === setNum)
    if (exacta.length > 0) todas = exacta
  }
  return todas.find(c => c.variantType === 'Standard')
    ?? todas.find(c => c.isCanonical)
    ?? todas[0]
}

/**
 * Todas las filas cuyo nombre aparece en el mazo, en UNA consulta indexada.
 *
 * Una consulta por carta serían ~20 barridos; `anyOfIgnoreCase` usa el índice
 * `name` una sola vez. Para los nombres que ese camino no encuentre —Dexie
 * solo permuta mayúsculas de caracteres ASCII— se cae al mismo `filter` que
 * usa la ficha suelta, que es exacto pero recorre la tabla.
 */
async function traerPorNombre(nombres: string[]): Promise<Map<string, Card[]>> {
  const porNombre = new Map<string, Card[]>()
  if (nombres.length === 0) return porNombre

  const filas = await db.cards.where('name').anyOfIgnoreCase(nombres).toArray()
  for (const c of filas) {
    const k = c.name.toLowerCase()
    const lista = porNombre.get(k)
    if (lista) lista.push(c)
    else porNombre.set(k, [c])
  }

  for (const n of nombres) {
    const k = n.toLowerCase()
    if (porNombre.has(k)) continue
    const lentas = await db.cards.filter(c => c.name.toLowerCase() === k).toArray()
    if (lentas.length > 0) porNombre.set(k, lentas)
  }
  return porNombre
}

/** Copias en el binder de la carta, sumando TODAS sus impresiones. */
function copiasEnBinder(
  carta: Card,
  hermanas: Card[],
  binder: Map<string, number>,
): number {
  let n = 0
  for (const h of hermanas) {
    if ((h.subtitle ?? null) !== (carta.subtitle ?? null)) continue
    n += binder.get(h.id) ?? 0
  }
  return n
}

async function resolverMazo(
  mazo: MazoDelArticulo,
  profileId: string | null,
): Promise<MazoResuelto | null> {
  const refs = [mazo.lider, mazo.base, ...mazo.main, ...mazo.sideboard]
  const nombres = [...new Set(refs.map(r => r.nombre))]

  let porNombre = await traerPorNombre(nombres)

  // El blog se lee SIN cuenta, y es la página a la que llega alguien desde un
  // enlace compartido: su base local está vacía. Solo se paga la descarga si
  // de verdad no hay nada guardado.
  const faltaAlguna = refs.some(r => !elegirImpresion(porNombre.get(r.nombre.toLowerCase()) ?? [], r))
  if (faltaAlguna && (await db.cards.count()) === 0) {
    const { ensureCards } = await import('../../services/swuApi')
    await ensureCards()
    porNombre = await traerPorNombre(nombres)
  }

  const binder = new Map<string, number>()
  if (profileId) {
    for (const item of await getMyCollection(profileId)) {
      binder.set(item.cardId, (binder.get(item.cardId) ?? 0) + item.quantity)
    }
  }

  const faltantes: string[] = []
  const resolver = (ref: RefCarta): CartaResuelta | null => {
    const hermanas = porNombre.get(ref.nombre.toLowerCase()) ?? []
    const carta = elegirImpresion(hermanas, ref)
    if (!carta) {
      faltantes.push(ref.set ? `${ref.nombre} (${ref.set})` : ref.nombre)
      return null
    }
    return { carta, cantidad: ref.cantidad, enBinder: copiasEnBinder(carta, hermanas, binder) }
  }

  /** Dos líneas que resuelven a la misma carta se suman en una sola fila. */
  const resolverLista = (lista: RefCarta[]): CartaResuelta[] => {
    const porId = new Map<string, CartaResuelta>()
    for (const ref of lista) {
      const r = resolver(ref)
      if (!r) continue
      const ya = porId.get(r.carta.id)
      if (ya) ya.cantidad += r.cantidad
      else porId.set(r.carta.id, r)
    }
    return [...porId.values()]
  }

  const lider = resolver(mazo.lider)
  const base = resolver(mazo.base)
  const main = resolverLista(mazo.main)
  const sideboard = resolverLista(mazo.sideboard)

  // Sin líder o sin base no hay nada que dibujar como encabezado: el bloque
  // cae a texto plano, igual que si la sintaxis no hubiera parseado.
  if (!lider || !base) return null
  return { lider, base, main, sideboard, faltantes }
}

// ── Agrupación y cuentas ─────────────────────────────────────────────

const GRUPOS: { clave: string; titulo: string }[] = [
  { clave: 'Unit', titulo: 'Unidades' },
  { clave: 'Event', titulo: 'Eventos' },
  { clave: 'Upgrade', titulo: 'Mejoras' },
]

function agrupar(cartas: CartaResuelta[]): { titulo: string; filas: CartaResuelta[]; copias: number }[] {
  const vistos = new Set<string>()
  const grupos = GRUPOS.map(g => {
    const filas = cartas.filter(c => c.carta.type === g.clave)
    filas.forEach(f => vistos.add(f.carta.id))
    return { titulo: g.titulo, filas, copias: filas.reduce((s, f) => s + f.cantidad, 0) }
  })
  // Cualquier tipo que no esté en la lista (fichas, cartas nuevas) se muestra
  // igual: perder cartas en silencio sería mentir sobre el total.
  const otras = cartas.filter(c => !vistos.has(c.carta.id))
  if (otras.length > 0) {
    grupos.push({ titulo: 'Otras', filas: otras, copias: otras.reduce((s, f) => s + f.cantidad, 0) })
  }
  return grupos
    .filter(g => g.filas.length > 0)
    .map(g => ({
      ...g,
      filas: [...g.filas].sort((a, b) =>
        (a.carta.cost ?? 99) - (b.carta.cost ?? 99) || a.carta.name.localeCompare(b.carta.name)),
    }))
}

function copias(cartas: CartaResuelta[]): number {
  return cartas.reduce((s, c) => s + c.cantidad, 0)
}

/** Columnas de la curva, con los costes vacíos incluidos: un hueco es un dato. */
function curvaDe(cartas: CartaResuelta[]): { coste: string; cantidad: number }[] {
  const conteo = new Map<number, number>()
  let max = 0
  let min = 99
  for (const c of cartas) {
    const k = c.carta.cost ?? 0
    conteo.set(k, (conteo.get(k) ?? 0) + c.cantidad)
    if (k > max) max = k
    if (k < min) min = k
  }
  if (conteo.size === 0) return []
  const desde = Math.min(min, 1)
  const columnas: { coste: string; cantidad: number }[] = []
  for (let i = desde; i <= max; i++) columnas.push({ coste: String(i), cantidad: conteo.get(i) ?? 0 })
  return columnas
}

// ── Copiar a Mis Decks ───────────────────────────────────────────────

function aDeckCard(r: CartaResuelta): DeckCard {
  return {
    cardId: r.carta.id,
    name: r.carta.name,
    subtitle: r.carta.subtitle,
    quantity: r.cantidad,
    setCode: r.carta.setCode,
  }
}

/** El primer «Nombre (n)» que no choque con ninguno de los mazos ya guardados. */
function nombreLibre(base: string, usados: Set<string>): string {
  for (let n = 2; n < 100; n++) {
    const candidato = `${base} (${n})`
    if (!usados.has(candidato.toLowerCase())) return candidato
  }
  return `${base} (${Date.now()})`
}

type Fase =
  | { f: 'listo' }
  | { f: 'confirmar'; sugerido: string }
  | { f: 'copiando' }
  | { f: 'copiado'; id: string; nombre: string; renombrado: boolean; valido: boolean; problema: string | null }
  | { f: 'error'; mensaje: string }

// ── El bloque ────────────────────────────────────────────────────────

export function BloqueMazo(
  {
    titulo, fuente, mazo, onAbrir,
  }: {
    titulo: string | null
    fuente: string | null
    mazo: MazoDelArticulo
    onAbrir: (id: string) => void
  },
) {
  const navigate = useNavigate()
  const { supabaseUser, currentProfileId, currentProfile } = useAuth()
  const [res, setRes] = useState<MazoResuelto | null | 'fallo'>(null)
  const [fase, setFase] = useState<Fase>({ f: 'listo' })

  useEffect(() => {
    let vivo = true
    void resolverMazo(mazo, currentProfileId)
      .then(r => { if (vivo) setRes(r ?? 'fallo') })
      .catch(() => {
        // IndexedDB bloqueado (navegación privada de Firefox) o sin red con la
        // base vacía: se dice, no se deja el esqueleto girando para siempre.
        if (vivo) setRes('fallo')
      })
    return () => { vivo = false }
  }, [mazo, currentProfileId])

  const nombreBase = useMemo(() => {
    if (titulo?.trim()) return titulo.trim().slice(0, 80)
    if (res && res !== 'fallo') return `${res.lider.carta.name} · ${res.base.carta.name}`.slice(0, 80)
    return 'Mazo del blog'
  }, [titulo, res])

  const guardar = useCallback(async (nombre: string, renombrado: boolean) => {
    if (!res || res === 'fallo') return
    setFase({ f: 'copiando' })
    try {
      const ahora = Date.now()
      const nuevo: Deck = {
        // Mismo formato de id que arma DeckBuilderPage: los mazos de la app
        // son todos de la misma familia, vengan de donde vengan.
        id: `d_${ahora}_${Math.random().toString(36).slice(2, 6)}`,
        name: nombre,
        format: mazo.formato,
        leaders: [aDeckCard(res.lider)],
        base: aDeckCard(res.base),
        mainDeck: res.main.map(aDeckCard),
        sideboard: res.sideboard.map(aDeckCard),
        isValid: false,
        validationErrors: [],
        isPublic: true,
        createdAt: ahora,
        updatedAt: ahora,
      }
      // El texto de la base decide el tamaño mínimo (Data Vault pide +10), así
      // que sin él la validación mentiría sobre un mazo perfectamente legal.
      const v = validateDeck(nuevo, res.base.carta.text)
      nuevo.isValid = v.isValid
      nuevo.validationErrors = v.errors

      await db.decks.put(nuevo)
      // Sin sesión el mazo vive solo en este dispositivo; con sesión sube y
      // aparece en cualquier otro. El fallo de nube no invalida el guardado
      // local, que ya está hecho.
      if (supabaseUser) syncDeckToCloud(supabaseUser.id, nuevo).catch(() => {})

      setFase({
        f: 'copiado',
        id: nuevo.id,
        nombre,
        renombrado,
        valido: nuevo.isValid,
        problema: nuevo.validationErrors[0] ?? null,
      })
    } catch (e) {
      setFase({ f: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo guardar el mazo.' })
    }
  }, [res, mazo.formato, supabaseUser])

  const copiar = useCallback(async () => {
    if (!res || res === 'fallo') return
    try {
      const usados = new Set((await db.decks.toArray()).map(d => (d.name ?? '').trim().toLowerCase()))
      if (usados.has(nombreBase.toLowerCase())) {
        // Guardar un segundo «The Armorer» sin avisar deja dos mazos idénticos
        // de nombre y ninguna forma de saber cuál es cuál.
        setFase({ f: 'confirmar', sugerido: nombreLibre(nombreBase, usados) })
        return
      }
      await guardar(nombreBase, false)
    } catch (e) {
      setFase({ f: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo leer Mis Decks.' })
    }
  }, [res, nombreBase, guardar])

  // ── Estados de carga ──────────────────────────────────────────────

  if (res === null) {
    return (
      <figure className="my-7 mx-0 rounded-xl border border-swu-border bg-swu-surface/60 p-4">
        <div className="h-4 w-40 rounded carta-esqueleto mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg carta-esqueleto aspect-[400/286]" />
          <div className="rounded-lg carta-esqueleto aspect-[400/286]" />
        </div>
      </figure>
    )
  }

  if (res === 'fallo') {
    return (
      <figure className="my-7 mx-0 rounded-xl border border-swu-border bg-swu-surface/60 p-4">
        {titulo && (
          <figcaption className="text-[11px] font-bold uppercase tracking-wider text-swu-amber mb-2">
            {titulo}
          </figcaption>
        )}
        <p className="text-[12px] text-swu-muted m-0">
          No se pudo armar este mazo con la base de cartas de este dispositivo.
        </p>
      </figure>
    )
  }

  const { lider, base, main, sideboard, faltantes } = res
  const grupos = agrupar(main)
  const totalMain = copias(main)
  const totalSb = copias(sideboard)
  const curva = curvaDe(main)

  // «52» es como cuenta melee: 50 del mazo + líder + base. El banquillo va
  // aparte porque es otra pregunta («¿puedo sentarme a jugarlo?» vs
  // «¿puedo cambiar entre partidas?»).
  const totalConCabeza = totalMain + 2
  const tengoCabeza = Math.min(1, lider.enBinder) + Math.min(1, base.enBinder)
  const tengoMain = main.reduce((s, c) => s + Math.min(c.cantidad, c.enBinder), 0) + tengoCabeza
  const tengoSb = sideboard.reduce((s, c) => s + Math.min(c.cantidad, c.enBinder), 0)

  const completo = faltantes.length === 0
  const copiando = fase.f === 'copiando'

  return (
    <figure className="my-7 mx-0 rounded-xl border border-swu-border bg-swu-surface/60 p-4">
      <figcaption className="flex items-start gap-2 mb-3">
        <Layers size={13} className="text-swu-amber mt-[2px] shrink-0" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wider text-swu-amber">
          {titulo || `${lider.carta.name} · ${base.carta.name}`}
        </span>
      </figcaption>

      {/* ── Líder y base ── */}
      <div className="grid grid-cols-2 gap-3">
        {[lider, base].map(({ carta }) => (
          <button
            key={carta.id}
            onClick={() => onAbrir(carta.id)}
            aria-label={`Ver ${carta.name}`}
            className="text-left"
          >
            <CardImage
              src={carta.imageUrl}
              // El FRENTE de un líder y el de una base son apaisados. Con la
              // caja vertical de las listas salían recortados por los lados.
              orientacion={isLandscapeFace(carta, false) ? 'apaisada' : 'vertical'}
              fit="cover"
              elevacion="realce"
              alt={carta.name}
              className={`w-full ${isLandscapeFace(carta, false) ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
            />
            <p className="text-[11px] font-bold text-swu-text truncate mt-1.5">{carta.name}</p>
            {carta.subtitle && (
              <p className="text-[10px] text-swu-muted truncate">{carta.subtitle}</p>
            )}
          </button>
        ))}
      </div>

      {/* ── Cuentas ── */}
      <p className="text-[11px] font-mono text-swu-muted mt-3 mb-0">
        {totalMain} cartas · líder + base
        {totalSb > 0 && <> · {totalSb} en el banquillo</>}
      </p>

      {/* ── Lo que ya tenés ── */}
      {currentProfileId && completo && (
        <p className="text-[11px] text-swu-text/85 mt-1.5 mb-0">
          En tu binder tenés{' '}
          <span className="font-mono text-swu-cyan">{tengoMain} de {totalConCabeza}</span>
          {totalSb > 0 && <> · banquillo <span className="font-mono text-swu-cyan">{tengoSb} de {totalSb}</span></>}
        </p>
      )}

      {/* ── Lo que no cuadró ── */}
      {!completo && (
        <p className="flex items-start gap-1.5 text-[11px] text-swu-amber mt-2 mb-0">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" aria-hidden />
          <span>
            {faltantes.length === 1 ? 'Esta carta no está' : `Estas ${faltantes.length} cartas no están`}
            {' '}en la base de este dispositivo: {faltantes.join(', ')}. El mazo no se puede copiar incompleto.
          </span>
        </p>
      )}

      {/* ── La lista ── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {grupos.map(g => (
          <div key={g.titulo}>
            <p className="text-[10px] uppercase tracking-wider text-swu-muted mb-1 mt-0">
              {g.titulo} <span className="font-mono">{g.copias}</span>
            </p>
            <ul className="m-0 p-0 list-none space-y-0.5">
              {g.filas.map(f => (
                <li key={f.carta.id} className="m-0">
                  <button
                    onClick={() => onAbrir(f.carta.id)}
                    className="w-full flex items-baseline gap-2 text-left rounded px-1 py-0.5 hover:bg-swu-bg/60"
                  >
                    <span className="text-[11px] font-mono text-swu-amber shrink-0 w-5">{f.cantidad}x</span>
                    <span className="text-[12px] text-swu-text/85 min-w-0 truncate">{f.carta.name}</span>
                    <span className="text-[10px] font-mono text-swu-muted ml-auto shrink-0">
                      {f.carta.cost ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {sideboard.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-swu-muted mb-1 mt-0">
            Banquillo <span className="font-mono">{totalSb}</span>
          </p>
          <p className="text-[11px] text-swu-text/70 m-0 leading-relaxed">
            {sideboard.map((f, i) => (
              <span key={f.carta.id}>
                {i > 0 && ' · '}
                <button onClick={() => onAbrir(f.carta.id)} className="hover:text-swu-cyan">
                  <span className="font-mono text-swu-muted">{f.cantidad}x</span> {f.carta.name}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* ── Curva ── */}
      {curva.length > 1 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-swu-muted mb-2 mt-0">
            Curva de coste <span className="normal-case tracking-normal">(calculada de la lista)</span>
          </p>
          <CurvaCoste columnas={curva} />
        </div>
      )}

      {/* ── Copiar ── */}
      <div className="mt-4 pt-3 border-t border-swu-border">
        {fase.f === 'listo' && (
          <button
            onClick={() => void copiar()}
            disabled={!completo}
            className="w-full py-2.5 rounded-xl bg-swu-accent text-white text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40"
          >
            <Copy size={15} aria-hidden /> Copiar a Mis Decks
          </button>
        )}

        {fase.f === 'confirmar' && (
          <div className="space-y-2">
            <p className="text-[11px] text-swu-amber m-0">
              Ya tenés un mazo llamado «{nombreBase}». ¿Guardo este aparte?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFase({ f: 'listo' })}
                className="flex-1 py-2 rounded-xl border border-swu-border text-swu-muted text-[12px] font-bold active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={() => void guardar(fase.sugerido, true)}
                className="flex-1 py-2 rounded-xl bg-swu-accent text-white text-[12px] font-bold active:scale-95"
              >
                Guardar como «{fase.sugerido}»
              </button>
            </div>
          </div>
        )}

        {copiando && (
          <p className="flex items-center justify-center gap-2 text-[12px] text-swu-muted m-0 py-2">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Copiando…
          </p>
        )}

        {fase.f === 'error' && (
          <div className="space-y-2">
            <p className="flex items-start gap-1.5 text-[11px] text-swu-red m-0">
              <AlertTriangle size={12} className="mt-[2px] shrink-0" aria-hidden />
              <span>{fase.mensaje}</span>
            </p>
            <button
              onClick={() => setFase({ f: 'listo' })}
              className="w-full py-2 rounded-xl border border-swu-border text-swu-muted text-[12px] font-bold active:scale-95"
            >
              Reintentar
            </button>
          </div>
        )}

        {fase.f === 'copiado' && (
          <div className="space-y-2">
            <p className="flex items-start gap-1.5 text-[11px] text-swu-green m-0">
              <Check size={12} className="mt-[2px] shrink-0" aria-hidden />
              <span>
                Guardado como «{fase.nombre}».
                {fase.renombrado && ' Le puse un número al final para no pisar el que ya tenías.'}
              </span>
            </p>

            {/* Un mazo que no pasa la validación se guarda igual —es la lista
                del artículo, no un error de quien copia— pero se dice, porque
                si no el aviso aparecería recién en Mis Decks sin explicación. */}
            {!fase.valido && fase.problema && (
              <p className="text-[11px] text-swu-amber m-0">Ojo: {fase.problema}</p>
            )}

            {currentProfile ? (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/decks')}
                  className="flex-1 py-2 rounded-xl border border-swu-border text-swu-text text-[12px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Library size={13} aria-hidden /> Ver en Mis Decks
                </button>
                <button
                  onClick={() => navigate(`/laboratorio?deck=${encodeURIComponent(fase.id)}`)}
                  className="flex-1 py-2 rounded-xl bg-swu-accent text-white text-[12px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <FlaskConical size={13} aria-hidden /> Probar en el laboratorio
                </button>
              </div>
            ) : (
              // Dexie es local: el mazo YA está guardado en este dispositivo y
              // va a estar ahí al entrar. Pero Mis Decks y el laboratorio piden
              // cuenta, así que mandar a esas rutas sin sesión solo mostraría
              // «Acceso Restringido» y parecería que el guardado falló.
              <>
                <p className="text-[11px] text-swu-muted m-0">
                  Quedó guardado en este dispositivo. Mis Decks y el laboratorio piden cuenta.
                </p>
                <button
                  onClick={() => navigate('/profile')}
                  className="w-full py-2 rounded-xl bg-swu-accent text-white text-[12px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <LogIn size={13} aria-hidden /> Entrar para verlo y probarlo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {fuente && <p className="text-[10px] text-swu-muted mt-3 mb-0">Fuente: {fuente}</p>}
    </figure>
  )
}
