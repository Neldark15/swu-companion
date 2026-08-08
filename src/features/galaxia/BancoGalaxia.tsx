/**
 * BancoGalaxia — banco de pruebas de la Galaxia. **Solo desarrollo.**
 *
 * /galaxia exige sesión y sus datos salen de Supabase: cuando el token local
 * vence, la pantalla entera es un error y no hay forma de MIRAR un cambio en
 * la escena. Este banco monta `GalaxiaEscena` con jugadores sintéticos que
 * ejercitan los extremos (0 y 9 logros, 0 y 2.900 cartas, niveles 1-9) y las
 * mismas lentes de la pantalla real, sin red y sin cuenta.
 */

import { useMemo, useState } from 'react'
import { GalaxiaEscena } from './GalaxiaEscena'
import { LENTES, metricaDe, magnitudDe, type Lente } from './GalaxiaPage'
import type { PlanetaJugador } from '../../services/galaxiaService'

function sintetico(i: number): PlanetaJugador {
  const niveles = [9, 7, 5, 4, 3, 2, 1, 1, 1, 1]
  const cartas = [2900, 640, 120, 48, 0, 0, 15, 0, 300, 0]
  const mazos = [6, 4, 3, 1, 0, 2, 0, 0, 1, 0]
  const logros = [9, 7, 5, 4, 3, 2, 1, 6, 2, 1]
  return {
    id: `qa-${i}`,
    nombre: `Jugador QA ${i + 1}`,
    avatar: '🛰️',
    nivel: niveles[i],
    xp: niveles[i] * 400,
    rango: 'QA',
    victorias: 0,
    derrotas: 0,
    ultimoMovimiento: null,
    orbita: i,
    esYo: i === 2,
    cartas: cartas[i],
    mazos: mazos[i],
    logros: logros[i],
    reputacion: 0,
    titulo: i === 0 ? 'Cazador de QA' : '',
    magnitud: Math.min(1, Math.log2(1 + niveles[i]) / Math.log2(27)),
  }
}

export function BancoGalaxia() {
  const [lente, setLente] = useState<Lente>('nivel')
  const base = useMemo(() => Array.from({ length: 10 }, (_, i) => sintetico(i)), [])

  // El MISMO recálculo que hace GalaxiaPage: si esto y aquello divergen, el
  // banco miente. Por eso importa los helpers en vez de copiarlos.
  const planetas = useMemo(() => {
    const max = Math.max(...base.map(p => metricaDe(p, lente)))
    return base
      .slice()
      .sort((a, b) =>
        (metricaDe(b, lente) - metricaDe(a, lente)) ||
        (b.nivel - a.nivel) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((p, i) => ({ ...p, orbita: i, magnitud: magnitudDe(p, lente, max) }))
  }, [base, lente])

  const [sel, setSel] = useState<string | null>(null)

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-swu-muted" data-banco-galaxia="1">
        Banco de la Galaxia · lente {lente} · {planetas.length} planetas ·{' '}
        {planetas.reduce((s, p) => s + Math.min(9, p.logros), 0)} lunas esperadas
      </p>
      <div className="flex gap-1.5">
        {LENTES.map(l => (
          <button key={l.id} onClick={() => setLente(l.id)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              lente === l.id ? 'border-swu-cyan/60 text-swu-cyan' : 'border-swu-border text-swu-muted'}`}>
            {l.rotulo}
          </button>
        ))}
      </div>
      <GalaxiaEscena
        planetas={planetas} seleccion={sel} onSeleccionar={setSel}
        className="h-[52vh] min-h-[320px] w-full rounded-2xl border border-swu-border"
      />
      <ol className="text-[10px] font-mono text-swu-muted">
        {planetas.map(p => (
          <li key={p.id}>
            órbita {p.orbita} · {p.nombre} · métrica {metricaDe(p, lente)} · magnitud {p.magnitud.toFixed(2)}
          </li>
        ))}
      </ol>
    </div>
  )
}
