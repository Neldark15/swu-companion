/**
 * Mission Service — Daily & Weekly missions system
 * "Órdenes del Día" y "Campañas Semanales"
 *
 * Uses deterministic seeded selection so all users get consistent missions per day/week.
 * Missions are tracked in Supabase `user_missions` table.
 */

import { supabase, isSupabaseReady } from './supabase'
import { notifyMissionComplete } from './notificationService'
import {
  diaCalendarioSV, diaCalendarioSVMas, inicioDelDiaSVenUTC, inicioDelDiaSiguienteSVenUTC,
} from './horaSV'

// ─── TYPES ──────────────────────────────────────────────────────────

export type MissionType = 'daily' | 'weekly'
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

export type RewardType = 'xp' | 'title' | 'xp_title'

export interface MissionTemplate {
  id: string
  type: MissionType
  name: string
  description: string
  objectiveType: ObjectiveType
  objectiveValue: number
  rewardXp: number
  icon: string
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
  { id: 'd_sobre1',    type: 'daily', name: 'Botín del día',        description: 'Abrir 1 sobre',                 objectiveType: 'sobre_abierto',      objectiveValue: 1, rewardXp: 20, icon: '📦' },
  { id: 'd_muro1',     type: 'daily', name: 'Señal en la red',      description: 'Publicar algo en el muro',      objectiveType: 'muro_publicado',     objectiveValue: 1, rewardXp: 15, icon: '📡' },
  { id: 'd_fav1',      type: 'daily', name: 'Ojo de Coleccionista', description: 'Marcar 1 carta favorita',       objectiveType: 'card_favorited',     objectiveValue: 1, rewardXp: 10, icon: '⭐' },
  { id: 'd_chat1',     type: 'daily', name: 'Frecuencia abierta',   description: 'Escribir en una sala de chat',  objectiveType: 'chat_enviado',       objectiveValue: 1, rewardXp: 15, icon: '💬' },
  { id: 'd_amistosa1', type: 'daily', name: 'Duelo de práctica',    description: 'Registrar una amistosa',        objectiveType: 'amistosa_registrada', objectiveValue: 1, rewardXp: 25, icon: '⚔️' },
  { id: 'd_deck1',     type: 'daily', name: 'Diseño Rápido',        description: 'Crear o importar un mazo',      objectiveType: 'deck_created',       objectiveValue: 1, rewardXp: 20, icon: '🔧' },
  { id: 'd_play1',     type: 'daily', name: 'Orden de Patrulla',    description: 'Jugar 1 partida',               objectiveType: 'match_played',       objectiveValue: 1, rewardXp: 20, icon: '🎮' },
  { id: 'd_win1',      type: 'daily', name: 'Victoria Táctica',     description: 'Ganar 1 partida',               objectiveType: 'match_won',          objectiveValue: 1, rewardXp: 25, icon: '🏆' },
  { id: 'd_sobre3',    type: 'daily', name: 'Fiebre de sobres',     description: 'Abrir 3 sobres',                objectiveType: 'sobre_abierto',      objectiveValue: 3, rewardXp: 30, icon: '🎁' },
  { id: 'd_gift1',     type: 'daily', name: 'Diplomacia Galáctica', description: 'Enviar 1 regalo',               objectiveType: 'gift_sent',          objectiveValue: 1, rewardXp: 15, icon: '🤝' },
]

