/**
 * Personalización — los tres catálogos con los que cada quien hace suya la app:
 * el fondo de TODA la interfaz, el tinte de su tarjeta de jugador, y el marco
 * de su fotografía.
 *
 * ── Por qué el tema de fondo son solo 4 variables ─────────────────────
 *
 * Tailwind 4 resuelve los tokens de `@theme` a `var()`, así que sobreescribir
 * `--color-swu-bg/surface/surface-hover/border` con `setProperty` repinta la
 * app entera de un golpe — el mismo mecanismo que ya usa el color de acento.
 * No hay que tocar ni un componente.
 *
 * NO hay tema claro a propósito: cada pantalla está diseñada sobre oscuro
 * (sombras, glows, imágenes de cartas con borde negro) y un fondo claro las
 * rompería todas. Seis oscuros con carácter > un claro roto.
 *
 * ── El contraste está MEDIDO, no estimado ─────────────────────────────
 *
 * Cada paleta se validó calculando el ratio WCAG del texto (#E2E8F0) y del
 * atenuado (#7C8BA1) sobre su bg y su surface, con el tema actual como piso:
 * ningún tema queda peor que 'holocron' en ninguna de las 4 mediciones.
 * (holocron: 14.24 / 13.30 / 5.07 / 4.74 — todos los demás por encima.)
 * Si se cambia un valor acá, hay que volver a medir antes de commitear.
 *
 * ── Los marcos se GANAN, no se compran ────────────────────────────────
 *
 * Hay un marco por tier de RANKS y se desbloquea al alcanzar su `minLevel`.
 * Ganado es ganado: un Gran Maestro puede seguir usando el marco de Iniciado
 * si le gusta. Lo que no se puede es usar uno que no se alcanzó — si el
 * guardado no está ganado (datos viejos o trampa), se cae a 'auto', que es
 * el más alto ganado.
 *
 * Los marcos con `animado: true` solo pueden animar transform/opacity en la
 * fase de UI — nada de filter/blur/backdrop (doctrina del repo: teléfonos de
 * gama baja). El color nunca es el único portador: cada marco tiene nombre.
 */

import { RANKS } from './gamification'

// ─── TEMAS DE FONDO ─────────────────────────────────────────────────

export type TemaFondoId =
  | 'holocron'
  | 'espacio'
  | 'nebulosa'
  | 'imperial'
  | 'cantina'
  | 'endor'

export interface TemaFondo {
  id: TemaFondoId
  etiqueta: string
  /** Fondo de la página (--color-swu-bg). */
  bg: string
  /** Tarjetas y paneles (--color-swu-surface). */
  surface: string
  /** Estado hover de superficies (--color-swu-surface-hover). */
  surfaceHover: string
  /** Bordes y separadores (--color-swu-border). */
  border: string
}

/**
 * Seis paletas oscuras curadas. La primera es la app tal como existe hoy —
 * sus valores tienen que ser EXACTOS a los de `@theme` en index.css, porque
 * es a la vez el default y la forma de "volver a como estaba".
 */
export const TEMAS_FONDO: TemaFondo[] = [
  { id: 'holocron', etiqueta: 'Holocrón',   bg: '#181825', surface: '#1e1e2e', surfaceHover: '#2a2a3c', border: '#2a2a3c' },
  { id: 'espacio',  etiqueta: 'Espacio Profundo', bg: '#0A0A0F', surface: '#121218', surfaceHover: '#1C1C24', border: '#1C1C24' },
  { id: 'nebulosa', etiqueta: 'Nebulosa',   bg: '#17121F', surface: '#1F1830', surfaceHover: '#2B2142', border: '#2B2142' },
  { id: 'imperial', etiqueta: 'Frío Imperial', bg: '#0E1420', surface: '#131E2C', surfaceHover: '#1C2C40', border: '#1C2C40' },
  { id: 'cantina',  etiqueta: 'Cantina',    bg: '#1A1410', surface: '#221A14', surfaceHover: '#33281D', border: '#33281D' },
  { id: 'endor',    etiqueta: 'Endor',      bg: '#101812', surface: '#16211A', surfaceHover: '#223227', border: '#223227' },
]

