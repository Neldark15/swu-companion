/**
 * misionesCatalogo — QUÉ misiones hay y CUÁL toca hoy. Puro, sin red.
 *
 * Va aparte de `missionService.ts` por la misma razón que `mesas.ts` va aparte
 * de `tournamentCloud.ts`: el reparto es aritmética y se puede probar sobre
 * 365 días simulados, y el servicio es Supabase, sesión y RLS. Mezclados, para
 * medir el sorteo hay que levantar medio backend — que es exactamente lo que
 * impidió ver, durante toda la vida de la app, que el barajado estaba sesgado.
 *
 * Acá NO se importa nada de `supabase`, `db` ni `useAuth`. Si hace falta, va
 * del otro lado.
 */

import { diaCalendarioSV } from './horaSV'

export type MissionType = 'daily' | 'weekly' | 'unique'

/** Bonus por terminar una misión, además del XP propio de cada una. */
export const BONUS_POR_TIPO: Record<MissionType, number> = {
  daily: 20,
  weekly: 60,
  unique: 0,   // las únicas ya llevan su recompensa en `rewardXp`
}

/** El `period_key` de las únicas. No cambia nunca: por eso son únicas. */
export const CLAVE_UNICA = 'once'
/**
 * Los objetivos que la app SABE observar. Cada uno tiene un llamador real de
 * `updateMissionProgress`; si agregás uno, agregá el llamador en el MISMO
 * commit o nace siendo una tarea imposible en pantalla.
 *
 * Se fueron cuatro que estaban declarados y no los disparaba nadie ni los usaba
 * ninguna plantilla —`card_collected`, `card_searched`, `price_checked`,
 * `set_explored`—: tipos muertos que solo servían para que alguien creyera que
 * había por dónde.
 */
export type ObjectiveType =
  | 'match_played' | 'match_won' | 'gift_sent' | 'deck_created' | 'card_favorited'
  | 'sobre_abierto' | 'muro_publicado' | 'chat_enviado' | 'amistosa_registrada'
  // Los siete nuevos. Cada uno salió de barrer la app buscando dónde una
  // acción TERMINA BIEN, y cada uno tiene su llamador puesto en este mismo
  // commit. Se descartaron 15 candidatas más porque el sitio no existía, se
  // alcanzaba también al fallar, o se disparaba sola al cargar la pantalla.
  | 'dia_visitado' | 'post_apoyado' | 'trivia_respondida' | 'carta_agregada'
  | 'carta_deseada' | 'carta_en_venta' | 'mazo_compartido'

export type RewardType = 'xp' | 'title' | 'xp_title'

/**
 * Cuánto cuesta una misión, medido — no a ojo.
 *
 * De 38 perfiles, esto es cuánta gente HIZO alguna vez cada acción:
 * publicar en Comunidades 26 · crear un mazo 14 · abrir un sobre 11 ·
 * marcar favorita 10 · registrar amistosa 8 · escribir en el chat 5 ·
 * jugar una partida 7 · enviar un regalo **3**.
 *
 * · `toque`  — un toque, y lo hace casi cualquiera.
 * · `rato`   — dos o tres toques, o hay que querer hacerlo.
 * · `reto`   — depende de jugar, de ganar, o de que OTRA persona haga algo.
 */
export type Dificultad = 'toque' | 'rato' | 'reto'

export interface MissionTemplate {
  id: string
  type: MissionType
  name: string
  description: string
  objectiveType: ObjectiveType
  objectiveValue: number
  rewardXp: number
  icon: string
  /** Decide el piso de fáciles del sorteo. Ver `sortearMisiones`. */
  dificultad: Dificultad
  /**
   * Adónde se va para hacerla, y cómo se llama ESA pantalla.
   *
   * No es un adorno. La misión decía «Publicar algo en el muro» y la palabra
   * «muro» **no aparece en ninguna pantalla de la app**: la sección se llama
   * «Comunidades», está a tres toques (Perfil → Más → Comunidad) y el botón
   * dice «Escribir al grupo…». Nel, que construyó la app, no supo cómo
   * hacerla. Si no la encuentra él, no la encuentra nadie.
   */
  ruta: string
  /** El rótulo del botón: nombra la pantalla tal como se lee en el menú. */
  donde: string
  rewardTitle?: string  // título desbloqueado al reclamar
}

