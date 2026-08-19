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
import { CartaGirable } from './CartaGirable'
import { PaginaAlbum } from './PaginaAlbum'
import { LupaCarta } from './LupaCarta'
import { ReversoCarta } from './ReversoCarta'
import { Acabado } from './Acabado'
import { AcabadoDeImagen } from './AcabadoDeImagen'
import { CardImage } from '../../components/CardImage'
import { ESCALA, NOMBRE_RAREZA, COLOR_RAREZA, ACABADO, type CartaSacada, type Rareza, type Variante } from '../../services/sobres'
import type { Card } from '../../types'
import type { SeccionAlbum, CasillaAlbum } from '../../services/sobres'

/** Arte real, para poder juzgar el brillo sobre una lámina de verdad. */
const ARTE_PRUEBA =
  'https://cdn.starwarsunlimited.com/card_SWH_01_101_Rogue_Squadron_Skirmisher_e5659ca239.png'

/**
 * Obi-Wan Kenobi Showcase (LOF 1012) — la carta EXACTA donde apareció el fallo
 * del brillo con la forma equivocada. Sus dos caras miden al revés:
 *
 *   frente  400×286  apaisada  (…_Leader_…)
 *   dorso   286×400  vertical  (…_Leader_Unit_…)
 *
 * Es el peor caso del módulo y por eso está en el banco.
 *
 * Ojo con la DOBLE BARRA, y es POR CARTA: la clave de esta empieza por «/», así
 * que su URL lleva `.com//card_…` y con una sola barra devuelve 403. Pero la
 * Rogue Squadron de este mismo archivo es al revés — con una barra da 200 y con
 * dos, 403. La URL viene así del API y NUNCA se debe «limpiar».
 */
const ARTE_APAISADO =
  'https://cdn.starwarsunlimited.com//card_05031012_EN_Obi_Wan_Kenobi_Leader_85186449a0.png'
const ARTE_APAISADO_DORSO =
  'https://cdn.starwarsunlimited.com//card_05031012_EN_Obi_Wan_Kenobi_Leader_Unit_3196d94aa3.png'

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
  hiper: 'Hyperspace Foil',
  prestigio: 'Standard Prestige',
  prestigioFoil: 'Foil Prestige',
  showcase: 'Showcase',
  serializada: 'Serialized Prestige',
}

/** Un sobre con cuatro comunes y un premio de la rareza pedida. */
function sobreDePrueba(premio: Rareza): CartaSacada[] {
  // Cuatro Hyperspace Foil de base, que es como es el sobre desde el recorte
  // del pool: la coleccion entera brilla.
  const base: CartaSacada[] = [0, 1, 2, 3].map(i => ({
    cardId: `c${i}`,
    variante: 'Hyperspace Foil' as Variante,
    rareza: 'hiper' as Rareza,
    premio: false,
    serializada: false,
    carta: cartaFalsa(`Base ${i + 1}`, 100 + i),
    arte: '',
  }))
  base.push({
    cardId: 'premio',
    variante: VARIANTE_DE[premio],
    rareza: premio,
    premio: true,
    serializada: premio === 'serializada',
    carta: cartaFalsa(`Premio ${NOMBRE_RAREZA[premio]}`, 300),
    arte: '',
  })
  return base
}

/**
 * Una sección del álbum de mentira: 14 casillas, unas cuantas tuyas.
 *
 * Existe porque en producción `cartas_desbloqueadas` está en CERO, así que la
 * rejilla del álbum HOY no se puede mirar en ningún lado: todas las casillas
 * salen como hueco y nunca se ve una llena, ni su brillo, ni el número encima,
 * ni la insignia de serializada.
 */
