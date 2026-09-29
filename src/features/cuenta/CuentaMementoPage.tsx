import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../services/supabase'
import {
  actualizarClaveVerificada, borrarRetorno, consultarOAuthFijado, destinoAutorizacionSeguro, esperarLectura, guardarRetorno,
  idAutorizacionValido, invalidaRecuperacion, leerAutorizacion, leerEnlaceCorreo, leerRetorno,
  RECUPERACION_MEMENTO, verificarCorreoExplicito, verificarSolicitud,
} from './autoridadMemento'
import './cuenta-memento.css'

const clienteMemento = (import.meta.env.VITE_MEMENTO_OAUTH_CLIENT_ID as string | undefined)?.trim() || ''
const ERROR_RED = 'No pudimos completar la conexión. Revisá tu conexión e intentá de nuevo.'
const ERROR_SOLICITUD = 'Este acceso venció o no pertenece a MEMENTO. Volvé a MEMENTO para iniciar otra conexión.'
const CORREO_ENVIADO = 'Si el correo corresponde a una cuenta, recibirás un enlace para elegir una nueva contraseña. Revisá también spam.'
const configuracionAuth = {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  clavePublica: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
}

function retornoTemporal(accion: 'leer' | 'guardar' | 'borrar', id?: string): string | null {
  try {
    if (accion === 'guardar' && id) guardarRetorno(window.sessionStorage, id)
    if (accion === 'borrar') borrarRetorno(window.sessionStorage)
    return accion === 'leer' ? leerRetorno(window.sessionStorage) : null
  } catch { return null }
}

function MarcoCuenta({ children }: { children: ReactNode }) {
  useEffect(() => {
    const titulo = document.title
    document.title = 'Tu cuenta · MEMENTO'
    return () => { document.title = titulo }
  }, [])
  return <main className="mm-cuenta">
    <header className="mm-cabecera">
      <a href="https://mementohobby.com" aria-label="Volver a MEMENTO" className="mm-marca"><span /></a>
      <span className="mm-etiqueta">HOBBY SHOP & CAFÉ</span>
    </header>
    <div className="mm-composicion">
      <aside className="mm-relato" aria-label="MEMENTO">
        <div className="mm-reliquia" aria-hidden="true" />
        <p className="mm-etiqueta">MEMENTO · TU PUNTO DE ENCUENTRO</p>
        <h1>Distintos mundos.<br />Una misma cuenta.</h1>
        <p>Lo que jugás. Lo que coleccionás.<br />Las historias que compartís.</p>
        <div className="mm-lema">DESCUBRÍ. COMPARTÍ. VIVÍ.</div>
      </aside>
      <section className="mm-panel" aria-label="Acceso a tu cuenta">{children}</section>
    </div>
    <footer className="mm-pie"><span>MEMENTO + SWU EL SALVADOR</span><a href="https://mementohobby.com">Volver a la tienda <span aria-hidden="true">↗</span></a></footer>
  </main>
}

function Aviso({ texto, error = false }: { texto: string; error?: boolean }) {
  return texto ? <p className={`mm-aviso${error ? ' mm-error' : ''}`} role={error ? 'alert' : 'status'}>{texto}</p> : null
}

type Vista = { estado: 'leyendo' } | { estado: 'acceso' } | { estado: 'error'; mensaje: string } | { estado: 'consentir'; usuario: User }