export interface UserMission {
  missionId: string
  template: MissionTemplate
  progress: number
  completed: boolean
  completedAt?: string
  claimed: boolean
}

// ─── MISSION CATALOG ────────────────────────────────────────────────

/**
 * Las diarias. Se sortean 4 por día.
 *
 * ── POR QUÉ CAMBIÓ EL CATÁLOGO ENTERO ────────────────────────────────
 *
 * El anterior pedía cosas que nadie hace a diario. Medido sobre 30 días de
 * producción, lo que la comunidad hace de verdad es:
 *
 *     publicar en el muro   322 veces · 18 personas
 *     abrir un sobre         54 ·  4      (y hay 259 sin abrir esperando)
 *     crear un mazo          27 · 11
 *     escribir en el chat    18 ·  5
 *     registrar amistosa     16 ·  6
 *
 * Y el catálogo viejo pedía «marcar 5 cartas favoritas en un día» y «20 en una
 * semana». En seis meses se registraron DIEZ filas de misión en toda la app.
 *
 * La regla nueva: una diaria tiene que ser algo que harías igual. El sobre lo
 * recibe todo el mundo a las 8 de la mañana y abrirlo es un toque; publicar en
 * el muro ya lo hacen 18 de 28. Nada pide «3 partidas» ni «5 favoritas».
 */
