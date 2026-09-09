import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EspacioJuego } from './JugarPage'
import type { ClienteJuego } from './cliente'
import { leerMazoMotor } from './mazos'
import { objeto, type SalaJuego } from './tipos'
import type { OpcionMazo } from './mazosCloud'
import { ensureCards } from '../../services/swuApi'

async function mazosDePrueba(cliente: ClienteJuego): Promise<OpcionMazo[]> {
  const respuesta = objeto(await cliente.pedir('/api/mazos-ejemplo'))
  if (!respuesta || !Array.isArray(respuesta.mazos)) throw new Error('El servicio no tiene mazos de prueba disponibles.')
  return respuesta.mazos.map((valor: unknown) => {
    const entrada = objeto(valor)
    if (!entrada || typeof entrada.id !== 'string' || typeof entrada.nombre !== 'string') throw new Error('El mazo de prueba está incompleto.')
    const mazo = leerMazoMotor(entrada.mazo)
    return { id: entrada.id, nombre: entrada.nombre, listo: { id: entrada.id, nombre: entrada.nombre, mazo } }
  })
}

/** Solo el router DEV importa este archivo. No crea cuentas ni datos cloud. */
export function BancoJugar() {
  const [params, setParams] = useSearchParams()
  const valor = params.get('jugador')
  const jugador = valor === 'beta' || valor === 'gamma' ? valor : 'alpha'
  const codigo = params.get('sala') ?? undefined
  /* Las dos pantallas que la gente SÍ puede ver hoy —el módulo sin servicio y
     el módulo con la variable mal escrita— viven detrás de la puerta de
     instalación en `/jugar`, así que sin este selector no hay forma de mirarlas
     en un navegador normal. Y son justo las dos que se publican: el servicio
     todavía no está encendido. */
  const servicio = params.get('servicio')
  const url = servicio === 'vacio' ? ''
    : servicio === 'malo' ? 'juego.swusv.com/sala?x=1'
    : 'http://127.0.0.1:3001'
  const token = useCallback(() => Promise.resolve(`dev:${jugador}`), [jugador])
  const abrir = useCallback((sala: SalaJuego) => {
    setParams({ jugador, sala: sala.codigo }, { replace: true })
  }, [jugador, setParams])
  const salir = useCallback(() => setParams({ jugador }, { replace: true }), [jugador, setParams])
  useEffect(() => { void ensureCards().catch(() => { /* El tablero mantiene nombres cuando falta arte local. */ }) }, [])
  const otro = jugador === 'alpha' ? 'beta' : 'alpha'
  return <main className="min-h-dvh bg-swu-bg text-swu-text max-w-6xl mx-auto pb-6">
    <div className="p-3 border-b border-amber-500/40 bg-amber-500/10 text-xs space-y-2">
      <p className="font-semibold text-amber-300">BANCO LOCAL · Dos jugadores de desarrollo · Motor real</p>
      <div className="flex items-center gap-3 flex-wrap"><label>Jugador <select className="rounded bg-swu-surface border border-swu-border px-2 py-2" value={jugador}
        onChange={event => setParams({ jugador: event.target.value, ...(codigo ? { sala: codigo } : {}) })}>
        <option value="alpha">Piloto Alfa</option><option value="beta">Piloto Beta</option><option value="gamma">Tercero (sin asiento)</option>
      </select></label>
        <a className="underline min-h-10 flex items-center" target="_blank" rel="noreferrer" href={`/banco-jugar?jugador=${otro}${codigo ? `&sala=${codigo}` : ''}`}>Abrir rival en otra pestaña</a>
        <label>Servicio <select className="rounded bg-swu-surface border border-swu-border px-2 py-2" value={servicio ?? 'local'}
          onChange={event => setParams({ jugador, servicio: event.target.value, ...(codigo ? { sala: codigo } : {}) })}>
          <option value="local">Local (127.0.0.1:3001)</option>
          <option value="vacio">Sin configurar — lo que se publica hoy</option>
          <option value="malo">VITE_JUEGO_URL mal escrita</option>
        </select></label></div>
    </div>
    <EspacioJuego key={`${jugador}:${codigo ?? ''}:${servicio ?? ''}`} usuarioId={`dev-${jugador}`} obtenerToken={token}
      url={url} cargarMazos={mazosDePrueba} codigoInicial={codigo}
      alAbrirSala={abrir} alSalir={salir} desarrollo />
  </main>
}
