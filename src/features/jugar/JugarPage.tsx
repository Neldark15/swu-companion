import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Flag, Gamepad2, Link2, LoaderCircle, LogIn, RefreshCw, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../services/supabase'
import { Sheet } from '../../components/ui/Sheet'
import { ClienteJuego, ErrorJuego, type ConexionJuego } from './cliente'
import { cargarMazosPropios, obtenerTokenJuego, type OpcionMazo } from './mazosCloud'
import { importarMazoOnline } from './mazos'
import { TableroJuego } from './TableroJuego'
import type { ComandoJuego, MazoOnline, SalaJuego } from './tipos'

const boton = 'min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-swu-accent'
const principal = `${boton} bg-swu-accent text-swu-bg hover:brightness-110`
const secundario = `${boton} border border-swu-border bg-swu-surface text-swu-text hover:bg-swu-surface-hover`
const campo = 'w-full min-h-11 rounded-xl border border-swu-border bg-swu-bg px-3 py-2 text-sm text-swu-text focus:outline-2 focus:outline-swu-accent'

export function JugarPage() {
  const usuarioId = useAuth(s => s.supabaseUser?.id)
  const authListo = useAuth(s => s.authListo)
  const { codigo } = useParams()
  const navigate = useNavigate()
  const token = useCallback(() => obtenerTokenJuego(usuarioId ?? ''), [usuarioId])
  const cargar = useCallback(() => cargarMazosPropios(usuarioId ?? ''), [usuarioId])
  const abrir = useCallback((sala: SalaJuego) => {
    const ruta = sala.estado === 'jugando' ? 'partida' : 'sala'
    navigate(`/jugar/${ruta}/${sala.codigo}`, { replace: true })
  }, [navigate])
  if (!authListo) return <div className="p-8 text-swu-muted" role="status">Preparando tu sesión…</div>
  if (!usuarioId) return (
    <section className="p-5 space-y-4">
      <Gamepad2 size={32} className="text-swu-accent-texto" />
      <h1 className="text-2xl font-bold">Jugar online</h1>
      <p className="text-swu-muted text-sm">Entrá con tu cuenta de HOLOCRON para jugar una partida virtual con otro usuario.</p>
      <Link className={`${principal} inline-flex items-center gap-2`} to={`/profile?modo=login&next=${encodeURIComponent(codigo ? `/jugar/sala/${codigo}` : '/jugar')}`}><LogIn size={18} /> Iniciar sesión</Link>
    </section>
  )
  return <EspacioJuego key={`${usuarioId}:${codigo ?? ''}`} usuarioId={usuarioId}
    url={import.meta.env.VITE_JUEGO_URL ?? ''} obtenerToken={token} cargarMazos={cargar}
    codigoInicial={codigo} alAbrirSala={abrir} alSalir={() => navigate('/jugar', { replace: true })} />
}

interface PropsEspacio {
  usuarioId: string
  url: string
  obtenerToken: () => Promise<string>
  cargarMazos: (cliente: ClienteJuego) => Promise<OpcionMazo[]>
  codigoInicial?: string
  alAbrirSala?: (sala: SalaJuego) => void
  alSalir?: () => void
  desarrollo?: boolean
}

/** Producción y banco usan el mismo cliente, lobby y tablero. */
export function EspacioJuego(props: PropsEspacio) {
  const [sesion, setSesion] = useState(0)
  return <SesionJuego key={sesion} {...props} alReiniciar={() => setSesion(actual => actual + 1)} />
}

