import { useState, type ReactNode } from 'react'
import { comandoBoton, comandoDistribucion, textoJuego, validarDistribucion } from './vistaJuego'
import type { CartaJuego, ComandoTablero, PromptJuego, RepartoJuego } from './vistaJuego'

interface Props {
  prompt: PromptJuego
  cartas: CartaJuego[]
  ocupado: boolean
  enviar: (comando: ComandoTablero) => Promise<void>
  renderCarta: (carta: CartaJuego, prompt?: PromptJuego) => ReactNode
}

/** Cada promptUuid monta un formulario nuevo: nunca reenviar elecciones de un prompt anterior. */
export function OpcionesJuego({ prompt, cartas, ocupado, enviar, renderCarta }: Props) {
  const [valor, setValor] = useState(String(prompt.numero?.min ?? ''))
  const [opcion, setOpcion] = useState(prompt.opciones[0] ?? '')
  const [reparto, setReparto] = useState<RepartoJuego[]>([])
  const d = prompt.distribucion
  const total = reparto.reduce((s, r) => s + r.amount, 0)
  const errorReparto = d ? validarDistribucion(prompt, reparto, cartas) : null
  const numeroValido = prompt.numero && valor.trim() !== '' && Number.isInteger(Number(valor)) && Number(valor) >= prompt.numero.min && Number(valor) <= prompt.numero.max
  const disponibles = cartas.filter(c => c.seleccionable && c.uuid)
  const hayEleccion = disponibles.length > 0 || prompt.botones.length > 0 || prompt.cartas.length > 0 || prompt.numero || prompt.opciones.length > 0
  const cambiarCantidad = (uuid: string, cantidad: number) => {
    setReparto(actual => [...actual.filter(r => r.uuid !== uuid), ...(cantidad > 0 ? [{ uuid, amount: cantidad }] : [])])
  }
  return <section className="juego-opciones" aria-label="Elección del motor" aria-busy={ocupado}>
    <div className="juego-opciones-titulo" aria-live="polite">
      <span className="juego-ceja">{ocupado ? 'Controles en pausa' : hayEleccion ? 'Tu siguiente paso' : 'Esperando'}</span>
      {prompt.titulo && <h2>{textoJuego(prompt.titulo)}</h2>}
      <p>{textoJuego(prompt.descripcion) || 'Esperando el siguiente estado de la partida.'}</p>
      {prompt.restantes !== null && <p>Quedan {prompt.restantes} habilidades de este grupo.</p>}
      {prompt.multiple && <p className="juego-ayuda">Tocá las cartas resaltadas para elegirlas o quitar la selección.</p>}
      {(prompt.ordenar || prompt.cartas.some(c => c.orden !== null)) && <p className="juego-ayuda">Elegí las cartas en orden. El número indica el orden confirmado; tocá una seleccionada para quitarla.</p>}
    </div>
    {prompt.cartas.length > 0 && <div className="juego-eleccion-cartas">
      {prompt.cartas.map(carta => <div key={carta.clave} className="juego-eleccion-carta">
        {renderCarta(carta, prompt)}
        {carta.texto && <p className="juego-ayuda">{carta.texto}</p>}
        {prompt.botonesCarta.map((boton, i) => {
          const comando = comandoBoton(boton, prompt, carta)
          return <button key={`${boton.argumento}-${i}`} type="button" disabled={ocupado || !comando} onClick={() => { if (comando) void enviar(comando) }}>{textoJuego(boton.texto)}</button>
        })}
      </div>)}
    </div>}
    {prompt.opciones.length > 0 && <form className="juego-form-eleccion" onSubmit={e => { e.preventDefault(); if (prompt.uuid && prompt.opciones.includes(opcion) && !ocupado) void enviar({ nombre: 'menuButton', args: [opcion, prompt.uuid] }) }}>
      <label>Opción<select value={opcion} disabled={ocupado} onChange={e => setOpcion(e.target.value)}>{prompt.opciones.map(o => <option key={o} value={o}>{textoJuego(o)}</option>)}</select></label>
      <button type="submit" disabled={ocupado || !prompt.uuid || !prompt.opciones.includes(opcion)}>Confirmar opción</button>
    </form>}
    {prompt.numero && <form className="juego-form-eleccion" onSubmit={e => { e.preventDefault(); if (numeroValido && prompt.uuid && !ocupado) void enviar({ nombre: 'menuButton', args: [Number(valor), prompt.uuid] }) }}>
      <label>Número ({prompt.numero.min} a {prompt.numero.max})<input type="number" inputMode="numeric" min={prompt.numero.min} max={prompt.numero.max} step={1} value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} /></label>
      <button type="submit" disabled={ocupado || !numeroValido || !prompt.uuid}>Confirmar número</button>
    </form>}
    {d && <div className="juego-reparto">
      <p><strong>{total} / {d.cantidad}</strong> {d.tipo === 'distributeHealing' ? 'de curación' : d.tipo === 'distributeTokenUpgrade' ? `fichas ${d.ficha ?? ''}` : 'de daño'} asignados{d.maxObjetivos !== null ? ` · hasta ${d.maxObjetivos} objetivos` : ''}</p>
      {disponibles.map(carta => {
        const cantidad = reparto.find(r => r.uuid === carta.uuid)?.amount ?? 0
        const limiteUnidad = d.indirecto && carta.tipo.toLowerCase().includes('unit') && carta.salud !== null && carta.dano !== null ? Math.max(0, carta.salud - carta.dano) : d.cantidad
        const maximo = Math.min(d.cantidad - total + cantidad, limiteUnidad)
        const nuevoObjetivoBloqueado = cantidad === 0 && d.maxObjetivos !== null && reparto.length >= d.maxObjetivos
        return <div className="juego-reparto-fila" key={carta.clave}>
          <span>{carta.nombre}{carta.salud !== null && carta.dano !== null && <small>{carta.salud - carta.dano} de salud restante</small>}</span>
          <div className="juego-contador">
            <button type="button" aria-label={`Quitar un punto a ${carta.nombre}`} disabled={ocupado || cantidad === 0} onClick={() => { if (carta.uuid) cambiarCantidad(carta.uuid, cantidad - 1) }}>−</button>
            <output aria-label={`Asignado a ${carta.nombre}`}>{cantidad}</output>
            <button type="button" aria-label={`Asignar un punto a ${carta.nombre}`} disabled={ocupado || cantidad >= maximo || nuevoObjetivoBloqueado} onClick={() => { if (carta.uuid) cambiarCantidad(carta.uuid, cantidad + 1) }}>+</button>
          </div>
        </div>
      })}
      {errorReparto && <p className="juego-ayuda">{errorReparto}</p>}
      <div className="juego-botones">
        <button type="button" disabled={ocupado || reparto.length === 0} onClick={() => setReparto([])}>Reiniciar reparto</button>
        <button type="button" className="juego-primario" disabled={ocupado || !!errorReparto} onClick={() => { const comando = comandoDistribucion(prompt, reparto, cartas); if (comando) void enviar(comando) }}>Confirmar reparto</button>
      </div>
    </div>}
    <div className="juego-botones">
      {prompt.botones.filter(b => b.comando !== 'statefulPromptResults' || !d).map((boton, i) => {
        const comando = comandoBoton(boton, prompt)
        return <button type="button" key={`${boton.argumento}-${i}`} className={boton.argumento === 'done' || boton.seleccionado ? 'juego-primario' : ''} aria-pressed={boton.seleccionado ?? undefined} disabled={ocupado || !comando} onClick={() => { if (comando) void enviar(comando) }}>
          {boton.origen && <small>{boton.origen.nombre}</small>}{boton.seleccionado ? '✓ ' : ''}{textoJuego(boton.texto)}{boton.cantidad !== null && boton.cantidad > 1 ? ` ×${boton.cantidad}` : ''}
        </button>
      })}
    </div>
  </section>
}
