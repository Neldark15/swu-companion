/**
 * BINDER DIGITAL — las cartas que salieron de los sobres.
 *
 * ── Por qué está separado del binder de verdad ───────────────────────
 *
 * La app ya tiene un binder: el de la colección FÍSICA, la que se guarda en
 * casa y se lleva a los torneos. Ese sirve para saber qué se tiene y qué se
 * puede vender. Este es otro: lo de acá no existe en cartón, no se vende y no
 * se cambia. Mezclarlos haría que la colección real dejara de ser confiable —
 * que es justamente para lo que sirve.
 *
 * ── Nueve por página, y los huecos se ven ────────────────────────────
 *
 * Un binder de verdad tiene nueve bolsillos por hoja, y lo que engancha de
 * coleccionar no es ver lo que se tiene: es ver el HUECO al lado. Por eso los
 * espacios vacíos de la última página se dibujan como bolsillos: la página a
 * medio llenar es la que hace volver.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Library, X, Hash } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useAuth } from '../../hooks/useAuth'
import { ensureCards } from '../../services/swuApi'
import {
  miBinder, totalColeccionable,
  COLOR_RAREZA, NOMBRE_RAREZA, ESCALA,
  type CartaDelBinder, type Rareza,
} from '../../services/sobres'
import { CartaGirable } from './CartaGirable'
import { ReversoCarta } from './ReversoCarta'

/** Bolsillos por hoja, como en un binder de verdad. */
const POR_HOJA = 9

type Filtro = 'todo' | Rareza

