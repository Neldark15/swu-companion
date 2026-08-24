/**
 * Qué ícono lleva cada TEMA de la trivia, y de qué color.
 *
 * Vive aparte de `iconosTrivia.tsx` por la regla del Fast Refresh: un módulo
 * que exporta componentes Y constantes lo rompe (quinta vez que hace falta esta
 * separación en el repo — §3t, §3w).
 *
 * El color no es decoración: 🟢 y 🔴 codificaban Jedi/Sith por color, y eso se
 * conserva. Tres temas REUSAN íconos de la app (el ícono de un tema es el de la
 * cosa que nombra): sable para Jedi, caza para Naves, cartas para SWU.
 */

import type { ComponentType } from 'react'
import type { TemaTrivia } from '../../services/trivia'
import { SaberIcon, StarfighterIcon, DeckCardsIcon } from '../../components/SWIcons'
import { SableSithIcon, GarrazoIcon, PlanetaAnilladoIcon } from './iconosTrivia'

export const ICONO_POR_TEMA: Record<TemaTrivia, {
  Icono: ComponentType<{ size?: number; className?: string }>
  clase: string
}> = {
  jedi: { Icono: SaberIcon, clase: 'text-emerald-400' },
  sith: { Icono: SableSithIcon, clase: 'text-red-400' },
  criaturas: { Icono: GarrazoIcon, clase: 'text-violet-300' },
  planetas: { Icono: PlanetaAnilladoIcon, clase: 'text-swu-cyan' },
  naves: { Icono: StarfighterIcon, clase: 'text-sky-300' },
  juego: { Icono: DeckCardsIcon, clase: 'text-swu-amber' },
}
