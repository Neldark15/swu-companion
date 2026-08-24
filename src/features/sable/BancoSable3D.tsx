/**
 * Banco de la escena del sable. Solo desarrollo (`/banco-sable-3d`).
 *
 * `/sable` exige sesión Y estar en `sable_probadores`, así que sin este banco la
 * única forma de MIRAR la escena sería entrar con la cuenta buena — y una escena
 * 3D no se revisa leyendo el código. Es el mismo motivo por el que existen
 * `/banco-galaxia` y `/banco-sobres`.
 *
 * Acá se elige cualquier pieza sin comprarla: el catálogo de formas vive en
 * TypeScript y no necesita ni base ni saldo.
 */

import { useState } from 'react'
import { SableEscena } from './SableEscena'
import { IDS_CONOCIDOS, POR_DEFECTO, type Diseno } from './partesSable'

const RANURAS = [
  ['emisor', IDS_CONOCIDOS.emisor],
  ['cuerpo', IDS_CONOCIDOS.cuerpo],
  ['pomo', IDS_CONOCIDOS.pomo],
  ['color', IDS_CONOCIDOS.color],
] as const

export function BancoSable3D() {
  const [d, setD] = useState<Diseno>(POR_DEFECTO)
  const [encendido, setEncendido] = useState(false)
  const [explotado, setExplotado] = useState(true)

  return (
    <div className="min-h-screen bg-swu-bg p-5">
      <h1 className="text-lg font-black text-swu-text">Escena del sable</h1>
      <p className="mb-3 text-[12px] text-swu-muted">
        Arrastrá para girar. Sin base y sin saldo: las 64 combinaciones a un toque.
      </p>

      <SableEscena
        diseno={d}
        encendido={encendido}
        explotado={explotado}
        className="h-[52vh] min-h-[320px] w-full rounded-2xl border border-swu-border bg-gradient-to-b from-[#0d0b08] to-[#1c1408]"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setEncendido(v => !v)}
          className="rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-[12px] font-bold text-swu-text"
        >{encendido ? 'Apagar hoja' : 'Encender hoja'}</button>
        <button
          onClick={() => setExplotado(v => !v)}
          className="rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-[12px] font-bold text-swu-text"
        >{explotado ? 'Armar' : 'Explotar'}</button>
        <span className="self-center text-[11px] text-swu-muted">
          La hoja CRECE desde el emisor; abrir el sable la recoge y armarlo la devuelve.
        </span>
      </div>

      {RANURAS.map(([tipo, ids]) => (
        <div key={tipo} className="mt-4">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-swu-muted">{tipo}</p>
          <div className="flex flex-wrap gap-1.5">
            {ids.map(id => (
              <button
                key={id}
                onClick={() => setD(x => ({ ...x, [tipo]: id }))}
                className={`rounded-lg border px-2 py-1 text-[11px] ${
                  d[tipo] === id
                    ? 'border-swu-amber bg-swu-amber/15 text-swu-amber'
                    : 'border-swu-border bg-swu-surface text-swu-muted'
                }`}
              >{id.replace(/^[a-z]+_/, '')}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