export const DAILY_MISSIONS: MissionTemplate[] = [
  // ── DE UN TOQUE ────────────────────────────────────────────────────────
  { id: 'd_visita',    type: 'daily', dificultad: 'toque', ruta: '/',            donde: 'Base',         name: 'Pasar lista',           description: 'Entrar hoy a la app',                       objectiveType: 'dia_visitado',        objectiveValue: 1, rewardXp: 10, icon: '🛰️' },
  { id: 'd_sobre1',    type: 'daily', dificultad: 'toque', ruta: '/sobres',      donde: 'Sobredosis',   name: 'Botín del día',         description: 'Abrir 1 sobre',                             objectiveType: 'sobre_abierto',       objectiveValue: 1, rewardXp: 20, icon: '📦' },
  { id: 'd_muro1',     type: 'daily', dificultad: 'toque', ruta: '/community',   donde: 'Comunidades',  name: 'Contale al grupo',      description: 'Escribir algo en Comunidades',              objectiveType: 'muro_publicado',      objectiveValue: 1, rewardXp: 15, icon: '📡' },
  { id: 'd_apoyo1',    type: 'daily', dificultad: 'toque', ruta: '/community',   donde: 'Comunidades',  name: 'Buena onda',            description: 'Dar corazón a 1 publicación',               objectiveType: 'post_apoyado',        objectiveValue: 1, rewardXp: 10, icon: '❤️' },
  { id: 'd_trivia1',   type: 'daily', dificultad: 'toque', ruta: '/profile',     donde: 'Mi Perfil',    name: 'Archivos Jedi',         description: 'Contestar 1 pregunta de la trivia',         objectiveType: 'trivia_respondida',   objectiveValue: 1, rewardXp: 15, icon: '🧠' },
  { id: 'd_fav1',      type: 'daily', dificultad: 'toque', ruta: '/cards',       donde: 'Buscar Cartas',name: 'Ojo de curador',  description: 'Marcar 1 carta favorita',                   objectiveType: 'card_favorited',      objectiveValue: 1, rewardXp: 10, icon: '⭐' },
  { id: 'd_carta1',    type: 'daily', dificultad: 'toque', ruta: '/cards',       donde: 'Buscar Cartas',name: 'Suma al botín',         description: 'Agregar 1 carta a tu colección',            objectiveType: 'carta_agregada',      objectiveValue: 1, rewardXp: 10, icon: '➕' },
  { id: 'd_apoyo3',    type: 'daily', dificultad: 'toque', ruta: '/community',   donde: 'Comunidades',  name: 'Escuadrón unido',       description: 'Dar corazón a 3 publicaciones',             objectiveType: 'post_apoyado',        objectiveValue: 3, rewardXp: 20, icon: '💞' },
  { id: 'd_busco1',    type: 'daily', dificultad: 'toque', ruta: '/explore',     donde: 'Contrabando',  name: 'Encargo',               description: 'Marcar 1 carta como «la busco»',            objectiveType: 'carta_deseada',       objectiveValue: 1, rewardXp: 15, icon: '🔎' },
  { id: 'd_trivia3',   type: 'daily', dificultad: 'toque', ruta: '/profile',     donde: 'Mi Perfil',    name: 'Buena memoria',  description: 'Contestar 3 preguntas de la trivia',        objectiveType: 'trivia_respondida',   objectiveValue: 3, rewardXp: 25, icon: '📚' },
  { id: 'd_carta3',    type: 'daily', dificultad: 'toque', ruta: '/cards',       donde: 'Buscar Cartas',name: 'Inventario al día',     description: 'Agregar 3 cartas a tu colección',           objectiveType: 'carta_agregada',      objectiveValue: 3, rewardXp: 20, icon: '📥' },
  { id: 'd_fav3',      type: 'daily', dificultad: 'toque', ruta: '/cards',       donde: 'Buscar Cartas',name: 'Buen gusto',            description: 'Marcar 3 cartas favoritas',                 objectiveType: 'card_favorited',      objectiveValue: 3, rewardXp: 20, icon: '✨' },

  // ── DE UN RATO ─────────────────────────────────────────────────────────
  { id: 'd_chat1',     type: 'daily', dificultad: 'rato',  ruta: '/community',   donde: 'Comunidades',  name: 'Frecuencia abierta',    description: 'Escribir en una sala de chat',              objectiveType: 'chat_enviado',        objectiveValue: 1, rewardXp: 15, icon: '💬' },
  { id: 'd_deck1',     type: 'daily', dificultad: 'rato',  ruta: '/decks',       donde: 'Mis Decks',    name: 'Diseño Rápido',         description: 'Crear o importar un mazo',                  objectiveType: 'deck_created',        objectiveValue: 1, rewardXp: 20, icon: '🔧' },
  { id: 'd_sobre3',    type: 'daily', dificultad: 'rato',  ruta: '/sobres',      donde: 'Sobredosis',   name: 'Fiebre de sobres',      description: 'Abrir 3 sobres',                            objectiveType: 'sobre_abierto',       objectiveValue: 3, rewardXp: 30, icon: '🎁' },
  { id: 'd_venta1',    type: 'daily', dificultad: 'rato',  ruta: '/collection',  donde: 'Mi Botín',     name: 'Abrir tienda',          description: 'Poner 1 carta en venta',                    objectiveType: 'carta_en_venta',      objectiveValue: 1, rewardXp: 25, icon: '🏷️' },
  { id: 'd_mazocomp1', type: 'daily', dificultad: 'rato',  ruta: '/decks',       donde: 'Mis Decks',    name: 'Plano compartido',      description: 'Compartir la imagen de un mazo',            objectiveType: 'mazo_compartido',     objectiveValue: 1, rewardXp: 20, icon: '🖼️' },

  // ── DE RETO ────────────────────────────────────────────────────────────
  { id: 'd_amistosa1', type: 'daily', dificultad: 'reto',  ruta: '/amistosas',   donde: 'Amistosas',    name: 'Duelo de práctica',     description: 'Registrar una amistosa',                    objectiveType: 'amistosa_registrada', objectiveValue: 1, rewardXp: 25, icon: '⚔️' },
  { id: 'd_play1',     type: 'daily', dificultad: 'reto',  ruta: '/contador',    donde: 'Contador',     name: 'Orden de Patrulla',     description: 'Jugar 1 partida',                           objectiveType: 'match_played',        objectiveValue: 1, rewardXp: 20, icon: '🎮' },
  { id: 'd_win1',      type: 'daily', dificultad: 'reto',  ruta: '/contador',    donde: 'Contador',     name: 'Victoria Táctica',      description: 'Ganar 1 partida',                           objectiveType: 'match_won',           objectiveValue: 1, rewardXp: 25, icon: '🏆' },
  { id: 'd_gift1',     type: 'daily', dificultad: 'reto',  ruta: '/galaxia',     donde: 'La Galaxia',   name: 'Diplomacia',  description: 'Enviar 1 regalo',                           objectiveType: 'gift_sent',           objectiveValue: 1, rewardXp: 15, icon: '🤝' },
]

/**
 * MISIONES ÚNICAS — los hitos de una cuenta, una sola vez.
 *
 * Se eligieron mirando lo que la gente YA hace y no se le reconocía: de 38
 * perfiles, 14 tienen mazo, 11 han abierto sobres y 19 tienen algo de XP.
 * Todas se apoyan en objetivos que ya tienen quien los dispare — una misión
 * sin llamador es una tarea imposible en pantalla (§3h-bis).
 */
