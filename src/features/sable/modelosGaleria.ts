import type { ParteTaller } from '../../services/sableService'
import type { Diseno } from './partesSable'

export interface ModeloGaleria {
  id: string
  nombre: string
  tipo: string
  descripcion: string
  diseno: Diseno
}

export const MODELOS_GALERIA: readonly ModeloGaleria[] = [
  { id: 'guardia', nombre: 'Guardia', tipo: 'Guarda transversal',
    descripcion: 'Dos brazos de luz se abren a los lados del emisor de acero.',
    diseno: { emisor: 'emi_cruceta', cuerpo: 'cue_liso', pomo: 'pom_contrapeso', color: 'col_naranja', acabadoCuerpo: 'negro' } },
  { id: 'gemelo', nombre: 'Géminis', tipo: 'Bastón de doble hoja',
    descripcion: 'Un mango largo une dos hojas que se encienden en extremos opuestos.',
    diseno: { emisor: 'emi_estandar', cuerpo: 'cue_pica', pomo: 'pom_gemelo', color: 'col_violeta', acabadoCuerpo: 'grafito' } },
  { id: 'orbital', nombre: 'Órbita', tipo: 'Emisor de anillo',
    descripcion: 'Un aro inclinado rodea la hoja y deja una abertura en un costado.',
    diseno: { emisor: 'emi_orbita', cuerpo: 'cue_shoto', pomo: 'pom_contrapeso', color: 'col_cian', acabadoCuerpo: 'acero' } },
  { id: 'shoto', nombre: 'Shoto', tipo: 'Sable corto',
    descripcion: 'Hoja corta, mango compacto y un terminal liso de acero.',
    diseno: { emisor: 'emi_estandar', cuerpo: 'cue_shoto', pomo: 'pom_plano', color: 'col_verde', acabadoEmisor: 'negro' } },
  { id: 'lira', nombre: 'Lira', tipo: 'Emisor de arcos',
    descripcion: 'Dos arcos se elevan desde el mango y dejan ver la hoja en el centro.',
    diseno: { emisor: 'emi_lira', cuerpo: 'cue_senda', pomo: 'pom_cometa', color: 'col_lavanda' } },
  { id: 'peregrino', nombre: 'Peregrino', tipo: 'Pica de asta larga',
    descripcion: 'El asta deja espacio entre dos agarres y termina en una cola asimétrica.',
    diseno: { emisor: 'emi_estandar', cuerpo: 'cue_pica', pomo: 'pom_cometa', color: 'col_menta', acabadoEmisor: 'bronce' } },
  { id: 'prisma', nombre: 'Prisma', tipo: 'Corona facetada',
    descripcion: 'Los planos de la corona y del contrapeso reflejan la luz al girar.',
    diseno: { emisor: 'emi_prisma', cuerpo: 'cue_liso', pomo: 'pom_contrapeso', color: 'col_magenta', acabadoCuerpo: 'esmalte' } },
  { id: 'reliquia', nombre: 'Reliquia', tipo: 'Cámara abierta',
    descripcion: 'Una jaula estrecha enmarca un núcleo ámbar en mitad del mango.',
    diseno: { emisor: 'emi_prisma', cuerpo: 'cue_reliquia', pomo: 'pom_plano', color: 'col_oro', acabadoEmisor: 'laton' } },
  { id: 'centinela', nombre: 'Centinela', tipo: 'Empuñadura orgánica',
    descripcion: 'Una cresta recorre un lado de la empuñadura y continúa hacia el pomo.',
    diseno: { emisor: 'emi_estandar', cuerpo: 'cue_senda', pomo: 'pom_cometa', color: 'col_azul', acabadoEmisor: 'grafito' } },
]

/** Una plantilla equipa solo geometría que el taller confirma como propia.
 * Los cristales de vitrina pueden ser de la tienda. En ese caso se mantiene
 * el que tenía equipado el jugador. */
export function disenoParaEquipar(modelo: ModeloGaleria, actual: Diseno, partes: ParteTaller[]): Diseno | null {
  const posee = (tipo: ParteTaller['tipo'], id: string) => partes.some(p => p.tipo === tipo && p.id === id && p.tengo)
  const d = modelo.diseno
  if (!posee('emisor', d.emisor) || !posee('cuerpo', d.cuerpo) || !posee('pomo', d.pomo)) return null
  const color = posee('color', d.color) ? d.color : actual.color
  return posee('color', color) ? { ...d, color } : null
}
