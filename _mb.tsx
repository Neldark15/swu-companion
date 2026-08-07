/* Banco TEMPORAL de verificación de la Mesa 3D. No es producción; se borra.
 *
 * Monta la pantalla REAL (MesaPage) con la red y la sesión sustituidas, porque
 * /partida del VPS está caído y /mesa está detrás de login. Los datos que come
 * son partidas REALES del motor, generadas en esta sesión.
 */
import './src/index.css'
import { createRoot, type Root } from 'react-dom/client'
import { createElement, StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as THREE from 'three'
import { MesaPage } from './src/features/mesa/MesaPage'
import { supabase } from './src/services/supabase'
import { db } from './src/services/db'
import PARTIDAS from './_mb-datos.json'

/* ── 1 · Instrumentación WebGL: se engancha ANTES de que exista contexto ── */
const cuenta = { texturaC: 0, texturaD: 0, bufferC: 0, bufferD: 0, progC: 0, progD: 0, vaoC: 0, vaoD: 0 }
let dibujos = 0
let triangulos = 0
const getCtxOrig = HTMLCanvasElement.prototype.getContext
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(HTMLCanvasElement.prototype as any).getContext = function (tipo: string, ...resto: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gl = (getCtxOrig as any).call(this, tipo, ...resto)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = gl as any
  if (g && (tipo === 'webgl' || tipo === 'webgl2') && !g.__instrumentado) {
    g.__instrumentado = true
    const pares: [string, keyof typeof cuenta][] = [
      ['createTexture', 'texturaC'], ['deleteTexture', 'texturaD'],
      ['createBuffer', 'bufferC'], ['deleteBuffer', 'bufferD'],
      ['createProgram', 'progC'], ['deleteProgram', 'progD'],
      ['createVertexArray', 'vaoC'], ['deleteVertexArray', 'vaoD'],
    ]
    for (const [m, k] of pares) {
      if (typeof g[m] !== 'function') continue
      const o = g[m].bind(gl)
      g[m] = (...a: unknown[]) => { cuenta[k]++; return o(...a) }
    }
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      if (typeof g[m] !== 'function') continue
      const o = g[m].bind(gl)
      g[m] = (...a: unknown[]) => {
        dibujos++
        if (m.startsWith('drawElements')) triangulos += Math.floor(Number(a[1]) / 3)
        else triangulos += Math.floor(Number(a[2]) / 3)
        return o(...a)
      }
    }
  }
  return gl
}

/* ── 2 · Capturar la instancia del renderer (los exports son de solo lectura) ── */
const renderers = new Set<THREE.WebGLRenderer>()
const origRender = THREE.WebGLRenderer.prototype.render
// eslint-disable-next-line @typescript-eslint/no-explicit-any
THREE.WebGLRenderer.prototype.render = function (this: THREE.WebGLRenderer, ...a: any[]) {
  renderers.add(this)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (origRender as any).apply(this, a)
}
const origDispose = THREE.WebGLRenderer.prototype.dispose
THREE.WebGLRenderer.prototype.dispose = function (this: THREE.WebGLRenderer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__ultimoAntesDeDisponer = JSON.parse(JSON.stringify(this.info))
  renderers.delete(this)
  return origDispose.apply(this)
}

/* ── 3 · Sonda de fps sobre rAF ─────────────────────────────────────── */
const marcas: number[] = []
let midiendo = false
const rafOrig = window.requestAnimationFrame.bind(window)
window.requestAnimationFrame = (cb: FrameRequestCallback) =>
  rafOrig((t) => { if (midiendo) marcas.push(t); cb(t) })

/* ── 4 · Red y sesión sustituidas ───────────────────────────────────── */
const RIVALES = [{ slug: 'cad-bane', lider: 'Cad Bane | Still Faster Than You', base: 'Nevarro City, Restored', jugador: 'JamesUgly', record: '13-1-1' }]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listaPartidas = Object.values(PARTIDAS as any)
let cual = 0
const fetchOrig = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/api/sim')) {
    const body = JSON.parse(String(init?.body ?? '{}'))
    if (body.action === 'rivales') return new Response(JSON.stringify({ rivales: RIVALES }), { status: 200 })
    if (body.action === 'partida') {
      const p = listaPartidas[(body.n ?? 0) % listaPartidas.length]
      cual = (body.n ?? 0) % listaPartidas.length
      return new Response(JSON.stringify(p), { status: 200 })
    }
    return new Response(JSON.stringify({ error: 'no' }), { status: 400 })
  }
  return fetchOrig(input as RequestInfo, init)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(supabase.auth as any).getSession = async () => ({ data: { session: { access_token: 'banco' } }, error: null })

/* ── 5 · Montaje ────────────────────────────────────────────────────── */
let raiz: Root | null = null
const nodo = document.getElementById('raiz')!

async function sembrarMazo() {
  const hay = await db.decks.count()
  if (hay > 0) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.decks.put({
    id: 'banco-mazo', name: 'GROGU MK5 (banco)', format: 'premier',
    leaders: [{ id: 'l', name: 'Grogu', subtitle: 'Charming Companion', quantity: 1 }],
    base: { id: 'b', name: 'Jedi Temple', subtitle: null, quantity: 1 },
    mainDeck: [], sideboard: [], createdAt: Date.now(), updatedAt: Date.now(),
  } as any)
}

function montar(strict = false) {
  if (raiz) return
  raiz = createRoot(nodo)
  const arbol = createElement(MemoryRouter, { initialEntries: ['/mesa'] }, createElement(MesaPage))
  raiz.render(strict ? createElement(StrictMode, null, arbol) : arbol)
}
function desmontar() {
  raiz?.unmount()
  raiz = null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const W = window as any
W.__montar = montar
W.__desmontar = desmontar
W.__cuenta = cuenta
W.__info = () => {
  const r = [...renderers][0]
  return r ? JSON.parse(JSON.stringify(r.info)) : null
}
W.__resetDibujos = () => { dibujos = 0; triangulos = 0 }
W.__dibujos = () => ({ dibujos, triangulos })
W.__fpsInicio = () => { marcas.length = 0; midiendo = true }
W.__fpsFin = () => {
  midiendo = false
  // Varias rAF del mismo fotograma comparten timestamp: dedupe o los deltas 0
  // inflarían la media.
  const t = marcas.filter((x, i) => i === 0 || x !== marcas[i - 1])
  const d: number[] = []
  for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1])
  if (d.length === 0) return { n: 0 }
  const orden = [...d].sort((a, b) => a - b)
  const media = d.reduce((s, x) => s + x, 0) / d.length
  const pct = (q: number) => orden[Math.min(orden.length - 1, Math.floor(orden.length * q))]
  return {
    fotogramas: d.length,
    fpsMedia: +(1000 / media).toFixed(1),
    peorMs: +orden[orden.length - 1].toFixed(1),
    peorFps: +(1000 / orden[orden.length - 1]).toFixed(1),
    p95ms: +pct(0.95).toFixed(1),
    p50ms: +pct(0.5).toFixed(1),
    bajo30: d.filter((x) => x > 33.4).length,
  }
}
W.__cual = () => cual
W.__decks = async () => { try { return (await db.decks.toArray()).map((d) => d.name) } catch (e) { return 'ERR ' + String(e) } }
W.__db = db

sembrarMazo().then(() => montar())