/** ¿Es un id de tema válido? Para validar lo que venga de localStorage/nube. */
export function esTemaFondo(valor: unknown): valor is TemaFondoId {
  return typeof valor === 'string' && TEMAS_FONDO.some((t) => t.id === valor)
}

/**
 * Pinta toda la app con el tema elegido escribiendo las 4 variables en el
 * `<html>`. Un id desconocido (datos viejos) cae al tema actual sin romper.
 */
export function aplicarTemaFondo(id: TemaFondoId): void {
  const tema = TEMAS_FONDO.find((t) => t.id === id) ?? TEMAS_FONDO[0]
  const raiz = document.documentElement.style
  raiz.setProperty('--color-swu-bg', tema.bg)
  raiz.setProperty('--color-swu-surface', tema.surface)
  raiz.setProperty('--color-swu-surface-hover', tema.surfaceHover)
  raiz.setProperty('--color-swu-border', tema.border)
}

// ─── TINTES DE LA TARJETA DE JUGADOR ────────────────────────────────

export type TinteTarjetaId =
  | 'auto'
  | 'dorado'
  | 'cian'
  | 'verde'
  | 'purpura'
  | 'rojo'
  | 'blanco'
  | 'naranja'
  | 'rosa'

/** Un tinte concreto — 'auto' no lleva colores: significa "que decida el rango". */
export type TinteConcreto = Exclude<TinteTarjetaId, 'auto'>

export interface TinteTarjeta {
  etiqueta: string
  /** Color pleno: el nombre del jugador (gradiente/glow) y el texto del rango. */
  nucleo: string
  /** Resplandor alrededor del núcleo, más profundo que él. */
  brillo: string
}

/**
 * Ocho tintes con núcleo y brillo, como los sables. 'auto' queda fuera del
 * Record a propósito: es la ausencia de tinte (el color del RANGO decide,
 * que es el comportamiento de siempre), no un noveno color.
 */
export const TINTES_TARJETA: Record<TinteConcreto, TinteTarjeta> = {
  dorado:  { etiqueta: 'Dorado',  nucleo: '#FFD75E', brillo: '#B8860B' },
  cian:    { etiqueta: 'Cian',    nucleo: '#4DD0E1', brillo: '#00838F' },
  verde:   { etiqueta: 'Verde',   nucleo: '#81C784', brillo: '#2E7D32' },
  purpura: { etiqueta: 'Púrpura', nucleo: '#CE93D8', brillo: '#6A1B9A' },
  rojo:    { etiqueta: 'Rojo',    nucleo: '#EF5350', brillo: '#B71C1C' },
  blanco:  { etiqueta: 'Blanco',  nucleo: '#F5F5F5', brillo: '#90A4AE' },
  naranja: { etiqueta: 'Naranja', nucleo: '#FFB74D', brillo: '#E65100' },
  rosa:    { etiqueta: 'Rosa',    nucleo: '#F48FB1', brillo: '#AD1457' },
}

/** El orden en que el picker los pinta, con 'auto' siempre primero. */
export const ORDEN_TINTES: TinteTarjetaId[] = [
  'auto', 'dorado', 'cian', 'verde', 'purpura', 'rojo', 'blanco', 'naranja', 'rosa',
]

/** ¿Es un id de tinte válido? Para validar lo que venga de localStorage/nube. */
export function esTinteTarjeta(valor: unknown): valor is TinteTarjetaId {
  return typeof valor === 'string' && (ORDEN_TINTES as string[]).includes(valor)
}

// ─── MARCOS DE LA FOTOGRAFÍA ────────────────────────────────────────

export type MarcoId =
  | 'borde-exterior'
  | 'alianza'
  | 'escuadron'
  | 'sector'
  | 'kyber'
  | 'holocron'
  | 'galactico'

/** Lo que se guarda: un marco concreto o 'auto' (= el más alto ganado). */
export type MarcoElegido = 'auto' | MarcoId