export function AutorizarMementoPage() {
  const [id] = useState(() => leerAutorizacion(window.location.search))
  const [vista, setVista] = useState<Vista>({ estado: 'leyendo' })
  const [revision, setRevision] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const accionActiva = useRef(false)
  const navegando = useRef(false)
  const vida = useRef<AbortController | null>(null)

  function navegar(value: string): boolean {
    const destino = destinoAutorizacionSeguro(value)
    if (!destino) return false
    if (!navegando.current) {
      navegando.current = true
      retornoTemporal('borrar')
      window.location.replace(destino)
    }
    return true
  }

  useEffect(() => {
    const controller = new AbortController()
    vida.current = controller
    async function cargar() {
      if (!id || !idAutorizacionValido(clienteMemento)) {
        setVista({ estado: 'error', mensaje: !id ? ERROR_SOLICITUD : 'La conexión de cuentas todavía no está disponible. Volvé a MEMENTO en unos minutos.' })
        return
      }
      setVista({ estado: 'leyendo' })
      setOcupado(false)
      setErrorAccion('')
      try {
        const { data, error } = await esperarLectura(supabase.auth.getUser(), controller.signal)
        if (controller.signal.aborted) return
        if (error) {
          if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) setVista({ estado: 'acceso' })
          else setVista({ estado: 'error', mensaje: ERROR_RED })
          return
        }
        if (!data.user) { setVista({ estado: 'acceso' }); return }
        const respuesta = await esperarLectura(supabase.auth.oauth.getAuthorizationDetails(id), controller.signal)
        if (controller.signal.aborted) return
        if (respuesta.error || !respuesta.data) throw new Error('solicitud_no_disponible')
        if ('redirect_url' in respuesta.data) {
          if (!navegar(respuesta.data.redirect_url)) throw new Error('destino_no_permitido')
        } else if (verificarSolicitud(respuesta.data, id, clienteMemento, data.user.id)) {
          retornoTemporal('guardar', id)
          setVista({ estado: 'consentir', usuario: data.user })
        } else throw new Error('solicitud_no_permitida')
      } catch {
        if (!controller.signal.aborted) setVista({ estado: 'error', mensaje: ERROR_SOLICITUD })
      }
    }
    void cargar()
    // No se ejecuta Auth/RPC dentro del lock del evento. Una sesión cambiada
    // en otra pestaña invalida lecturas y vuelve a comprobar usuario y cliente.
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data: suscripcion } = supabase.auth.onAuthStateChange(evento => {
      if (evento === 'INITIAL_SESSION' || evento === 'TOKEN_REFRESHED') return
      controller.abort()
      clearTimeout(timer)
      timer = setTimeout(() => setRevision(v => v + 1), 0)
    })
    return () => { controller.abort(); clearTimeout(timer); suscripcion.subscription.unsubscribe() }
  }, [id, revision])

  async function continuar() {
    if (!id || vista.estado !== 'consentir' || accionActiva.current || navegando.current) return
    const signal = vida.current?.signal
    if (!signal || signal.aborted) return
    accionActiva.current = true
    setOcupado(true)
    setErrorAccion('')
    const controller = new AbortController()
    const cancelar = () => controller.abort()
    signal.addEventListener('abort', cancelar, { once: true })
    const timer = setTimeout(cancelar, 20000)
    try {
      const sesion = await esperarLectura(supabase.auth.getSession(), controller.signal)
      if (sesion.error || !sesion.data.session) throw new Error('cuenta_cambio')
      const token = sesion.data.session.access_token
      const actual = await esperarLectura(supabase.auth.getUser(token), controller.signal)
      if (controller.signal.aborted) return
      if (actual.error || actual.data.user?.id !== vista.usuario.id) throw new Error('cuenta_cambio')
      const comprobacion = await consultarOAuthFijado(fetch, configuracionAuth, { id, token, aprobar: false }, controller.signal)
      if (controller.signal.aborted) return
      if ('redirect_url' in comprobacion) {
        if (!navegar(comprobacion.redirect_url)) throw new Error('destino_no_permitido')
        return
      }
      if (!verificarSolicitud(comprobacion, id, clienteMemento, actual.data.user.id)) throw new Error('solicitud_no_permitida')
      const respuesta = await consultarOAuthFijado(fetch, configuracionAuth, { id, token, aprobar: true }, controller.signal)
      if (controller.signal.aborted) return
      if (!('redirect_url' in respuesta) || !navegar(respuesta.redirect_url)) throw new Error('consentimiento_fallo')
    } catch { if (!signal.aborted) setErrorAccion(ERROR_SOLICITUD) }
    finally { clearTimeout(timer); signal.removeEventListener('abort', cancelar); accionActiva.current = false; if (!signal.aborted) setOcupado(false) }
  }

  async function cambiarCuenta() {
    if (accionActiva.current) return
    accionActiva.current = true
    setOcupado(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) setErrorAccion(ERROR_RED)
    } catch { setErrorAccion(ERROR_RED) }
    finally { accionActiva.current = false; setOcupado(false) }
  }

  return <MarcoCuenta>
    <p className="mm-etiqueta">CUENTA MEMENTO</p>
    {vista.estado === 'leyendo' && <><h2>Abriendo tu cuenta.</h2><p role="status">Comprobando tu conexión segura…</p></>}
    {vista.estado === 'error' && <><h2>Retomemos el camino.</h2><Aviso texto={vista.mensaje} error /><button className="mm-boton" onClick={() => setRevision(v => v + 1)}>Reintentar</button><a className="mm-enlace" href="https://mementohobby.com">Volver a MEMENTO</a></>}
    {vista.estado === 'acceso' && <FormularioAcceso autorizacion={id} />}
    {vista.estado === 'consentir' && <>
      <h2>Ya sos parte.</h2><p>Continuá con tu cuenta de MEMENTO y SWU El Salvador.</p>
      <div className="mm-identidad"><span className="mm-etiqueta">TU CUENTA</span><strong>{vista.usuario.email}</strong></div>
      <p className="mm-detalle">Al continuar, MEMENTO recibirá tu correo y los datos básicos de tu cuenta. Tu colección y tus partidas siguen en SWU.</p>
      <Aviso texto={errorAccion} error />
      <button className="mm-boton" disabled={ocupado} onClick={() => void continuar()}>{ocupado ? 'Conectando…' : 'Continuar a MEMENTO'}<span aria-hidden="true">↗</span></button>
      <button className="mm-enlace" disabled={ocupado} onClick={() => void cambiarCuenta()}>Usar otra cuenta</button>
      <p className="mm-nota">Cambiar de cuenta cierra el acceso de SWU en este navegador.</p>
    </>}
  </MarcoCuenta>
}

