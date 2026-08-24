/**
 * Temas de la CREDENCIAL DE JUGADOR — paletas de placa de identificación.
 *
 * Cada tema son exactamente 5 colores y cada uno tiene UN trabajo:
 *
 * - `base`    el material de la placa (la silueta exterior).
 * - `panel`   el panel interior oscuro donde vive la información.
 * - `texto`   el texto legible sobre el panel.
 * - `acento`  la banda del nombre, marcos de la foto y detalles vivos.
 * - `grabado` lo «grabado en el material»: emblema, etiquetas, código de
 *   barras y glifos — siempre translúcido, nunca compite con el texto.
 *
 * Este archivo es SOLO datos + validadores (sin React) a propósito: lo
 * importa useSettings para validar lo que llega de la nube, y meter acá
 * componentes arrastraría los íconos al bundle principal. El mapa
 * id→componente de emblemas vive en `emblemasCredencial.ts`.
 */

export type TemaCredencialId =
  | 'sith'
  | 'jedi'
  | 'mandaloriano'
  | 'rebelde'
  | 'deathwatch'
  | 'imperial'
  | 'republica'
  | 'cazarrecompensas'
  | 'inquisidor'
  | 'contrabandista'
  | 'hutt'
  | 'kyber'
  | 'nabu'
  | 'hoth'
  | 'dagobah'
  | 'nocturna'
  | 'tatooine'
  | 'kashyyyk'
  | 'mustafar'
  | 'coruscante'

export interface TemaCredencial {
  id: TemaCredencialId
  etiqueta: string
  base: string
  panel: string
  texto: string
  acento: string
  /**
   * El acento cuando lleva TEXTO CHICO encima del panel.
   *
   * No es un color de más: medido con `scripts/contraste-credencial.mjs`, el
   * `acento` crudo sobre `panel` da **3,17 en Sith, 3,06 en Rebelde y 3,67 en
   * Hoth** — por debajo del 4,5 que pide WCAG para texto normal. Y ahí van
   * cuatro textos de verdad: el encabezado «HOLOCRON SWU», el sub-nombre, la
   * línea del dorso y el rótulo del nivel.
   *
   * Se sube la LUMINOSIDAD conservando matiz y saturación —Sith sigue en 358°,
   * Rebelde en 4°, Hoth en 207°— así que la placa se sigue leyendo del mismo
   * color. Donde el acento crudo ya pasaba, los dos valores son el mismo.
   *
   * El `acento` sin tocar se queda para las FORMAS (la banda del nombre, los
   * remaches, el número grande de nivel): ahí no hay umbral de texto chico y
   * bajarle saturación apagaría la placa.
   */
  acentoTexto: string
  grabado: string
}

/**
 * Ocho placas derivadas de las referencias de identificación galáctica.
 * Todas oscuras salvo «rebelde», que es la placa crema con rojo de la
 * Alianza — su panel sigue siendo oscuro para que el texto no cambie de
 * lógica entre temas.
 */
