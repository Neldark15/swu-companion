/* BANCO DE PRUEBAS TEMPORAL — se borra al terminar la verificacion.
   Monta la GalaxiaPage REAL fuera del AuthGate e instrumenta WebGL a nivel de
   contexto (drawElements/drawArrays + create/deleteBuffer/Texture), que es de
   donde three saca renderer.info. */

// ── 1. Instrumentacion de WebGL, ANTES de cargar nada de la app ──
type Cont = WebGLRenderingContext | WebGL2RenderingContext

interface Medidor {
  calls: number
  triangles: number
  points: number
  lines: number
  buffersVivos: number
  texturasVivas: number
  buffersCreados: number
  buffersBorrados: number
  texturasCreadas: number
  texturasBorradas: number
  programas: number
  contextos: number
  ctxs: Cont[]
}

const M: Medidor = {
  calls: 0, triangles: 0, points: 0, lines: 0,
  buffersVivos: 0, texturasVivas: 0,
  buffersCreados: 0, buffersBorrados: 0,
  texturasCreadas: 0, texturasBorradas: 0,
  programas: 0, contextos: 0, ctxs: [],
}
;(window as unknown as { __M: Medidor }).__M = M

function contarDibujo(gl: Cont, mode: number, count: number, inst: number): void {
  M.calls++
  const n = count * inst
  if (mode === gl.TRIANGLES) M.triangles += n / 3
  else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) M.triangles += Math.max(0, n - 2 * inst)
  else if (mode === gl.LINES) M.lines += n / 2
  else if (mode === gl.LINE_STRIP) M.lines += Math.max(0, n - inst)
  else if (mode === gl.POINTS) M.points += n
}

function instrumentar(gl: Cont): Cont {
  type Any = Record<string, unknown>
  const g = gl as unknown as Any
  const env = (nombre: string, envoltorio: (orig: (...a: unknown[]) => unknown) => (...a: unknown[]) => unknown) => {
    const orig = g[nombre] as ((...a: unknown[]) => unknown) | undefined
    if (typeof orig !== 'function') return
    const atado = orig.bind(gl)
    g[nombre] = envoltorio(atado)
  }

  env('drawElements', o => (...a) => { contarDibujo(gl, a[0] as number, a[1] as number, 1); return o(...a) })
  env('drawArrays', o => (...a) => { contarDibujo(gl, a[0] as number, a[2] as number, 1); return o(...a) })
  env('drawElementsInstanced', o => (...a) => { contarDibujo(gl, a[0] as number, a[1] as number, a[4] as number); return o(...a) })
  env('drawArraysInstanced', o => (...a) => { contarDibujo(gl, a[0] as number, a[2] as number, a[3] as number); return o(...a) })

  env('createBuffer', o => (...a) => { M.buffersCreados++; M.buffersVivos++; return o(...a) })
  env('deleteBuffer', o => (...a) => { M.buffersBorrados++; M.buffersVivos--; return o(...a) })
  env('createTexture', o => (...a) => { M.texturasCreadas++; M.texturasVivas++; return o(...a) })
  env('deleteTexture', o => (...a) => { M.texturasBorradas++; M.texturasVivas--; return o(...a) })
  env('createProgram', o => (...a) => { M.programas++; return o(...a) })
  return gl
}

const getContextOrig = HTMLCanvasElement.prototype.getContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, attrs?: any): any {
  const ctx = getContextOrig.call(this, tipo as 'webgl2', attrs)
  if (ctx && (tipo === 'webgl2' || tipo === 'webgl' || tipo === 'experimental-webgl')) {
    const c = ctx as unknown as Cont
    if (!M.ctxs.includes(c)) {
      M.contextos++
      M.ctxs.push(c)
      instrumentar(c)
      ;(window as unknown as { __GL: Cont }).__GL = c
    }
  }
  return ctx
}

// ── 2. La app ──
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { GalaxiaPage } from './src/features/galaxia/GalaxiaPage'
import './src/index.css'

function Puente() {
  const nav = useNavigate()
  ;(window as unknown as { __ir: (p: string) => void }).__ir = p => nav(p)
  return null
}

function Vacio() {
  return <div style={{ padding: 24, color: '#9ca3af' }} id="pantalla-vacia">fuera de la galaxia</div>
}

createRoot(document.getElementById('root')!).render(
  // Sin StrictMode a proposito: el doble montaje de desarrollo falsearia el
  // conteo de fugas. Lo que se mide aca es el montaje real de produccion.
  <MemoryRouter initialEntries={['/galaxia']}>
    <Puente />
    <Routes>
      <Route path="/galaxia" element={<GalaxiaPage />} />
      <Route path="*" element={<Vacio />} />
    </Routes>
  </MemoryRouter>,
)
void StrictMode