function FormularioAcceso({ autorizacion }: { autorizacion: string | null }) {
  const [modo, setModo] = useState<'entrar' | 'crear' | 'recuperar'>('entrar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const activo = useRef(false)
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])

  function cambiar(modoNuevo: typeof modo) { setModo(modoNuevo); setClave(''); setError(''); setMensaje('') }
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (activo.current) return
    activo.current = true
    setOcupado(true); setError(''); setMensaje('')
    if (autorizacion) retornoTemporal('guardar', autorizacion)
    try {
      if (modo === 'recuperar') {
        const { error: fallo } = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: RECUPERACION_MEMENTO })
        if (fallo && fallo.status !== 429) throw new Error('red')
        if (montado.current) setMensaje(CORREO_ENVIADO)
      } else if (modo === 'crear') {
        const { data, error: fallo } = await supabase.auth.signUp({ email: correo.trim(), password: clave, options: {
          data: { name: nombre.trim(), origin_app: 'memento' }, emailRedirectTo: RECUPERACION_MEMENTO,
        } })
        if (fallo) throw new Error('registro')
        if (montado.current && !data.session) setMensaje('Revisá tu correo para continuar. Si ya tenés cuenta, usá Iniciar sesión.')
      } else {
        const { error: fallo } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
        if (fallo) throw new Error('acceso')
      }
    } catch {
      if (montado.current) setError(modo === 'entrar' ? 'No pudimos iniciar sesión. Revisá tu correo y contraseña, o recuperá tu acceso.' : modo === 'crear' ? 'No pudimos crear la cuenta. Revisá los datos o intentá iniciar sesión si ya tenés una.' : ERROR_RED)
    } finally { activo.current = false; if (montado.current) { setOcupado(false); setClave('') } }
  }
  return <>
    <h2>{modo === 'entrar' ? 'Tu próxima historia empieza acá.' : modo === 'crear' ? 'Hacete parte.' : 'Volvé a tu cuenta.'}</h2>
    <p>{modo === 'recuperar' ? 'Te enviaremos un enlace para elegir una nueva contraseña.' : 'Si ya tenés cuenta en SWU El Salvador, entrá con el mismo correo y contraseña.'}</p>
    <form onSubmit={evento => void enviar(evento)} className="mm-formulario">
      {modo === 'crear' && <label>Cómo te llamás<input autoComplete="name" value={nombre} onChange={e => setNombre(e.target.value)} minLength={2} maxLength={64} required disabled={ocupado} /></label>}
      <label>Correo<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={correo} onChange={e => setCorreo(e.target.value)} maxLength={254} required disabled={ocupado} /></label>
      {modo !== 'recuperar' && <label>Contraseña<input type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} value={clave} onChange={e => setClave(e.target.value)} minLength={modo === 'crear' ? 8 : 1} maxLength={128} required disabled={ocupado} />{modo === 'crear' && <small>Usá al menos 8 caracteres.</small>}</label>}
      <Aviso texto={error} error /><Aviso texto={mensaje} />
      <button className="mm-boton" disabled={ocupado}>{ocupado ? 'Un momento…' : modo === 'entrar' ? 'Iniciar sesión' : modo === 'crear' ? 'Crear mi cuenta' : 'Enviar enlace'}<span aria-hidden="true">↗</span></button>
    </form>
    <div className="mm-alternativas">
      {modo === 'entrar' ? <><button className="mm-enlace" disabled={ocupado} onClick={() => cambiar('recuperar')}>Olvidé mi contraseña</button><div className="mm-separador" /><p>¿Primera vez por acá? <button className="mm-enlace" disabled={ocupado} onClick={() => cambiar('crear')}>Crear cuenta</button></p></> : <button className="mm-enlace" disabled={ocupado} onClick={() => cambiar('entrar')}>Ya tengo cuenta · Iniciar sesión</button>}
    </div>
  </>
}