export const UNIQUE_MISSIONS: MissionTemplate[] = [
  // ── PRIMERAS VECES ─────────────────────────────────────────────────────
  { id: 'u_muro1',      type: 'unique', dificultad: 'toque', ruta: '/community',  donde: 'Comunidades',   name: 'Primera señal',      description: 'Escribí algo en Comunidades',      objectiveType: 'muro_publicado',      objectiveValue: 1,  rewardXp: 60,  icon: '📡' },
  { id: 'u_sobre1',     type: 'unique', dificultad: 'toque', ruta: '/sobres',     donde: 'Sobredosis',    name: 'Primer sobre',       description: 'Abrí tu primer sobre',             objectiveType: 'sobre_abierto',       objectiveValue: 1,  rewardXp: 75,  icon: '📦' },
  { id: 'u_apoyo1',     type: 'unique', dificultad: 'toque', ruta: '/community',  donde: 'Comunidades',   name: 'Primer aplauso',     description: 'Dale corazón a una publicación',   objectiveType: 'post_apoyado',        objectiveValue: 1,  rewardXp: 50,  icon: '❤️' },
  { id: 'u_trivia1',    type: 'unique', dificultad: 'toque', ruta: '/profile',    donde: 'Mi Perfil',     name: 'Primer archivo',     description: 'Contestá una pregunta de la trivia', objectiveType: 'trivia_respondida', objectiveValue: 1,  rewardXp: 50,  icon: '🧠' },
  { id: 'u_carta1',     type: 'unique', dificultad: 'toque', ruta: '/cards',      donde: 'Buscar Cartas', name: 'Primera carta',      description: 'Agregá tu primera carta al botín', objectiveType: 'carta_agregada',      objectiveValue: 1,  rewardXp: 50,  icon: '➕' },
  { id: 'u_deck1',      type: 'unique', dificultad: 'rato',  ruta: '/decks',      donde: 'Mis Decks',     name: 'Primer mazo',        description: 'Armá tu primer mazo',              objectiveType: 'deck_created',        objectiveValue: 1,  rewardXp: 100, icon: '🛠️' },
  { id: 'u_busco1',     type: 'unique', dificultad: 'toque', ruta: '/explore',    donde: 'Contrabando',   name: 'Primer encargo',     description: 'Marcá una carta como «la busco»',  objectiveType: 'carta_deseada',       objectiveValue: 1,  rewardXp: 60,  icon: '🔎' },
  { id: 'u_venta1',     type: 'unique', dificultad: 'rato',  ruta: '/collection', donde: 'Mi Botín',      name: 'Primer negocio',     description: 'Poné una carta en venta',          objectiveType: 'carta_en_venta',      objectiveValue: 1,  rewardXp: 80,  icon: '🏷️' },
  { id: 'u_amistosa1',  type: 'unique', dificultad: 'reto',  ruta: '/amistosas',  donde: 'Amistosas',     name: 'Primera amistosa',   description: 'Registrá tu primera amistosa',     objectiveType: 'amistosa_registrada', objectiveValue: 1,  rewardXp: 100, icon: '🤝' },

  // ── HITOS ──────────────────────────────────────────────────────────────
  { id: 'u_visita7',    type: 'unique', dificultad: 'toque', ruta: '/',           donde: 'Base',          name: 'Guardia semanal', description: 'Entrá 7 días',                   objectiveType: 'dia_visitado',        objectiveValue: 7,  rewardXp: 120, icon: '🛰️' },
  { id: 'u_visita30',   type: 'unique', dificultad: 'toque', ruta: '/',           donde: 'Base',          name: 'Centinela',          description: 'Entrá 30 días',                    objectiveType: 'dia_visitado',        objectiveValue: 30, rewardXp: 300, icon: '🌌' },
  { id: 'u_fav10',      type: 'unique', dificultad: 'toque', ruta: '/cards',      donde: 'Buscar Cartas', name: 'Ojo entrenado',      description: 'Marcá 10 cartas favoritas',        objectiveType: 'card_favorited',      objectiveValue: 10, rewardXp: 120, icon: '⭐' },
  { id: 'u_apoyo25',    type: 'unique', dificultad: 'toque', ruta: '/community',  donde: 'Comunidades',   name: 'Alma del grupo',     description: 'Dale corazón a 25 publicaciones',  objectiveType: 'post_apoyado',        objectiveValue: 25, rewardXp: 200, icon: '💞' },
  { id: 'u_trivia50',   type: 'unique', dificultad: 'toque', ruta: '/profile',    donde: 'Mi Perfil',     name: 'Bibliotecario',      description: 'Contestá 50 preguntas de la trivia', objectiveType: 'trivia_respondida', objectiveValue: 50, rewardXp: 250, icon: '📚' },
  { id: 'u_carta100',   type: 'unique', dificultad: 'toque', ruta: '/cards',      donde: 'Buscar Cartas', name: 'Bodeguero',          description: 'Agregá 100 cartas a tu colección', objectiveType: 'carta_agregada',      objectiveValue: 100, rewardXp: 250, icon: '📦' },
  { id: 'u_sobre25',    type: 'unique', dificultad: 'rato',  ruta: '/sobres',     donde: 'Sobredosis',    name: 'Contrabandista',     description: 'Abrí 25 sobres',                   objectiveType: 'sobre_abierto',       objectiveValue: 25, rewardXp: 250, icon: '🎁' },
  { id: 'u_deck5',      type: 'unique', dificultad: 'rato',  ruta: '/decks',      donde: 'Mis Decks',     name: 'Arquitecto',         description: 'Armá 5 mazos',                     objectiveType: 'deck_created',        objectiveValue: 5,  rewardXp: 200, icon: '📐' },
  { id: 'u_chat10',     type: 'unique', dificultad: 'rato',  ruta: '/community',  donde: 'Comunidades',   name: 'Voz de la red',      description: 'Escribí 10 veces en el chat',      objectiveType: 'chat_enviado',        objectiveValue: 10, rewardXp: 120, icon: '💬' },
  { id: 'u_amistosa10', type: 'unique', dificultad: 'reto',  ruta: '/amistosas',  donde: 'Amistosas',     name: 'Veterano de mesa',   description: 'Registrá 10 amistosas',            objectiveType: 'amistosa_registrada', objectiveValue: 10, rewardXp: 300, icon: '⚔️' },
  { id: 'u_play10',     type: 'unique', dificultad: 'reto',  ruta: '/contador',   donde: 'Contador',      name: 'Piloto curtido',     description: 'Jugá 10 partidas',                 objectiveType: 'match_played',        objectiveValue: 10, rewardXp: 250, icon: '🎮' },
]

