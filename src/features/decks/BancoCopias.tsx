/**
 * BANCO DE COPIAS — la hoja de impresiones sin tener sesión ni mazo.
 *
 * El constructor de mazos está detrás del login y de la puerta de instalación,
 * así que la hoja de copias y la fila del mazo se estaban subiendo sin que
 * nadie las viera. Tipos, lint y build pasan igual con un encabezado duplicado
 * o un texto ilegible — los dos fallos que aparecieron hoy en el álbum.
 *
 * Se prueban los tres casos que importan:
 *   · 3 copias mezcladas (el caso real: una foil y dos normales)
 *   · 1 copia, donde el atajo «poner las N en» no debe aparecer
 *   · una carta APAISADA, que es donde el bolsillo fijo se pone a prueba
 */

import { useState } from 'react'
import { CopiasDeCarta } from './CopiasDeCarta'
import { Button } from '../../components/ui/Button'
import {
  impresionesDe, resumenImpresiones, type VarianteMazo,
} from '../../services/precioMazo'

const ARTE_VERTICAL =
  'https://cdn.starwarsunlimited.com/card_SWH_01_101_Rogue_Squadron_Skirmisher_e5659ca239.png'
/* Ojo: la cantidad de barras es POR CARTA, no una regla del CDN. Comprobado:
   Rogue Squadron con UNA barra da 200 y con dos 403; Obi-Wan al revés — su
   clave empieza por «/», así que la URL lleva `.com//card_…`. La URL viene así
   del API y NO se debe «limpiar». */
const ARTE_APAISADO =
  'https://cdn.starwarsunlimited.com//card_05031012_EN_Obi_Wan_Kenobi_Leader_85186449a0.png'

interface Caso {
  nombre: string
  imagen: string
  apaisada: boolean
  cantidad: number
  variantes: VarianteMazo[]
}

const CASOS: Caso[] = [
  { nombre: 'Tres copias mezcladas', imagen: ARTE_VERTICAL, apaisada: false, cantidad: 3, variantes: ['foil', 'normal', 'normal'] },
  { nombre: 'Una sola copia', imagen: ARTE_VERTICAL, apaisada: false, cantidad: 1, variantes: ['normal'] },
  { nombre: 'Líder apaisado', imagen: ARTE_APAISADO, apaisada: true, cantidad: 2, variantes: ['alterna', 'hyperspace'] },
]

export function BancoCopias() {
  const [estado, setEstado] = useState<VarianteMazo[][]>(CASOS.map(c => c.variantes))
  const [abierto, setAbierto] = useState<number | null>(null)

  const cambiar = (caso: number, copia: number, v: VarianteMazo) =>
    setEstado(prev => prev.map((vs, i) => (i === caso ? vs.map((x, j) => (j === copia ? v : x)) : vs)))

  const todas = (caso: number, v: VarianteMazo) =>
    setEstado(prev => prev.map((vs, i) => (i === caso ? vs.map(() => v) : vs)))

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-black text-swu-text">Banco de copias</h1>
      <p className="text-sm text-swu-muted">
        Solo en desarrollo. La hoja de impresiones por copia del constructor de mazos.
      </p>

      <ul className="space-y-2">
        {CASOS.map((c, i) => (
          <li key={c.nombre} className="flex items-center gap-3 rounded-lg border border-swu-border bg-swu-surface px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-swu-accent/20 font-mono text-xs font-bold text-swu-accent-texto">
              {estado[i].length}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-swu-text">{c.nombre}</span>
              {/* Esta es la etiqueta que se ve en la fila del mazo de verdad. */}
              <span className="block text-[9px] tracking-wide text-swu-muted uppercase">
                {resumenImpresiones(impresionesDe({ quantity: estado[i].length, variantes: estado[i] }))}
              </span>
            </span>
            <Button size="xs" variant="secondary" onClick={() => setAbierto(i)}>Abrir</Button>
          </li>
        ))}
      </ul>

      {abierto !== null && (
        <CopiasDeCarta
          abierto
          alCerrar={() => setAbierto(null)}
          nombre={CASOS[abierto].nombre}
          imagen={CASOS[abierto].imagen}
          apaisada={CASOS[abierto].apaisada}
          impresiones={estado[abierto]}
          alCambiar={(copia, v) => cambiar(abierto, copia, v)}
          alCambiarTodas={(v) => todas(abierto, v)}
        />
      )}
    </div>
  )
}
