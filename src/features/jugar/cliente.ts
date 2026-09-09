import { io, type Socket } from 'socket.io-client'
import { leerSala, objeto } from './tipos'
import type { ComandoJuego, ConfiguracionJuego, MazoOnline, SalaJuego } from './tipos'

export class ErrorJuego extends Error {
  readonly codigo: string
  readonly estado: number
  constructor(codigo: string, mensaje: string, estado = 0) {
    super(mensaje)
    this.name = 'ErrorJuego'
    this.codigo = codigo
    this.estado = estado
  }
}
export type ConexionJuego = 'conectando' | 'conectado' | 'reconectando'
interface EventosSala { sala: (respuesta: unknown) => void }
interface AccionPendiente { codigo: string; cuerpo: { id: string; revision: number; comando: ComandoJuego } }

export function normalizarUrlJuego(valor: string): string {
  if (!valor.trim()) return ''
  const url = new URL(valor)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('La dirección del servicio de juego no es válida.')
  }
  return url.origin
}

/** Solo transporta comandos e información autorizada; no ejecuta reglas. */
export class ClienteJuego {
  readonly url: string
  readonly usuarioId: string
  private obtenerToken: () => Promise<string>
  private socket: Socket<EventosSala> | null = null
  private pendiente: AccionPendiente | null = null
  private enviando = false
  private cerrada = false
  private cancelarSuscripcion: (() => void) | null = null
  private reconectarSuscripcion: (() => void) | null = null
  private revisionSesion = 0
  private solicitudes = new Set<AbortController>()

  constructor(url: string, usuarioId: string, obtenerToken: () => Promise<string>) {
    this.url = normalizarUrlJuego(url)
    this.usuarioId = usuarioId
    this.obtenerToken = obtenerToken
  }
  get hayJugadaPendiente() { return this.pendiente !== null }
  activar() { this.cerrada = false }