function SesionJuego({ usuarioId, url, obtenerToken, cargarMazos, codigoInicial,
  alAbrirSala, alSalir, desarrollo = false, alReiniciar }: PropsEspacio & { alReiniciar: () => void }) {
  const cliente = useMemo(() => new ClienteJuego(url, usuarioId, obtenerToken), [url, usuarioId, obtenerToken])
  const [nombre, setNombre] = useState('Tu cuenta')
  const [cargando, setCargando] = useState(true)
  const [disponible, setDisponible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorMazos, setErrorMazos] = useState<string | null>(null)
  const [mazos, setMazos] = useState<OpcionMazo[]>([])
  const [mazoId, setMazoId] = useState('')
  const [sala, setSala] = useState<SalaJuego | null>(null)
  const [codigo, setCodigo] = useState(codigoInicial?.toUpperCase() ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [conexion, setConexion] = useState<ConexionJuego>('conectando')
  const [importando, setImportando] = useState(false)
  const [texto, setTexto] = useState('')
  const [confirmarConcesion, setConfirmarConcesion] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const candado = useRef(false)
  const viva = useRef(true)
  const salaActual = useRef<SalaJuego | null>(null)

  const aceptarSala = useCallback((nueva: SalaJuego) => {
    if (!viva.current) return
    setSala(actual => actual?.codigo === nueva.codigo && actual.revision > nueva.revision ? actual : nueva)
    try { sessionStorage.setItem(`holocron-juego:${usuarioId}`, nueva.codigo) } catch { /* Navegación funciona sin almacenamiento. */ }
  }, [usuarioId])
  useEffect(() => { salaActual.current = sala }, [sala])

  useEffect(() => {
    let activa = true
    viva.current = true
    cliente.activar()
    const cargar = async () => {
      setCargando(true)
      setError(null)
      try {
        const config = await cliente.configuracion()
        if (!activa) return
        if (config.desarrollo && !desarrollo) throw new Error('Esta dirección corresponde al banco de desarrollo, no al servicio de tu cuenta.')
        setDisponible(config.disponible)
        if (!config.disponible) throw new Error('El servicio está preparando las partidas. Volvé a intentarlo en un momento.')
        const usuario = await cliente.usuario()
        if (!activa) return
        setNombre(usuario.nombre)
        const propia = await cliente.propia()
        if (!activa) return
        if (propia) aceptarSala(propia)
        else if (codigoInicial) {
          // Un enlace de invitación no concede acceso a la sala antes de unirse.
          try { aceptarSala(await cliente.leer(codigoInicial.toUpperCase())) } catch (error) {
            if (!(error instanceof ErrorJuego && [403, 404].includes(error.estado))) throw error
          }
        }
        try {
          const opciones = await cargarMazos(cliente)
          if (!activa) return
          setMazos(opciones)
          setMazoId(opciones.find(opcion => opcion.listo)?.id ?? '')
          setErrorMazos(null)
        } catch (error) { if (activa) setErrorMazos(error instanceof Error ? error.message : 'No pudimos cargar los mazos.') }
      } catch (error) { if (activa) setError(error instanceof Error ? error.message : 'No pudimos conectar con el servicio.') }
      finally { if (activa) setCargando(false) }
    }
    void cargar()
    return () => { activa = false; viva.current = false; cliente.cerrar() }
  }, [cliente, codigoInicial, cargarMazos, desarrollo, aceptarSala, recarga])

  useEffect(() => {
    if (desarrollo) return
    const { data } = supabase.auth.onAuthStateChange(evento => {
      if (evento === 'TOKEN_REFRESHED') cliente.renovarConexion()
      if (evento === 'SIGNED_OUT') cliente.cerrar()
    })
    return () => data.subscription.unsubscribe()
  }, [cliente, desarrollo])

  const codigoSala = sala?.codigo
  useEffect(() => {
    if (!codigoSala) return
    return cliente.suscribir(codigoSala, aceptarSala, setConexion, error => setError(error.message))
  }, [cliente, codigoSala, aceptarSala, recarga])

  async function ejecutar(accion: () => Promise<void>) {
    if (candado.current) return
    candado.current = true
    setOcupado(true)
    setError(null)
    try { await accion() }
    catch (error) { if (viva.current) setError(error instanceof Error ? error.message : 'No se pudo completar la operación.') }
    finally { candado.current = false; if (viva.current) setOcupado(false) }
  }
  const elegido = mazos.find(mazo => mazo.id === mazoId)?.listo
  const propio = sala?.jugadores.find(jugador => jugador.id === usuarioId)
  const rival = sala?.jugadores.find(jugador => jugador.id !== usuarioId)
  const enPartida = sala?.estado === 'jugando'
  const bloqueado = ocupado || conexion !== 'conectado' || cliente.hayJugadaPendiente

  function abrirSala(nueva: SalaJuego) {
    if (!viva.current) return
    aceptarSala(nueva)
    alAbrirSala?.(nueva)
  }
  function dejarSala() {
    if (!viva.current) return
    // Invalidar el cliente antes de navegar: /jugar puede conservar la misma URL.
    // Una respuesta tardía de la partida anterior no debe reabrirla.
    viva.current = false
    cliente.cerrar()
    try { sessionStorage.removeItem(`holocron-juego:${usuarioId}`) } catch { /* Opcional. */ }
    alReiniciar()
    alSalir?.()
  }
  async function enviar(comando: ComandoJuego) {
    await ejecutar(async () => {
      const actual = salaActual.current
      if (!actual || conexion !== 'conectado') throw new Error('Esperá a que se recupere la conexión.')
      try { aceptarSala(await cliente.enviar(actual.codigo, actual.revision, comando)) }
      catch (error) {
        if (error instanceof ErrorJuego && error.estado === 409) aceptarSala(await cliente.leer(actual.codigo))
        throw error
      }
    })
  }
  async function copiar(enlace: boolean) {
    if (!sala) return
    try {
      await navigator.clipboard.writeText(enlace ? `${window.location.origin}/jugar/sala/${sala.codigo}` : sala.codigo)
      setCopiado(true)
    } catch { setError(`Compartí este código para invitar: ${sala.codigo}`) }
  }
  function importar() {
    try {
      const importado = importarMazoOnline(texto)
      const listo: MazoOnline = { ...importado, id: `importado-${crypto.randomUUID()}` }
      setMazos(actual => [...actual, { id: listo.id, nombre: listo.nombre, listo }])
      setMazoId(listo.id)
      setImportando(false)
      setTexto('')
      setError(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos leer el JSON.') }
  }

  if (!url) return <section className="p-5 space-y-4">
    <Gamepad2 size={32} className="text-swu-accent-texto" /><h1 className="text-2xl font-bold">Jugar online</h1>
    <p className="text-sm text-swu-muted">Estamos preparando las partidas virtuales de HOLOCRON. Este módulo todavía no tiene un servicio de partidas disponible.</p>
    <Link to="/decks" className={`${secundario} inline-flex`}>Ver mis mazos</Link>
  </section>

  return (
    <section className="p-3 sm:p-5 space-y-4" aria-label="Jugar online">
      <header className="flex items-start justify-between gap-3">
        <div><div className="text-[10px] font-mono uppercase tracking-widest text-swu-accent-texto">Premier · 1 contra 1 · {desarrollo ? 'Prueba local' : 'Beta privada'}</div>
          <h1 className="text-xl sm:text-2xl font-bold mt-1">{enPartida ? 'Partida online' : 'Jugar online'}</h1>
          {!enPartida && <p className="text-sm text-swu-muted mt-1">Tu mazo. Un código. Un rival.</p>}</div>
        {sala && <div className="text-right text-xs text-swu-muted"><span className="font-mono text-swu-text">{sala.codigo}</span>
          <div className="flex items-center gap-1 mt-1" role="status">{conexion === 'conectado' ? <Wifi size={13} /> : <WifiOff size={13} />}{conexion === 'conectado' ? 'Conectado' : 'Reconectando'}</div></div>}
      </header>

      {error && <div role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100 space-y-2">
        <p>{error}</p>
        {cliente.hayJugadaPendiente ? <button className={secundario} disabled={ocupado} onClick={() => void ejecutar(async () => aceptarSala(await cliente.reintentar()))}>Reintentar jugada</button>
          : <button className="underline min-h-10" disabled={ocupado} onClick={() => void ejecutar(async () => {
            if (sala) { aceptarSala(await cliente.leer(sala.codigo)); cliente.renovarConexion() }
            else setRecarga(valor => valor + 1)
          })}>Comprobar conexión y partida</button>}
      </div>}
      {cargando && <div className="flex gap-2 items-center text-swu-muted text-sm py-4" role="status"><LoaderCircle className="animate-spin" size={18} /> Conectando y preparando tus mazos…</div>}

      {sala && sala.estado === 'espera' && <section className="rounded-2xl border border-swu-border bg-swu-surface p-4 space-y-4">
        <div className="flex justify-between items-center"><h2 className="font-semibold flex gap-2 items-center"><Users size={18} /> Sala privada</h2><span className="text-xs text-swu-muted">{sala.jugadores.length}/2</span></div>
        <div className="flex gap-2"><button className={`${secundario} flex-1 inline-flex justify-center items-center gap-2 font-mono`} onClick={() => void copiar(false)}><Copy size={16} /> {sala.codigo}</button>
          <button className={secundario} aria-label="Copiar enlace de invitación" onClick={() => void copiar(true)}><Link2 size={18} /></button></div>
        {copiado && <p role="status" className="text-xs text-swu-accent-texto">Copiado. Compartilo con tu rival.</p>}
        <div className="space-y-3">{sala.jugadores.map(jugador => <div key={jugador.id} className="flex gap-3 items-center rounded-xl bg-swu-bg p-3">
          <div className="h-9 w-9 rounded-full border border-swu-border flex items-center justify-center text-swu-accent-texto"><Users size={17} /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{jugador.nombre}{jugador.id === usuarioId ? ' (vos)' : ''}</p><p className="text-xs text-swu-muted truncate">{jugador.mazoNombre}</p></div>
          <span className={`text-xs ${jugador.preparado ? 'text-emerald-400' : 'text-swu-muted'}`}>{jugador.preparado ? 'Listo' : 'Preparando'}</span>
        </div>)}
          {!rival && <p className="border border-dashed border-swu-border rounded-xl p-4 text-sm text-swu-muted text-center">Esperando a tu rival. Compartí el código para invitarlo.</p>}</div>
        <button className={`${propio?.preparado ? secundario : principal} w-full flex items-center justify-center gap-2`}
          disabled={bloqueado || !rival} onClick={() => void ejecutar(async () => {
            const nueva = await cliente.preparado(sala.codigo, !propio?.preparado)
            aceptarSala(nueva)
          })}><Check size={18} /> {propio?.preparado ? 'Dejar de estar listo' : 'Estoy listo'}</button>
        <p className="text-xs text-swu-muted">La partida comienza cuando ambos estén listos. El mazo queda fijo hasta terminar.</p>
      </section>}

      {!cargando && disponible && (!sala || sala.estado === 'espera') && <section className="rounded-2xl border border-swu-border bg-swu-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{sala ? 'Cambiar tu mazo' : 'Elegí tu mazo'}</h2><span className="text-xs text-swu-muted truncate">{nombre}</span></div>
        {errorMazos && <p className="text-sm text-amber-300">{errorMazos}</p>}
        {mazos.length > 0 ? <label className="block text-sm text-swu-muted">Mazo Premier<select className={`${campo} mt-1`} value={mazoId} onChange={event => setMazoId(event.target.value)} disabled={ocupado || propio?.preparado}>
          <option value="">Seleccionar mazo</option>{mazos.map(mazo => <option key={mazo.id} value={mazo.id} disabled={!mazo.listo}>{mazo.nombre}{!mazo.listo ? ' — revisar cartas' : ''}</option>)}
        </select></label> : <p className="text-sm text-swu-muted">No hay mazos Premier disponibles en tu cuenta. Podés importar uno o crearlo en Mis mazos.</p>}
        {mazos.filter(mazo => mazo.error).map(mazo => <p key={mazo.id} className="text-xs text-amber-300">{mazo.nombre}: {mazo.error}</p>)}
        {elegido && <p className="text-xs text-swu-muted">{elegido.mazo.deck.reduce((total, carta) => total + carta.count, 0)} cartas · Legalidad y habilidades verificadas al entrar.</p>}
        <div className="flex gap-2 flex-wrap"><button className={secundario} disabled={ocupado || propio?.preparado} onClick={() => setImportando(true)}>Importar JSON</button>
          {!desarrollo && <Link className={`${secundario} inline-flex items-center`} to="/decks">Mis mazos</Link>}
          <button className={secundario} aria-label="Actualizar lista de mazos" disabled={ocupado} onClick={() => void ejecutar(async () => { const opciones = await cargarMazos(cliente); setMazos(opciones); setErrorMazos(null) })}><RefreshCw size={16} /></button></div>
        {sala ? <button className={`${secundario} w-full`} disabled={!elegido || bloqueado || propio?.preparado} onClick={() => void ejecutar(async () => { if (elegido) aceptarSala(await cliente.cambiarMazo(sala.codigo, elegido)) })}>Usar este mazo en la sala</button>
          : <><button className={`${principal} w-full flex items-center justify-center gap-2`} disabled={!elegido || ocupado} onClick={() => void ejecutar(async () => { if (elegido) abrirSala(await cliente.crear(elegido)) })}><Gamepad2 size={18} /> Crear sala privada</button>
            <div className="border-t border-swu-border pt-3 space-y-2"><label className="block text-sm text-swu-muted">Código de tu rival<input className={`${campo} mt-1 uppercase font-mono tracking-widest`} value={codigo} maxLength={16} autoCapitalize="characters" autoCorrect="off" placeholder="CÓDIGO" onChange={event => setCodigo(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
              <button className={`${secundario} w-full`} disabled={!elegido || codigo.length < 6 || ocupado} onClick={() => void ejecutar(async () => { if (elegido) abrirSala(await cliente.unirse(codigo, elegido)) })}>Entrar a la sala</button></div></>}
        <p className="flex gap-2 text-xs text-swu-muted"><ShieldCheck size={15} className="shrink-0" /><span>Las habilidades se resuelven automáticamente. Si alguna carta aún no es compatible, te indicaremos cuál antes de empezar.</span></p>
      </section>}

      {enPartida && <>
        {conexion !== 'conectado' && <p className="text-sm text-amber-300" role="status">Recuperando la partida. Las jugadas se habilitarán al reconectar.</p>}
        {sala.juego ? <TableroJuego estado={sala.juego} usuarioId={usuarioId} ocupado={bloqueado} enviar={enviar} />
          : <p role="status" className="text-swu-muted">Recuperando el tablero…</p>}
        <div className="flex justify-between gap-2"><Link to="/jugar" className={`${secundario} inline-flex items-center gap-2`}><ArrowLeft size={16} /> Volver</Link>
          <button className={`${secundario} inline-flex items-center gap-2`} disabled={bloqueado} onClick={() => setConfirmarConcesion(true)}><Flag size={16} /> Conceder</button></div>
      </>}

      {sala && ['finalizada', 'interrumpida'].includes(sala.estado) && <section className="rounded-2xl border border-swu-border bg-swu-surface p-5 space-y-3 text-center">
        <h2 className="text-xl font-bold">{sala.estado === 'interrumpida' ? 'Partida interrumpida' : sala.resultado?.ganadorId === usuarioId ? 'Ganaste la partida' : sala.resultado?.ganadorId ? `${rival?.nombre ?? 'Tu rival'} ganó la partida` : 'Partida terminada'}</h2>
        <p className="text-sm text-swu-muted">{sala.estado === 'interrumpida' ? 'El servicio se reinició. Esta partida no asigna ganador ni cambia tus estadísticas.' : 'La partida casual terminó. Podés crear otra sala para volver a jugar.'}</p>
        <button className={principal} disabled={ocupado} onClick={dejarSala}>Jugar otra partida</button>
      </section>}
      {sala?.estado === 'espera' && <button className={`${secundario} w-full`} disabled={ocupado} onClick={() => void ejecutar(async () => { await cliente.salir(sala.codigo); dejarSala() })}>Salir de la sala</button>}

      <Sheet open={importando} onClose={() => setImportando(false)} title="Importar mazo para jugar">
        <div className="space-y-3 p-4"><p className="text-sm text-swu-muted">Pegá el JSON exportado desde SWUDB o Mis mazos. Solo se utilizará en esta sesión.</p>
          <label className="block text-sm">JSON del mazo<textarea className={`${campo} mt-2 font-mono text-xs min-h-52`} value={texto} maxLength={50_000} onChange={event => setTexto(event.target.value)} spellCheck={false} /></label>
          <button className={`${principal} w-full`} disabled={!texto.trim()} onClick={importar}>Usar mazo importado</button>
          {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}</div>
      </Sheet>
      <Sheet open={confirmarConcesion} onClose={() => setConfirmarConcesion(false)} title="Conceder la partida">
        <div className="p-4 space-y-4"><p className="text-sm text-swu-muted">Tu rival ganará esta partida. Esta acción no se puede deshacer.</p>
          <div className="flex gap-2"><button className={`${secundario} flex-1`} onClick={() => setConfirmarConcesion(false)}>Seguir jugando</button>
            <button className={`${principal} flex-1`} disabled={bloqueado} onClick={() => { setConfirmarConcesion(false); void enviar({ nombre: 'concede', args: [] }) }}>Conceder</button></div></div>
      </Sheet>
      <p className="text-[10px] text-swu-muted text-center">Motor de reglas basado en <a className="underline" href="https://github.com/SWU-Karabast/forceteki" target="_blank" rel="noreferrer">Forceteki · MIT</a></p>
    </section>
  )
}