export const WEEKLY_MISSIONS: MissionTemplate[] = [
  // ── DE UN TOQUE ────────────────────────────────────────────────────────
  { id: 'w_visita4',   type: 'weekly', dificultad: 'toque', ruta: '/',           donde: 'Base',         name: 'Guardia constante',   description: 'Entrar 4 días esta semana',           objectiveType: 'dia_visitado',        objectiveValue: 4,  rewardXp: 50, icon: '🛰️' },
  { id: 'w_muro5',     type: 'weekly', dificultad: 'toque', ruta: '/community',  donde: 'Comunidades',  name: 'Voz de la Alianza',   description: 'Escribir 5 veces en Comunidades',     objectiveType: 'muro_publicado',      objectiveValue: 5,  rewardXp: 50, icon: '📡' },
  { id: 'w_apoyo10',   type: 'weekly', dificultad: 'toque', ruta: '/community',  donde: 'Comunidades',  name: 'Sostén del grupo',    description: 'Dar corazón a 10 publicaciones',      objectiveType: 'post_apoyado',        objectiveValue: 10, rewardXp: 45, icon: '❤️' },
  { id: 'w_trivia10',  type: 'weekly', dificultad: 'toque', ruta: '/profile',    donde: 'Mi Perfil',    name: 'Archivos completos',  description: 'Contestar 10 preguntas de la trivia', objectiveType: 'trivia_respondida',   objectiveValue: 10, rewardXp: 55, icon: '🧠' },
  { id: 'w_fav10',     type: 'weekly', dificultad: 'toque', ruta: '/cards',      donde: 'Buscar Cartas',name: 'Gran Curador',        description: 'Marcar 10 favoritas',                 objectiveType: 'card_favorited',      objectiveValue: 10, rewardXp: 40, icon: '💎' },
  { id: 'w_carta10',   type: 'weekly', dificultad: 'toque', ruta: '/cards',      donde: 'Buscar Cartas',name: 'Bodega llena',        description: 'Agregar 10 cartas a tu colección',    objectiveType: 'carta_agregada',      objectiveValue: 10, rewardXp: 45, icon: '📥' },
  { id: 'w_busco3',    type: 'weekly', dificultad: 'toque', ruta: '/explore',    donde: 'Contrabando',  name: 'Lista de encargos',   description: 'Marcar 3 cartas como «la busco»',     objectiveType: 'carta_deseada',       objectiveValue: 3,  rewardXp: 45, icon: '🔎' },

  // ── DE UN RATO ─────────────────────────────────────────────────────────
  { id: 'w_sobre7',    type: 'weekly', dificultad: 'rato',  ruta: '/sobres',     donde: 'Sobredosis',   name: 'Almacén Imperial',    description: 'Abrir 7 sobres',                      objectiveType: 'sobre_abierto',       objectiveValue: 7,  rewardXp: 60, icon: '📦' },
  { id: 'w_deck2',     type: 'weekly', dificultad: 'rato',  ruta: '/decks',      donde: 'Mis Decks',    name: 'Laboratorio', description: 'Crear 2 mazos',                       objectiveType: 'deck_created',        objectiveValue: 2,  rewardXp: 40, icon: '🔬' },
  { id: 'w_chat5',     type: 'weekly', dificultad: 'rato',  ruta: '/community',  donde: 'Comunidades',  name: 'Red abierta',         description: 'Escribir 5 veces en el chat',         objectiveType: 'chat_enviado',        objectiveValue: 5,  rewardXp: 45, icon: '💬' },
  { id: 'w_venta3',    type: 'weekly', dificultad: 'rato',  ruta: '/collection', donde: 'Mi Botín',     name: 'Puesto en el bazar',  description: 'Poner 3 cartas en venta',             objectiveType: 'carta_en_venta',      objectiveValue: 3,  rewardXp: 60, icon: '🏷️' },

  // ── DE RETO ────────────────────────────────────────────────────────────
  { id: 'w_amistosa3', type: 'weekly', dificultad: 'reto',  ruta: '/amistosas',  donde: 'Amistosas',    name: 'Sala de Guerra',      description: 'Registrar 3 amistosas',               objectiveType: 'amistosa_registrada', objectiveValue: 3,  rewardXp: 70, icon: '⚔️' },
  { id: 'w_win5',      type: 'weekly', dificultad: 'reto',  ruta: '/contador',   donde: 'Contador',     name: 'Campaña', description: 'Ganar 5 partidas',                    objectiveType: 'match_won',           objectiveValue: 5,  rewardXp: 60, icon: '🏅' },
]

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** Create a numeric seed from a string */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * El día de hoy en El Salvador (`YYYY-MM-DD`). La clave de las misiones diarias.
 *
 * ── Lo que había acá ──────────────────────────────────────────────────
 *
 * Este archivo era el ÚNICO del repo que intentaba fijar la zona, y la cuenta
 * estaba al revés. Hacía `getTimezoneOffset() + (-6 * 60)` y le sumaba eso al
 * instante. Medido, con el reloj de El Salvador:
 *
 *   dispositivo en SV     → getTimezoneOffset() = 360 → corrección 0 h    ✗
 *   dispositivo en UTC    → getTimezoneOffset() =   0 → corrección −6 h   ✓
 *   dispositivo en Tokio  → getTimezoneOffset() =−540 → corrección −15 h  ✗
 *
 * O sea que solo acertaba con el dispositivo en UTC — el único lugar donde no
 * está nadie de esta comunidad. En un teléfono puesto en El Salvador devolvía
 * el día de UTC: las misiones diarias se reiniciaban **a las 6 de la tarde**,
 * en plena hora de jugar, y una misión completada a las 7 p. m. contaba para
 * el día siguiente.
 *
 * La zona ya no se calcula a mano en ningún lado: se le pregunta al sistema.
 */
