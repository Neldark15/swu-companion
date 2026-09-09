import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, Shield, Swords, Zap } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { db } from '../../services/db'
import { artUrlOptimizada } from '../../services/cardArt'
import { loadFullDatabase } from '../../services/swuApi'
import type { Card } from '../../types'
import { OpcionesJuego } from './OpcionesJuego'
import { comandoCarta, normalizarVista, todasLasCartas } from './vistaJuego'
import type { CartaJuego, ComandoTablero, JugadorJuego, PromptJuego, VistaJuego, ZonaJuego } from './vistaJuego'
import './jugar.css'

interface Props { estado: unknown; usuarioId: string; ocupado: boolean; enviar: (comando: ComandoTablero) => Promise<void> }
type ArteJuego = Pick<Card, 'name' | 'imageUrl' | 'backImageUrl' | 'setCode' | 'setNumber' | 'isLeader' | 'isBase' | 'text' | 'subtitle'>
function claveArte(edicion: string | null, numero: number | null) { return `${edicion}-${numero}` }
function urlArte(carta: CartaJuego, arte: ArteJuego | undefined, ancho: number): string | null {
  if (!arte || carta.oculta) return null
  const desplegada = carta.tipo.toLowerCase().includes('leaderunit') || (arte.isLeader && (carta.zona === 'groundArena' || carta.zona === 'spaceArena'))
  const url = desplegada || carta.ladoInicial === false ? arte.backImageUrl ?? arte.imageUrl : arte.imageUrl
  if (!url.startsWith('https://cdn.starwarsunlimited.com/')) return null
  // cardArt omite el proxy en Vite DEV; la mesa exige el mismo trayecto cerrado en ambos entornos.
  const optimizada = artUrlOptimizada(url, ancho)
  return optimizada === url ? `/api/img?u=${encodeURIComponent(url)}&w=${ancho}` : optimizada
}
function ImagenJuego({ carta, arte, grande = false }: { carta: CartaJuego; arte?: ArteJuego; grande?: boolean }) {
  const [fallida, setFallida] = useState<string | null>(null)
  const url = urlArte(carta, arte, grande ? 448 : 224)
  return url && fallida !== url ? <img className={grande ? 'juego-arte-grande' : 'juego-arte'} src={url} alt={grande ? carta.nombre : ''} loading="lazy" draggable={false} onError={() => setFallida(url)} /> : <div className={`juego-dorso${grande ? ' juego-dorso-grande' : ''}`} data-arte={carta.oculta ? 'oculta' : url ? 'fallida' : arte ? 'origen-incompatible' : 'sin-catalogo'} data-origen={import.meta.env.DEV ? url : undefined} aria-hidden="true"><span>✦</span><small>{carta.oculta ? 'HOLOCRON' : carta.edicion ? `${carta.edicion} ${carta.numero ?? ''}` : 'SWU'}</small></div>
}
function Estadisticas({ carta }: { carta: CartaJuego }) {
  return <span className="juego-estadisticas">
    {carta.poder !== null && <span title="Poder"><Swords size={12} aria-hidden />{carta.poder}<span className="sr-only"> de poder</span></span>}
    {carta.salud !== null && <span title="Salud total"><Shield size={12} aria-hidden />{carta.salud}<span className="sr-only"> de salud total</span></span>}
    {carta.dano !== null && <span className={carta.dano > 0 ? 'juego-dano' : ''}>{carta.dano} daño</span>}
  </span>
}

