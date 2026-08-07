/* BANCO DE PRUEBAS TEMPORAL de la mesa 3D — no entra en la app.
   Monta MesaEscena con una partida REAL del fixture, sin AuthGate, sin Dexie y
   sin red al VPS: el arte sale de mesa-banco-arte.json (generado del export
   oficial). Sirve para mirar la escena y para contar llamadas de dibujo.

   Instrumenta WebGL a nivel de contexto ANTES de cargar three, igual que
   banco-galaxia.tsx: de ahí salen drawElements/drawArrays y las texturas. */

/* El navegador de pruebas corre con la pestaña en segundo plano
   (document.hidden === true), así que ni el rAF se dispara ni el bucle de la
   escena pasa de su propia compuerta de ahorro. Se desactivan las dos SOLO
   aquí: son justo el comportamiento que la mesa debe tener en la app. */
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true })
Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true })
window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  window.setTimeout(() => cb(performance.now()), 16)) as typeof window.requestAnimationFrame
window.cancelAnimationFrame = ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame

type Cont = WebGLRenderingContext | WebGL2RenderingContext

const M = {
  calls: 0, texturasCreadas: 0, texturasBorradas: 0,
  buffersCreados: 0, buffersBorrados: 0, programas: 0, contextos: 0,
}

const orig = HTMLCanvasElement.prototype.getContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: any, ...resto: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (orig as any).call(this, tipo, ...resto)
  if (ctx && (tipo === 'webgl' || tipo === 'webgl2') && !(ctx as { __medido?: boolean }).__medido) {
    ;(ctx as { __medido?: boolean }).__medido = true
    M.contextos++
    const c = ctx as Cont
    const envolver = <K extends keyof Cont>(k: K, fn: () => void) => {
      const f = c[k] as unknown as (...a: unknown[]) => unknown
      ;(c[k] as unknown) = function (...a: unknown[]) { fn(); return f.apply(c, a) }
    }
    envolver('drawElements', () => { M.calls++ })
    envolver('drawArrays', () => { M.calls++ })
    envolver('createTexture', () => { M.texturasCreadas++ })
    envolver('deleteTexture', () => { M.texturasBorradas++ })
    envolver('createBuffer', () => { M.buffersCreados++ })
    envolver('deleteBuffer', () => { M.buffersBorrados++ })
    envolver('createProgram', () => { M.programas++ })
  }
  return ctx
} as typeof HTMLCanvasElement.prototype.getContext

import { StrictMode, useState, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import './src/index.css'   // sin esto `w-full h-full` de la escena no existe
import { MesaEscena, type ArteCarta } from './src/features/mesa/MesaEscena'
import { PARTIDAS } from './src/features/mesa/partidas.fixture'
import { estadoEn, totalPasos, frase } from './src/features/mesa/reproductor'
import crudoArte from './mesa-banco-arte.json'

const ARTE: Map<string, ArteCarta> = new Map(
  Object.entries(crudoArte as Record<string, ArteCarta>),
)

function Banco() {
  const [cual, setCual] = useState(0)
  const [i, setI] = useState(0)
  const [jugando, setJugando] = useState(false)
  const p = PARTIDAS[cual]
  const total = totalPasos(p)
  const estado = useMemo(() => estadoEn(p, i), [p, i])

  useEffect(() => {
    if (!jugando) return
    if (i >= total) { setJugando(false); return }
    const t = setTimeout(() => setI((x) => x + 1), 380)
    return () => clearTimeout(t)
  }, [jugando, i, total])

  // Se publica para poder leerlo desde el navegador sin tocar la pantalla.
  ;(window as unknown as { __M: typeof M; __i: number }).__M = M
  ;(window as unknown as { __M: typeof M; __i: number }).__i = i

  return (
    <div style={{ padding: 8, maxWidth: 460, margin: '0 auto' }}>
      <div style={{ height: '60vh', minHeight: 340, border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <MesaEscena estado={estado} arte={ARTE} duracion={300} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <button onClick={() => { setI(0); setJugando(false) }}>⏮</button>
        <button onClick={() => setI(Math.max(0, i - 1))}>◀</button>
        <button onClick={() => setJugando(!jugando)}>{jugando ? '⏸' : '▶'}</button>
        <button onClick={() => setI(Math.min(total, i + 1))}>▶|</button>
        <button onClick={() => setI(total)}>⏭</button>
        <select value={cual} onChange={(e) => { setCual(Number(e.target.value)); setI(0) }}>
          {PARTIDAS.map((x, k) => <option key={k} value={k}>{k}: {x.rival} ({x.eventos.length})</option>)}
        </select>
        <span id="paso">{i}/{total}</span>
      </div>
      <input type="range" min={0} max={total} value={i} style={{ width: '100%' }}
        onChange={(e) => { setJugando(false); setI(Number(e.target.value)) }} />
      <p id="frase" style={{ fontSize: 13, minHeight: 34 }}>{frase(estado.ultimo, 'A', 'B')}</p>
      <p id="marcador" style={{ fontSize: 13, fontFamily: 'monospace' }}>
        vida A={Math.max(0, estado.a.vida)} B={Math.max(0, estado.b.vida)} ·
        unidades {estado.a.unidades.length}/{estado.b.unidades.length} ·
        descuadre={String(estado.descuadre)}
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Banco /></StrictMode>)