export function getTodayKey(): string {
  return diaCalendarioSV(new Date())
}

/**
 * La semana a la que pertenece un día del calendario SV (`2026-08-08`),
 * escrita como `YYYY-Wnn`.
 *
 * Se saca aparte —y toma el día por parámetro— para que el contador de abajo
 * pueda preguntarle por días futuros. Es LA definición de dónde cae el borde
 * de la semana, y tiene que haber una sola.
 *
 * La fórmula cuenta semanas que empiezan en **domingo**: la clave cambia al
 * pasar de sábado a domingo. Se deja tal cual estaba a propósito. Cambiarla a
 * lunes cambiaría el string de la semana EN CURSO, y `period_key` es parte de
 * la clave con la que se guarda el progreso en `user_missions`: todo el mundo
 * perdería de golpe lo que llevara avanzado, y encima le cambiarían las
 * misiones a media semana (el set sale de `hashString('weekly_' + weekKey)`).
 * El desacuerdo estaba en el contador, no acá.
 */
export function semanaDe(diaSV: string): string {
  const [anio, mes, dia] = diaSV.split('-').map(Number)
  // Aritmética pura de calendario sobre el día SV: sin zona que la corra.
  const hoy = Date.UTC(anio, mes - 1, dia)
  /*
   * La MISMA fórmula de siempre, pero evaluada en el DOMINGO en que empieza la
   * semana en vez de en el día en curso.
   *
   * El borde se rompía cada 1 de enero, porque el año de la clave salía del
   * día y el número de semana se reiniciaba con él:
   *
   *   2026-12-31 (jueves)  → 2026-W53
   *   2027-01-01 (viernes) → 2027-W01   ← la clave cambiaba un VIERNES
   *   2027-01-03 (domingo) → 2027-W02   ← y otra vez el domingo
   *
   * O sea dos cambios en una misma semana. `period_key` es parte de la clave
   * con la que se guarda el progreso en `user_missions`, así que todo el mundo
   * perdía a media semana lo que llevara avanzado y encima le cambiaban las
   * misiones (el set sale de `hashString('weekly_' + weekKey)`) — justo el
   * desacuerdo que este archivo decía haber cerrado.
   *
   * Anclar al domingo lo arregla SIN mover la clave de ninguna semana ya en
   * curso: para cualquier día, el domingo que lo contiene es el mismo que
   * antes, así que la fórmula devuelve el mismo string. Verificado día a día.
   */
  const domingo = hoy - new Date(hoy).getUTCDay() * 86_400_000
  const anioSemana = new Date(domingo).getUTCFullYear()
  const inicioAnio = Date.UTC(anioSemana, 0, 1)
  const diaDelAnio = Math.round((domingo - inicioAnio) / 86_400_000)
  const semana = Math.ceil((diaDelAnio + new Date(inicioAnio).getUTCDay() + 1) / 7)
  return `${anioSemana}-W${String(semana).padStart(2, '0')}`
}