export const WEEKLY_MISSIONS: MissionTemplate[] = [
  { id: 'w_sobre7',    type: 'weekly', name: 'Almacén Imperial',    description: 'Abrir 7 sobres',            objectiveType: 'sobre_abierto',       objectiveValue: 7,  rewardXp: 60, icon: '📦' },
  { id: 'w_muro5',     type: 'weekly', name: 'Voz de la Alianza',   description: 'Publicar 5 veces en el muro', objectiveType: 'muro_publicado',    objectiveValue: 5,  rewardXp: 50, icon: '📡' },
  { id: 'w_amistosa3', type: 'weekly', name: 'Sala de Guerra',      description: 'Registrar 3 amistosas',     objectiveType: 'amistosa_registrada', objectiveValue: 3,  rewardXp: 70, icon: '⚔️' },
  { id: 'w_deck2',     type: 'weekly', name: 'Laboratorio Táctico', description: 'Crear 2 mazos',             objectiveType: 'deck_created',        objectiveValue: 2,  rewardXp: 40, icon: '🔬' },
  { id: 'w_win5',      type: 'weekly', name: 'Campaña de Victoria', description: 'Ganar 5 partidas',          objectiveType: 'match_won',           objectiveValue: 5,  rewardXp: 60, icon: '🏅' },
  { id: 'w_fav10',     type: 'weekly', name: 'Gran Curador',        description: 'Marcar 10 favoritas',       objectiveType: 'card_favorited',      objectiveValue: 10, rewardXp: 40, icon: '💎' },
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
function semanaDe(diaSV: string): string {
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

/** Select N random items from array using seed */
function selectWithSeed<T>(items: T[], count: number, seed: number): T[] {
  const rng = seededRandom(seed)
  const shuffled = [...items].sort(() => rng() - 0.5)
  return shuffled.slice(0, count)
}

// ─── PUBLIC FUNCTIONS ───────────────────────────────────────────────

/** Get today's daily missions for a user */
export function getDailyMissionTemplates(): MissionTemplate[] {
  const dayKey = getTodayKey()
  const seed = hashString(`daily_${dayKey}`)
  return selectWithSeed(DAILY_MISSIONS, 4, seed)
}

/** Get this week's weekly missions */
export function getWeeklyMissionTemplates(): MissionTemplate[] {
  const weekKey = getWeekKey()
  const seed = hashString(`weekly_${weekKey}`)
  return selectWithSeed(WEEKLY_MISSIONS, 3, seed)
}

/** Load user's mission progress from Supabase */
export async function getUserMissions(userId: string): Promise<{
  daily: UserMission[]
  weekly: UserMission[]
}> {
  const dailyTemplates = getDailyMissionTemplates()
  const weeklyTemplates = getWeeklyMissionTemplates()

  if (!isSupabaseReady()) {
    return {
      daily: dailyTemplates.map(t => ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })),
      weekly: weeklyTemplates.map(t => ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })),
    }
  }

  const dayKey = getTodayKey()
  const weekKey = getWeekKey()

  try {
    const { data } = await supabase
      .from('user_missions')
      .select('mission_id, progress, completed, completed_at, claimed')
      .eq('user_id', userId)
      .in('period_key', [dayKey, weekKey])

    const progressMap = new Map<string, { progress: number; completed: boolean; completedAt?: string; claimed: boolean }>()
    if (data) {
      for (const row of data) {
        progressMap.set(row.mission_id, {
          progress: row.progress || 0,
          completed: !!row.completed,
          completedAt: row.completed_at || undefined,
          claimed: !!row.claimed,
        })
      }
    }

    const mapTemplate = (t: MissionTemplate): UserMission => {
      const saved = progressMap.get(t.id)
      return {
        missionId: t.id,
        template: t,
        progress: saved?.progress || 0,
        completed: saved?.completed || false,
        completedAt: saved?.completedAt,
        claimed: saved?.claimed || false,
      }
    }

    return {
      daily: dailyTemplates.map(mapTemplate),
      weekly: weeklyTemplates.map(mapTemplate),
    }
  } catch {
    return {
      daily: dailyTemplates.map(t => ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })),
      weekly: weeklyTemplates.map(t => ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })),
    }
  }
}

