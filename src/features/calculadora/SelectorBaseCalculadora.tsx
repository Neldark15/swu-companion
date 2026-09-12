import { useEffect, useId, useState } from 'react'
import { Check, Search, Shield } from 'lucide-react'
import { CardImage } from '../../components/CardImage'
import { db } from '../../services/db'
import { isDatabaseComplete, loadFullDatabase, subscribeDbLoadProgress } from '../../services/swuApi'
import type { BaseCalculadora } from './estadoCalculadora'
import { catalogoBasesCalculadora, filtrarBasesCalculadora, type OpcionBaseCalculadora } from './basesCalculadora'

const TAMANO_PAGINA = 24

export function SelectorBaseCalculadora({ elegida, onElegir }: {
  elegida: BaseCalculadora | null
  onElegir: (base: BaseCalculadora) => void
}) {
  const idBusqueda = useId()
  const [bases, setBases] = useState<OpcionBaseCalculadora[]>([])
  const [consulta, setConsulta] = useState('')
  const [limite, setLimite] = useState(TAMANO_PAGINA)
  const [intento, setIntento] = useState(0)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error' | 'sin-conexion'>('cargando')

  useEffect(() => {
    let vigente = true
    let dejarDeEscuchar: (() => void) | undefined
    async function cargar() {
      try {
        const leer = async () => catalogoBasesCalculadora(await db.cards.where('type').equals('Base').toArray())
        let disponibles = await leer()
        if (!vigente) return
        // Las bases locales siguen siendo seleccionables mientras se completa
        // el catálogo: una sola carta no demuestra que la caché esté completa.
        setBases(disponibles)
        if (navigator.onLine === false) {
          setEstado('sin-conexion')
          return
        }
        const completo = await isDatabaseComplete()
        if (!vigente) return
        if (!completo || !disponibles.length || intento > 0) {
          let falloCarga = false
          dejarDeEscuchar = subscribeDbLoadProgress(progreso => {
            if (progreso.phase === 'error') falloCarga = true
          })
          try {
            // _dbReady puede seguir activo después de una escritura parcial.
            // Forzar una caché incompleta evita que ese flag omita la carga.
            await loadFullDatabase({ force: intento > 0 || !completo })
          } finally {
            dejarDeEscuchar()
            dejarDeEscuchar = undefined
          }
          if (!vigente) return
          disponibles = await leer()
          const completoAhora = await isDatabaseComplete()
          if (!vigente) return
          setBases(disponibles)
          // El servicio informa algunos fallos por progreso y devuelve la
          // cantidad anterior; resolver la promesa no significa éxito.
          setEstado(falloCarga || !completoAhora ? 'error' : 'listo')
          return
        }
        setEstado('listo')
      } catch {
        if (vigente) setEstado('error')
      }
    }
    void cargar()
    return () => { vigente = false; dejarDeEscuchar?.() }
  }, [intento])

  function reintentar() {
    setEstado('cargando')
    setIntento(anterior => anterior + 1)
  }

  const filtradas = filtrarBasesCalculadora(bases, consulta)
  return <div className="calc-bases">
    <label className="calc-bases-buscador" htmlFor={idBusqueda}>
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">Buscar base por nombre o expansión</span>
      <input id={idBusqueda} type="search" placeholder="Buscar base o expansión" value={consulta}
        autoComplete="off" onChange={e => { setConsulta(e.target.value); setLimite(TAMANO_PAGINA) }} />
    </label>
    {estado === 'cargando' && <p className="calc-bases-estado" role="status">{bases.length ? 'Actualizando catálogo… Podés elegir una base guardada.' : 'Cargando bases…'}</p>}
    {estado === 'error' && <div className="calc-bases-estado" role="alert">
      <p>{bases.length ? 'No pudimos actualizar el catálogo. Podés elegir una base guardada o reintentar.' : 'No pudimos cargar las bases. Podés reintentar o cerrar y usar una vida manual.'}</p>
      <button type="button" className="calc-secundario" onClick={reintentar}>Reintentar</button>
    </div>}
    {(estado === 'listo' || estado === 'sin-conexion') && bases.length === 0 && <div className="calc-bases-estado">
      <p>No hay bases disponibles en este dispositivo. Conectate y reintentá; también podés cerrar y usar una vida manual.</p>
      <button type="button" className="calc-secundario" onClick={reintentar}>Reintentar</button>
    </div>}
    {estado === 'sin-conexion' && bases.length > 0 && <p className="calc-bases-estado" role="status">Sin conexión. Podés elegir una base guardada o usar vida manual.</p>}
    {bases.length > 0 && <>
      <p className="calc-bases-resumen" role="status">{filtradas.length} {filtradas.length === 1 ? 'base disponible' : 'bases disponibles'}</p>
      {filtradas.length === 0 && <p className="calc-bases-estado">No encontramos esa base. Probá otro nombre o expansión.</p>}
      <div className="calc-bases-lista">
        {filtradas.slice(0, limite).map(base => <button key={base.id} type="button"
          className={`calc-bases-opcion${elegida?.id === base.id ? ' elegida' : ''}`}
          aria-pressed={elegida?.id === base.id}
          aria-label={`Elegir ${base.nombre}, ${base.expansion}, ${base.vidaImpresa} de vida`}
          onClick={() => onElegir({ id: base.id, nombre: base.nombre, imagen: base.imagen, vidaImpresa: base.vidaImpresa, usaFuerza: base.usaFuerza })}>
          <CardImage src={base.imagen} alt="" className="calc-bases-imagen" orientacion="apaisada" relleno={false} />
          <span className="calc-bases-info"><strong>{base.nombre}</strong>
            <span className="calc-bases-meta">{base.expansion} · {String(base.numero).padStart(3, '0')}</span>
            <span className="calc-bases-vida"><Shield size={13} aria-hidden="true" /> {base.vidaImpresa} de vida{base.usaFuerza && ' · Fuerza'}</span>
          </span>
          {elegida?.id === base.id && <Check className="calc-bases-elegida" size={18} aria-hidden="true" />}
        </button>)}
      </div>
      {filtradas.length > limite && <button type="button" className="calc-bases-mas calc-secundario"
        onClick={() => setLimite(anterior => anterior + TAMANO_PAGINA)}>Ver más ({filtradas.length - limite})</button>}
      {estado !== 'error' && <button type="button" className="calc-secundario" disabled={estado === 'cargando'}
        onClick={reintentar}>Actualizar catálogo</button>}
    </>}
  </div>
}
