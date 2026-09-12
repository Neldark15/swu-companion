import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { searchProfiles, type SearchableProfile } from '../../services/playerSearch'

export function NombreJugadorCalculadora({ indice, nombre, onNombre, children }: {
  indice: number
  nombre: string
  onNombre: (nombre: string) => void
  children: ReactNode
}) {
  const id = useId()
  const listaId = `${id}-usuarios`
  const estadoId = `${id}-estado`
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const generacion = useRef(0)
  const demora = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controlador = useRef<AbortController | null>(null)
  const ultimaConsulta = useRef<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<'buscando' | 'listo' | 'error'>('listo')
  const [error, setError] = useState('')
  const [resultados, setResultados] = useState<SearchableProfile[]>([])
  const [activo, setActivo] = useState(-1)
  const [nombreElegido, setNombreElegido] = useState<string | null>(null)

  const cancelar = useCallback(() => {
    generacion.current += 1
    clearTimeout(demora.current)
    clearTimeout(espera.current)
    demora.current = undefined
    espera.current = undefined
    controlador.current?.abort()
    controlador.current = null
  }, [])
  useEffect(() => cancelar, [cancelar])

  function cerrar() {
    cancelar()
    setAbierto(false)
    setActivo(-1)
  }

  function buscar(texto: string) {
    cancelar()
    const consulta = texto.trim()
    const version = generacion.current
    setResultados([])
    setActivo(-1)
    setError('')
    if (consulta.length < 2) {
      setAbierto(false)
      setEstado('listo')
      return
    }
    setAbierto(true)
    setEstado('buscando')
    demora.current = setTimeout(() => {
      if (version !== generacion.current) return
      const control = new AbortController()
      controlador.current = control
      const limite = setTimeout(() => {
        if (version !== generacion.current) return
        generacion.current += 1
        control.abort()
        setEstado('error')
        setError('La búsqueda tardó demasiado. Podés reintentar o usar el nombre escrito.')
      }, 8000)
      espera.current = limite
      void searchProfiles(consulta, { signal: control.signal, throwOnError: true }).then(perfiles => {
        if (version !== generacion.current) return
        setResultados(perfiles)
        setEstado('listo')
      }).catch(() => {
        if (version !== generacion.current) return
        setEstado('error')
        setError('No pudimos buscar jugadores. Podés reintentar o usar el nombre escrito.')
      }).finally(() => {
        clearTimeout(limite)
        if (espera.current === limite) espera.current = undefined
        if (controlador.current === control) controlador.current = null
      })
    }, 250)
  }

  function elegir(perfil: SearchableProfile) {
    const elegido = perfil.name.replace(/\s+/g, ' ').trim().slice(0, 32) || `Jugador ${indice + 1}`
    ultimaConsulta.current = null
    cerrar()
    setNombreElegido(elegido)
    onNombre(elegido)
    input.current?.focus()
  }

  function teclado(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing) return
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault()
      cerrar()
    } else if (evento.key === 'Enter' && abierto) {
      evento.preventDefault()
      if (activo >= 0 && resultados[activo]) elegir(resultados[activo])
      else cerrar()
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (!abierto) {
        if (ultimaConsulta.current !== null && nombre.trim().length >= 2) {
          evento.preventDefault()
          buscar(nombre)
        }
        return
      }
      evento.preventDefault()
      if (!resultados.length) return
      const siguiente = evento.key === 'ArrowDown'
        ? (activo + 1) % resultados.length
        : (activo < 0 ? resultados.length - 1 : (activo - 1 + resultados.length) % resultados.length)
      setActivo(siguiente)
      document.getElementById(`${listaId}-${siguiente}`)?.scrollIntoView({ block: 'nearest' })
    }
  }

  return <>
    <div className="calc-jugador-form">
      <span className="calc-asiento">0{indice + 1}</span>
      <div className="calc-nombre-campo">
        <input ref={input} role="combobox" aria-label={`Nombre del jugador ${indice + 1}`}
          aria-autocomplete="list" aria-expanded={abierto} aria-controls={abierto ? listaId : undefined}
          aria-activedescendant={abierto && activo >= 0 ? `${listaId}-${activo}` : undefined}
          aria-describedby={abierto ? estadoId : undefined} autoComplete="off" maxLength={32}
          value={nombre} placeholder={`Jugador ${indice + 1}`} onKeyDown={teclado}
          onChange={e => {
            ultimaConsulta.current = e.target.value
            setNombreElegido(null)
            onNombre(e.target.value)
            buscar(e.target.value)
          }}
          onFocus={() => { if (ultimaConsulta.current !== null) buscar(nombre) }}
          onBlur={e => { if (!panel.current?.contains(e.relatedTarget)) cerrar() }} />
        {nombreElegido === nombre && <small>Nombre de usuario elegido</small>}
      </div>
      {children}
    </div>
    {abierto && <div className="calc-usuarios-panel" ref={panel}
      onBlur={e => { if (e.relatedTarget !== input.current && !e.currentTarget.contains(e.relatedTarget)) cerrar() }}>
      <p className="calc-usuarios-estado" id={estadoId} role={estado === 'error' ? 'alert' : 'status'}>{estado === 'buscando'
        ? 'Buscando usuarios…'
        : estado === 'error' ? error
        : resultados.length ? 'Elegí un usuario o conservá el nombre como invitado.'
        : 'No encontramos usuarios. Podés seguir con este nombre como invitado.'}</p>
      <div className="calc-usuarios-lista" id={listaId} role="listbox"
        aria-label={`Usuarios para el jugador ${indice + 1}`} aria-busy={estado === 'buscando'}>
        {resultados.map((perfil, posicion) => <button type="button" role="option" tabIndex={-1}
          id={`${listaId}-${posicion}`} key={perfil.id} className="calc-usuarios-opcion"
          aria-selected={activo === posicion} onPointerDown={e => e.preventDefault()}
          onClick={() => elegir(perfil)}>
          <Avatar avatar={perfil.avatar} size={32} anillo={perfil.id} />
          <span>{perfil.name}<small>Usuario de HOLOCRON</small></span>
          {activo === posicion && <Check size={16} aria-hidden="true" />}
        </button>)}
      </div>
      {estado === 'error' && <button type="button" className="calc-secundario"
        onPointerDown={e => e.preventDefault()} onClick={() => buscar(nombre)}>Reintentar búsqueda</button>}
    </div>}
  </>
}
