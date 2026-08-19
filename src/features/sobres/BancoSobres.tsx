/**
 * BANCO DE SOBRES — probar la apertura sin gastar sobres ni tener sesión.
 *
 * Solo en desarrollo, como el resto de los bancos del proyecto. Existe porque
 * la parte cara de revisar de este módulo son los EFECTOS —el rasgado, los
 * rayos, las chispas, el fogonazo, la fanfarria de la serializada— y esos solo
 * se ven abriendo sobres de verdad, que cuestan y que salen al azar: revisar
 * cómo se ve una serializada esperando a que toque una es 1 de cada 33 sobres.
 *
 * Acá se elige la rareza a mano y sale eso.
 */

import { useState } from 'react'
import { CajaDeSobres } from './CajaDeSobres'
import { AperturaSobre } from './AperturaSobre'
import { ESCALA, NOMBRE_RAREZA, type CartaSacada, type Rareza, type Variante } from '../../services/sobres'
import type { Card } from '../../types'

/** Una carta de mentira, con lo justo para que la pantalla la sepa pintar. */
function cartaFalsa(nombre: string, n: number): Card {
  return {
    id: `falsa-${n}`,
    name: nombre,
    subtitle: null,
    type: 'Unit',
    rarity: 'Rare',
    cost: 4,
    power: 3,
    hp: 4,
    aspects: ['Vigilance'],
    traits: [],
    keywords: [],
    arena: 'Ground',
    text: '',
    deployBox: null,
    epicAction: null,
    setCode: 'ASH',
    setNumber: n,
    artist: '',
    // Sin arte: el banco prueba los EFECTOS, no la CDN. El hueco se ve como
    // se vería una carta que el catálogo local todavía no bajó, que también
    // es un caso real que conviene mirar.
    imageUrl: '',
    backImageUrl: null,
    isUnique: false,
    isLeader: false,
    isBase: false,
  }
}

const VARIANTE_DE: Record<Rareza, Variante> = {
  comun: 'Hyperspace',
  brillante: 'Hyperspace Foil',
  rara: 'Showcase',
  epica: 'Foil Prestige',
  unica: 'Serialized Prestige',
}

/** Un sobre con cuatro comunes y un premio de la rareza pedida. */
function sobreDePrueba(premio: Rareza): CartaSacada[] {
  const base: CartaSacada[] = [0, 1, 2].map(i => ({
    cardId: `c${i}`,
    variante: 'Hyperspace' as Variante,
    rareza: 'comun' as Rareza,
    premio: false,
    serializada: false,
    carta: cartaFalsa(`Común ${i + 1}`, 100 + i),
  }))
  base.push({
    cardId: 'foil',
    variante: 'Standard Foil',
    rareza: 'brillante',
    premio: false,
    serializada: false,
    carta: cartaFalsa('El foil', 200),
  })
  base.push({
    cardId: 'premio',
    variante: VARIANTE_DE[premio],
    rareza: premio,
    premio: true,
    serializada: premio === 'unica',
    carta: cartaFalsa(`Premio ${NOMBRE_RAREZA[premio]}`, 300),
  })
  return base
}

export function BancoSobres() {
  const [premio, setPremio] = useState<Rareza>('unica')
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [cartas, setCartas] = useState<CartaSacada[] | null>(null)
  const [demora, setDemora] = useState(400)

  const elegir = (i: number) => {
    setAbriendo(i)
    setCartas(null)
    // Se imita la ida y vuelta al servidor: sin demora nunca se vería el
    // estado «sellando», que es donde vive el riesgo real (el botón de rasgar
    // apareciendo antes de tiempo).
    window.setTimeout(() => setCartas(sobreDePrueba(premio)), demora)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-black text-swu-text">Banco de sobres</h1>
      <p className="mb-4 text-sm text-swu-muted">Solo en desarrollo. Elegí qué premio va a salir.</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {ESCALA.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setPremio(r)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              premio === r ? 'bg-swu-accent text-white' : 'bg-swu-surface text-swu-muted'
            }`}
          >
            {NOMBRE_RAREZA[r]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-swu-muted">
          demora
          <input
            type="number"
            value={demora}
            onChange={e => setDemora(Number(e.target.value))}
            className="w-20 rounded bg-swu-surface px-2 py-1"
          />
          ms
        </label>
      </div>

      {abriendo !== null ? (
        <AperturaSobre
          indiceSobre={abriendo}
          cartas={cartas}
          fallo={null}
          alCerrar={() => {
            setAbriendo(null)
            setCartas(null)
          }}
        />
      ) : (
        <CajaDeSobres alElegir={elegir} />
      )}
    </div>
  )
}