/**
 * La semana corriente (`YYYY-Wnn`), contada en El Salvador. La clave de las
 * misiones semanales.
 *
 * Arrastraba el mismo desfase de `getTodayKey`, y encima mezclaba `getDay()`
 * —del dispositivo— con un instante ya corrido: dos relojes distintos en la
 * misma cuenta.
 */
export function getWeekKey(): string {
  return semanaDe(getTodayKey())
}

/**
 * El `period_key` que le toca a una misión según su tipo.
 *
 * Existe para que la regla viva en UN sitio: estaba escrita como
 * `type === 'daily' ? dayKey : weekKey` en cuatro lugares, y con un tercer
 * tipo ese ternario mandaba las únicas al cajón de las semanales — o sea que
 * habrían caducado cada lunes.
 */
export function clavePeriodo(tipo: MissionType): string {
  if (tipo === 'unique') return CLAVE_UNICA
  return tipo === 'daily' ? getTodayKey() : getWeekKey()
}


/** Select N random items from array using seed */
/**
 * Baraja de verdad (Fisher-Yates).
 *
 * Antes era `[...items].sort(() => rng() - 0.5)`, que NO produce una
 * permutación pareja: un comparador aleatorio le da al motor de ordenamiento
 * respuestas incoherentes y el resultado depende del algoritmo interno.
 *
 * Medido corriendo el sorteo real sobre 365 días:
 *
 *     10 misiones, se sortean 4 → la primera del arreglo salía 190 veces
 *                                  y la última 117            (1,6×)
 *     25 misiones, se sortean 6 → 154 contra 66               (2,3×)
 *
 * O sea que **empeora cuanto más grande es el montón**, y el sesgo es
 * POSICIONAL: las de más abajo son las que menos salen. Justo cuando se
 * agrandó el catálogo de 16 a 54, agregar misiones al final habría sido
 * agregarlas para que casi no aparecieran — la ampliación entera fallando en
 * silencio. Con Fisher-Yates el mismo experimento da 1,2×, que es el ruido
 * esperable de 365 tiradas.
 */
