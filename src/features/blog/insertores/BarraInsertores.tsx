/**
 * BarraInsertores — los cuatro botones del editor y el cableado con el textarea.
 *
 * Acá vive la única decisión que los insertores no pueden tomar solos: DÓNDE
 * cae lo que producen.
 *
 * Tres reglas, y las tres nacen de cómo lee el renderizador:
 *  1. Si el cursor está sobre algo del mismo tipo, se EDITA eso (se reemplaza
 *    su rango) en vez de insertar una copia. Sin esto, corregir una fila
 *    obliga a borrar el bloque y rehacerlo.
 *  2. Si el cursor está dentro de un bloque de OTRO tipo, lo nuevo va DESPUÉS
 *    del bloque, nunca en medio: partir un bloque en dos lo tumba entero, y en
 *    el caso peor lo deja parseando con la mitad de las líneas (un mazo
 *    truncado que igual ofrece «Copiar a Mis Decks»).
 *  3. Todo bloque se escribe con línea en blanco antes y después, que es lo
 *    único que abre y cierra bloques en esta sintaxis.
 */

import { useState } from 'react'
import { CreditCard, BarChart3, Layers, ImagePlus } from 'lucide-react'
import {
  aplicarEdicion, bloqueEnCursor, cartaEnCursor, imagenEnCursor,
  rangoDeSeleccion, reemplazarBloque, reemplazarEnLinea,
  type Rango,
} from './edicionTexto'
import { InsertorCarta } from './InsertorCarta'
import { InsertorGrafico } from './InsertorGrafico'
import { InsertorMazo } from './InsertorMazo'
import { InsertorImagen } from './InsertorImagen'
import type { TipoGrafico } from './sintaxisSalida'

type Cual = 'carta' | 'grafico' | 'mazo' | 'imagen'

interface Objetivo {
  rango: Rango
  /** Datos del bloque/ficha que ya estaba ahí, para editarlo. */
  carta?: { nombre: string; set: string | null }
  grafico?: { tipo: TipoGrafico; titulo: string; fuente: string; lineas: string[] }
  mazo?: { titulo: string; fuente: string; lineas: string[] }
  imagen?: { pie: string; url: string }
}

export interface BarraInsertoresProps {
  areaRef: React.RefObject<HTMLTextAreaElement | null>
  contenido: string
  onCambiar: (texto: string) => void
  userId: string | null
}

export function BarraInsertores({ areaRef, contenido, onCambiar, userId }: BarraInsertoresProps) {
  const [cual, setCual] = useState<Cual | null>(null)
  const [objetivo, setObjetivo] = useState<Objetivo>({ rango: { desde: 0, hasta: 0 } })

  const abrir = (quien: Cual) => {
    const area = areaRef.current
    const sel = rangoDeSeleccion(area, contenido.length)
    const bloque = bloqueEnCursor(contenido, sel.desde)

    if (quien === 'carta') {
      const ficha = cartaEnCursor(contenido, sel.desde)
      if (ficha && !bloque) {
        setObjetivo({ rango: ficha.rango, carta: { nombre: ficha.nombre, set: ficha.set } })
      } else {
        setObjetivo({ rango: bloque ? finDe(bloque.rango) : sel })
      }
    } else if (quien === 'grafico') {
      if (bloque && bloque.tipo !== 'mazo') {
        setObjetivo({
          rango: bloque.rango,
          grafico: { tipo: bloque.tipo, titulo: bloque.titulo, fuente: bloque.fuente, lineas: bloque.lineas },
        })
      } else {
        setObjetivo({ rango: bloque ? finDe(bloque.rango) : sel })
      }
    } else if (quien === 'mazo') {
      if (bloque && bloque.tipo === 'mazo') {
        setObjetivo({
          rango: bloque.rango,
          mazo: { titulo: bloque.titulo, fuente: bloque.fuente, lineas: bloque.lineas },
        })
      } else {
        setObjetivo({ rango: bloque ? finDe(bloque.rango) : sel })
      }
    } else {
      const img = imagenEnCursor(contenido, sel.desde)
      if (img) setObjetivo({ rango: img.rango, imagen: { pie: img.pie, url: img.url } })
      else setObjetivo({ rango: bloque ? finDe(bloque.rango) : sel })
    }

    setCual(quien)
  }

  const aplicar = (texto: string, bloque: boolean) => {
    const edicion = bloque
      ? reemplazarBloque(contenido, objetivo.rango, texto)
      : reemplazarEnLinea(contenido, objetivo.rango, texto)
    aplicarEdicion(areaRef.current, edicion, onCambiar)
  }

  const cerrar = () => setCual(null)

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Boton icono={<CreditCard size={12} aria-hidden />} onClick={() => abrir('carta')}>Carta</Boton>
        <Boton icono={<BarChart3 size={12} aria-hidden />} onClick={() => abrir('grafico')}>Datos</Boton>
        <Boton icono={<Layers size={12} aria-hidden />} onClick={() => abrir('mazo')}>Mazo</Boton>
        <Boton icono={<ImagePlus size={12} aria-hidden />} onClick={() => abrir('imagen')}>Imagen</Boton>
      </div>
      <p className="text-[10px] text-swu-muted">
        Con el cursor encima de un bloque ya escrito, el botón lo EDITA en vez de agregar otro.
      </p>

      {cual === 'carta' && (
        <InsertorCarta
          onCerrar={cerrar}
          onAplicar={t => aplicar(t, false)}
          inicial={objetivo.carta ?? null}
        />
      )}
      {cual === 'grafico' && (
        <InsertorGrafico
          onCerrar={cerrar}
          onAplicar={t => aplicar(t, true)}
          inicial={objetivo.grafico ?? null}
        />
      )}
      {cual === 'mazo' && (
        <InsertorMazo
          onCerrar={cerrar}
          onAplicar={t => aplicar(t, true)}
          inicial={objetivo.mazo ?? null}
        />
      )}
      {cual === 'imagen' && (
        <InsertorImagen
          onCerrar={cerrar}
          onAplicar={t => aplicar(t, true)}
          userId={userId}
          inicial={objetivo.imagen ?? null}
        />
      )}
    </>
  )
}

/** Un punto colapsado al final del bloque: lo nuevo va después, nunca en medio. */
function finDe(rango: Rango): Rango {
  return { desde: rango.hasta, hasta: rango.hasta }
}

function Boton({ icono, children, onClick }: { icono: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-swu-cyan/40 px-2.5 py-1
                 text-[11px] text-swu-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
    >
      {icono} {children}
    </button>
  )
}
