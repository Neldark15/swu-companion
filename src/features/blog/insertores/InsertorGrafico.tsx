/**
 * InsertorGrafico — los tres bloques de datos (barras · curva · ficha) en un
 * formulario de filas.
 *
 * Uno solo para los tres porque la mecánica es idéntica —dos campos por fila,
 * agregar, quitar, subir, bajar— y lo único que cambia es qué se valida. Tres
 * formularios serían tres sitios donde arreglar el mismo error.
 *
 * Lo que este formulario impide, y el textarea no:
 *  - un `:` en el valor de barras (el corte es por el ÚLTIMO `:`, así que
 *    «A: 3:1» no falla: dibuja «A: 3 → 1 %»);
 *  - un `:`, un `·` o un `|` en la etiqueta de una ficha;
 *  - una fila que se llame «fuente», que el marco del bloque se roba;
 *  - un espacio dentro de un par de la curva, que lo parte en dos tokens;
 *  - pasarse de 40 / 20 / 24 filas, que tumba el bloque entero;
 *  - un `]` en el título, que anula el marcador.
 *
 * La vista previa monta el componente REAL con los datos del parser REAL: si
 * se ve, es lo que va a salir publicado.
 */

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Check, AlertTriangle } from 'lucide-react'
import { Sheet } from '../../../components/ui/Sheet'
import { Button } from '../../../components/ui/Button'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { BloqueEstadistico } from '../BloquesEstadisticos'
import { parsearBloqueEstadistico } from '../sintaxisEstadistica'
import {
  MAX_FILAS, cuerpoGrafico, filasDesdeCuerpo, limpiarTitulo, limpiarUnaLinea,
  serializarGrafico, validarFila,
  type FilaGrafico, type TipoGrafico,
} from './sintaxisSalida'

const ETIQUETAS: Record<TipoGrafico, { a: string; b: string; ejemploA: string; ejemploB: string }> = {
  barras: { a: 'Etiqueta', b: '%', ejemploA: 'Cad Bane — campeón', ejemploB: '79.7' },
  curva: { a: 'Coste', b: 'Cartas', ejemploA: '3', ejemploB: '12' },
  ficha: { a: 'Etiqueta', b: 'Valor', ejemploA: 'Unidades', ejemploB: '57' },
}

export interface InsertorGraficoProps {
  onCerrar: () => void
  onAplicar: (texto: string) => void
  /** Bloque ya escrito bajo el cursor, para editarlo. */
  inicial?: { tipo: TipoGrafico; titulo: string; fuente: string; lineas: string[] } | null
}