export function RecuperarMementoPage() {
  const [enlace, setEnlace] = useState(() => leerEnlaceCorreo(window.location.hash))
  const [paso, setPaso] = useState<'confirmar' | 'clave' | 'listo'>('confirmar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const usuarioVerificado = useRef<string | null>(null)
  const tokenVerificado = useRef<string | null>(null)
  const escritura = useRef<AbortController | null>(null)
  const activo = useRef(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    // El fragmento no llega al servidor y se quita del historial. No se
    // persiste, registra ni consume el enlace por montar esta pantalla.
    window.history.replaceState(window.history.state, '', '/cuenta/recuperar')
    let identidadNativa: string | null | undefined
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, sesion) => {
      const siguiente = sesion?.user.id ?? null
      const invalidar = invalidaRecuperacion(evento, identidadNativa, siguiente)
      identidadNativa = siguiente
      if (!invalidar) return
      escritura.current?.abort()
      tokenVerificado.current = null
      usuarioVerificado.current = null
      setClave(''); setRepetida(''); setEnlace(null); setPaso('confirmar')
      setError('La cuenta del navegador cambió. Pedí un nuevo enlace para continuar.')
    })
    return () => { montado.current = false; tokenVerificado.current = null; escritura.current?.abort(); suscripcion.subscription.unsubscribe() }
  }, [])

  async function confirmar() {
    if (!enlace || activo.current) return
    activo.current = true; setOcupado(true); setError('')
    const controller = new AbortController()
    escritura.current = controller
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const verificado = await verificarCorreoExplicito(fetch, configuracionAuth, enlace, controller.signal)
      if (!montado.current || controller.signal.aborted) return
      usuarioVerificado.current = verificado.usuario
      tokenVerificado.current = verificado.token
      setCorreo(verificado.correo)
      setPaso(enlace.tipo === 'recovery' ? 'clave' : 'listo')
      setEnlace(null)
    } catch { if (montado.current) setError('El enlace venció, ya se usó o no pudo verificarse. Volvé a MEMENTO para solicitar otro.') }
    finally { clearTimeout(timer); activo.current = false; if (montado.current) setOcupado(false) }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (activo.current) return
    if (clave !== repetida) { setError('Las contraseñas no coinciden.'); return }
    activo.current = true; setOcupado(true); setError('')
    const controller = new AbortController()
    escritura.current = controller
    try {
      if (!tokenVerificado.current) throw new Error('cuenta_no_verificada')
      const actual = await esperarLectura(supabase.auth.getUser(tokenVerificado.current), controller.signal)
      if (!montado.current || controller.signal.aborted) return
      if (actual.error || !usuarioVerificado.current || !tokenVerificado.current || actual.data.user?.id !== usuarioVerificado.current) throw new Error('cuenta_cambio')
      const timer = setTimeout(() => controller.abort(), 20000)
      try {
        await actualizarClaveVerificada(fetch, configuracionAuth, { usuario: usuarioVerificado.current, token: tokenVerificado.current, clave }, controller.signal)
      } finally { clearTimeout(timer) }
      if (!montado.current || controller.signal.aborted) return
      tokenVerificado.current = null
      setClave(''); setRepetida(''); setPaso('listo')
    } catch { if (montado.current) setError('No se pudo actualizar la contraseña. Comprobá tu conexión y usá una contraseña distinta de la anterior. Si cambiaste de cuenta, pedí otro enlace.') }
    finally { activo.current = false; if (montado.current) setOcupado(false) }
  }

  function volver() {
    const id = retornoTemporal('leer')
    window.location.assign(id ? `/cuenta/autorizar?authorization_id=${encodeURIComponent(id)}` : 'https://mementohobby.com')
  }

  return <MarcoCuenta><p className="mm-etiqueta">CUENTA MEMENTO</p>
    {paso === 'confirmar' && <><h2>Recuperá tu acceso.</h2><p>{enlace ? 'Confirmá que querés usar este enlace para continuar con tu cuenta.' : 'Abrí el enlace del correo para continuar. Si ya lo usaste o recargaste esta pantalla, pedí uno nuevo desde MEMENTO.'}</p><Aviso texto={error} error />{enlace && <button className="mm-boton" onClick={() => void confirmar()} disabled={ocupado}>{ocupado ? 'Verificando…' : enlace.tipo === 'recovery' ? 'Verificar enlace' : 'Confirmar mi correo'}<span aria-hidden="true">↗</span></button>}<a className="mm-enlace" href="https://mementohobby.com">Volver a MEMENTO</a></>}
    {paso === 'clave' && <><h2>Una nueva contraseña.</h2><p>Se actualizará para tu cuenta en MEMENTO y SWU El Salvador.</p><div className="mm-identidad"><strong>{correo}</strong></div><form className="mm-formulario" onSubmit={e => void guardar(e)}><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={clave} onChange={e => setClave(e.target.value)} disabled={ocupado} required /><small>Usá al menos 8 caracteres.</small></label><label>Repetí la contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={repetida} onChange={e => setRepetida(e.target.value)} disabled={ocupado} required /></label><Aviso texto={error} error /><button className="mm-boton" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar contraseña'}</button></form></>}
    {paso === 'listo' && <><h2>Listo. Seguimos.</h2><Aviso texto="Tu cuenta está lista para continuar. Si no habías iniciado sesión, entrá con tu contraseña al volver." /><button className="mm-boton" onClick={volver}>Volver a MEMENTO <span aria-hidden="true">↗</span></button></>}
  </MarcoCuenta>
}
