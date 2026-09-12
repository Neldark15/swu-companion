import { lazy, Suspense, useId, useRef, useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Crosshair, Expand, History,
  Minus, Plus, RotateCcw, Settings2, Shield, Sparkles, Swords, Undo2,
  Users, Volume2, VolumeX, X, Zap, Orbit, Repeat2,
} from 'lucide-react'
import {
  CLAVE_CALCULADORA, crearMesa, cambiarVida, cambiarFuerza, deshacer, leerMesa,
  puedeTomarFicha, siguienteRonda, tomarFicha,
  type BaseCalculadora, type FichaCalculadora, type JugadorCalculadora, type MesaCalculadora, type ModoCalculadora,
} from './estadoCalculadora'
import { CardImage } from '../../components/CardImage'
import { DigitosVida } from './DigitosVida'
import { useConsola } from './useConsola'
import './calculadora.css'

const COLORES = ['#67e8f9', '#ffb85c', '#b2a0ff', '#80efad']
const SelectorBaseCalculadora = lazy(() => import('./SelectorBaseCalculadora').then(m => ({ default: m.SelectorBaseCalculadora })))
interface JugadorPreparacion { nombre: string; maxVida: string; base: BaseCalculadora | null }
const FICHAS = {
  iniciativa: { nombre: 'Iniciativa', Icono: Zap, ayuda: 'Tomás la iniciativa y pasás tus acciones restantes de esta fase.' },
  blast: { nombre: 'Explosión', Icono: Crosshair, ayuda: 'Hacé 1 de daño a cada base rival y pasá tus acciones restantes. Anotá el daño con los controles de cada base.' },
  plan: { nombre: 'Plan', Icono: Orbit, ayuda: 'Robá una carta, poné una carta de tu mano debajo del mazo y pasá tus acciones restantes.' },
}
const CLAVE_OPCIONES = 'swu_calculadora_opciones_v1'
interface Opciones { sonido: boolean; efectos: boolean; enfrentados: boolean }
function leerOpciones(): Opciones {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE_OPCIONES) ?? '{}') as Partial<Opciones> | null
    return { sonido: o?.sonido === true, efectos: o?.efectos !== false, enfrentados: o?.enfrentados === true }
  } catch { return { sonido: false, efectos: true, enfrentados: false } }
}
function cargarMesa() {
  try { return leerMesa(localStorage.getItem(CLAVE_CALCULADORA)) } catch { return null }
}
type Panel = 'registro' | 'ajustes' | 'nueva' | 'ronda' | null
type Impacto = { delta: number; secuencia: number }

function Dialogo({ titulo, cerrar, children }: { titulo: string; cerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialogo = ref.current
    dialogo?.showModal()
    return () => { dialogo?.close() }
  }, [])
  return <dialog ref={ref} className="calc-dialogo" aria-labelledby={id}
    onCancel={e => { e.preventDefault(); cerrar() }}
    onClick={e => { if (e.target === e.currentTarget) cerrar() }}>
    <div className="calc-dialogo-interior">
      <header><h2 id={id}>{titulo}</h2><button className="calc-icono" aria-label="Cerrar panel" onClick={cerrar}><X size={20} /></button></header>
      {children}
    </div>
  </dialog>
}

