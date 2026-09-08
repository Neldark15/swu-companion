/** Presentación y edición compartidas por el taller real y su banco DEV.
 * Las compras y el guardado se inyectan: este componente no conoce las RPC. */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Gem, Package, RotateCw, Volume2, VolumeX } from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import type { Acabado, ParteTaller, Taller } from '../../services/sableService'
import { SableEscena, type Encuadre, type Orientacion } from './SableEscena'
import { MiniaturaPieza } from './MiniaturaPieza'
import { ConsejoHuyang } from './ConsejoHuyang'
import { colorDeHoja, materialDe, piezasDeSable, type Diseno } from './partesSable'
import { PASOS, RANURAS_MANGO, deltaDe, pesoDeRareza, rarezaDe, sumarStats, type Paso, type Stats } from './kyber'
import {
  afinarZumbido, alternarSilencioSable, arrancarZumbido, pararZumbido,
  sableEnSilencio, sonarApagado, sonarEncendido, sonarPieza,
} from './sonidoSable'
import './tallerKyber.css'

export interface TallerKyberProps {
  taller: Taller
  diseno: Diseno
  nombre: string
  ocupado: boolean
  aviso: string | null
  alCambiarDiseno: Dispatch<SetStateAction<Diseno>>
  alCambiarNombre: (nombre: string) => void
  alElegirParte: (parte: ParteTaller) => void | Promise<void>
  alGuardar: () => void | Promise<void>
  alLimpiarAviso: () => void
  /** Recuperación de lectura; no impide equipar las piezas ya confirmadas. */
  alReintentarAviso?: () => void
  refrescando?: boolean
  comprasBloqueadas?: boolean
  /** Rótulo visible, sonido inicialmente apagado y guardado explícito local. */
  demo?: boolean
  pasoInicial?: Paso
}

type RanuraMango = Exclude<ParteTaller['tipo'], 'color'>
const CAMPOS_ACABADO = {
  emisor: 'acabadoEmisor', cuerpo: 'acabadoCuerpo', pomo: 'acabadoPomo',
} as const

function TiraAcabados({ acabados, actual, alElegir }: {
  acabados: Acabado[]; actual: string | null; alElegir: (id: string | null) => void
}) {
  return (
    <div className="kyber-acabados kyber-carrusel" aria-label="Acabado de la pieza" tabIndex={0}>
      {[{ id: null, nombre: 'Original' }, ...acabados].map(a => {
        const m = a.id ? materialDe(a.id) : null
        return (
          <button key={a.id ?? 'original'} type="button" className="kyber-acabado"
            aria-pressed={actual === a.id} onClick={() => alElegir(a.id)}>
            <span className="kyber-muestra" style={{
              background: m?.plano ?? 'linear-gradient(135deg, #aeb6c0 0 50%, #2b2e35 50%)',
              borderColor: m?.borde ?? '#a0a6ad',
            }} />
            {a.nombre.toLocaleLowerCase('es-SV')}
          </button>
        )
      })}
    </div>
  )
}

function TarjetaPieza({ parte, puesta, ocupado, delta, tonoHoja, alElegir }: {
  parte: ParteTaller; puesta: boolean; ocupado: boolean; delta: Stats | null
  tonoHoja: string; alElegir: () => void
}) {
  const r = rarezaDe(parte.rareza)
  const cambios = delta ? ([['potencia', 'pot'], ['control', 'ctrl'], ['energia', 'ener']] as const)
    .filter(([campo]) => delta[campo] !== 0) : []
  const descripcionCambios = delta ? cambios.map(([campo]) =>
    `${campo === 'energia' ? 'energía' : campo}: ${delta[campo] > 0 ? 'más' : 'menos'} ${Math.abs(delta[campo])}`,
  ).join(', ') : ''
  return (
    <button type="button" className="kyber-pieza" data-rareza={r.clave}
      aria-pressed={puesta} disabled={ocupado} onClick={alElegir}
      aria-label={`${parte.nombre}, ${r.rotulo}. ${puesta ? 'Equipada' : parte.tengo ? 'Equipar' : `Comprar por ${parte.precio} créditos`}.${descripcionCambios ? ` Cambios: ${descripcionCambios}.` : ''}`}>
      <span className="kyber-pieza-cabecera">
        <span className="kyber-rareza">{r.rotulo}</span>
        {puesta && <Check size={15} aria-hidden="true" />}
      </span>
      <span className="kyber-pieza-identidad">
        {parte.tipo === 'color'
          ? <Gem size={35} strokeWidth={1.2} style={{ color: colorDeHoja(parte.id).halo }} aria-hidden="true" />
          : <MiniaturaPieza tipo={parte.tipo} id={parte.id} size={46} colorHoja={tonoHoja} />}
        <span className="kyber-pieza-nombre">{parte.nombre.toLocaleLowerCase('es-SV')}</span>
      </span>
      <span className={`kyber-pieza-estado${!parte.tengo ? ' kyber-precio' : ''}`}>
        {puesta ? 'Equipada' : parte.tengo ? 'La tenés · equipar' : <>
          <CreditoIcon size={13} /> {parte.precio.toLocaleString('es-SV')} · comprar
        </>}
      </span>
      {cambios.length > 0 && delta && (
        <span className="kyber-deltas">
          {cambios.map(([campo, rotulo]) => <span key={campo} data-sube={delta[campo] > 0}>
            {delta[campo] > 0 ? '+' : ''}{delta[campo]} {rotulo}
          </span>)}
        </span>
      )}
    </button>
  )
}

