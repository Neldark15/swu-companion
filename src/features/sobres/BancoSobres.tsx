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
import { FranjaSobreDiario } from './AvisoSobreDiario'
import { TiendaSobres, type AccionesTienda } from './TiendaSobres'
import type { EstadoTienda } from '../../services/tiendaSobres'
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

/**
 * LA TIENDA, sin sesión y sin haber abierto un solo sobre.
 *
 * Vive detrás de DOS puertas —tener cuenta y tener repetidas— así que en el
 * navegador la única forma de verla con carga sería abrir sobres hasta que una
 * carta se repita. Acá las tres situaciones que de verdad existen se eligen a
 * dedo, y las acciones son de mentira pero MUEVEN el estado: canjear vacía el
 * bloque de repetidas y comprar sube el contador del día, que es justo lo que
 * hay que mirar.
 *
 * LOS DATOS SON LOS DE VERDAD, no unos parecidos. La variante es
 * `Serialized Prestige` —así, como la escribe `sobres_pool`— y no
 * «Serializada»: esa cadena inventada es exactamente el error que hizo que la
 * tarifa de la carta más rara no casara con nada y pagara 10 en vez de 150. Un
 * banco con la mentira adentro habría dado verde con el bug puesto (§4y).
 */
const REPETIDAS_DE_PRUEBA = [
  { nombre: 'Rogue Squadron Skirmisher', variante: 'Hyperspace Foil', n: 3, cu: 10 },
  { nombre: 'Vanquish', variante: 'Showcase', n: 2, cu: 25 },
  { nombre: 'Obi-Wan Kenobi', variante: 'Serialized Prestige', n: 1, cu: 150 },
  { nombre: 'Cell Block Guard', variante: 'Standard Prestige', n: 4, cu: 35 },
  { nombre: 'Wing Leader', variante: 'Foil Prestige', n: 2, cu: 50 },
  { nombre: 'Restock', variante: '?', n: 1, cu: 10 },
]

const TARIFAS_DE_PRUEBA: Record<string, number> = {
  'Hyperspace Foil': 10, Showcase: 25, 'Standard Prestige': 35,
  'Foil Prestige': 50, 'Serialized Prestige': 150, '*': 10,
}

function tiendaDePrueba(caso: 'carga' | 'vacia' | 'tope'): EstadoTienda {
  const filas = caso === 'carga'
    ? REPETIDAS_DE_PRUEBA.map((r, i) => ({
        cardId: `rep-${i}`,
        variante: r.variante,
        repetidas: r.n,
        creditosCadaUna: r.cu,
        creditos: r.n * r.cu,
        carta: cartaFalsa(r.nombre, 900 + i),
        arte: ARTE_PRUEBA,
      }))
    : []
  return {
    // «vacía» es el caso de la MAYORÍA: 25 de las 42 cuentas no tienen ni una
    // repetida, y la mediana de créditos no llega a un sobre.
    saldo: caso === 'carga' ? 4467 : caso === 'tope' ? 3000 : 90,
    precio: 250,
    tope: 5,
    hoy: caso === 'tope' ? 5 : 0,
    disponibles: caso === 'carga' ? 2 : 0,
    tarifas: TARIFAS_DE_PRUEBA,
    repetidas: filas,
    repetidasCartas: filas.reduce((s, f) => s + f.repetidas, 0),
    repetidasCreditos: filas.reduce((s, f) => s + f.creditos, 0),
  }
}

/** Una caja mutable, no una `ref`: el linter prohíbe pasarle una ref a una
 *  función durante el render, y acá no hace falta ninguna de las dos cosas que
 *  una ref aporta. */
interface CajaTienda { actual: EstadoTienda }

