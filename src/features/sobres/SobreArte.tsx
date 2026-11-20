import { useId } from 'react'

export const ANCHO = 200
export const ALTO = 300

interface Props {
  indice: number
  abierto?: boolean
  className?: string
}

const TINTAS = [0, 47, 112, 156, 236, 292]
const CORTE = 'M0 55 L18 52 25 55 37 50 49 53 58 49 67 52 81 46 92 49 105 45 118 48 129 43 144 46 156 42 166 44 178 40 189 42 200 39'

export function SobreArte({ indice, abierto = false, className = '' }: Props) {
  const id = useId()
  const papel = (
    <image href="/sobres/paquete-foil.webp" width={ANCHO} height={ALTO}
      style={{ filter: `hue-rotate(${TINTAS[indice % TINTAS.length]}deg)` }} />
  )
  const canto = <path d={CORTE} fill="none" stroke="#dde9e9" strokeWidth="1.4" />
  return (
    <svg viewBox="0 0 200 300" className={className} aria-hidden="true" focusable="false"
      style={{ display: 'block', width: '100%', height: '100%', overflow: abierto ? 'visible' : 'hidden' }}>
      {abierto ? <>
        <defs>
          <clipPath id={`${id}-tapa`}><path d={`${CORTE} V0 H0 Z`} /></clipPath>
          <clipPath id={`${id}-funda`}><path d={`${CORTE} V300 H0 Z`} /></clipPath>
          <clipPath id={`${id}-canto`}><path d="M18 30 H183 V62 H18 Z" /></clipPath>
        </defs>
        <g className="sobre-solapa"><g clipPath={`url(#${id}-tapa)`}>
          {papel}<g clipPath={`url(#${id}-canto)`}>{canto}</g>
        </g></g>
        <g className="sobre-funda"><g clipPath={`url(#${id}-funda)`}>
          {papel}<g clipPath={`url(#${id}-canto)`}>{canto}</g>
        </g></g>
      </> : papel}
    </svg>
  )
}
