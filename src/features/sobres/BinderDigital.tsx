/**
 * BINDER DIGITAL — el álbum de las impresiones brillantes.
 *
 * ── Por qué está separado del binder de verdad ───────────────────────
 *
 * La app ya tiene un binder: el de la colección FÍSICA, la que se guarda en
 * casa y se lleva a los torneos. Ese sirve para saber qué se tiene y qué se
 * puede vender. Este es otro: lo de acá no existe en cartón, no se vende y no
 * se cambia. Mezclarlos haría que la colección real dejara de ser confiable —
 * que es justamente para lo que sirve.
 *
 * ── La estructura: sección → página → casilla ────────────────────────
 *
 * Medido sobre el pool: 33 SECCIONES (set + variante), 311 PÁGINAS de nueve,
 * 2.669 CASILLAS. La sección es set+variante y no solo el set porque cada
 * variante ocupa su propia banda de números, disjunta de las demás (cero
 * números compartidos entre variantes de un mismo set).
 *
 * ── Y por qué la casilla NO es el número impreso ─────────────────────
 *
 * Es lo que uno haría primero, y está mal por dos motivos medidos:
 *
 *   · Un álbum indexado por número tendría 2.930 casillas para 2.669 cartas:
 *     305 bolsillos IMPOSIBLES de llenar. Y están casi todos en una sola
 *     sección — TWI Hyperspace Foil va del #3 al #517 con 220 cartas, o sea
 *     295 huecos muertos: 33 páginas de puro vacío inalcanzable.
 *   · Y el número tampoco es llave: 23 tripletas (set, variante, número)
 *     tienen 2 o 3 cartas DISTINTAS. SEC Serialized Prestige tiene 85 cartas
 *     para 43 números — tres tiradas por número.
 *
 * Así que la casilla es la posición ordinal (la calcula `album_seccion()` con
 * `row_number()` en Postgres) y el número impreso va de etiqueta. En 29 de las
 * 33 secciones las dos cosas coinciden exactamente, así que no se pierde nada.
 *
 * ── El orden de las secciones ────────────────────────────────────────
 *
 * Por ESCALA de rareza, nunca por número: medido, en TWI la Hyperspace Foil
 * arranca en el #3 y en SOR/SHD arranca antes la Showcase, o sea que el mismo
 * criterio pondría familias distintas primero según el set.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Library } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { ensureCards } from '../../services/swuApi'
import {
  seccionesAlbum, casillasDeSeccion,
  COLOR_RAREZA, NOMBRE_RAREZA, ACABADO, esApaisada,
  type SeccionAlbum, type CasillaAlbum,
} from '../../services/sobres'
import { PaginaAlbum, POR_HOJA } from './PaginaAlbum'
import { LupaCarta } from './LupaCarta'
import { Acabado } from './Acabado'

export function BinderDigital() {
  const usuario = useAuth(s => s.supabaseUser)
  const miId = usuario?.id ?? ''

  const [secciones, setSecciones] = useState<SeccionAlbum[] | null>(null)
  const [abierta, setAbierta] = useState<SeccionAlbum | null>(null)
  const [casillas, setCasillas] = useState<CasillaAlbum[] | null>(null)
  const [hoja, setHoja] = useState(0)
  const [mirando, setMirando] = useState<CasillaAlbum | null>(null)

  /* Carga DENTRO del efecto y con guarda `vivo`: una respuesta lenta que llega
   * después de cerrar la pantalla escribiría estado sobre un componente ya
   * desmontado. Es el patrón del resto de la app. */
  useEffect(() => {
    if (!miId) return
    let vivo = true
    void (async () => {
      await ensureCards()
      const s = await seccionesAlbum()
      if (vivo) setSecciones(s)
    })()
    return () => {
      vivo = false
    }
  }, [miId])

  // Las casillas de la sección abierta. Se piden de a una sección: son 2.669
  // en total y bajárselas todas para enseñar nueve es el mismo error que ya
  // costó caro con las imágenes (§2t: 45 MB para pintar 1,4).
  useEffect(() => {
    if (!abierta) return
    let vivo = true
    void (async () => {
      const c = await casillasDeSeccion(abierta.setCode, abierta.variante)
      if (vivo) setCasillas(c)
    })()
    return () => {
      vivo = false
    }
  }, [abierta])

  /* Abrir una sección limpia lo de la anterior ACÁ y no dentro del efecto.
   * Vaciar desde el efecto es una escritura síncrona de estado que provoca un
   * render en cascada — y además el sitio correcto es donde está la acción de
   * la persona, no donde se reacciona a ella. */
  const abrirSeccion = useCallback((s: SeccionAlbum) => {
    setCasillas(null)
    setHoja(0)
    setAbierta(s)
  }, [])

  const totales = useMemo(() => {
    const s = secciones ?? []
    return {
      tenidas: s.reduce((a, x) => a + x.tenidas, 0),
      total: s.reduce((a, x) => a + x.total, 0),
    }
  }, [secciones])

  if (!usuario) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState icon={<Library size={26} />} title="Tu binder es de tu cuenta" hint="Iniciá sesión para verlo." />
      </div>
    )
  }

  // ── Una sección abierta: las páginas de nueve ────────────────────────
  if (abierta) {
    const color = COLOR_RAREZA[abierta.rareza]
    // La sección siguiente, para que la última hoja ofrezca seguir en vez de
    // obligar a volver al índice. Va con `abrirSeccion` y NO con `setAbierta`:
    // el primero limpia las casillas de la anterior, si no quedarían pintadas.
    const lista = secciones ?? []
    const siguiente = lista[lista.indexOf(abierta) + 1]

    return (
      <div className="mx-auto max-w-3xl px-4 pt-3 pb-24">
        <button
          type="button"
          onClick={() => setAbierta(null)}
          className="-ml-1 mb-3 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text"
        >
          <ChevronLeft size={18} />
          Todas las secciones
        </button>

        <PaginaAlbum
          seccion={abierta}
          casillas={casillas}
          hoja={Math.min(hoja, Math.max(0, Math.ceil(abierta.total / POR_HOJA) - 1))}
          alCambiarHoja={setHoja}
          alAbrir={setMirando}
          alSiguienteSeccion={siguiente ? () => abrirSeccion(siguiente) : undefined}
          siguienteSeccion={siguiente ? `${siguiente.setCode} · ${NOMBRE_RAREZA[siguiente.rareza]}` : undefined}
        />

        {mirando && (
          <LupaCarta
            casilla={mirando}
            color={color}
            acabado={
              mirando.tenida
                ? <Acabado acabado={ACABADO[abierta.rareza]} apaisada={esApaisada(mirando.carta)} />
                : undefined
            }
            alCerrar={() => setMirando(null)}
          />
        )}
      </div>
    )
  }

  // ── El índice: todas las secciones ───────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 pt-3 pb-24">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/sobres" className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text">
          <ChevronLeft size={18} />
          La bóveda
        </Link>
        <span className="text-xs text-swu-muted">
          {totales.tenidas} de {totales.total || '—'}
        </span>
      </div>

      <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">EL ÁLBUM</h1>
      <p className="mt-1 mb-5 text-center text-sm text-swu-muted">
        Cada carta cae en su casilla. Solo lo que sale de los sobres.
      </p>

      {secciones === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="carta-esqueleto h-14 rounded-lg" />
          ))}
        </div>
      ) : secciones.length === 0 ? (
        <EmptyState icon={<Library size={26} />} title="El álbum todavía no cargó" hint="Volvé a entrar en un momento." />
      ) : (
        <div className="space-y-4">
          {agrupadoPorSet(secciones).map(([setCode, lista]) => (
            <section key={setCode}>
              <h2 className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-swu-muted/70">
                {setCode}
              </h2>
              <div className="clip-hud divide-y divide-swu-border bg-swu-surface">
                {lista.map(s => (
                  <button
                    key={s.variante}
                    type="button"
                    onClick={() => abrirSeccion(s)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-swu-surface-hover"
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: COLOR_RAREZA[s.rareza] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-swu-text">
                        {NOMBRE_RAREZA[s.rareza]}
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${s.total ? (s.tenidas / s.total) * 100 : 0}%`,
                            background: COLOR_RAREZA[s.rareza],
                          }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-swu-muted">
                      {s.tenidas}/{s.total}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-swu-muted/50" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Las secciones agrupadas por set, conservando el orden que ya trae la lista. */
function agrupadoPorSet(secciones: SeccionAlbum[]): [string, SeccionAlbum[]][] {
  const mapa = new Map<string, SeccionAlbum[]>()
  for (const s of secciones) {
    const lista = mapa.get(s.setCode)
    if (lista) lista.push(s)
    else mapa.set(s.setCode, [s])
  }
  return [...mapa.entries()]
}