export function TableroJuego({ estado, usuarioId, ocupado, enviar }: Props) {
  const vista = useMemo(() => normalizarVista(estado, usuarioId), [estado, usuarioId])
  if (!vista.jugador) return <div className="juego-tablero"><p role="status">Esperando una vista privada válida para tu cuenta…</p></div>
  return <MesaJuego key={`${vista.id}-${usuarioId}`} vista={vista} ocupado={ocupado} enviar={enviar} />
}
function MesaJuego({ vista, ocupado, enviar }: { vista: VistaJuego; ocupado: boolean; enviar: Props['enviar'] }) {
  const [ampliada, setAmpliada] = useState<CartaJuego | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cargandoArte, setCargandoArte] = useState(true)
  const candado = useRef(false)
  const cartas = todasLasCartas(vista)
  const prompt = vista.jugador?.prompt
  const ediciones = [...new Set([...cartas, ...(prompt?.cartas ?? [])].flatMap(c => c.edicion ? [c.edicion] : []))].sort().join(',')
  const catalogo = useLiveQuery(async () => ediciones ? db.cards.where('setCode').anyOf(ediciones.split(',')).toArray() : [], [ediciones], [])
  // ensureCards sólo comprueba si existe ALGUNA carta: una caché parcial deja
  // sin arte partidas de otros sets. Este cargador verifica el catálogo completo
  // antes de pedir la red y comparte cualquier descarga ya en curso.
  useEffect(() => {
    let viva = true
    void loadFullDatabase().finally(() => { if (viva) setCargandoArte(false) })
    return () => { viva = false }
  }, [])
  const artes = new Map<string, ArteJuego>()
  for (const c of catalogo) { const clave = claveArte(c.setCode.toUpperCase(), c.setNumber); if (!artes.has(clave) || c.variantType === 'Standard') artes.set(clave, c) }
  const faltaArte = [...cartas, ...(prompt?.cartas ?? [])].some(c => !c.oculta && c.edicion && c.numero !== null && !artes.has(claveArte(c.edicion, c.numero)))
  const bloqueado = ocupado || enviando || vista.ganadores.length > 0
  const mandar = async (comando: ComandoTablero) => {
    if (bloqueado || candado.current) return
    candado.current = true
    setEnviando(true)
    setError(null)
    try { await enviar(comando) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar la elección. Intentá otra vez.') }
    finally { candado.current = false; setEnviando(false) }
  }
  const renderCarta = (carta: CartaJuego, eleccion?: PromptJuego) => {
    const comando = prompt?.distribucion && !eleccion ? null : comandoCarta(carta, eleccion)
    const arte = artes.get(claveArte(carta.edicion, carta.numero))
    const padre = carta.padre ? cartas.find(c => c.uuid === carta.padre) : null
    return <article className={`juego-carta${carta.seleccionable ? ' es-elegible' : ''}${carta.seleccionada ? ' es-seleccionada' : ''}${carta.agotada ? ' es-agotada' : ''}${carta.oculta ? ' es-oculta' : ''}`} key={carta.clave}>
      <button type="button" className="juego-carta-cuerpo" aria-label={`${comando ? carta.seleccionada ? 'Quitar selección de' : 'Elegir' : 'Ver'} ${carta.nombre}${carta.orden !== null ? `, orden ${carta.orden}` : ''}`} aria-pressed={comando ? carta.seleccionada : undefined} disabled={bloqueado && !!comando} onClick={() => { if (comando) void mandar(comando); else setAmpliada(carta) }}>
        <ImagenJuego carta={carta} arte={arte} />
        {carta.orden !== null && <span className="juego-orden">{carta.orden}</span>}
        {carta.seleccionada && <span className="juego-seleccionada">Elegida</span>}
        <strong>{carta.oculta ? 'Carta oculta' : carta.nombre}</strong>
        <Estadisticas carta={carta} />
        <span className="juego-etiquetas">
          {carta.agotada === true && <span>Agotada</span>}{carta.agotada === false && <span>Lista</span>}
          {carta.atacante && <span>Atacando</span>}{carta.defensora && <span>Defendiendo</span>}{carta.centinela && <span>Centinela</span>}
          {carta.anulada && <span>Texto anulado</span>}{carta.accionEpicaGastada && <span>Épica usada</span>}
          {padre && <span>En {padre.nombre}</span>}
        </span>
      </button>
      {!carta.oculta && <button className="juego-ampliar" type="button" aria-label={`Ampliar ${carta.nombre}`} onClick={() => setAmpliada(carta)}><Eye size={12} aria-hidden /> Ampliar</button>}
      {carta.mejoras.length > 0 && <div className="juego-mejoras" aria-label={`Mejoras de ${carta.nombre}`}>{carta.mejoras.map(c => renderCarta(c))}</div>}
    </article>
  }
  const zona = (j: JugadorJuego, nombre: ZonaJuego, titulo: string, plegable = false) => {
    const contenido = <div className="juego-fila-cartas">{j.zonas[nombre].length ? j.zonas[nombre].map(c => renderCarta(c)) : <p className="juego-vacio">Sin cartas</p>}</div>
    const elegibles = j.zonas[nombre].filter(c => c.seleccionable || c.seleccionada).length
    return plegable ? <details className="juego-zona juego-pila" key={nombre}>
      <summary>{titulo} <span>{j.zonas[nombre].length}</span>{elegibles > 0 && <em>{elegibles} para elegir</em>}</summary>{contenido}
    </details> : <section className={`juego-zona${j.zonas[nombre].length === 0 ? ' es-vacia' : ''}`} aria-label={`${titulo} de ${j.nombre}`}><h3>{titulo}<span>{j.zonas[nombre].length}</span></h3>{contenido}</section>
  }
  const cabeceraJugador = (j: JugadorJuego, propio: boolean) => <section className={`juego-jugador ${propio ? 'es-propio' : 'es-rival'}`} aria-label={propio ? 'Tu campo' : 'Campo rival'}>
    <header><strong>{propio ? 'Vos' : j.nombre}</strong><span>{j.iniciativa && <b><Zap size={12} aria-hidden /> Iniciativa</b>}{j.activo && <b>En acción</b>}{j.desconectado && <b>Sin conexión</b>}</span></header>
    <div className="juego-resumen-jugador"><span>Mazo: {j.mazo ?? '—'}</span><span>Mano: {j.zonas.hand.length}</span><span>Recursos: {j.recursosDisponibles ?? '—'} / {j.zonas.resources.length}</span></div>
    <div className="juego-identidades">{j.base && renderCarta(j.base)}{j.lider && (
      j.lider.zona === 'groundArena' || j.lider.zona === 'spaceArena'
        ? <div className="juego-lider-desplegado"><strong>{j.lider.nombre}</strong><span>Líder desplegado en {j.lider.zona === 'groundArena' ? 'tierra' : 'espacio'}</span><button type="button" onClick={() => setAmpliada(j.lider)}>Ver líder</button></div>
        : renderCarta(j.lider)
    )}{j.fuerza && renderCarta(j.fuerza)}</div>
  </section>
  const vistaAmpliada = ampliada && ([...cartas, ...(prompt?.cartas ?? [])].find(c => c.clave === ampliada.clave) ?? ampliada)
  const arteAmpliado = vistaAmpliada ? artes.get(claveArte(vistaAmpliada.edicion, vistaAmpliada.numero)) : undefined
  return <div className="juego-tablero">
    {error && <p className="juego-error" role="alert">{error}</p>}
    {faltaArte && <div className="juego-estado-arte" role="status">{cargandoArte ? 'Cargando arte de las cartas…' : <>Falta arte de algunas cartas. <button type="button" onClick={() => { setCargandoArte(true); void loadFullDatabase({ force: true }).finally(() => setCargandoArte(false)) }}>Actualizar catálogo</button></>}</div>}
    {prompt && vista.ganadores.length === 0 && <OpcionesJuego key={prompt.uuid || 'esperando'} prompt={prompt} cartas={cartas} ocupado={bloqueado} enviar={mandar} renderCarta={renderCarta} />}
    <div className="juego-campo">
      {vista.rival && cabeceraJugador(vista.rival, false)}
      <div className="juego-arenas">
        <section className="juego-arena" aria-label="Arena espacial"><h2>Espacio</h2>{vista.rival && zona(vista.rival, 'spaceArena', 'Rival')}{vista.jugador && zona(vista.jugador, 'spaceArena', 'Vos')}</section>
        <section className="juego-arena" aria-label="Arena terrestre"><h2>Tierra</h2>{vista.rival && zona(vista.rival, 'groundArena', 'Rival')}{vista.jugador && zona(vista.jugador, 'groundArena', 'Vos')}</section>
      </div>
      {vista.jugador && cabeceraJugador(vista.jugador, true)}
      {vista.jugador && <div className="juego-mano">{zona(vista.jugador, 'hand', 'Tu mano')}</div>}
      <div className="juego-pilas-jugadores">{[vista.jugador, vista.rival].map((j, i) => j && <section key={j.id} className="juego-pilas" aria-label={`Zonas de ${j.nombre}`}><h2>{i === 0 ? 'Tus zonas' : `Zonas de ${j.nombre}`}</h2>
        {zona(j, 'resources', 'Recursos', true)}{zona(j, 'discard', 'Descarte', true)}
        {(['credits', 'capturedZone', 'outsideTheGame'] as const).filter(z => j.zonas[z].length > 0).map(z => zona(j, z, z === 'credits' ? 'Créditos' : z === 'capturedZone' ? 'Capturadas' : 'Fuera del juego', true))}
        {i === 1 && j.zonas.hand.some(c => c.seleccionable || !c.oculta) && zona(j, 'hand', 'Mano rival', true)}
      </section>)}</div>
    </div>
    <Sheet open={!!vistaAmpliada} onClose={() => setAmpliada(null)} title={vistaAmpliada?.nombre ?? 'Carta'}>
      {vistaAmpliada && <div className="juego-tablero juego-detalle"><ImagenJuego carta={vistaAmpliada} arte={arteAmpliado} grande /><h3>{vistaAmpliada.nombre}</h3><Estadisticas carta={vistaAmpliada} />
        {vistaAmpliada.salud !== null && vistaAmpliada.dano !== null && <p>{vistaAmpliada.salud - vistaAmpliada.dano} de salud restante · {vistaAmpliada.salud} total</p>}
        {vistaAmpliada.agotada !== null && <p>{vistaAmpliada.agotada ? 'Agotada' : 'Lista'}</p>}
        {vistaAmpliada.texto && <p>{vistaAmpliada.texto}</p>}
        {arteAmpliado?.text && <p className="juego-texto-carta">{arteAmpliado.text}</p>}
        <p className="juego-ayuda">Arte y texto impreso: Star Wars: Unlimited / Fantasy Flight Games. El estado y las elecciones los determina el motor.</p>
      </div>}
    </Sheet>
  </div>
}