function seccionDePrueba(rareza: Rareza): { seccion: SeccionAlbum; casillas: CasillaAlbum[] } {
  const total = 14
  const casillas: CasillaAlbum[] = Array.from({ length: total }, (_, i) => {
    // Una de cada tres la tenés, y una apaisada de por medio: 7 hojas del
    // álbum real son MIXTAS y ahí es donde el bolsillo fijo se pone a prueba.
    const tenida = i % 3 !== 1
    const lider = i === 2 || i === 5
    const c = cartaFalsa(lider ? `Líder ${i}` : `Carta ${i}`, 767 + i)
    return {
      posicion: i + 1,
      numero: 767 + i,
      cardId: `p${i}`,
      cantidad: i === 4 ? 3 : 1,
      tenida,
      serializada: rareza === 'serializada' && i === 8,
      carta: { ...c, isLeader: lider, imageUrl: lider ? ARTE_APAISADO : ARTE_PRUEBA,
               backImageUrl: lider ? ARTE_APAISADO_DORSO : null },
      arte: lider ? ARTE_APAISADO : ARTE_PRUEBA,
    }
  })
  return {
    seccion: { setCode: 'ASH', variante: VARIANTE_DE[rareza], rareza, total, tenidas: casillas.filter(c => c.tenida).length },
    casillas,
  }
}

export function BancoSobres() {
  const [premio, setPremio] = useState<Rareza>('serializada')
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [cartas, setCartas] = useState<CartaSacada[] | null>(null)
  const [demora, setDemora] = useState(400)
  const [hojaAlbum, setHojaAlbum] = useState(0)
  const [lupa, setLupa] = useState<CasillaAlbum | null>(null)

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
        <>
          <CajaDeSobres alElegir={elegir} />

          {/* La carta girable con su acabado. Va acá porque ni el gesto
              —arrastrar con inercia y pasar de los 90°— ni el brillo se pueden
              juzgar leyendo el código: hay que girarla y mirar. */}
          <div className="mt-10 border-t border-swu-border pt-6">
            <p className="mb-3 text-center text-sm text-swu-muted">
              Carta girable — arrastrala y mirá cómo barre el brillo
            </p>
            <div className="mx-auto max-w-[260px]">
              <CartaGirable
                frente={<CardImage src={ARTE_PRUEBA} alt="Carta de prueba" orientacion="vertical" className="w-full" />}
                acabadoFrente={<AcabadoDeImagen src={ARTE_PRUEBA} acabado={ACABADO[premio]} />}
                dorso={<ReversoCarta color={COLOR_RAREZA[premio]} />}
              />
            </div>
          </div>

          {/* Los tres acabados uno al lado del otro, moviéndose solos: es la
              única forma de ver si de verdad se distinguen entre sí. */}
          <div className="mt-10 border-t border-swu-border pt-6">
            <p className="mb-3 text-center text-sm text-swu-muted">Los tres acabados</p>
            <div className="grid grid-cols-3 gap-3">
              {(['foil', 'metal', 'oro'] as const).map(a => (
                <div key={a}>
                  <div className="relative overflow-hidden rounded-lg">
                    <CardImage src={ARTE_PRUEBA} alt={a} orientacion="vertical" className="w-full" />
                    <Acabado acabado={a} movimiento="solo" />
                  </div>
                  <p className="mt-1 text-center text-[11px] text-swu-muted">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* El álbum. Con datos de mentira porque en producción está vacío y
              no hay otra forma de ver una casilla llena. */}
          <div className="mt-10 border-t border-swu-border pt-6">
            <p className="mb-3 text-center text-sm text-swu-muted">
              Una sección del álbum — arrastrá para pasar hoja
            </p>
            {(() => {
              const { seccion, casillas } = seccionDePrueba(premio)
              return (
                <>
                  <PaginaAlbum
                    seccion={seccion}
                    casillas={casillas}
                    hoja={hojaAlbum}
                    alCambiarHoja={setHojaAlbum}
                    alAbrir={setLupa}
                  />
                  {lupa && (
                    <LupaCarta
                      casilla={lupa}
                      color={COLOR_RAREZA[premio]}
                      acabado={lupa.tenida ? ACABADO[premio] : undefined}
                      alCerrar={() => setLupa(null)}
                    />
                  )}
                </>
              )
            })()}
          </div>

          {/* Y el dorso redibujado, solo. */}
          <div className="mt-10 border-t border-swu-border pt-6">
            <p className="mb-3 text-center text-sm text-swu-muted">El dorso</p>
            <div className="mx-auto w-[200px]">
              <ReversoCarta color={COLOR_RAREZA[premio]} misterio />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