export function InsertorGrafico({ onCerrar, onAplicar, inicial = null }: InsertorGraficoProps) {
  const [tipo, setTipo] = useState<TipoGrafico>(inicial?.tipo ?? 'barras')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [fuente, setFuente] = useState(inicial?.fuente ?? '')
  const [filas, setFilas] = useState<FilaGrafico[]>(() =>
    inicial ? filasDesdeCuerpo(inicial.tipo, inicial.lineas) : [{ a: '', b: '' }],
  )

  const cambiar = (i: number, campo: 'a' | 'b', valor: string) =>
    setFilas(f => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)))
  const quitar = (i: number) => setFilas(f => (f.length === 1 ? [{ a: '', b: '' }] : f.filter((_, j) => j !== i)))
  const mover = (i: number, d: -1 | 1) => setFilas(f => {
    const j = i + d
    if (j < 0 || j >= f.length) return f
    const copia = [...f]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    return copia
  })

  const form = { tipo, titulo, fuente, filas }
  const resultado = serializarGrafico(form)
  const datos = parsearBloqueEstadistico(tipo, cuerpoGrafico(form))
  const eti = ETIQUETAS[tipo]
  const llenas = filas.filter(x => x.a.trim() !== '' || x.b.trim() !== '')

  return (
    <Sheet open onClose={onCerrar} title={inicial ? 'Editar el bloque de datos' : 'Bloque de datos'}>
      <div className="space-y-3 p-4">
        <SegmentedControl<TipoGrafico>
          label="Tipo de bloque"
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'barras', label: 'Barras' },
            { value: 'curva', label: 'Curva' },
            { value: 'ficha', label: 'Ficha' },
          ]}
        />

        <input
          value={titulo}
          /* El `]` se filtra AL ESCRIBIR: con uno solo, el marcador entero se
             lee como texto plano y el bloque desaparece. */
          onChange={e => setTitulo(limpiarTitulo(e.target.value))}
          placeholder="Título del bloque (opcional)"
          className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm text-swu-text
                     placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
        />

        <div className="space-y-1.5">
          {filas.map((fila, i) => {
            const e = validarFila(tipo, fila)
            const vacia = fila.a.trim() === '' && fila.b.trim() === ''
            return (
              <div key={i}>
                <div className="flex items-center gap-1.5">
                  <input
                    value={fila.a}
                    onChange={ev => cambiar(i, 'a', ev.target.value.replace(/[\r\n]/g, ''))}
                    placeholder={eti.ejemploA}
                    aria-label={`${eti.a} de la fila ${i + 1}`}
                    className={`min-w-0 flex-1 rounded-lg border bg-swu-surface px-2.5 py-2 text-[13px] text-swu-text
                                placeholder:text-swu-muted/40 focus:outline-none focus:ring-2 focus:ring-swu-accent
                                ${!vacia && e.a ? 'border-swu-red-texto' : 'border-swu-border'}`}
                  />
                  <input
                    value={fila.b}
                    onChange={ev => cambiar(i, 'b', ev.target.value.replace(/[\r\n]/g, ''))}
                    placeholder={eti.ejemploB}
                    inputMode={tipo === 'ficha' ? 'text' : 'decimal'}
                    aria-label={`${eti.b} de la fila ${i + 1}`}
                    className={`w-24 flex-shrink-0 rounded-lg border bg-swu-surface px-2.5 py-2 text-[13px] text-swu-text
                                placeholder:text-swu-muted/40 focus:outline-none focus:ring-2 focus:ring-swu-accent
                                ${!vacia && e.b ? 'border-swu-red-texto' : 'border-swu-border'}`}
                  />
                  <div className="flex flex-shrink-0">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir la fila" className="p-1.5 text-swu-muted disabled:opacity-30">
                      <ChevronUp size={14} aria-hidden />
                    </button>
                    <button onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label="Bajar la fila" className="p-1.5 text-swu-muted disabled:opacity-30">
                      <ChevronDown size={14} aria-hidden />
                    </button>
                    <button onClick={() => quitar(i)} aria-label="Quitar la fila" className="p-1.5 text-swu-red-texto">
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>
                {!vacia && (e.a ?? e.b) && (
                  <p className="mt-0.5 pl-1 text-[11px] text-swu-red-texto">{e.a ?? e.b}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setFilas(f => [...f, { a: '', b: '' }])}
            disabled={llenas.length >= MAX_FILAS[tipo]}
          >
            <Plus size={13} aria-hidden /> Otra fila
          </Button>
          <span className="text-[10px] text-swu-muted">{llenas.length} / {MAX_FILAS[tipo]}</span>
        </div>

        <input
          value={fuente}
          onChange={e => setFuente(limpiarUnaLinea(e.target.value))}
          placeholder="Fuente del dato (opcional)"
          className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[13px] text-swu-text
                     placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
        />

        {/* Vista previa con el componente y el parser de verdad. */}
        {datos && (
          <div className="rounded-lg border border-swu-border/60 bg-swu-bg p-2">
            <BloqueEstadistico titulo={limpiarTitulo(titulo).trim() || null} fuente={fuente.trim() || null} datos={datos} />
          </div>
        )}

        {!resultado.ok && (
          <p className="flex items-start gap-1.5 text-[12px] text-swu-red-texto">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden /> {resultado.error}
          </p>
        )}

        <Button block size="sm" disabled={!resultado.ok} onClick={() => { if (resultado.ok) { onAplicar(resultado.texto); onCerrar() } }}>
          <Check size={14} aria-hidden /> {inicial ? 'Reemplazar el bloque' : 'Insertar el bloque'}
        </Button>
      </div>
    </Sheet>
  )
}