export const TEMAS_CREDENCIAL: TemaCredencial[] = [
  { id: 'sith',             etiqueta: 'Sith',             base: '#26262B', panel: '#121214', texto: '#E6E4E1', acento: '#C41E24', acentoTexto: '#E3474C', grabado: '#8A8F98' },
  { id: 'jedi',             etiqueta: 'Jedi',             base: '#191613', panel: '#0F0D0B', texto: '#F4E9C8', acento: '#D9A93C', acentoTexto: '#D9A93C', grabado: '#B08D3F' },
  { id: 'mandaloriano',     etiqueta: 'Mandaloriano',     base: '#1B2733', panel: '#101820', texto: '#E3E9EF', acento: '#5C87AE', acentoTexto: '#5C87AE', grabado: '#AEB9C4' },
  { id: 'rebelde',          etiqueta: 'Rebelde',          base: '#E8DFC9', panel: '#26211C', texto: '#F0E9D8', acento: '#C6392F', acentoTexto: '#D96860', grabado: '#D9A93C' },
  { id: 'deathwatch',       etiqueta: 'Death Watch',      base: '#232A31', panel: '#151A1F', texto: '#DFE8EF', acento: '#6FB7D9', acentoTexto: '#6FB7D9', grabado: '#93A2AE' },
  { id: 'imperial',         etiqueta: 'Imperial',         base: '#33373C', panel: '#17191C', texto: '#DCDEE1', acento: '#9AA3AB', acentoTexto: '#9AA3AB', grabado: '#6A7178' },
  { id: 'republica',        etiqueta: 'República',        base: '#4A1622', panel: '#1E0A10', texto: '#F0E3D0', acento: '#CFA349', acentoTexto: '#CFA349', grabado: '#A66B5A' },
  { id: 'cazarrecompensas', etiqueta: 'Cazarrecompensas', base: '#2A3A2E', panel: '#141C16', texto: '#E4E9DD', acento: '#D9772F', acentoTexto: '#D9772F', grabado: '#7E9B72' },
  // Seis más. Se eligieron por CONTRASTE entre ellas —dos rojos oscuros no
  // suman una opción, suman una duda— y todas se probaron con el texto encima:
  // el `texto` sobre `panel` pasa el contraste AA en las catorce.
  { id: 'inquisidor',       etiqueta: 'Inquisidor',       base: '#1A1013', panel: '#0C0709', texto: '#F0DADC', acento: '#E03B3B', acentoTexto: '#E03B3B', grabado: '#9B5F63' },
  { id: 'contrabandista',   etiqueta: 'Contrabandista',   base: '#3A2A1C', panel: '#1B1410', texto: '#F2E4CE', acento: '#C9922F', acentoTexto: '#C9922F', grabado: '#9C7A4E' },
  { id: 'hutt',             etiqueta: 'Cartel Hutt',      base: '#2E2A16', panel: '#16140A', texto: '#EDE7C4', acento: '#A8B534', acentoTexto: '#A8B534', grabado: '#8A8C4E' },
  { id: 'kyber',            etiqueta: 'Cristal Kyber',    base: '#141C22', panel: '#0A1014', texto: '#DDF2F5', acento: '#39C7D6', acentoTexto: '#39C7D6', grabado: '#5E8E99' },
  { id: 'nabu',             etiqueta: 'Naboo',            base: '#2B2136', panel: '#150F1C', texto: '#EDE2F5', acento: '#A374D9', acentoTexto: '#A374D9', grabado: '#8A72A6' },
  { id: 'hoth',             etiqueta: 'Hoth',             base: '#D7DEE4', panel: '#1C242B', texto: '#EDF3F7', acento: '#4E7FA6', acentoTexto: '#6291B5', grabado: '#7C8B98' },
  // ── Seis más (2026-08-23) ──
  // Se eligieron por MATIZ que todavía no existía, no por «otro rojo bonito»:
  // verde puro, magenta, arena clara, verde azulado, naranja encendido y añil.
  // El guion de contraste comprueba que ningún acento se repita entre temas.
  { id: 'dagobah',    etiqueta: 'Dagobah',    base: '#1C2A1E', panel: '#0D140F', texto: '#DFEEDF', acento: '#4FBF6A', acentoTexto: '#4FBF6A', grabado: '#6E9478' },
  { id: 'nocturna',   etiqueta: 'Hermanas de la Noche', base: '#2A1220', panel: '#140810', texto: '#F2DCE8', acento: '#E052A0', acentoTexto: '#E052A0', grabado: '#A05C7E' },
  { id: 'tatooine',   etiqueta: 'Tatooine',   base: '#E4D3B0', panel: '#2A1F14', texto: '#F5E9D2', acento: '#E07B45', acentoTexto: '#E07B45', grabado: '#B08A5A' },
  { id: 'kashyyyk',   etiqueta: 'Kashyyyk',   base: '#122A28', panel: '#081615', texto: '#DCF0EC', acento: '#2FBFA6', acentoTexto: '#2FBFA6', grabado: '#5E938A' },
  { id: 'mustafar',   etiqueta: 'Mustafar',   base: '#2B1410', panel: '#150807', texto: '#F5DED2', acento: '#FF7A3D', acentoTexto: '#FF7A3D', grabado: '#A0604A' },
  { id: 'coruscante', etiqueta: 'Coruscante', base: '#1A1E33', panel: '#0C0E1A', texto: '#E2E6F7', acento: '#7B8BFF', acentoTexto: '#7B8BFF', grabado: '#7B84B0' },
]

/** ¿Es un id de tema válido? Para validar lo que venga de localStorage/nube. */
export function esTemaCredencial(valor: unknown): valor is TemaCredencialId {
  return typeof valor === 'string' && TEMAS_CREDENCIAL.some((t) => t.id === valor)
}

/** Un id desconocido (datos viejos) cae al primer tema sin romper. */
export function temaCredencial(id: TemaCredencialId): TemaCredencial {
  return TEMAS_CREDENCIAL.find((t) => t.id === id) ?? TEMAS_CREDENCIAL[0]
}

// ─── EMBLEMAS (solo los ids: el dibujo vive en emblemasCredencial.ts) ──

/**
 * Los emblemas de la credencial son los MISMOS íconos que la app usa como
 * avatar de perfil (`public/avatars/<id>.png`, catalogados en
 * `data/avatars.ts`).
 *
 * Antes acá había un juego distinto sacado de SWIcons: iconografía nueva para
 * una pantalla nueva, cuando la app ya tenía la suya y la comunidad ya la
 * reconoce. Reusar la que ya se habla es lo que hace que la credencial se
 * sienta parte de la app y no una pieza pegada.
 */
export const EMBLEMAS_CREDENCIAL_IDS = [
  'chewbacca', 'r2d2', 'c3po', 'bb8', 'pilot', 'boba-fett', 'stormtrooper',
  'darth-vader', 'phasma', 'kylo-ren', 'jedi-order', 'phoenix',
  'rebel-alliance', 'galactic-empire', 'first-order', 'first-order-2',
  'starfighter', 'sith-empire', 'rebel-alliance-2', 'jedi-order-2',
  'new-republic', 'empire-gear', 'separatist', 'galactic-republic',
] as const

export type EmblemaCredencialId = (typeof EMBLEMAS_CREDENCIAL_IDS)[number]

/** ¿Es un id de emblema válido? Para validar lo que venga de la nube. */
export function esEmblemaCredencial(valor: unknown): valor is EmblemaCredencialId {
  return typeof valor === 'string' && (EMBLEMAS_CREDENCIAL_IDS as readonly string[]).includes(valor)
}
