/**
 * Mission Service — Daily & Weekly missions system
 * "Órdenes del Día" y "Campañas Semanales"
 *
 * Uses deterministic seeded selection so all users get consistent missions per day/week.
 * Missions are tracked in Supabase `user_missions` table.
 */

import { supabase, isSupabaseReady } from './supabase'
import { contarMisionEnLaNube } from './sync'
import { acreditarXp } from '../hooks/useAuth'
import { notifyMissionComplete } from './notificationService'
import {
  diaCalendarioSV, diaCalendarioSVMas, inicioDelDiaSVenUTC, inicioDelDiaSiguienteSVenUTC,
} from './horaSV'

// ─── TYPES ──────────────────────────────────────────────────────────

/**
 * `unique` son las que se hacen UNA VEZ en la vida de la cuenta.
 *
 * Las diarias premian volver; las únicas premian *empezar*. Sin ellas, quien
 * abre la app por primera vez ve tareas que dan 20 XP y una barra de nivel
 * que no se mueve — y los hitos que de verdad importan (armar el primer mazo,
 * jugar el primer torneo, completar un set) no se reconocían en ningún lado.
 *
 * No caducan: su `period_key` es la constante `once`, así que la fila que se
 * crea al completarla es la prueba permanente de que ya se hizo.
 */
/* El catálogo, las claves de período y el sorteo viven en
   `misionesCatalogo.ts` (puro, sin red, probado sobre 365 días simulados).
   Se re-exportan enteros para no tocar a los archivos que ya importan de acá. */
export type {
  MissionType, Dificultad, ObjectiveType, RewardType, MissionTemplate, UserMission,
} from './misionesCatalogo'
export {
  BONUS_POR_TIPO, CLAVE_UNICA,
  DAILY_MISSIONS, WEEKLY_MISSIONS, UNIQUE_MISSIONS,
  getDailyMissionTemplates, getWeeklyMissionTemplates,
  getTodayKey, getWeekKey, clavePeriodo, sortearMisiones, semanaDe,
} from './misionesCatalogo'

import {
  BONUS_POR_TIPO, CLAVE_UNICA,
  DAILY_MISSIONS, WEEKLY_MISSIONS, UNIQUE_MISSIONS,
  getDailyMissionTemplates, getWeeklyMissionTemplates,
  getTodayKey, getWeekKey, clavePeriodo, semanaDe,
  type ObjectiveType, type MissionTemplate, type UserMission,
} from './misionesCatalogo'

// ─── PUBLIC FUNCTIONS ───────────────────────────────────────────────





