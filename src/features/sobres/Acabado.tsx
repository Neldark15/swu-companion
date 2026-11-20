import type { Acabado as TipoAcabado } from '../../services/sobres'

export interface PropsAcabado {
  acabado: TipoAcabado
  calidad?: 'completo' | 'plano'
  movimiento?: 'gesto' | 'solo'
}

export function Acabado({ acabado, calidad = 'completo', movimiento = 'gesto' }: PropsAcabado) {
  if (calidad === 'plano') {
    return <span className={`foil-plano foil-plano-${acabado}`} />
  }
  return (
    <span className={`foil-caja foil-${movimiento}`}>
      <span className={acabado === 'foil' ? 'foil-arcoiris' : acabado === 'metal' ? 'foil-metal' : 'foil-oro'} />
      <span className="foil-trama" />
      <span className="foil-lustre" />
    </span>
  )
}
