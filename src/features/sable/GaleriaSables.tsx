import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, RotateCw } from 'lucide-react'
import type { ParteTaller } from '../../services/sableService'
import { SableEscena, type Encuadre } from './SableEscena'
import type { Diseno } from './partesSable'
import { MODELOS_GALERIA, disenoParaEquipar, type ModeloGaleria } from './modelosGaleria'
import './galeriaSables.css'

interface Props {
  actual: Diseno
  partes: ParteTaller[]
  ocupado: boolean
  alUsar: (diseno: Diseno) => void
}

function foto(id: string) { return `/kyber/modelos/${id}.webp` }

export function GaleriaSables({ actual, partes, ocupado, alUsar }: Props) {
  const [modelo, setModelo] = useState<ModeloGaleria | null>(null)
  const [encuadre, setEncuadre] = useState<Encuadre>('detalle')
  const [sinWebGL, setSinWebGL] = useState(false)
  const ultimoBotonId = useRef<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    if (modelo) {
      titulo.current?.focus({ preventScroll: true })
      titulo.current?.scrollIntoView({ block: 'nearest' })
    } else if (ultimoBotonId.current) {
      document.getElementById(ultimoBotonId.current)?.focus()
    }
  }, [modelo])

  if (!modelo) return <section aria-label="Galería de sables">
    <div className="kyber-galeria-cabecera"><h2>Modelos de sable</h2><span>{MODELOS_GALERIA.length} modelos</span></div>
    <div className="kyber-galeria-grid">
      {MODELOS_GALERIA.map((m, indice) =>
        <button type="button" className="kyber-modelo" key={m.id} id={`modelo-${m.id}`}
          aria-label={`Ver ${m.nombre}, ${m.tipo}`}
          onClick={e => { ultimoBotonId.current = e.currentTarget.id; setEncuadre('detalle'); setModelo(m) }}>
          <img src={foto(m.id)} alt="" width="512" height="448" loading={indice < 4 ? 'eager' : 'lazy'} decoding="async" />
          <span className="kyber-modelo-rotulo"><strong>{m.nombre}</strong><ChevronRight size={16} aria-hidden="true" /><small>{m.tipo}</small></span>
        </button>)}
    </div>
  </section>

  const equipable = disenoParaEquipar(modelo, actual, partes)
  const cristal = partes.find(p => p.id === equipable?.color)
  return <section className="kyber-galeria-detalle" aria-labelledby="kyber-modelo-titulo">
    <button type="button" className="kyber-modelos-volver" onClick={() => setModelo(null)}>
      <ArrowLeft size={16} aria-hidden="true" /> Todos los modelos
    </button>
    <h2 ref={titulo} id="kyber-modelo-titulo" tabIndex={-1}>{modelo.nombre}</h2>
    <div className="kyber-area-trabajo">
      <div className="kyber-vista">
        <div className="kyber-visor">
          {sinWebGL
            ? <img className="kyber-modelo-foto" src={foto(modelo.id)} alt={modelo.tipo} />
            : <><SableEscena className="kyber-lienzo" diseno={modelo.diseno} encendido encuadre={encuadre}
              onSinWebGL={() => setSinWebGL(true)} />
              <span className="kyber-gesto"><RotateCw size={12} aria-hidden="true" /> Arrastrá para girar</span></>}
        </div>
        {!sinWebGL && <div className="kyber-encuadre" role="group" aria-label="Encuadre del modelo">
          {(['detalle', 'completo'] as const).map(e => <button key={e} type="button"
            aria-pressed={encuadre === e} onClick={() => setEncuadre(e)}>{e === 'detalle' ? 'Detalle' : 'Completo'}</button>)}
        </div>}
      </div>
      <div className="kyber-modelo-ficha">
        <h3>{modelo.tipo}</h3><p>{modelo.descripcion}</p>
        <button type="button" className="kyber-principal" disabled={!equipable || ocupado}
          onClick={() => { if (equipable) alUsar(equipable) }}>Usar modelo</button>
        <p className="kyber-ayuda">{!equipable ? 'Las piezas de este modelo todavía no están disponibles en tu taller.'
          : equipable.color !== modelo.diseno.color ? `Se equipará con tu cristal ${cristal?.nombre.toLocaleLowerCase('es-SV') ?? 'actual'}.`
          : 'Podés cambiar sus piezas y su cristal antes de forjarlo.'}</p>
      </div>
    </div>
  </section>
}