function accionesDePrueba(caja: CajaTienda): AccionesTienda {
  return {
    recargar: async () => caja.actual,
    canjear: async () => {
      const e = caja.actual
      if (e.repetidasCartas === 0) return { ok: false, mensaje: 'No tenés repetidas para canjear.' }
      const cartas = e.repetidasCartas
      const creditos = e.repetidasCreditos
      caja.actual = {
        ...e, saldo: e.saldo + creditos,
        repetidas: [], repetidasCartas: 0, repetidasCreditos: 0,
      }
      return { ok: true, cartas, creditos, saldo: caja.actual.saldo }
    },
    comprar: async (n: number) => {
      const e = caja.actual
      const costo = e.precio * n
      if (e.tope != null && e.hoy + n > e.tope) {
        return { ok: false, mensaje: `Hoy podés comprar ${e.tope} sobres y ya llevás ${e.hoy}.` }
      }
      if (e.saldo < costo) return { ok: false, mensaje: `Te faltan ${costo - e.saldo} créditos.` }
      caja.actual = {
        ...e, saldo: e.saldo - costo, hoy: e.hoy + n, disponibles: e.disponibles + n,
      }
      return {
        ok: true, sobres: n, costo,
        saldo: caja.actual.saldo, hoy: caja.actual.hoy,
        disponibles: caja.actual.disponibles,
      }
    },
  }
}

/**
 * Una situación, con su caja propia.
 *
 * Va en componente aparte y montado por `key` para que cambiar de situación
 * REMONTE: así la caja nace de cero sin que nadie tenga que mutarla desde un
 * manejador —cosa que el compilador de React prohíbe sobre un valor de
 * `useState`— y de paso el panel vuelve a pedir el estado y se le olvidan el
 * aviso y el paso de confirmación de la situación anterior. Sin eso quedaba un
 * «2 sobres a la bóveda» encima de una tienda vacía.
 */
function CasoDeTienda({ caso }: { caso: 'carga' | 'vacia' | 'tope' }) {
  const [banco] = useState(() => {
    const caja: CajaTienda = { actual: tiendaDePrueba(caso) }
    return { acciones: accionesDePrueba(caja) }
  })
  return <TiendaSobres acciones={banco.acciones} />
}

function BancoTienda() {
  const [caso, setCaso] = useState<'carga' | 'vacia' | 'tope'>('carga')

  /* El estado de mentira vive en una CAJA MUTABLE, y las acciones se arman una
   * sola vez contra ella.
   *
   * Con `useState` + `useMemo` las acciones quedaban congeladas contra el valor
   * del render en que se crearon: canjear cambiaba el estado, pero el
   * `recargar()` que el panel llama justo después seguía devolviendo el
   * ANTERIOR. En pantalla se veía «13 copias cambiadas por 480 créditos» encima
   * de un bloque que seguía diciendo 13 copias y 480 créditos — el banco
   * mintiendo sobre un componente que está bien (§4r). Leyendo la caja, las
   * acciones ven siempre lo último, que es lo que hace el servidor de verdad. */

  return (
    <div className="mt-10 border-t border-swu-border pt-6">
      <p className="mb-2 text-center text-sm text-swu-muted">La tienda</p>
      <div className="mb-2 flex flex-wrap justify-center gap-2">
        {([
          ['carga', 'con repetidas'],
          ['vacia', 'sin nada (25 de 42)'],
          ['tope', 'tope del día alcanzado'],
        ] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCaso(id)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              caso === id ? 'bg-swu-accent text-white' : 'bg-swu-surface text-swu-muted'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {/* `key` por caso: remonta el panel. Sin eso, su aviso y su paso de
          confirmación quedarían hablando de la situación anterior —un «2 sobres
          a la bóveda» encima de una tienda vacía— y además no volvería a
          pedir el estado. */}
      <CasoDeTienda key={caso} caso={caso} />
    </div>
  )
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

          {/* La franja del sobre diario. En producción solo aparece el día que
              el cron reparte y una sola vez por aparato: sin esto, revisarla
              sería esperar a las 8 de la mañana con una cuenta de verdad.
              Se dibujan los DOS textos porque el singular y el plural son
              cadenas distintas y la de uno solo no se ve casi nunca. */}
          <div className="mt-10 border-t border-swu-border pt-6">
            <p className="mb-1 text-center text-sm text-swu-muted">La franja del sobre diario</p>
            <div className="-mx-4">
              <FranjaSobreDiario saldo={1} alAbrir={() => {}} alCerrar={() => {}} />
              <FranjaSobreDiario saldo={173} alAbrir={() => {}} alCerrar={() => {}} />
            </div>
          </div>

          <BancoTienda />

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