function Reactor({ vida, maxVida, impacto, editar }: { vida: number; maxVida: number; impacto?: Impacto; editar?: () => void }) {
  return <div className="calc-reactor">
    <div className="calc-aura" />
    <svg className="calc-anillo" viewBox="0 0 240 240" aria-hidden="true">
      <circle className="calc-orbita" cx="120" cy="120" r="113" pathLength="100" strokeDasharray="18 6 2 6 36 6 2 6 12 6" />
      <circle className="calc-guia" cx="120" cy="120" r="101" />
      <circle className="calc-carga" cx="120" cy="120" r="101" pathLength="100" strokeDasharray={`${vida / maxVida * 100} 100`} transform="rotate(-90 120 120)" />
      <circle className="calc-marcas" cx="120" cy="120" r="91" pathLength="100" strokeDasharray="0.4 2.1" />
    </svg>
    <button className="calc-lectura" onClick={editar} disabled={!editar} aria-label={`Vida ${vida} de ${maxVida}. Ajustar cantidad exacta`}>
      <span className="calc-micro">VIDA DE LA BASE</span>
      <span key={vida} className="calc-numero"><DigitosVida valor={vida} /></span>
      <span className="calc-capacidad">{vida === 0 ? 'BASE DESTRUIDA' : `DE ${maxVida}`}<span className="calc-cruz"> + </span></span>
    </button>
    {impacto && <div className={`calc-impacto ${impacto.delta > 0 ? 'es-cura' : ''}`} key={impacto.secuencia} aria-hidden="true">
      <i className="calc-onda" /><i className="calc-destello" />
      {Array.from({ length: 8 }, (_, i) => <i key={i} className="calc-particula" style={{ '--angulo': `${i * 45}deg` } as CSSProperties} />)}
      <strong className="calc-delta">{impacto.delta > 0 ? '+' : '−'}{Math.abs(impacto.delta)}</strong>
    </div>}
  </div>
}

function Jugador({ jugador, indice, impacto, invertir, fichas, ajustar, editar, fuerza }: {
  jugador: JugadorCalculadora; indice: number; impacto?: Impacto; invertir: boolean;
  fichas: FichaCalculadora[]; ajustar: (delta: number) => void; editar: () => void; fuerza?: () => void;
}) {
  const destruida = jugador.vida === 0
  return <section className={`calc-jugador ${jugador.base ? 'con-base' : ''} ${invertir ? 'invertido' : ''} ${destruida ? 'destruido' : ''}`}
    style={{ '--jugador': COLORES[indice] } as CSSProperties} aria-label={`Base de ${jugador.nombre}`}>
    {jugador.base?.imagen && <div className="calc-base-arte" aria-hidden="true"><CardImage src={jugador.base.imagen} alt="" orientacion="apaisada" fit="cover" relleno={false} className="calc-base-fondo" /></div>}
    <div className="calc-jugador-fondo" aria-hidden="true" />
    <div className="calc-jugador-contenido">
      <header className="calc-jugador-nombre"><span className="calc-asiento">0{indice + 1}</span><div className="calc-identidad"><h2>{jugador.nombre}</h2>{jugador.base && <span title={jugador.base.nombre}>{jugador.base.nombre}</span>}</div>
        <span className="calc-estado-base" title={destruida ? 'Base destruida' : fichas.includes('iniciativa') ? 'Conserva la iniciativa' : 'Base activa'}>{fichas.includes('iniciativa') ? <Zap size={14} /> : <Shield size={14} />}</span>
      </header>
      <div className="calc-reactor-fila">
        <button className="calc-ajustar calc-menos" disabled={destruida} aria-label={`Hacer 1 de daño a ${jugador.nombre}`} onClick={() => ajustar(-1)}><Minus /></button>
        <Reactor vida={jugador.vida} maxVida={jugador.maxVida} impacto={impacto} editar={editar} />
        <button className="calc-ajustar calc-mas" disabled={destruida || jugador.vida === jugador.maxVida} aria-label={`Curar 1 a ${jugador.nombre}`} onClick={() => ajustar(1)}><Plus /></button>
      </div>
      <div className="calc-jugador-pie">
        <button disabled={destruida} aria-label={`Hacer 5 de daño a ${jugador.nombre}`} onClick={() => ajustar(-5)}>−5 <span>DAÑO</span></button>
        {fuerza ? <button type="button" className={`calc-fuerza${jugador.fuerza ? ' activa' : ''}`} disabled={destruida}
          aria-pressed={jugador.fuerza} aria-label={`${jugador.fuerza ? 'Usar la Fuerza' : 'Crear ficha de Fuerza'} de ${jugador.nombre}`}
          title={jugador.fuerza ? 'Usar la Fuerza: gastar tu ficha' : 'Crear tu ficha cuando una carta lo indique'} onClick={fuerza}>
          <span className="calc-fuerza-orbe" aria-hidden="true"><Orbit size={21} /></span>
          <span className="calc-fuerza-texto"><strong>Fuerza</strong><small>{jugador.fuerza ? 'Disponible' : 'Sin ficha'}</small></span>
        </button> : <span className="calc-fichas-jugador">{fichas.length ? fichas.map(f => {
          const { Icono, nombre } = FICHAS[f]
          return <span key={f} title={nombre}><Icono size={13} /><span>{nombre}</span></span>
        }) : <span className="calc-senal"><i /><i /><i /><i /><i /></span>}</span>}
        <button disabled={destruida || jugador.vida === jugador.maxVida} aria-label={`Curar 5 a ${jugador.nombre}`} onClick={() => ajustar(5)}>+5 <span>CURAR</span></button>
      </div>
    </div>
  </section>
}