  async pedir(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; publico?: boolean; signal?: AbortSignal } = {}): Promise<unknown> {
    if (!this.url) throw new ErrorJuego('no_configurado', 'Las partidas online todavía no están habilitadas en esta versión.')
    if (this.cerrada) throw new ErrorJuego('sesion_cambiada', 'La sesión de juego cambió. Volvé a entrar.')
    const revisionSesion = this.revisionSesion
    const token = opciones.publico ? null : await this.obtenerToken()
    if (this.cerrada || revisionSesion !== this.revisionSesion) throw new ErrorJuego('sesion_cambiada', 'La sesión de juego cambió. Volvé a entrar.')
    const controller = new AbortController()
    const cancelar = () => controller.abort()
    opciones.signal?.addEventListener('abort', cancelar, { once: true })
    if (opciones.signal?.aborted) cancelar()
    this.solicitudes.add(controller)
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const respuesta = await fetch(this.url + ruta, {
        method: opciones.metodo ?? 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      })
      const contenido: unknown = await respuesta.json().catch(() => null)
      if (!respuesta.ok) {
        const error = objeto(objeto(contenido)?.error)
        throw new ErrorJuego(typeof error?.codigo === 'string' ? error.codigo : 'servicio',
          typeof error?.mensaje === 'string' ? error.mensaje : 'No se pudo completar la operación. Volvé a intentarlo.', respuesta.status)
      }
      if (this.cerrada || revisionSesion !== this.revisionSesion) throw new ErrorJuego('sesion_cambiada', 'La sesión de juego cambió. Volvé a entrar.')
      return contenido
    } catch (error) {
      if (error instanceof ErrorJuego) throw error
      throw new ErrorJuego('conexion', 'Se perdió la conexión con la partida. Reconectá para comprobar la última jugada.')
    } finally { clearTimeout(timer); opciones.signal?.removeEventListener('abort', cancelar); this.solicitudes.delete(controller) }
  }

  async configuracion(): Promise<ConfiguracionJuego> {
    const config = objeto(await this.pedir('/api/configuracion', { publico: true }))
    if (!config || typeof config.disponible !== 'boolean' || typeof config.versionMotor !== 'string'
      || config.formato !== 'premier' || config.modo !== 'bo1' || typeof config.desarrollo !== 'boolean') {
      throw new ErrorJuego('version', 'El servicio de juego usa una versión incompatible. Actualizá la app.')
    }
    return { disponible: config.disponible, versionMotor: config.versionMotor,
      formato: 'premier', modo: 'bo1', desarrollo: config.desarrollo }
  }
  async usuario(): Promise<{ id: string; nombre: string }> {
    const usuario = objeto(objeto(await this.pedir('/api/usuario'))?.usuario)
    if (!usuario || usuario.id !== this.usuarioId || typeof usuario.nombre !== 'string') {
      throw new ErrorJuego('sesion_cambiada', 'La cuenta activa cambió. Volvé a entrar a Jugar online.')
    }
    return { id: this.usuarioId, nombre: usuario.nombre }
  }
  async leer(codigo: string, signal?: AbortSignal): Promise<SalaJuego> {
    return leerSala(await this.pedir(`/api/salas/${encodeURIComponent(codigo)}`, { signal }), this.usuarioId)
  }
  async propia(): Promise<SalaJuego | null> {
    const respuesta = await this.pedir('/api/salas/mia')
    if (objeto(respuesta)?.sala === null) return null
    return leerSala(respuesta, this.usuarioId)
  }
  async crear(mazo: MazoOnline): Promise<SalaJuego> {
    return leerSala(await this.pedir('/api/salas', { metodo: 'POST', cuerpo: { mazo: mazo.mazo, mazoNombre: mazo.nombre } }), this.usuarioId)
  }
  async unirse(codigo: string, mazo: MazoOnline): Promise<SalaJuego> {
    return leerSala(await this.pedir(`/api/salas/${encodeURIComponent(codigo)}/unirse`, {
      metodo: 'POST', cuerpo: { mazo: mazo.mazo, mazoNombre: mazo.nombre },
    }), this.usuarioId)
  }
  async preparado(codigo: string, preparado: boolean): Promise<SalaJuego> {
    return leerSala(await this.pedir(`/api/salas/${encodeURIComponent(codigo)}/preparado`, {
      metodo: 'POST', cuerpo: { preparado },
    }), this.usuarioId)
  }
  async cambiarMazo(codigo: string, mazo: MazoOnline): Promise<SalaJuego> {
    return leerSala(await this.pedir(`/api/salas/${encodeURIComponent(codigo)}/mazo`, {
      metodo: 'POST', cuerpo: { mazo: mazo.mazo, mazoNombre: mazo.nombre },
    }), this.usuarioId)
  }
  async salir(codigo: string): Promise<void> {
    await this.pedir(`/api/salas/${encodeURIComponent(codigo)}/salir`, { metodo: 'POST', cuerpo: {} })
  }

  async enviar(codigo: string, revision: number, comando: ComandoJuego): Promise<SalaJuego> {
    if (this.pendiente) throw new ErrorJuego('pendiente', 'Primero hay que confirmar la jugada anterior. Tocá Reintentar jugada.')
    this.pendiente = { codigo, cuerpo: { id: crypto.randomUUID(), revision, comando: structuredClone(comando) } }
    return this.reintentar()
  }
  async reintentar(): Promise<SalaJuego> {
    if (!this.pendiente) throw new ErrorJuego('sin_pendiente', 'No hay una jugada pendiente.')
    if (this.enviando) throw new ErrorJuego('enviando', 'La jugada se está enviando.')
    this.enviando = true
    const pendiente = this.pendiente
    try {
      const sala = leerSala(await this.pedir(`/api/salas/${encodeURIComponent(pendiente.codigo)}/acciones`, {
        metodo: 'POST', cuerpo: pendiente.cuerpo,
      }), this.usuarioId)
      this.pendiente = null
      return sala
    } catch (error) {
      // Un rechazo explícito del servidor permite elegir de nuevo. Una respuesta
      // perdida conserva UUID/payload para comprobarla sin duplicar efectos.
      if (error instanceof ErrorJuego && error.estado >= 400 && error.estado < 500) this.pendiente = null
      throw error
    } finally { this.enviando = false }
  }

  suscribir(codigo: string, recibir: (sala: SalaJuego) => void, conexion: (valor: ConexionJuego) => void, fallo: (error: Error) => void): () => void {
    this.cancelarSuscripcion?.()
    let viva = true
    let intento = 0
    let iniciada = false
    let ultimaRevision = -1
    let demora = 750
    let reintento: ReturnType<typeof setTimeout> | null = null
    let transporte: Socket<EventosSala> | null = null
    let lectura: AbortController | null = null
    const vigente = (numero: number) => viva && !this.cerrada && numero === intento
    const aplicar = (respuesta: unknown) => {
      const sala = leerSala(respuesta, this.usuarioId)
      if (sala.codigo !== codigo) throw new ErrorJuego('sala_incorrecta', 'El servicio respondió con otra sala.')
      if (sala.revision < ultimaRevision) return
      ultimaRevision = sala.revision
      recibir(sala)
    }
    const limpiarIntento = () => {
      intento += 1
      if (reintento) clearTimeout(reintento)
      reintento = null
      lectura?.abort()
      lectura = null
      if (transporte) {
        transporte.removeAllListeners()
        transporte.disconnect()
        if (this.socket === transporte) this.socket = null
        transporte = null
      }
    }
    const programar = (error?: unknown) => {
      if (!viva || this.cerrada) return
      limpiarIntento()
      conexion('reconectando')
      if (error) fallo(error instanceof Error ? error : new Error('No se pudo conectar con la partida.'))
      reintento = setTimeout(() => { void intentar() }, demora)
      demora = Math.min(demora * 2, 5_000)
    }
    const intentar = async () => {
      if (!viva || this.cerrada) return
      limpiarIntento()
      const numero = intento
      conexion(iniciada ? 'reconectando' : 'conectando')
      iniciada = true
      try {
        // Resolver Auth antes de abrir transporte evita dejar un callback de
        // Socket.IO esperando indefinidamente si la renovación del token falla.
        const token = await this.obtenerToken()
        if (!vigente(numero)) return
        const socket: Socket<EventosSala> = io(this.url, {
          path: '/ws', autoConnect: false, reconnection: false, forceNew: true,
          timeout: 12_000, withCredentials: false, auth: { token, codigo },
        })
        transporte = socket
        this.socket = socket
        socket.on('sala', respuesta => {
          if (!vigente(numero)) return
          try { aplicar(respuesta) } catch (error) { programar(error) }
        })
        socket.on('connect', () => {
          // La conexión solo habilita acciones después de un GET autoritativo.
          const controller = new AbortController()
          lectura = controller
          void this.leer(codigo, controller.signal).then(sala => {
            if (!vigente(numero) || !socket.connected) return
            aplicar({ sala })
            demora = 750
            conexion('conectado')
          }).catch(error => { if (vigente(numero)) programar(error) })
            .finally(() => { if (lectura === controller) lectura = null })
        })
        socket.on('disconnect', motivo => {
          // Socket.IO no reintenta io server disconnect; usamos la misma cola
          // acotada para ese cierre y para una pérdida normal de transporte.
          if (vigente(numero) && motivo !== 'io client disconnect') programar()
        })
        socket.on('connect_error', error => { if (vigente(numero)) programar(error) })
        socket.connect()
      } catch (error) { if (vigente(numero)) programar(error) }
    }
    const reconciliar = () => {
      if (viva && !document.hidden) void intentar()
    }
    const renovar = () => { if (viva) void intentar() }
    const cancelar = () => {
      if (!viva) return
      viva = false
      limpiarIntento()
      document.removeEventListener('visibilitychange', reconciliar)
      window.removeEventListener('online', reconciliar)
      if (this.cancelarSuscripcion === cancelar) {
        this.cancelarSuscripcion = null
        this.reconectarSuscripcion = null
      }
    }
    this.cancelarSuscripcion = cancelar
    this.reconectarSuscripcion = renovar
    document.addEventListener('visibilitychange', reconciliar)
    window.addEventListener('online', reconciliar)
    void intentar()
    return cancelar
  }
  renovarConexion() { this.reconectarSuscripcion?.() }
  cerrar() {
    this.cerrada = true
    this.revisionSesion += 1
    this.cancelarSuscripcion?.()
    for (const controller of this.solicitudes) controller.abort()
    this.solicitudes.clear()
    this.socket = null
    this.pendiente = null
  }
}
