import { useCallback, useEffect, useRef, useState } from 'react'
import { ScanPage } from './ScanPage'
import { db } from '../../services/db'
import { marcosDeCamara } from '../../services/encuadreEscaner'
import { ResumenFaltantesMazo } from '../decks/PanelFaltantesMazo'
import { calcularFaltantesMazo } from '../decks/faltantesMazo'
import type { Card } from '../../types'
import datos from '../../../scripts/fixtures/escaner/cartas.json'

// El import y la ruta del banco están detrás de DEV. Ninguna imagen de
// prueba ni esta cámara simulada debe entrar en el precache de producción.
const imagenes = import.meta.glob('../../../scripts/fixtures/escaner/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cartas: Card[] = datos.map(c => ({
  ...c, type: c.type as Card['type'], rarity: 'Common', cost: null, power: null, hp: null,
  aspects: [], traits: [], keywords: [], arena: null, text: '', deployBox: null, epicAction: null,
  artist: '', imageUrl: imagenes[`../../../scripts/fixtures/escaner/${c.imagen}`], backImageUrl: null,
  isUnique: false, isLeader: c.type === 'Leader', isBase: c.type === 'Base', isCanonical: true,
}))
const prepararCatalogo = async () => { await db.cards.bulkPut(cartas) }
const copias = new Map<string, number>()
const leerCantidad = async (id: string) => copias.get(id) ?? 0
const guardarCantidad = async (id: string, cantidad: number) => { copias.set(id, cantidad); return true }

export function BancoEscaner() {
  const [seleccion, setSeleccion] = useState('')
  const [vertical, setVertical] = useState(true)
  const [imagenesListas, setImagenesListas] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const obtenerCanvas = useCallback(() => canvasRef.current ?? (canvasRef.current = document.createElement('canvas')), [])
  const fuentes = useRef(new Map<string, HTMLImageElement>())
  const seleccionRef = useRef(seleccion)
  const streams = useRef<MediaStream[]>([])
  useEffect(() => { seleccionRef.current = seleccion }, [seleccion])
  useEffect(() => {
    let activo = true
    void Promise.all(cartas.map(c => new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => { fuentes.current.set(c.id, img); resolve() }
      img.onerror = () => reject(new Error(`Fixture ausente: ${c.name}`))
      img.src = c.imageUrl
    }))).then(() => { if (activo) setImagenesListas(true) })
    return () => { activo = false }
  }, [])
  useEffect(() => {
    const canvas = obtenerCanvas()
    canvas.width = vertical ? 720 : 1280
    canvas.height = vertical ? 1280 : 720
    const ctx = canvas.getContext('2d')!
    const pintar = () => {
      ctx.fillStyle = '#484544'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const carta = cartas.find(c => c.id === seleccionRef.current)
      const img = carta && fuentes.current.get(carta.id)
      if (!carta || !img) return
      const m = marcosDeCamara(canvas.width, canvas.height)[carta.isLeader || carta.isBase ? 1 : 0]
      ctx.drawImage(img, m.x * canvas.width, m.y * canvas.height, m.w * canvas.width, m.h * canvas.height)
    }
    pintar()
    const timer = setInterval(pintar, 100)
    return () => clearInterval(timer)
  }, [obtenerCanvas, vertical])
  useEffect(() => () => { streams.current.forEach(s => s.getTracks().forEach(t => t.stop())) }, [])
  const crearCamara = useCallback(async () => {
    const stream = obtenerCanvas().captureStream(10)
    streams.current.push(stream)
    return { stream, tieneLinterna: false }
  }, [obtenerCanvas])
  const resultado = calcularFaltantesMazo({ leaders: [], base: null,
    mainDeck: [{ ...cartas[0], cardId: cartas[0].id, quantity: 3 }], sideboard: [{ ...cartas[1], cardId: cartas[1].id, quantity: 2 }],
  }, cartas, [{ cardId: cartas[0].id, quantity: 1, profileId: 'banco' }], 'banco', true)

  return <>
    <div className="max-w-lg mx-auto p-4 space-y-3 bg-swu-surface text-swu-text">
      <p className="text-xs">Prueba local · Cámara simulada · Guardados en memoria</p>
      <label className="block text-sm">Carta frente a la cámara
        <select aria-label="Carta de prueba" value={seleccion} onChange={e => setSeleccion(e.target.value)}
          className="block w-full p-2 bg-swu-bg border border-swu-border rounded-lg">
          <option value="">Mesa vacía</option>
          {cartas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <button className="text-xs underline" onClick={() => setVertical(v => !v)}>Girar cámara simulada</button>
      <ResumenFaltantesMazo resultado={resultado} alReintentar={() => {}} />
    </div>
    {imagenesListas && <ScanPage key={String(vertical)} crearCamara={crearCamara} prepararCatalogo={prepararCatalogo}
      leerCantidad={leerCantidad} guardarCantidad={guardarCantidad} />}
  </>
}