export function TallerKyber({
  taller, diseno, nombre, ocupado, aviso, alCambiarDiseno, alCambiarNombre,
  alElegirParte, alGuardar, alLimpiarAviso, demo = false, pasoInicial = 'piezas',
  alReintentarAviso, refrescando = false, comprasBloqueadas = false,
}: TallerKyberProps) {
  const [paso, setPaso] = useState<Paso>(pasoInicial)
  const [ranura, setRanura] = useState<RanuraMango>('emisor')
  const [encuadre, setEncuadre] = useState<Encuadre>('detalle')
  const [orientacion, setOrientacion] = useState<Orientacion>('diagonal')
  const [sinWebGL, setSinWebGL] = useState(false)
  const [silencio, setSilencio] = useState(() => demo || sableEnSilencio())
  const hubo = useRef(false)
  const encendido = paso === 'prueba'
  const tonoHoja = colorDeHoja(diseno.color).halo
  const partes = taller.partes
  const puestas = [diseno.emisor, diseno.cuerpo, diseno.pomo, diseno.color]
  const stats = sumarStats(partes, puestas)
  const catalogo = useMemo(() => [...partes].sort((a, b) =>
    pesoDeRareza(a.rareza) - pesoDeRareza(b.rareza) || a.precio - b.precio || a.orden - b.orden,
  ), [partes])
  const cristales = catalogo.filter(p => p.tipo === 'color')
  const cristal = cristales.find(c => c.id === diseno.color)
  const tonoCristal = cristal ? 0.86 + (cristal.orden - 1) * 0.075 : 1
  const lista = catalogo.filter(p => p.tipo === (paso === 'cristal' ? 'color' : ranura))
  const resumenMaterial = [...new Set(piezasDeSable(diseno).map(p =>
    taller.acabados.find(a => a.id === p.material)?.nombre.toLocaleLowerCase('es-SV') ?? p.material,
  ))].join(' · ')

  useEffect(() => {
    if (encendido && !silencio) {
      if (hubo.current) afinarZumbido(tonoCristal)
      else sonarEncendido()
      arrancarZumbido(tonoCristal)
    } else {
      pararZumbido()
      if (!silencio && hubo.current) sonarApagado()
    }
    hubo.current = encendido
    return () => { pararZumbido() }
  }, [encendido, silencio, tonoCristal])

  function irAlPaso(siguiente: Paso) { setPaso(siguiente); alLimpiarAviso() }
  function alternarSonido() {
    const siguiente = !silencio
    // El banco empieza mudo sin tocar la preferencia. El primer gesto explícito
    // sí sincroniza el motor, aunque la cuenta se hubiera silenciado antes.
    if (sableEnSilencio() !== siguiente) alternarSilencioSable()
    setSilencio(siguiente)
  }
  function elegir(parte: ParteTaller) {
    if (!silencio && parte.tengo) sonarPieza()
    void alElegirParte(parte)
  }

  return (
    <div className="kyber-taller" data-paso={paso} aria-busy={ocupado || refrescando}>
      {demo && <p className="kyber-demo">Demo local · catálogo de prueba · sin compras reales</p>}
      <header className="kyber-cabecera">
        <Link className="kyber-icono" to="/" aria-label="Volver a Inicio"><ChevronLeft size={23} /></Link>
        <h1>Taller Kyber</h1>
        <button type="button" className="kyber-icono" aria-pressed={!silencio}
          aria-label={silencio ? 'Activar sonido' : 'Silenciar sonido'}
          onClick={alternarSonido}>
          {silencio ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      </header>

      <nav className="kyber-pasos" aria-label="Pasos del taller">
        {PASOS.map(p => <button key={p.id} type="button" aria-current={p.id === paso ? 'step' : undefined}
          onClick={() => irAlPaso(p.id)}>
          <span className="kyber-paso-numero">{p.n}</span><span>{p.rotulo}</span>
        </button>)}
      </nav>

      <div className="kyber-area-trabajo">
        <section className="kyber-vista" aria-label="Vista del sable">
          <div className="kyber-visor">
            {sinWebGL ? <div className="kyber-sin-webgl" role="status">
              <Gem size={34} aria-hidden="true" />
              <p>La vista 3D no está disponible en este navegador.</p>
              <span>Podés seguir eligiendo piezas, colores y forjar tu sable.</span>
            </div> : <SableEscena diseno={diseno} encendido={encendido} explotado={paso === 'piezas'}
              orientacion={orientacion} vista={paso === 'cristal' ? 'cristal' : 'sable'}
              encuadre={encuadre} onSinWebGL={() => setSinWebGL(true)} className="kyber-lienzo" />}
            {!sinWebGL && <span className="kyber-gesto"><RotateCw size={12} /> Arrastrá para girar</span>}
            {!sinWebGL && paso !== 'cristal' && <label className="kyber-orientacion">
              <span className="kyber-sr">Orientación del sable</span>
              <select value={orientacion} onChange={e => setOrientacion(e.target.value as Orientacion)}>
                <option value="diagonal">Diagonal</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option>
              </select>
            </label>}
          </div>
          {paso === 'prueba' && <div className="kyber-encuadre" role="group" aria-label="Encuadre de la vista">
            {(['detalle', 'completo'] as const).map(e => <button key={e} type="button"
              aria-pressed={encuadre === e} disabled={sinWebGL} onClick={() => setEncuadre(e)}>
              {e === 'detalle' ? 'Detalle' : 'Completo'}
            </button>)}
          </div>}
        </section>

        <section className="kyber-seleccion" aria-label={`Paso ${PASOS.find(p => p.id === paso)?.rotulo}`}>
          {(paso === 'piezas' || paso === 'cristal') && <>
            <div className="kyber-inventario">
              <span>{paso === 'piezas' ? 'Armá tu empuñadura' : 'Elegí tu cristal'}</span>
              <span className="kyber-saldo" aria-label={comprasBloqueadas ? 'Saldo pendiente de actualizar' : `${taller.saldo.toLocaleString('es-SV')} créditos`}>
                <CreditoIcon size={15} /> {comprasBloqueadas ? 'Pendiente' : taller.saldo.toLocaleString('es-SV')}
              </span>
            </div>
            {paso === 'piezas' && <div className="kyber-ranuras" role="group" aria-label="Pieza del mango">
              {RANURAS_MANGO.map(r => <button key={r.tipo} type="button" aria-pressed={ranura === r.tipo}
                onClick={() => setRanura(r.tipo as RanuraMango)}>{r.rotulo}</button>)}
            </div>}
            <div key={paso === 'cristal' ? 'cristales' : ranura} className="kyber-carrusel kyber-piezas"
              tabIndex={0} role="group" aria-label={paso === 'cristal' ? 'Catálogo de cristales' : `Catálogo de ${ranura}`}>
              {lista.map(p => <TarjetaPieza key={p.id} parte={p} puesta={diseno[p.tipo] === p.id}
                ocupado={ocupado || (comprasBloqueadas && !p.tengo)} tonoHoja={tonoHoja} delta={deltaDe(partes, puestas, p)} alElegir={() => elegir(p)} />)}
              {lista.length === 0 && <p className="kyber-ayuda">No hay piezas disponibles en esta categoría.</p>}
            </div>
            {paso === 'piezas' && <div className="kyber-acabado-panel">
              <p className="kyber-etiqueta">Acabado de {ranura === 'cuerpo' ? 'la empuñadura' : `este ${ranura}`}</p>
              <TiraAcabados acabados={taller.acabados} actual={diseno[CAMPOS_ACABADO[ranura]] ?? null}
                alElegir={id => alCambiarDiseno(d => ({ ...d, [CAMPOS_ACABADO[ranura]]: id }))} />
            </div>}
            {paso === 'cristal' && <button type="button" className="kyber-cristal-visto" aria-pressed={!!diseno.cristalVisto}
              onClick={() => alCambiarDiseno(d => ({ ...d, cristalVisto: !d.cristalVisto }))}>
              <Gem size={19} style={{ color: tonoHoja }} /><span>Cristal a la vista <small>Ventanas en la empuñadura · gratis</small></span>
              <span className="kyber-interruptor" aria-hidden="true" />
            </button>}
          </>}

          {paso === 'color' && <div className="kyber-color-panel">
            <h2>El color de tu hoja</h2><p className="kyber-ayuda">Elegí entre tus cristales. Para conseguir otro, volvé a Cristal.</p>
            <div className="kyber-colores" role="group" aria-label="Colores de tus cristales">
              {cristales.filter(c => c.tengo).map(c => <button key={c.id} type="button" aria-pressed={diseno.color === c.id}
                onClick={() => alCambiarDiseno(d => ({ ...d, color: c.id }))}>
                <span className="kyber-muestra" style={{ background: colorDeHoja(c.id).halo }} />
                <span>{c.nombre.toLocaleLowerCase('es-SV')}</span>{diseno.color === c.id && <Check size={15} />}
              </button>)}
            </div>
          </div>}

          {paso === 'prueba' && <div className="kyber-prueba">
            <p className="kyber-resumen">{resumenMaterial}<span>{cristal?.nombre.toLocaleLowerCase('es-SV') ?? 'Cristal'}</span></p>
            <button type="button" className="kyber-principal" disabled={ocupado} onClick={() => void alGuardar()}>
              {ocupado ? 'Forjando…' : demo ? 'Guardar prueba local' : 'Forjar mi sable'}
            </button>
            <details className="kyber-nombre-opcional">
              <summary>{nombre.trim() ? `Nombre: ${nombre.trim()}` : 'Ponéle nombre (opcional)'}</summary>
              <label className="kyber-nombre" htmlFor="kyber-nombre">Nombre del sable
                <input id="kyber-nombre" value={nombre} maxLength={40} placeholder="Sin nombre"
                  onChange={e => alCambiarNombre(e.target.value.slice(0, 40))} />
              </label>
            </details>
          </div>}

          {(aviso || refrescando) && <div className="kyber-aviso" role="status">
            {aviso && <p>{aviso}</p>}
            {refrescando && <p>Actualizando saldo e inventario…</p>}
            {alReintentarAviso && <button type="button" className="kyber-siguiente" disabled={refrescando || ocupado}
              onClick={alReintentarAviso}>{refrescando ? 'Actualizando…' : 'Actualizar saldo e inventario'}</button>}
          </div>}
          {paso !== 'prueba' && <button type="button" className="kyber-siguiente"
            onClick={() => irAlPaso(PASOS[PASOS.findIndex(p => p.id === paso) + 1].id)}>
            {paso === 'piezas' ? 'Elegir cristal' : paso === 'cristal' ? 'Elegir color' : 'Probar mi sable'}<ChevronRight size={17} />
          </button>}
        </section>
      </div>

      <div className="kyber-detalles">
        <dl className="kyber-stats" aria-label="Características del sable">
          {([['potencia', 'Potencia'], ['control', 'Control'], ['energia', 'Energía']] as const).map(([campo, rotulo]) =>
            <div key={campo}><dt>{rotulo}</dt><dd>{stats[campo]}</dd></div>)}
        </dl>
        <p className="kyber-nota-stats">Los stats describen tu sable. No afectan las partidas ni el ranking.</p>
        <div className="kyber-consejo"><ConsejoHuyang key={paso} paso={paso} /></div>
        {!demo && <details className="kyber-creditos">
          <summary><CreditoIcon size={16} /> Cómo se ganan créditos</summary>
          <dl>{[
            ['Abrir un sobre en Sobredosis', '50'], ['Cada acierto de la Trivia', '2'],
            ['Jugar un torneo', '500'], ['Misiones del día', 'Según la misión'],
          ].map(([que, cuanto]) => <div key={que}><dt>{que}</dt><dd>{cuanto}</dd></div>)}</dl>
          <p>Todo lo que da XP, da créditos. Gastarlos nunca te baja de nivel.</p>
        </details>}
        <p className="kyber-coleccion"><Package size={13} /> {demo ? `${taller.cuantasHay} piezas de prueba` : `${taller.cuantasTengo} de ${taller.cuantasHay} piezas conseguidas · Nivel ${taller.nivel}`}</p>
      </div>
    </div>
  )
}