/** Update mission progress when a relevant action happens */
export async function updateMissionProgress(
  userId: string,
  objectiveType: ObjectiveType,
  increment: number = 1,
): Promise<void> {
  if (!isSupabaseReady()) return

  const dailyTemplates = getDailyMissionTemplates()
  const weeklyTemplates = getWeeklyMissionTemplates()
  const allRelevant = [...dailyTemplates, ...weeklyTemplates].filter(t => t.objectiveType === objectiveType)

  if (allRelevant.length === 0) return

  const dayKey = getTodayKey()
  const weekKey = getWeekKey()

  for (const template of allRelevant) {
    const periodKey = template.type === 'daily' ? dayKey : weekKey

    try {
      // Upsert mission progress
      const { data: existing } = await supabase
        .from('user_missions')
        .select('progress, completed, claimed')
        .eq('user_id', userId)
        .eq('mission_id', template.id)
        .eq('period_key', periodKey)
        .single()

      if (existing?.completed) continue // already completed

      const newProgress = Math.min((existing?.progress || 0) + increment, template.objectiveValue)
      const nowCompleted = newProgress >= template.objectiveValue
      const completedAt = nowCompleted ? new Date().toISOString() : null

      if (existing) {
        await supabase
          .from('user_missions')
          .update({ progress: newProgress, completed: nowCompleted, completed_at: completedAt })
          .eq('user_id', userId)
          .eq('mission_id', template.id)
          .eq('period_key', periodKey)
      } else {
        await supabase.from('user_missions').insert({
          user_id: userId,
          mission_id: template.id,
          period_key: periodKey,
          mission_type: template.type,
          progress: newProgress,
          completed: nowCompleted,
          completed_at: completedAt,
          claimed: false,
        })
      }

      if (nowCompleted) {
        /* SE ACREDITA SOLA. Antes no.
         *
         * Este es el fallo que dejaba las misiones sin efecto: `claimMissionReward`
         * tenía UN llamador —la pantalla de Misiones— así que completabas la misión
         * en silencio y el XP no llegaba nunca a menos que entraras a /misiones y
         * tocaras un botón. Medido sobre las 10 filas de toda la historia de la app:
         * 7 completadas, y 3 de ellas nunca cobradas. Peor, la recompensa se PERDÍA
         * al rotar el período.
         *
         * Un premio que hay que ir a buscar a una pantalla escondida no es un premio,
         * es una tarea. Se acredita acá y se avisa con el número.
         *
         * Se reusa `claimMissionReward` en vez de copiar el reparto: comprueba
         * `completed && !claimed` contra la base, así que llamarla dos veces —desde
         * acá y desde la pantalla vieja— no paga dos veces. */
        const cobro = await claimMissionReward(userId, template.id)
        notifyMissionComplete(
          template.name,
          cobro.success ? cobro.xpAwarded : undefined,
        )
      }
    } catch (e) {
      console.warn('[Mission] Failed to update progress:', e)
    }
  }
}

/** Claim a completed mission reward */
export async function claimMissionReward(
  userId: string,
  missionId: string,
): Promise<{ success: boolean; xpAwarded: number; error?: string }> {
  if (!isSupabaseReady()) return { success: false, xpAwarded: 0, error: 'Sin conexión' }

  const allTemplates = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]
  const template = allTemplates.find(t => t.id === missionId)
  if (!template) return { success: false, xpAwarded: 0, error: 'Misión no encontrada' }

  const periodKey = template.type === 'daily' ? getTodayKey() : getWeekKey()

  try {
    const { data } = await supabase
      .from('user_missions')
      .select('completed, claimed')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .eq('period_key', periodKey)
      .single()

    if (!data?.completed) return { success: false, xpAwarded: 0, error: 'Misión no completada' }
    if (data.claimed) return { success: false, xpAwarded: 0, error: 'Ya reclamada' }

    // Mark as claimed
    await supabase
      .from('user_missions')
      .update({ claimed: true })
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .eq('period_key', periodKey)

    // Award XP + bonus XP for mission completion
    const bonusXp = template.type === 'daily' ? 20 : 60
    const totalXp = template.rewardXp + bonusXp

    const { data: stats } = await supabase
      .from('player_stats')
      .select('xp, daily_missions_completed, weekly_missions_completed')
      .eq('user_id', userId)
      .single()

    if (stats) {
      const updates: Record<string, number | string> = {
        xp: (stats.xp || 0) + totalXp,
        updated_at: new Date().toISOString(),
      }
      if (template.type === 'daily') {
        updates.daily_missions_completed = (stats.daily_missions_completed || 0) + 1
      } else {
        updates.weekly_missions_completed = (stats.weekly_missions_completed || 0) + 1
      }

      await supabase
        .from('player_stats')
        .update(updates)
        .eq('user_id', userId)
    }

    return { success: true, xpAwarded: totalXp }
  } catch (e) {
    console.warn('[Mission] Claim failed:', e)
    return { success: false, xpAwarded: 0, error: 'Error al reclamar' }
  }
}

