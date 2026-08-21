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
import { LENTES, metricaDe, conLente, type Lente } from './lentes'
import type { PlanetaJugador, SistemaSolar } from '../../services/galaxiaService'

function sintetico(i: number): PlanetaJugador {
  const niveles = [9, 7, 5, 4, 3, 2, 1, 1, 1, 1]
  const cartas = [2900, 640, 120, 48, 0, 0, 15, 0, 300, 0]
  const mazos = [6, 4, 3, 1, 0, 2, 0, 0, 1, 0]
  const logros = [9, 7, 5, 4, 3, 2, 1, 6, 2, 1]
  return {
    id: `qa-${i}`,
    nombre: `Jugador QA ${i + 1}`,
    // Uno de cada tres SIN bautizar, a propósito: el banco tiene que enseñar
    // los dos estados, porque el emergente los dibuja distinto.
    nombrePlaneta: i % 3 === 0 ? '' : `Mundo QA ${i + 1}`,
    ajustesPlaneta: { familia: null, mares: null, crateres: null, acento: null },
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

/** Países de mentira para el banco, con la misma forma que trae el servicio. */
const PAISES = [
  { pais: 'SV', nombre: 'El Salvador', bandera: '🇸🇻' },
  { pais: 'MX', nombre: 'México', bandera: '🇲🇽' },
  { pais: 'ES', nombre: 'España', bandera: '🇪🇸' },
  { pais: 'AR', nombre: 'Argentina', bandera: '🇦🇷' },
  { pais: null, nombre: 'Sin registrar', bandera: '🛰' },
]

export function BancoGalaxia() {
  const [lente, setLente] = useState<Lente>('nivel')
  // Cuántos soles. Es lo que hay que poder mirar de un lado a otro: con 1 la
  // escena tiene que quedar EXACTAMENTE como antes de repartir la galaxia.
  const [nPaises, setNPaises] = useState(5)
  const base = useMemo(() => Array.from({ length: 10 }, (_, i) => sintetico(i)), [])

  // El mismo reparto que hace el servicio: el primer país se queda con casi
  // todos y los demás con uno, que es la forma real de la comunidad hoy
  // (24 salvadoreños y un jugador suelto en cada uno de los otros).
  const crudos = useMemo<SistemaSolar[]>(() => {
    const n = Math.min(nPaises, PAISES.length)
    const sueltos = base.slice(base.length - (n - 1))
    const casa = base.slice(0, base.length - (n - 1))
    return PAISES.slice(0, n).map((p, i) => ({
      ...p,
      planetas: i === 0 ? casa : [sueltos[i - 1]],
    }))
  }, [base, nPaises])

  // El MISMO recálculo que hace GalaxiaPage: si esto y aquello divergen, el
  // banco miente. Por eso importa el helper en vez de copiarlo.
  const sistemas = useMemo(() => conLente(crudos, base, lente), [crudos, base, lente])
  const planetas = useMemo(() => sistemas.flatMap(s => s.planetas), [sistemas])

  const [sel, setSel] = useState<string | null>(null)
  const [amplitud, setAmplitud] = useState<'sistema' | 'galaxia'>('sistema')

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-swu-muted" data-banco-galaxia="1">
        Banco de la Galaxia · lente {lente} · {sistemas.length} sistemas ·{' '}
        {planetas.length} planetas ·{' '}
        {planetas.reduce((s, p) => s + Math.min(9, p.logros), 0)} lunas esperadas
      </p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 5].map(n => (
          <button key={n} onClick={() => setNPaises(n)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              nPaises === n ? 'border-swu-amber/60 text-swu-amber' : 'border-swu-border text-swu-muted'}`}>
            {n} {n === 1 ? 'sol' : 'soles'}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {(['sistema', 'galaxia'] as const).map(a => (
          <button key={a} onClick={() => setAmplitud(a)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              amplitud === a ? 'border-swu-cyan/60 text-swu-cyan' : 'border-swu-border text-swu-muted'}`}>
            {a}
          </button>
        ))}
      </div>
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
        sistemas={sistemas} seleccion={sel} amplitud={amplitud} onSeleccionar={setSel}
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