/** Load user's mission progress from Supabase */
export async function getUserMissions(userId: string): Promise<{
  daily: UserMission[]
  weekly: UserMission[]
  /* Las únicas van TODAS, no una selección: no rotan, y esconder un hito que
     ya se cumplió sería quitarle a alguien la prueba de haberlo hecho. */
  unicas: UserMission[]
}> {
  const dailyTemplates = getDailyMissionTemplates()
  const weeklyTemplates = getWeeklyMissionTemplates()

  /* Sin id no se sale a la red: `.eq('user_id', '')` es un 400 de PostgREST
   * («invalid input syntax for type uuid»), y el catálogo en cero es la misma
   * respuesta sin el viaje ni el error rojo en consola. */
  if (!userId || !isSupabaseReady()) {
    const vacia = (t: MissionTemplate): UserMission =>
      ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })
    return {
      daily: dailyTemplates.map(vacia),
      weekly: weeklyTemplates.map(vacia),
      unicas: UNIQUE_MISSIONS.map(vacia),
    }
  }

  const dayKey = getTodayKey()
  const weekKey = getWeekKey()

  try {
    const { data, error } = await supabase
      .from('user_missions')
      .select('mission_id, progress, completed, completed_at, claimed')
      .eq('user_id', userId)
      .in('period_key', [dayKey, weekKey, CLAVE_UNICA])

    /* §2f otra vez: sin mirar `error`, `data` viene null y TODA la pantalla
     * sale en 0/N. Eso no se distingue de «todavía no hiciste nada», que es
     * justo el síntoma que se reportó. */
    if (error) console.warn('[Misiones] No se pudo leer el progreso:', error.message)

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
      unicas: UNIQUE_MISSIONS.map(mapTemplate),
    }
  } catch {
    const vacia = (t: MissionTemplate): UserMission =>
      ({ missionId: t.id, template: t, progress: 0, completed: false, claimed: false })
    return {
      daily: dailyTemplates.map(vacia),
      weekly: weeklyTemplates.map(vacia),
      unicas: UNIQUE_MISSIONS.map(vacia),
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
  /* Las únicas van enteras: no se rotan, así que una acción tiene que poder
     avanzar el hito aunque ese día no haya salido ninguna diaria del tema. */
  const allRelevant = [...dailyTemplates, ...weeklyTemplates, ...UNIQUE_MISSIONS]
    .filter(t => t.objectiveType === objectiveType)

  if (allRelevant.length === 0) return

  for (const template of allRelevant) {
    const periodKey = clavePeriodo(template.type)

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

      /* §2f: hay que MIRAR `error`. Sin esto, el CHECK
       * `mission_type in ('daily','weekly')` rebotaba cada única con un 23514
       * y el fallo se veía idéntico a «esta misión todavía no avanza»: la
       * función entera habría quedado desplegada y muerta, sin un solo
       * mensaje. Ese CHECK ya se amplió, pero la ceguera era el bug de
       * verdad — la próxima restricción nueva se vería igual de bien. */
      const { error: errEscritura } = existing
        ? await supabase
            .from('user_missions')
            .update({ progress: newProgress, completed: nowCompleted, completed_at: completedAt })
            .eq('user_id', userId)
            .eq('mission_id', template.id)
            .eq('period_key', periodKey)
        : await supabase.from('user_missions').insert({
            user_id: userId,
            mission_id: template.id,
            period_key: periodKey,
            mission_type: template.type,
            progress: newProgress,
            completed: nowCompleted,
            completed_at: completedAt,
            claimed: false,
          })

      if (errEscritura) {
        console.warn(`[Misiones] No se pudo guardar "${template.id}" (${template.type}):`, errEscritura.message)
        continue
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

  const allTemplates = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS, ...UNIQUE_MISSIONS]
  const template = allTemplates.find(t => t.id === missionId)
  if (!template) return { success: false, xpAwarded: 0, error: 'Misión no encontrada' }

  const periodKey = clavePeriodo(template.type)

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

    /* El XP se SUMA en el servidor; antes se leía el total, se sumaba y se
     * escribía de vuelta — y `syncStatsToCloud`, que hace un upsert de la
     * fila entera desde el Dexie local, lo pisaba con el valor viejo del
     * aparato. Medido: 8 de 11 personas con misiones cobradas perdieron
     * pagos, y como la misión queda `claimed`, no se podían volver a cobrar.
     *
     * `acreditarXp` manda `sumar_xp` (`xp = xp + n`) y BAJA el total nuevo a
     * Dexie. Las dos mitades hacen falta: sin la suma en el servidor el XP se
     * pierde, y sin la bajada el número de la pantalla —que sale de Dexie— no
     * se mueve hasta el siguiente inicio de sesión, que se ve exactamente
     * igual que si no se hubiera pagado. */
    const bonusXp = BONUS_POR_TIPO[template.type]
    const totalXp = template.rewardXp + bonusXp

    const sumado = await acreditarXp(totalXp, `mision:${missionId}`)
    if (!sumado) {
      /* No se pudo pagar. Se DESMARCA el cobro: dejarla `claimed` sin haber
       * pagado es exactamente cómo se perdieron los 15 pagos anteriores —
       * marcada como cobrada y sin XP, imposible de reintentar. */
      await supabase
        .from('user_missions')
        .update({ claimed: false })
        .eq('user_id', userId)
        .eq('mission_id', missionId)
        .eq('period_key', periodKey)
      return { success: false, xpAwarded: 0, error: 'No se pudo acreditar el XP; intentá de nuevo.' }
    }

    await contarMisionEnLaNube(template.type)

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
