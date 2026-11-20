import { CardImage, type CardImageProps } from '../../components/CardImage'
import { Acabado, type PropsAcabado } from './Acabado'

type Props = Omit<CardImageProps, 'children' | 'foil'> & Omit<PropsAcabado, 'acabado'> & {
  acabado?: PropsAcabado['acabado']
}

export function AcabadoDeImagen({ acabado, calidad, movimiento, ...imagen }: Props) {
  return (
    <CardImage {...imagen}>
      {acabado && <Acabado acabado={acabado} calidad={calidad} movimiento={movimiento} />}
    </CardImage>
  )
}
