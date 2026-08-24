/**
 * De cada OBJETIVO a su ícono.
 *
 * Va en archivo aparte y no dentro de `MisionIcons.tsx` porque un módulo que
 * exporta componentes Y una constante rompe el Fast Refresh de Vite: al
 * guardar el archivo se recarga la página entera en vez de recomponer. Es la
 * misma separación que ya hubo que hacer entre `piezas.tsx` y `estado.ts` del
 * Contador.
 *
 * Y también vive fuera de `misionesCatalogo.ts`: ese es puro y sin red, y
 * meterle JSX lo ataría a React, que es justo lo que impide probarlo en Node.
 */

import type { ObjectiveType } from '../../services/misionesCatalogo'
import { AnuncioIcon, HolocronIcon, DeckCardsIcon, ChanceCubeIcon, MandoTrophyIcon } from '../SWIcons'
import { IconGlowingStar } from './SWUIcons'
import {
  BalizaIcon, ApoyoIcon, CartaMasIcon, EtiquetaIcon, MazoCompartidoIcon, RegaloIcon,
  SobreMisionIcon, ChatMisionIcon, AmistosaIcon, LaBuscoIcon,
} from './MisionIcons'

export type IconoMision = (p: { size?: number; className?: string }) => React.ReactElement

export const ICONO_POR_OBJETIVO: Record<ObjectiveType, IconoMision> = {
  dia_visitado: BalizaIcon,
  sobre_abierto: SobreMisionIcon,
  muro_publicado: AnuncioIcon,
  post_apoyado: ApoyoIcon,
  trivia_respondida: HolocronIcon,
  card_favorited: IconGlowingStar,
  carta_agregada: CartaMasIcon,
  carta_deseada: LaBuscoIcon,
  chat_enviado: ChatMisionIcon,
  deck_created: DeckCardsIcon,
  carta_en_venta: EtiquetaIcon,
  mazo_compartido: MazoCompartidoIcon,
  amistosa_registrada: AmistosaIcon,
  match_played: ChanceCubeIcon,
  match_won: MandoTrophyIcon,
  gift_sent: RegaloIcon,
}
