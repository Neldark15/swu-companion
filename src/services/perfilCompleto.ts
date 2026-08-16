/**
 * ¿Qué le falta a este perfil? — y, sobre todo, qué NO se le va a pedir.
 *
 * ── El problema, medido ──────────────────────────────────────────────
 *
 * Sobre los 23 perfiles de producción: **todos** tienen avatar, y en cambio
 * bio, banner, vitrina y nombre de planeta están en **0 de 23**. Ni una sola
 * persona. País lo tienen 6, aspectos favoritos 2.
 *
 * Un 0/23 con cuatro campos distintos no es pereza de la gente: es que la
 * personalización vive detrás de un botón que nadie encuentra, y cuando se
 * encuentra pide demasiado de una sentada. Por eso esto existe.
 *
 * ── Qué se pide y qué no ─────────────────────────────────────────────
 *
 * Se pide lo que la app USA o lo que hace que un perfil se lea como el de una
 * persona. NO se pide:
 *
 *  · **WhatsApp** — es un dato de contacto privado. Perseguir a alguien para
 *    que deje su teléfono está mal, y además el intercambio ya funciona sin
 *    número: el mensaje se arma y cada quien elige a quién escribirle.
 *  · **Usuario de melee** — solo sirve si esa persona juega en melee.gg.
 *    Pedírselo a quien no lo usa es ruido, y encima el perfil no se puede
 *    verificar (ver gotcha 2n), así que insistir sugiere una garantía que no
 *    existe.
 *
 * Que un campo no se pida NO quiere decir que esté escondido: los dos siguen
 * en su sitio del perfil para quien los quiera poner.
 */

import type { Personalizacion } from './profileCustomService'

/** Un dato que falta, con por qué importa. */
export interface FaltanteInfo {
  id: Faltante
  /** Lo que se muestra en la lista. */
  label: string
  /** Para qué sirve. Sin esto un pedido se lee como burocracia. */
  porque: string
  /** Se resuelve dentro del asistente, o hay que mandar a otra pantalla. */
  enElAsistente: boolean
}

export type Faltante =
  | 'pais' | 'aspectos' | 'planeta' | 'bio' | 'cartas'

/**
 * El catálogo, en el orden en que conviene pedirlo: primero lo que la app usa
 * de verdad, después lo que decora. Si el primer paso es «elegí un banner», la
 * persona abandona antes de dar el dato que sirve para algo.
 *
 * `cartas` es UN solo requisito para las dos formas de presumir cartas —la
 * portada y la vitrina—, y se cumple con CUALQUIERA de las dos. Antes eran dos
 * requisitos separados, y como los dos salen de las favoritas, pedir ambos para
 * el 100% era demasiado: quien elegía una portada seguía viendo el perfil
 * «incompleto» por no haber armado además una vitrina.
 */
export const CATALOGO: Record<Faltante, Omit<FaltanteInfo, 'id'>> = {
  pais: {
    label: 'Tu país',
    porque: 'Para ubicarte en la comunidad y en La Galaxia.',
    enElAsistente: true,
  },
  aspectos: {
    label: 'Tus aspectos favoritos',
    porque: 'Marcan tu estilo de juego en tu tarjeta de jugador.',
    enElAsistente: true,
  },
  planeta: {
    label: 'El nombre de tu planeta',
    porque: 'Es tu mundo en La Galaxia. Sin nombre sale con una designación de catálogo.',
    enElAsistente: true,
  },
  bio: {
    label: 'Una línea sobre vos',
    porque: 'Es lo que lee quien entra a tu perfil.',
    enElAsistente: true,
  },
  cartas: {
    label: 'Una carta destacada',
    porque: 'Elegí una portada o armá tu vitrina — con cualquiera alcanza.',
    enElAsistente: false,
  },
}

/** El orden en que se piden. */
export const ORDEN: Faltante[] = ['pais', 'aspectos', 'planeta', 'bio', 'cartas']

/** Lo que hace falta saber para decidir. Se arma en la pantalla. */
export interface EstadoPerfil {
  pais: string | null | undefined
  bio: string | null | undefined
  personalizacion: Personalizacion | null
}

export interface Completitud {
  faltantes: FaltanteInfo[]
  /** Cuántos de los del catálogo ya están. */
  hechos: number
  total: number
  /** 0..100. */
  porcentaje: number
  /** `true` cuando no falta nada. */
  completo: boolean
}

/**
 * Qué falta.
 *
 * Con `personalizacion` en `null` —que es lo que hay mientras carga— NO se
 * reporta nada como faltante. Si se reportara, el aviso aparecería un instante
 * en cada arranque diciéndole «te falta todo» a quien tiene el perfil lleno, y
 * ese parpadeo es peor que no avisar.
 */
export function calcularCompletitud(e: EstadoPerfil): Completitud {
  const p = e.personalizacion
  if (!p) {
    return { faltantes: [], hechos: ORDEN.length, total: ORDEN.length, porcentaje: 100, completo: true }
  }

  const falta: Faltante[] = []
  if (!e.pais) falta.push('pais')
  if (!p.favorite_aspects?.length) falta.push('aspectos')
  if (!p.planet_name?.trim()) falta.push('planeta')
  if (!e.bio?.trim()) falta.push('bio')
  // «cartas» se cumple con la portada O con al menos una carta en vitrina.
  if (!p.banner_card_id && !p.showcase_cards?.length) falta.push('cartas')

  const faltantes = ORDEN.filter(f => falta.includes(f)).map(id => ({ id, ...CATALOGO[id] }))
  const total = ORDEN.length
  const hechos = total - faltantes.length

  return {
    faltantes,
    hechos,
    total,
    porcentaje: Math.round((hechos / total) * 100),
    completo: faltantes.length === 0,
  }
}

/* ── Cuándo callarse ──────────────────────────────────────────────────
 *
 * Un aviso que vuelve en cada arranque deja de ser una ayuda y pasa a ser una
 * molestia que se aprende a ignorar — y de paso entrena a la gente a cerrar
 * avisos sin leerlos, que después rompe los avisos que sí importan.
 *
 * Reglas:
 *  · «Ahora no» calla el aviso 7 días.
 *  · «No me lo recuerdes» lo calla para siempre.
 *  · Completar algo REINICIA el silencio: si volvés y todavía falta, el aviso
 *    puede volver — pero solo después de la espera.
 */
const CLAVE_SILENCIO = 'perfil_aviso_silencio_hasta'
const CLAVE_NUNCA = 'perfil_aviso_nunca'
const DIAS_7 = 7 * 24 * 60 * 60 * 1000

export function avisoSilenciado(): boolean {
  try {
    if (localStorage.getItem(CLAVE_NUNCA) === '1') return true
    const hasta = Number(localStorage.getItem(CLAVE_SILENCIO) ?? 0)
    return Number.isFinite(hasta) && Date.now() < hasta
  } catch {
    // Modo privado o almacenamiento bloqueado: mejor no avisar que reventar.
    return true
  }
}

export function silenciarAviso(dias = 7): void {
  try { localStorage.setItem(CLAVE_SILENCIO, String(Date.now() + (dias / 7) * DIAS_7)) } catch { /* sin storage */ }
}

export function nuncaMasAviso(): void {
  try { localStorage.setItem(CLAVE_NUNCA, '1') } catch { /* sin storage */ }
}