export interface MarcoPerfil {
  id: MarcoId
  nombre: string
  /** Nivel al que se gana. Sale de RANKS: un marco por tier, mismo umbral. */
  minLevel: number
  /** Color principal del marco cuadrado (esquinas `rounded-xl`). */
  borde: string
  /** Segundo color: gradiente, glow estático, esquinas decoradas. */
  brillo: string
  /** Esquinas dobles decorativas (los marcos altos son más ricos). */
  esquinas: boolean
  /** Animación sutil en la fase de UI — SOLO transform/opacity. */
  animado: boolean
}

/**
 * La parte visual de cada marco, en el mismo orden que RANKS. El `minLevel`
 * no se escribe acá: se toma de RANKS al armar MARCOS, así los umbrales de
 * los marcos y los de los rangos no pueden divergir jamás.
 */
const ESTILOS_MARCOS: Omit<MarcoPerfil, 'minLevel'>[] = [
  { id: 'borde-exterior', nombre: 'Borde Exterior', borde: '#4B5563', brillo: '#6B7280', esquinas: false, animado: false },
  { id: 'alianza',        nombre: 'Alianza',        borde: '#3B82F6', brillo: '#60A5FA', esquinas: false, animado: false },
  { id: 'escuadron',      nombre: 'Escuadrón',      borde: '#22C55E', brillo: '#4ADE80', esquinas: true,  animado: false },
  { id: 'sector',         nombre: 'Sector',         borde: '#EAB308', brillo: '#FACC15', esquinas: true,  animado: false },
  { id: 'kyber',          nombre: 'Kyber',          borde: '#22D3EE', brillo: '#67E8F9', esquinas: true,  animado: true },
  { id: 'holocron',       nombre: 'Holocrón',       borde: '#F59E0B', brillo: '#FCD34D', esquinas: true,  animado: true },
  { id: 'galactico',      nombre: 'Galáctico',      borde: '#FFD700', brillo: '#FFF7CC', esquinas: true,  animado: true },
]

/** Los 7 marcos, del más humilde al más rico, con su umbral tomado de RANKS. */
export const MARCOS: MarcoPerfil[] = ESTILOS_MARCOS.map((estilo, i) => ({
  ...estilo,
  // Si RANKS y los estilos alguna vez desalinearan en cantidad, el marco
  // sobrante hereda el último umbral en vez de reventar la app al cargar.
  minLevel: (RANKS[i] ?? RANKS[RANKS.length - 1]).minLevel,
}))

/** ¿El valor guardado es una elección real? ('auto' o un id del catálogo). */
export function esMarcoElegido(valor: unknown): valor is MarcoElegido {
  return valor === 'auto' || (typeof valor === 'string' && MARCOS.some((m) => m.id === valor))
}

/** ¿Este nivel ya ganó este marco? Ganado es ganado: nunca se pierde. */
export function marcoGanado(marcoId: MarcoId, nivel: number): boolean {
  const marco = MARCOS.find((m) => m.id === marcoId)
  return marco !== undefined && nivel >= marco.minLevel
}

/** Los marcos que este nivel puede ELEGIR (todos los ya ganados, en orden). */
export function marcosDisponibles(nivel: number): MarcoPerfil[] {
  return MARCOS.filter((m) => nivel >= m.minLevel)
}

/**
 * El marco que efectivamente se muestra.
 *
 * - 'auto' → el más alto ganado (el comportamiento de siempre).
 * - Un id concreto → ese marco, PERO solo si está ganado. Si no lo está
 *   (datos viejos, o alguien editó su localStorage), cae a 'auto' en
 *   silencio: mentir un marco no ganado rompería lo único que lo hace valer.
 * - Un nivel raro (0, negativo) → el primer marco, que se gana por existir.
 */
export function resolverMarco(elegido: MarcoElegido, nivel: number): MarcoPerfil {
  if (elegido !== 'auto' && marcoGanado(elegido, nivel)) {
    // find nunca falla acá: marcoGanado ya comprobó que el id existe.
    return MARCOS.find((m) => m.id === elegido) as MarcoPerfil
  }
  const ganados = marcosDisponibles(nivel)
  return ganados[ganados.length - 1] ?? MARCOS[0]
}