/**
 * Cuánto falta para el próximo reinicio diario: la medianoche de El Salvador.
 *
 * Lo que se devuelve es una DURACIÓN, y una duración no tiene zona. Lo que sí
 * la tiene es el borde contra el que se mide, y ese borde estaba mal (ver
 * `getTodayKey`): el contador llegaba a cero a las 6 de la tarde.
 */
export function getTimeUntilDailyReset(): { hours: number; minutes: number } {
  const diff = inicioDelDiaSiguienteSVenUTC().getTime() - Date.now()
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  }
}

/**
 * Cuánto falta para el próximo reinicio semanal, contado en El Salvador.
 *
 * ── El contador prometía un día que no era ────────────────────────────
 *
 * Apuntaba al **lunes** a medianoche, calculado a mano con `diaSemanaSV()`.
 * Pero las misiones no cambian el lunes: cambian cuando cambia `getWeekKey()`,
 * y esa fórmula cuenta semanas que empiezan en **domingo**. Medido con el
 * reloj en sábado 8 de agosto: `2026-08-08` → W32, `2026-08-09` (domingo) →
 * W33. O sea que el domingo las misiones ya se habían reiniciado y el contador
 * seguía diciendo «falta 1 día». No lo trajo la migración de zona: el
 * `getWeekKey` viejo usaba la misma fórmula de domingo y el contador viejo
 * también apuntaba al lunes. Se preservó fielmente una contradicción vieja.
 *
 * ── Por qué se busca el borde en vez de calcularlo ────────────────────
 *
 * Ahora el contador no sabe qué día empieza la semana: le PREGUNTA a
 * `semanaDe` avanzando de día en día hasta que la clave cambia. Así no hay dos
 * reglas que puedan volver a separarse —hay una sola, y la otra la consulta—,
 * y de paso queda bien el 1 de enero, cuando la clave salta de año a mitad de
 * semana y cualquier cuenta de «próximo domingo» habría vuelto a mentir.
 *
 * El tope de 8 vueltas es una red, no la lógica: una semana tiene 7 días, así
 * que el cambio siempre cae antes. Si por lo que sea no cayera, se devuelve el
 * borde del día 7 en vez de colgar el render en un bucle infinito.
 */
export function getTimeUntilWeeklyReset(): { days: number; hours: number } {
  // Un solo instante para toda la cuenta. Con `new Date()` en cada paso, una
  // llamada que cruzara la medianoche entre el primero y el último leería dos
  // «hoy» distintos y devolvería un día de más.
  const ahora = new Date()
  const semanaHoy = semanaDe(diaCalendarioSV(ahora))

  let dias = 1
  let diaBorde = diaCalendarioSVMas(dias, ahora)
  while (dias < 8 && semanaDe(diaBorde) === semanaHoy) {
    dias++
    diaBorde = diaCalendarioSVMas(dias, ahora)
  }

  // La medianoche SV del MISMO día que encontró el bucle. Se ancla al mediodía
  // UTC de ese día —que en SV son las 6 de la mañana, bien adentro— para que
  // ninguna cuenta de milisegundos pueda dejarlo en el día vecino.
  const proximoBorde = inicioDelDiaSVenUTC(`${diaBorde}T12:00:00Z`)
  const diff = proximoBorde.getTime() - ahora.getTime()
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
  }
}