export function CalculadoraPage({ modoInicial }: { modoInicial?: ModoCalculadora }) {
  const [mesa, setMesa] = useState<MesaCalculadora | null>(cargarMesa)
  const actual = useRef(mesa)
  const [configurando, setConfigurando] = useState(() => !mesa || Boolean(modoInicial && mesa.modo !== modoInicial))
  const [modo, setModo] = useState<ModoCalculadora>(modoInicial ?? mesa?.modo ?? 'premier')
  const [cuantos, setCuantos] = useState<3 | 4>(mesa?.jugadores.length === 3 ? 3 : 4)
  const [jugadores, setJugadores] = useState<JugadorPreparacion[]>(() => Array.from({ length: 4 }, (_, i) => ({
    nombre: mesa?.jugadores[i]?.nombre ?? `Jugador ${i + 1}`, maxVida: String(mesa?.jugadores[i]?.maxVida ?? 30),
    base: mesa?.jugadores[i]?.base ?? null,
  })))
  const [basePara, setBasePara] = useState<number | null>(null)
  const [opciones, setOpciones] = useState<Opciones>(leerOpciones)
  const [panel, setPanel] = useState<Panel>(null)
  const [ficha, setFicha] = useState<FichaCalculadora | null>(null)
  const [editarId, setEditarId] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [impactos, setImpactos] = useState<Record<string, Impacto>>({})
  const secuencia = useRef(0)
  const [aviso, setAviso] = useState('')
  const [guardado, setGuardado] = useState(true)
  const { completa, visible, pantallaCompleta, pulso } = useConsola(Boolean(mesa) && !configurando, opciones.sonido)
  const total = modo === 'premier' ? 2 : cuantos
  const editando = mesa?.jugadores.find(j => j.id === editarId)
  const finalTwin = mesa?.modo === 'twin-suns' && mesa.jugadores.some(j => j.vida === 0)
  const terminadoPremier = mesa?.modo === 'premier' && mesa.jugadores.some(j => j.vida === 0)
  const puedeAvanzar = Boolean(mesa && !finalTwin && !terminadoPremier && mesa.ronda < 9999)

  function actualizar(nueva: MesaCalculadora) {
    actual.current = nueva
    try { localStorage.setItem(CLAVE_CALCULADORA, JSON.stringify(nueva)); setGuardado(true) }
    catch { setGuardado(false) }
    setMesa(nueva)
  }
  function opcion(clave: keyof Opciones) {
    const nuevas = { ...opciones, [clave]: !opciones[clave] }
    setOpciones(nuevas)
    try { localStorage.setItem(CLAVE_OPCIONES, JSON.stringify(nuevas)) } catch { /* Las opciones funcionan en memoria. */ }
  }
  function empezar() {
    const nueva = crearMesa(modo, jugadores.slice(0, total).map(j => ({ nombre: j.nombre, maxVida: Number(j.maxVida), base: j.base })))
    actualizar(nueva)
    setImpactos({}); setPanel(null); setConfigurando(false); setAviso('')
    pulso(true)
  }
  function ajustar(id: string, delta: number) {
    const antes = actual.current
    if (!antes) return
    const nueva = cambiarVida(antes, id, delta)
    if (nueva === antes) return
    const diferencia = nueva.jugadores.find(j => j.id === id)!.vida - antes.jugadores.find(j => j.id === id)!.vida
    actualizar(nueva)
    secuencia.current += 1
    setImpactos(prev => ({ ...prev, [id]: { delta: diferencia, secuencia: secuencia.current } }))
    pulso(delta > 0)
  }
  function cambiarJugador(indice: number, clave: 'nombre' | 'maxVida', valor: string) {
    setJugadores(prev => prev.map((j, i) => i === indice ? { ...j, [clave]: valor } : j))
  }
  function alternarFuerza(id: string) {
    const antes = actual.current
    const jugador = antes?.jugadores.find(j => j.id === id)
    if (!antes || !jugador) return
    const nueva = cambiarFuerza(antes, id, !jugador.fuerza)
    if (nueva === antes) return
    actualizar(nueva)
    pulso(!jugador.fuerza)
  }
  function elegirBase(base: BaseCalculadora | null) {
    if (basePara === null) return
    setJugadores(prev => prev.map((j, i) => i === basePara ? { ...j, base, maxVida: base ? String(base.vidaImpresa) : j.maxVida } : j))
    setBasePara(null)
  }
  function reclamar(id: string) {
    if (!actual.current || !ficha) return
    actualizar(tomarFicha(actual.current, id, ficha)); setFicha(null); pulso(true)
  }
  function abrirSiguienteRonda() {
    if (!puedeAvanzar) return
    setFicha(null)
    setPanel('ronda')
  }
  function avanzarRonda() {
    const antes = actual.current
    if (!antes || antes.jugadores.some(j => j.vida === 0) || antes.ronda >= 9999) return
    actualizar(siguienteRonda(antes))
    setPanel(null)
    pulso(true)
  }
  const opcionesBotones = <>
    <button className="calc-icono" onClick={() => opcion('sonido')} aria-label={opciones.sonido ? 'Silenciar sonido' : 'Activar sonido'} aria-pressed={opciones.sonido}>{opciones.sonido ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
    {document.fullscreenEnabled && <button className="calc-icono" onClick={() => void pantallaCompleta().catch(() => setAviso('El navegador no pudo ampliar la pantalla. Podés seguir jugando en esta vista.'))}
      aria-label={completa ? 'Salir de pantalla completa' : 'Activar pantalla completa'} aria-pressed={completa}><Expand size={19} /></button>}
  </>

  return <main className={`calc-app ${configurando ? 'en-configuracion' : 'en-partida'}`} data-efectos={opciones.efectos ? 'si' : 'no'} data-pausa={!visible ? 'si' : 'no'}>
    <div className="calc-estrellas" aria-hidden="true" />
    <header className="calc-cabecera">
      <Link className="calc-icono" to="/" aria-label="Volver a Inicio"><ArrowLeft size={19} /></Link>
      <div className="calc-marca"><span className="calc-marca-icono"><Orbit size={22} /></span><div>HOLOCRON<span>CONSOLA DE COMBATE</span></div></div>
      <div className="calc-cabecera-acciones">{opcionesBotones}</div>
    </header>

    {configurando ? <div className="calc-configuracion">
      <div className="calc-presentacion">
        <div className="calc-eyebrow"><i /> MODO CASUAL · EN TU DISPOSITIVO</div>
        <h1>Tu mesa.<br /><span>Otra dimensión.</span></h1>
        <p>Las cartas sobre la mesa.<br />Toda la energía del juego, en tu pantalla.</p>
        <div className="calc-demo" style={{ '--jugador': COLORES[0] } as CSSProperties} aria-hidden="true"><Reactor vida={30} maxVida={30} /></div>
        <span className="calc-demo-leyenda"><Sparkles size={14} /> DAÑO, LUZ Y ENERGÍA EN CADA TOQUE</span>
      </div>
      <form className="calc-preparar" onSubmit={e => { e.preventDefault(); if (mesa) setPanel('nueva'); else empezar() }}>
        <div className="calc-form-titulo"><span>01 / CONFIGURÁ LA MESA</span>{mesa && <button type="button" onClick={() => setConfigurando(false)}>Reanudar <ArrowRight size={14} /></button>}</div>
        <div className="calc-modos">
          <button type="button" aria-pressed={modo === 'premier'} onClick={() => setModo('premier')}><Swords size={22} /><strong>Premier</strong><span>Duelo · 2 jugadores</span>{modo === 'premier' && <Check size={14} />}</button>
          <button type="button" aria-pressed={modo === 'twin-suns'} onClick={() => setModo('twin-suns')}><Users size={22} /><strong>Twin Suns</strong><span>Mesa · 3 o 4 jugadores</span>{modo === 'twin-suns' && <Check size={14} />}</button>
        </div>
        {modo === 'twin-suns' && <div className="calc-cuantos"><span>Jugadores en la mesa</span>{([3, 4] as const).map(n => <button key={n} type="button" aria-pressed={cuantos === n} onClick={() => setCuantos(n)}>{n}</button>)}</div>}
        <div className="calc-campos-cabecera"><span>JUGADORES</span><span>VIDA INICIAL</span></div>
        <div className="calc-jugadores-form">{jugadores.slice(0, total).map((j, i) => <div className="calc-preparacion-jugador" key={i} style={{ '--jugador': COLORES[i] } as CSSProperties}><div className="calc-jugador-form">
          <span className="calc-asiento">0{i + 1}</span>
          <input aria-label={`Nombre del jugador ${i + 1}`} maxLength={32} value={j.nombre} placeholder={`Jugador ${i + 1}`} onChange={e => cambiarJugador(i, 'nombre', e.target.value)} />
          <label><Shield size={14} /><input aria-label={`Vida inicial del jugador ${i + 1}`} type="number" inputMode="numeric" min={1} max={999} step={1} required readOnly={Boolean(j.base)} value={j.maxVida} onChange={e => cambiarJugador(i, 'maxVida', e.target.value)} /></label>
        </div><button type="button" className="calc-elegir-base" aria-label={`Elegir base del jugador ${i + 1}`} onClick={() => setBasePara(i)}>
          {j.base ? <CardImage src={j.base.imagen} alt="" orientacion="apaisada" relleno={false} className="calc-base-miniatura" /> : <Shield size={20} />}
          <span><strong>{j.base?.nombre ?? 'Elegir una base'}</strong><small>{j.base ? `${j.base.vidaImpresa} de vida impresa${modo === 'premier' && j.base.usaFuerza ? ' · Fuerza' : ''} · Cambiar` : 'Imagen y vida de tu carta'}</small></span><ChevronRight size={15} />
        </button></div>)}</div>
        <p className="calc-ayuda">Al elegir una base se usa su vida impresa. También podés jugar con vida manual.</p>
        {modo === 'premier' && jugadores.slice(0, 2).some(j => j.base?.usaFuerza) && <p className="calc-ayuda">Tu ficha de Fuerza aparece junto a la vida: tocala para crearla cuando una carta lo indique y otra vez para usarla. Se conserva entre rondas.</p>}
        <button type="button" className="calc-opcion-linea" aria-pressed={opciones.enfrentados} onClick={() => opcion('enfrentados')}><Repeat2 size={18} /><span>Frente a frente<small>Girá los paneles de quienes están enfrente.</small></span><i className="calc-switch" /></button>
        <button className="calc-empezar" type="submit"><Zap size={19} /> ENCENDER LA MESA <ArrowRight size={19} /></button>
        <div className="calc-nota"><Shield size={12} /> Sin cuenta · Guardado local · Sin puntos de ranking</div>
        <Link className="calc-acceso-registrado" to="/contador/registrado"><History size={16} /><span>Duelo registrado<small>Partidas anteriores, Amistosas y Misiones</small></span><ChevronRight size={15} /></Link>
      </form>
    </div> : mesa && <>
      <div className="calc-barra-ronda">
        <div className="calc-ronda"><span>{mesa.modo === 'premier' ? 'PREMIER' : 'TWIN SUNS'}</span><strong>Ronda {String(mesa.ronda).padStart(2, '0')}</strong></div>
        <div className="calc-fichas">{(mesa.modo === 'premier' ? ['iniciativa'] as const : ['iniciativa', 'blast', 'plan'] as const).map(f => {
          const { nombre, Icono } = FICHAS[f]
          const duenio = mesa.jugadores.findIndex(j => j.id === mesa.fichas[f])
          const tomada = mesa.reclamadas.includes(f)
          return <button key={f} className={tomada ? 'reclamada' : ''} style={duenio >= 0 ? { '--ficha': COLORES[duenio] } as CSSProperties : undefined}
            onClick={() => setFicha(f)} aria-label={`${nombre}: ${tomada ? `tomada por ${mesa.jugadores[duenio].nombre}` : `disponible${duenio >= 0 ? `; inicia ${mesa.jugadores[duenio].nombre}` : ''}`}`}><Icono size={17} /><span className="calc-ficha-etiqueta"><span>{nombre}</span><small>{tomada ? 'Tomada' : 'Disponible'}</small></span>{duenio >= 0 && <b>{duenio + 1}</b>}</button>
        })}</div>
        <button className="calc-siguiente-ronda" onClick={abrirSiguienteRonda} disabled={!puedeAvanzar} aria-label="Siguiente ronda: restablecer fichas"><RotateCcw size={17} /><strong>Siguiente ronda</strong><span>Restablecer fichas</span><ChevronRight size={16} /></button>
      </div>
      {(finalTwin || terminadoPremier) && <div className="calc-final" role="status"><Shield size={17} /><span>{finalTwin ? 'Fase final: al terminar esta fase gana la base con más vida. Empates comparten victoria. Anotá +5 al eliminador, si corresponde.' : `Base destruida. ${mesa.jugadores.find(j => j.vida > 0)?.nombre ?? 'Sin sobrevivientes'}${mesa.jugadores.some(j => j.vida > 0) ? ' gana el duelo.' : '.'}`} <small>¿Fue un toque accidental? Usá Deshacer.</small></span></div>}
      <div className={`calc-tablero jugadores-${mesa.jugadores.length}`}>
        {mesa.jugadores.map((j, i) => <Jugador key={j.id} jugador={j} indice={i} impacto={impactos[j.id]}
          invertir={opciones.enfrentados && (mesa.jugadores.length === 4 ? i < 2 : i === 0)}
          fichas={(Object.keys(FICHAS) as FichaCalculadora[]).filter(f => mesa.fichas[f] === j.id)}
          fuerza={mesa.modo === 'premier' && j.base?.usaFuerza ? () => alternarFuerza(j.id) : undefined}
          ajustar={delta => ajustar(j.id, delta)} editar={() => { setEditarId(j.id); setCantidad('1') }} />)}
      </div>
      <footer className="calc-herramientas">
        <button disabled={!mesa.historial.length} onClick={() => { if (actual.current) actualizar(deshacer(actual.current)); setImpactos({}); pulso(true) }}><Undo2 size={20} /><span>Deshacer</span></button>
        <button onClick={() => setPanel('registro')}><History size={20} /><span>Registro</span></button>
        <button aria-pressed={opciones.enfrentados} onClick={() => opcion('enfrentados')}><Repeat2 size={20} /><span>Girar mesa</span></button>
        <button aria-pressed={opciones.efectos} onClick={() => opcion('efectos')}><Sparkles size={20} /><span>Efectos</span></button>
        <button onClick={() => setPanel('ajustes')}><Settings2 size={20} /><span>Ajustes</span></button>
      </footer>
      <span className="calc-sr" role="status" aria-live="polite">{mesa.historial.at(-1)?.descripcion}</span>
    </>}

    {(!guardado || aviso) && <div className="calc-aviso" role="alert">{!guardado ? 'No se pudo guardar en este dispositivo. Mantené abierta la calculadora para conservar la partida.' : aviso}<button aria-label="Cerrar aviso" onClick={() => setAviso('')} disabled={!guardado}><X size={16} /></button></div>}
    {panel === 'registro' && mesa && <Dialogo titulo="Registro de la mesa" cerrar={() => setPanel(null)}><p className="calc-ayuda">Últimos 100 movimientos. Deshacer restaura también las fichas y la ronda.</p><ol className="calc-registro">{mesa.historial.length ? mesa.historial.slice().reverse().map((m, i) => <li key={i}><span>{String(mesa.historial.length - i).padStart(2, '0')}</span>{m.descripcion}</li>) : <li>La mesa está lista. Todavía no hay movimientos.</li>}</ol></Dialogo>}
    {panel === 'ajustes' && <Dialogo titulo="Ajustes de la consola" cerrar={() => setPanel(null)}>
      {([{ clave: 'sonido', titulo: 'Sonido de energía', texto: 'Un pulso suave para daño y curación.', Icono: Volume2 }, { clave: 'efectos', titulo: 'Efectos animados', texto: 'Órbitas, ondas de choque y partículas.', Icono: Sparkles }, { clave: 'enfrentados', titulo: 'Frente a frente', texto: 'Paneles superiores girados 180°.', Icono: Repeat2 }] as const).map(o => <button className="calc-opcion-linea" key={o.clave} aria-pressed={opciones[o.clave]} onClick={() => opcion(o.clave)}><o.Icono size={20} /><span>{o.titulo}<small>{o.texto}</small></span><i className="calc-switch" /></button>)}
      <p className="calc-ayuda">La preferencia de movimiento reducido de tu dispositivo siempre se respeta. La pantalla se mantiene encendida cuando tu navegador lo permite.</p>
      <button className="calc-secundario" onClick={() => { setPanel(null); setConfigurando(true) }}><RotateCcw size={17} /> Preparar otra partida</button>
      <Link className="calc-acceso-registrado" to="/contador/registrado"><History size={16} /><span>Duelo registrado<small>Partidas anteriores, Amistosas y Misiones</small></span><ChevronRight size={15} /></Link>
    </Dialogo>}
    {panel === 'nueva' && <Dialogo titulo="¿Encender una nueva mesa?" cerrar={() => setPanel(null)}><p>Esto reemplaza la partida guardada en este dispositivo y su registro.</p><button className="calc-empezar" onClick={empezar}>Empezar nueva partida <ArrowRight size={18} /></button><button className="calc-secundario" onClick={() => setPanel(null)}>Conservar la partida anterior</button></Dialogo>}
    {panel === 'ronda' && mesa && <Dialogo titulo={`Pasar a ronda ${mesa.ronda + 1}`} cerrar={() => setPanel(null)}><p>Cuando todos hayan terminado el reagrupamiento, confirmá para restablecer las fichas.</p><p className="calc-ayuda">{mesa.modo === 'twin-suns' ? 'Explosión y Plan vuelven al centro. ' : ''}La iniciativa conserva su dueño, pero puede reclamarse de nuevo. Todos vuelven a poder tomar una ficha. Las vidas se conservan.{mesa.modo === 'premier' && mesa.jugadores.some(j => j.base?.usaFuerza) && ' Las fichas de Fuerza se conservan hasta usarlas.'}</p><button className="calc-empezar" disabled={!puedeAvanzar} onClick={avanzarRonda}>Siguiente ronda <ArrowRight size={18} /></button></Dialogo>}
    {ficha && mesa && <Dialogo titulo={FICHAS[ficha].nombre} cerrar={() => setFicha(null)}><p>{FICHAS[ficha].ayuda}</p><p className="calc-ficha-estado">{mesa.reclamadas.includes(ficha) ? `Ya tomada en la ronda ${mesa.ronda}. Volverá a estar disponible en la siguiente ronda.` : ficha === 'iniciativa' && mesa.fichas.iniciativa ? `${mesa.jugadores.find(j => j.id === mesa.fichas.iniciativa)?.nombre} conserva la iniciativa. Se puede reclamar de nuevo en esta ronda.` : 'Disponible para quien todavía no haya tomado otra ficha en esta ronda.'}</p><p className="calc-ayuda">Una ficha por jugador en cada ronda. Este control registra quién la tomó; los efectos se resuelven en la mesa.</p><div className="calc-elegir-jugador">{mesa.jugadores.map((j, i) => <button style={{ '--jugador': COLORES[i] } as CSSProperties} key={j.id} disabled={!puedeTomarFicha(mesa, j.id, ficha)} onClick={() => reclamar(j.id)}><span className="calc-asiento">0{i + 1}</span>{j.nombre}<span>{mesa.fichas[ficha] === j.id && mesa.reclamadas.includes(ficha) ? 'La tomó' : 'Reclamar'}</span></button>)}</div><button className="calc-secundario" disabled={!puedeAvanzar} onClick={abrirSiguienteRonda}><RotateCcw size={17} /> Siguiente ronda · restablecer fichas</button></Dialogo>}
    {basePara !== null && <Dialogo titulo={`Base · ${jugadores[basePara].nombre || `Jugador ${basePara + 1}`}`} cerrar={() => setBasePara(null)}><Suspense fallback={<p className="calc-ayuda" role="status">Abriendo catálogo de bases…</p>}><SelectorBaseCalculadora elegida={jugadores[basePara].base} onElegir={elegirBase} /></Suspense><button className="calc-secundario" onClick={() => elegirBase(null)}>Usar vida manual</button></Dialogo>}
    {editando && <Dialogo titulo={`Ajustar · ${editando.nombre}`} cerrar={() => setEditarId(null)}>{editando.base && <figure className="calc-base-detalle"><CardImage src={editando.base.imagen} alt={editando.base.nombre} orientacion="apaisada" relleno={false} className="calc-base-carta" /><figcaption>{editando.base.nombre} · {editando.base.vidaImpresa} de vida impresa</figcaption></figure>}<p className="calc-ayuda">Vida actual: {editando.vida} de {editando.maxVida}. El daño y la curación respetan los límites de la base.</p><label className="calc-cantidad">Cantidad<input autoFocus type="number" inputMode="numeric" min={1} max={999} step={1} value={cantidad} onChange={e => setCantidad(e.target.value)} /></label><div className="calc-cantidades">{[1, 3, 5, 10].map(n => <button key={n} aria-pressed={Number(cantidad) === n} onClick={() => setCantidad(String(n))}>{n}</button>)}</div><div className="calc-acciones-exactas">
      <button disabled={editando.vida === 0 || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1 || Number(cantidad) > 999} onClick={() => { ajustar(editando.id, -Number(cantidad)); setEditarId(null) }}><Minus size={18} /> Hacer daño</button>
      <button disabled={editando.vida === 0 || editando.vida === editando.maxVida || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1 || Number(cantidad) > 999} onClick={() => { ajustar(editando.id, Number(cantidad)); setEditarId(null) }}><Plus size={18} /> Curar</button>
    </div>{editando.vida === 0 && <p className="calc-ayuda">Una base destruida no se cura. Para corregir un error, cerrá este panel y usá Deshacer.</p>}</Dialogo>}
  </main>
}