function barajar<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * El sorteo del día (o de la semana), con PISO de misiones fáciles.
 *
 * ── Por qué hace falta un piso ────────────────────────────────────────
 *
 * El sorteo era «N al azar del montón», y con eso se midió, sobre 365 días y
 * el catálogo viejo: **22 días al año no salía NINGUNA misión que la mayoría
 * de la comunidad pudiera hacer**, y el 38 % de los días salía como mucho
 * una. No es raro: de 38 perfiles, «enviar un regalo» lo hicieron 3 personas
 * y «jugar una partida» 7, y esas competían de igual a igual con «publicar en
 * Comunidades», que hicieron 26.
 *
 * El resultado se ve en la base: **19 de 38 personas tienen 0 XP**. No es que
 * no quieran; es que les tocaba una lista que no podían cumplir.
 *
 * Con el piso, todos los días hay al menos `minFaciles` de un toque. Las
 * difíciles siguen saliendo — son las que dan más XP y las que empujan a jugar
 * de verdad —, pero ya no pueden copar la lista entera.
 *
 * Las fáciles entran DOS veces al sorteo (en el piso y en el resto), así que
 * salen más seguido a propósito. Medido sobre 365 días con 22 plantillas:
 * dentro de cada nivel el reparto queda entre 1,1× y 1,5×, y ninguna se queda
 * sin salir nunca.
 */
export function sortearMisiones(
  items: MissionTemplate[],
  total: number,
  minFaciles: number,
  seed: number,
): MissionTemplate[] {
  const rng = seededRandom(seed)
  const faciles = barajar(items.filter(m => m.dificultad === 'toque'), rng)
  const resto = barajar(items.filter(m => m.dificultad !== 'toque'), rng)

  /* NO SE REPITE OBJETIVO en un mismo sorteo.
   *
   * «Abrir 1 sobre» y «Abrir 3 sobres» el mismo día son la misma tarea dos
   * veces: haciendo la segunda se cumple la primera sola, así que una de las
   * seis ranuras del día no pedía nada nuevo. Y desde que el ícono es uno por
   * OBJETIVO, además se verían dos tarjetas con el mismo dibujo — que se lee
   * como un error de la app, no como dos misiones.
   *
   * Se toma la primera de cada objetivo. Como el montón viene barajado, cuál
   * sea la elegida es distinto cada día. */
  const tomar = (de: MissionTemplate[], cuantas: number, ya: Set<ObjectiveType>) => {
    const out: MissionTemplate[] = []
    for (const m of de) {
      if (out.length >= cuantas) break
      if (ya.has(m.objectiveType)) continue
      ya.add(m.objectiveType)
      out.push(m)
    }
    return out
  }

  const usados = new Set<ObjectiveType>()
  const piso = tomar(faciles, Math.min(minFaciles, total), usados)
  const pool = barajar([...faciles.slice(piso.length), ...resto], rng)
  const relleno = tomar(pool, total - piso.length, usados)

  /* Si por el filtro no se llenaron las ranuras —pasa si el montón tiene menos
   * objetivos distintos que ranuras— se completa permitiendo repetir. Preferir
   * una lista corta a una con repetidos sería castigar al que juega por una
   * regla de presentación. */
  const salida = [...piso, ...relleno]
  if (salida.length < total) {
    const puestos = new Set(salida.map(m => m.id))
    for (const m of [...faciles, ...resto]) {
      if (salida.length >= total) break
      if (!puestos.has(m.id)) { puestos.add(m.id); salida.push(m) }
    }
  }
  return salida
}


/** Get today's daily missions for a user */
export function getDailyMissionTemplates(): MissionTemplate[] {
  const dayKey = getTodayKey()
  const seed = hashString(`daily_${dayKey}`)
  // 6 y no 4: hay 21 diarias en el montón y la queja era que había poco que
  // hacer. Con piso de 3 fáciles, la lista de un día siempre tiene mitad
  // hacible de un toque.
  return sortearMisiones(DAILY_MISSIONS, 6, 3, seed)
}

/** Get this week's weekly missions */
export function getWeeklyMissionTemplates(): MissionTemplate[] {
  const weekKey = getWeekKey()
  const seed = hashString(`weekly_${weekKey}`)
  return sortearMisiones(WEEKLY_MISSIONS, 4, 2, seed)
}
