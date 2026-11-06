import { Component, lazy, Suspense } from 'react'

interface Props {
  valores: number[]
  tirada: number
}

const cargarDado = () => import('../utilities/Dice3D').then(modulo => ({ default: modulo.Dice3D }))

/** El resultado es local; el 3D opcional nunca bloquea tirar dados sin conexión. */
export class DadosMesa extends Component<Props> {
  state = { error: false, Dado: lazy(cargarDado) }

  static getDerivedStateFromError() { return { error: true } }

  private reintentar = () => {
    // React.lazy conserva un rechazo: un intento nuevo necesita otra instancia.
    this.setState({ error: false, Dado: lazy(cargarDado) })
  }

  private resultado(mensaje: string) {
    const { valores, tirada } = this.props
    return <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-swu-border bg-swu-bg p-3" role="status">
      <span className="font-mono text-3xl font-bold text-swu-cyan" aria-label={tirada ? `Dados: ${valores.join(', ')}` : undefined}>{tirada ? valores.join(' · ') : 'Listo para tirar'}</span>
      <p className="text-center text-xs text-swu-muted">{mensaje}</p>
    </div>
  }

  render() {
    if (this.state.error) return <>
      {this.resultado('La vista 3D no está disponible. Podés seguir tirando y usar estos resultados.')}
      <button className="mt-2 min-h-11 w-full rounded-xl border border-swu-border px-3 text-xs font-bold text-swu-text" onClick={this.reintentar}>Reintentar vista 3D</button>
    </>
    const Dado = this.state.Dado
    return <Suspense fallback={this.resultado('Cargando vista 3D. Los resultados ya están disponibles.')}>
      <Dado {...this.props} className="h-40" />
    </Suspense>
  }
}