export function BinderDigital() {
  const usuario = useAuth(s => s.supabaseUser)
  const [cartas, setCartas] = useState<CartaDelBinder[] | null>(null)
  const [total, setTotal] = useState(0)
  const [hoja, setHoja] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [abierta, setAbierta] = useState<CartaDelBinder | null>(null)

  const miId = usuario?.id ?? ''

  /* La carga va DENTRO del efecto y con guarda `vivo`: una respuesta lenta que
   * llega después de cerrar la pantalla escribiría estado sobre un componente
   * ya desmontado. Es el mismo patrón del resto de la app. */
  useEffect(() => {
    if (!miId) return
    let vivo = true
    void (async () => {
      await ensureCards()
      const [b, t] = await Promise.all([miBinder(miId), totalColeccionable()])
      if (!vivo) return
      setCartas(b)
      setTotal(t)
    })()
    return () => {
      vivo = false
    }
  }, [miId])

  const visibles = useMemo(
    () => (cartas ?? []).filter(c => filtro === 'todo' || c.rareza === filtro),
    [cartas, filtro],
  )

  const hojas = Math.max(1, Math.ceil(visibles.length / POR_HOJA))
  // El filtro puede dejar la hoja actual fuera de rango; se corrige al pintar
  // en vez de con un efecto, que provocaría un render de más.
  const hojaReal = Math.min(hoja, hojas - 1)
  const enHoja = visibles.slice(hojaReal * POR_HOJA, hojaReal * POR_HOJA + POR_HOJA)
  const huecos = POR_HOJA - enHoja.length

  const porRareza = useMemo(() => {
    const m = new Map<Rareza, number>()
    for (const c of cartas ?? []) m.set(c.rareza, (m.get(c.rareza) ?? 0) + 1)
    return m
  }, [cartas])

  if (!usuario) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState icon={<Library size={26} />} title="Tu binder es de tu cuenta" hint="Iniciá sesión para verlo." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-3 pb-24">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/sobres" className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text">
          <ChevronLeft size={18} />
          La bóveda
        </Link>
        <span className="text-xs text-swu-muted">
          {(cartas?.length ?? 0)} de {total || '—'}
        </span>
      </div>

      <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">BINDER DIGITAL</h1>
      <p className="mt-1 mb-5 text-center text-sm text-swu-muted">
        Solo lo que salió de los sobres. No es tu colección física.
      </p>

      {/* Cuánto llevás de cada cosa */}
      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {ESCALA.map(r => (
          <span
            key={r}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              color: COLOR_RAREZA[r],
              background: `${COLOR_RAREZA[r]}1f`,
            }}
          >
            {NOMBRE_RAREZA[r]} {porRareza.get(r) ?? 0}
          </span>
        ))}
      </div>

      <div className="mb-4">
        <SegmentedControl<Filtro>
          label="Filtrar por rareza"
          value={filtro}
          onChange={v => {
            setFiltro(v)
            setHoja(0)
          }}
          options={[
            { value: 'todo' as Filtro, label: 'Todo' },
            ...ESCALA.map(r => ({ value: r as Filtro, label: NOMBRE_RAREZA[r] })),
          ]}
        />
      </div>

      {cartas === null ? (
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="carta-esqueleto aspect-[286/400] rounded-lg" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={<Library size={26} />}
          title={filtro === 'todo' ? 'Todavía no abriste nada' : 'Nada de esa rareza'}
          hint={
            filtro === 'todo'
              ? 'Abrí tu primer sobre y lo que salga aparece acá.'
              : 'Seguí abriendo: esa impresión todavía no te salió.'
          }
        />
      ) : (
        <>
          {/* La hoja */}
          <div className="grid grid-cols-3 gap-2.5">
            {enHoja.map(c => (
              <button
                key={c.cardId}
                type="button"
                onClick={() => setAbierta(c)}
                className="group relative block rounded-lg text-left
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swu-cyan"
                aria-label={`Ver ${c.carta?.name ?? 'carta'}`}
              >
                <div
                  className="rounded-lg transition-transform duration-200 group-active:scale-95"
                  style={{
                    boxShadow: c.rareza === 'comun' ? 'none' : `0 0 12px ${COLOR_RAREZA[c.rareza]}45`,
                  }}
                >
                  {c.carta ? (
                    <CardImage
                      src={c.carta.imageUrl}
                      alt={c.carta.name}
                      orientacion={c.carta.isLeader || c.carta.isBase ? 'apaisada' : 'vertical'}
                      className="w-full"
                    />
                  ) : (
                    <div className="aspect-[286/400] rounded-lg bg-swu-surface" />
                  )}
                </div>

                {c.cantidad > 1 && (
                  <span className="absolute top-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-black text-white">
                    ×{c.cantidad}
                  </span>
                )}
                {c.serializada && (
                  <span
                    className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black"
                    style={{ background: COLOR_RAREZA.unica, color: '#fff' }}
                  >
                    <Hash size={9} />
                    ÚNICA
                  </span>
                )}
              </button>
            ))}

            {/* Bolsillos vacíos: el hueco es parte del juego. */}
            {Array.from({ length: huecos }, (_, i) => (
              <div
                key={`hueco-${i}`}
                aria-hidden
                className="aspect-[286/400] rounded-lg border border-dashed border-swu-border bg-swu-surface/25"
              />
            ))}
          </div>

          {/* Pasar hoja */}
          {hojas > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setHoja(h => Math.max(0, h - 1))}
                disabled={hojaReal === 0}
                className="rounded-lg p-2 text-swu-muted disabled:opacity-30"
                aria-label="Hoja anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-swu-muted">
                Hoja {hojaReal + 1} de {hojas}
              </span>
              <button
                type="button"
                onClick={() => setHoja(h => Math.min(hojas - 1, h + 1))}
                disabled={hojaReal >= hojas - 1}
                className="rounded-lg p-2 text-swu-muted disabled:opacity-30"
                aria-label="Hoja siguiente"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {/* La carta abierta, para girarla en la mano */}
      {abierta && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={abierta.carta?.name ?? 'Carta'}
        >
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>

          <div className="w-full max-w-[300px]">
            <CartaGirable
              ratio={abierta.carta?.isLeader || abierta.carta?.isBase ? 400 / 286 : 286 / 400}
              frente={
                abierta.carta ? (
                  <CardImage
                    src={abierta.carta.imageUrl}
                    alt={abierta.carta.name}
                    orientacion={abierta.carta.isLeader || abierta.carta.isBase ? 'apaisada' : 'vertical'}
                    className="w-full"
                  />
                ) : (
                  <div className="h-full w-full rounded-xl bg-swu-surface" />
                )
              }
              dorso={<ReversoCarta color={COLOR_RAREZA[abierta.rareza]} />}
            />
          </div>

          <div className="mt-4 text-center">
            <p
              className="text-[11px] font-black uppercase tracking-[0.24em]"
              style={{ color: COLOR_RAREZA[abierta.rareza] }}
            >
              {abierta.serializada ? 'ÚNICA EN LA COMUNIDAD' : abierta.variante}
            </p>
            <p className="mt-0.5 text-lg font-bold text-white">{abierta.carta?.name ?? '—'}</p>
            <p className="text-xs text-white/55">
              {abierta.carta ? `${abierta.carta.setCode} ${abierta.carta.setNumber}` : ''}
              {abierta.cantidad > 1 ? ` · tenés ${abierta.cantidad}` : ''}
            </p>
            <p className="mt-2 text-[11px] text-white/40">Arrastrá para girarla</p>
          </div>
        </div>
      )}
    </div>
  )
}
