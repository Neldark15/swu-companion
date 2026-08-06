/**
 * BloquesEstadisticos — los números de un análisis, dibujados dentro del artículo.
 *
 * Tres bloques: barras de winrate, curva de coste y ficha de datos. La
 * sintaxis con la que se escriben —y por qué el parseo es todo-o-nada— vive
 * en sintaxisEstadistica.ts; acá solo se dibuja lo ya parseado.
 *
 * Decisiones de dibujo, todas deliberadas:
 *
 * - **Móvil primero.** Las barras de winrate van en dos renglones (etiqueta y
 *   número arriba, barra abajo a todo lo ancho): a 320px una fila de tres
 *   columnas truncaba «Darth Vader Mt. Tantis» y el nombre ES el dato.
 * - **El número siempre como texto real, siempre en mono.** La barra es el
 *   adorno (va con aria-hidden); quien no distinga los colores o use lector
 *   de pantalla lee exactamente la misma información.
 * - **Nada de animaciones.** Son datos, no vitrina.
 */

import type { ReactNode } from 'react'
import type { DatosBloque, FilaBarra, ColumnaCurva, DatoFicha } from './sintaxisEstadistica'

// ── Marco común ──────────────────────────────────────────────────────

/**
 * Los tres bloques comparten el mismo marco: panel con borde, título en el
 * registro del `###` del artículo (ámbar, versalitas) y la fuente en chico.
 * Dentro de la prosa serif del blog, el panel en mono y superficie es lo que
 * dice «esto es un dato, no una opinión».
 */
function Marco(
  { titulo, fuente, children }: { titulo: string | null; fuente: string | null; children: ReactNode },
) {
  return (
    <figure className="my-7 mx-0 rounded-xl border border-swu-border bg-swu-surface/60 p-4">
      {titulo && (
        <figcaption className="text-[11px] font-bold uppercase tracking-wider text-swu-amber mb-3">
          {titulo}
        </figcaption>
      )}
      {children}
      {fuente && <p className="text-[10px] text-swu-muted mt-3 mb-0">Fuente: {fuente}</p>}
    </figure>
  )
}

// ── 1 · Barras de winrate ────────────────────────────────────────────

/**
 * Los umbrales vienen del análisis, no del gusto: ≥80 % es un emparejamiento
 * dominante (ámbar, el color de progreso de la app), <50 % se pierde (rojo)
 * y el resto es favorable (verde). El color solo refuerza lo que el número
 * ya dice.
 */
export function BarrasWinrate({ filas }: { filas: FilaBarra[] }) {
  return (
    <div className="space-y-2">
      {filas.map((f, i) => {
        const dominante = f.valor >= 80
        const perdida = f.valor < 50
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] leading-snug text-swu-text/85 min-w-0">{f.etiqueta}</span>
              <span
                className={`text-[12px] font-mono tabular-nums shrink-0 ${
                  dominante ? 'text-swu-amber' : perdida ? 'text-swu-red' : 'text-swu-green'
                }`}
              >
                {f.texto}%
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-swu-border/60 overflow-hidden" aria-hidden>
              <div
                className={`h-full rounded-full ${
                  dominante ? 'bg-swu-amber' : perdida ? 'bg-swu-red' : 'bg-swu-green/80'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, f.valor))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 2 · Curva de coste ───────────────────────────────────────────────

/** Alto de la barra más grande, en píxeles. Las demás escalan contra ella. */
const ALTO_CURVA = 72

export function CurvaCoste({ columnas }: { columnas: ColumnaCurva[] }) {
  const max = Math.max(...columnas.map(c => c.cantidad), 1)
  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-2.5">
      {columnas.map((c, i) => (
        <div key={i} className="flex-1 min-w-0 max-w-10 flex flex-col items-center">
          <span className="text-[11px] font-mono tabular-nums text-swu-text/85 mb-1">{c.cantidad}</span>
          <div
            aria-hidden
            className={`w-full rounded-t-sm ${c.cantidad === 0 ? 'bg-swu-border' : 'bg-swu-amber/90'}`}
            // Un coste con 0 cartas conserva un tocón visible: la columna
            // existe y está vacía, que no es lo mismo que no estar.
            style={{ height: `${Math.max(3, Math.round((c.cantidad / max) * ALTO_CURVA))}px` }}
          />
          <span className="text-[10px] font-mono text-swu-muted mt-1">{c.coste}</span>
        </div>
      ))}
    </div>
  )
}

// ── 3 · Ficha de datos ───────────────────────────────────────────────

export function FichaDatos({ datos }: { datos: DatoFicha[] }) {
  return (
    // `<dl>` de verdad: pares término/definición es exactamente lo que esto es,
    // y un lector de pantalla los anuncia como pareja sin trabajo extra.
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
      {datos.map((d, i) => (
        <div key={i} className="rounded-lg border border-swu-border bg-swu-bg/40 px-2.5 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-swu-muted leading-snug">{d.etiqueta}</dt>
          <dd className="text-[15px] font-mono text-swu-text mt-0.5 ml-0 break-words">{d.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Despacho ─────────────────────────────────────────────────────────

/** Un bloque ya parseado, con su marco. El artículo no necesita saber de cuál tipo es. */
export function BloqueEstadistico(
  { titulo, fuente, datos }: { titulo: string | null; fuente: string | null; datos: DatosBloque },
) {
  return (
    <Marco titulo={titulo} fuente={fuente}>
      {datos.tipo === 'barras' && <BarrasWinrate filas={datos.filas} />}
      {datos.tipo === 'curva' && <CurvaCoste columnas={datos.columnas} />}
      {datos.tipo === 'ficha' && <FichaDatos datos={datos.datos} />}
    </Marco>
  )
}
