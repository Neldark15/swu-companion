import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { useMenosMovimiento } from './efectos'
import './lupaCarta.css'

interface Props {
  frente: ReactNode
  dorso: ReactNode
  acabadoFrente?: ReactNode
  acabadoDorso?: ReactNode
  ratio?: number
  ratioDorso?: number
  className?: string
}

const limitar = (v: number, limite: number) => Math.max(-limite, Math.min(limite, v))

export function CartaGirable({
  frente, dorso, acabadoFrente, acabadoDorso, ratio = 286 / 400, ratioDorso = ratio, className = '',
}: Props) {
  const reducido = useMenosMovimiento()
  const caja = useRef<HTMLDivElement>(null)
  const ladoAnunciado = useRef<HTMLOutputElement>(null)
  const giro = useRef({ x: 0, y: 0 })
  const velocidad = useRef({ x: 0, y: 0 })
  const dedo = useRef<{ id: number; x: number; y: number; t: number } | null>(null)
  const raf = useRef(0)

  const detener = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const pintar = useCallback(() => {
    const el = caja.current
    if (!el) return
    const { x, y } = giro.current
    const atras = Math.abs(Math.round(y / 180) % 2) === 1
    el.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
    el.style.setProperty('--px', String(Math.sin(y * Math.PI / 180)))
    el.style.setProperty('--py', String(x / 48))
    if (el.dataset.cara !== (atras ? 'dorso' : 'frente')) {
      el.dataset.cara = atras ? 'dorso' : 'frente'
      if (ladoAnunciado.current) ladoAnunciado.current.textContent = atras ? 'Reverso de la carta' : 'Frente de la carta'
      el.children[0].setAttribute('aria-hidden', String(atras))
      el.children[1].setAttribute('aria-hidden', String(!atras))
    }
  }, [])

  const voltear = () => {
    detener()
    dedo.current = null
    const desde = { ...giro.current }
    const hasta = (Math.round(desde.y / 180) + 1) * 180
    if (reducido) {
      giro.current = { x: 0, y: hasta }
      pintar()
      return
    }
    const inicio = performance.now()
    const avanzar = (t: number) => {
      const fraccion = Math.min(1, (t - inicio) / 460)
      const resto = (1 - fraccion) ** 3
      giro.current = { x: desde.x * resto, y: hasta + (desde.y - hasta) * resto }
      pintar()
      if (fraccion < 1) raf.current = requestAnimationFrame(avanzar)
    }
    raf.current = requestAnimationFrame(avanzar)
  }

  const empezar = (e: PointerEvent<HTMLDivElement>) => {
    if (reducido || dedo.current || !e.isPrimary || e.button !== 0) return
    detener()
    dedo.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
    velocidad.current = { x: 0, y: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const p = dedo.current
    if (!p || p.id !== e.pointerId) return
    const dx = (e.clientX - p.x) * 0.8
    const dy = (p.y - e.clientY) * 0.38
    const dt = Math.max(8, e.timeStamp - p.t)
    velocidad.current = { x: limitar(dy / dt, 0.5), y: limitar(dx / dt, 1.4) }
    giro.current.y += dx
    giro.current.x = limitar(giro.current.x + dy, 48)
    dedo.current = { id: p.id, x: e.clientX, y: e.clientY, t: e.timeStamp }
    pintar()
  }

  const soltar = (e: PointerEvent<HTMLDivElement>) => {
    const p = dedo.current
    if (!p || p.id !== e.pointerId) return
    dedo.current = null
    if (e.timeStamp - p.t > 90) return
    let anterior = performance.now()
    const rodar = (t: number) => {
      const dt = Math.min(40, Math.max(0, t - anterior))
      anterior = t
      const v = velocidad.current
      const roce = Math.exp(-dt / 126)
      giro.current.y += v.y * 126 * (1 - roce)
      giro.current.x = limitar(giro.current.x + v.x * 126 * (1 - roce), 48)
      v.x *= roce
      v.y *= roce
      pintar()
      if (Math.abs(v.x) + Math.abs(v.y) > 0.008) raf.current = requestAnimationFrame(rodar)
    }
    raf.current = requestAnimationFrame(rodar)
  }
  const cancelar = (e: PointerEvent<HTMLDivElement>) => {
    if (dedo.current?.id === e.pointerId) dedo.current = null
  }

  useEffect(() => {
    if (reducido) {
      dedo.current = null
      giro.current = { x: 0, y: Math.round(giro.current.y / 180) * 180 }
    }
    pintar()
    return detener
  }, [reducido, pintar, detener])

  // Cada cara ocupa su rectángulo impreso dentro de un escenario fijo. Un líder
  // apaisado puede girar hacia su unidad vertical sin mover el botón ni el texto.
  const ancho = Math.max(Math.min(1, ratio), Math.min(1, ratioDorso))
  const alto = Math.max(Math.min(1, 1 / ratio), Math.min(1, 1 / ratioDorso))
  const medidaCara = (r: number): CSSProperties => ({
    width: `${100 * Math.min(1, r) / ancho}%`,
    height: `${100 * Math.min(1, 1 / r) / alto}%`,
  })
  return (
    <div className={`carta-girable select-none ${className}`}>
      <div className="carta-girable-escena" style={{ aspectRatio: String(ancho / alto), '--ancho-carta': ancho } as CSSProperties}
        onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar}
        onPointerCancel={cancelar} onLostPointerCapture={cancelar}
        onDoubleClick={voltear} onDragStart={e => e.preventDefault()}>
        <div ref={caja} className="carta-girable-objeto">
          <div className="carta-girable-cara" style={medidaCara(ratio)}>{frente}{acabadoFrente}</div>
          <div className="carta-girable-cara carta-girable-dorso" style={medidaCara(ratioDorso)}>{dorso}{acabadoDorso}</div>
        </div>
      </div>
      <output aria-live="polite" className="sr-only" ref={ladoAnunciado} />
      <button type="button" onClick={voltear} className="carta-girable-voltear">
        <RotateCw size={16} aria-hidden /> Darle la vuelta
      </button>
    </div>
  )
}
