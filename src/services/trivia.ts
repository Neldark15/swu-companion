/**
 * Archivos Jedi — Sistema de Trivia diaria
 * 10 preguntas diarias, 2 XP cada respuesta correcta
 * Mezcla: universo Star Wars + juego Star Wars Unlimited
 */

import { supabase, isSupabaseReady } from './supabase'
import { updateMissionProgress } from './missionService'
import { BANCO_TRIVIA, type TemaTrivia } from './triviaBanco'
import { diaCalendarioSV, diaCalendarioSVMas } from './horaSV'
/* El sorteo vive aparte y PURO para poder probarlo con un guion: acá adentro
   arrastraría el cliente de Supabase. Se reexporta para no tocar a quien ya
   importaba `getDailyQuestions` desde este archivo. */
export { getDailyQuestions, getTemaQuestions } from './triviaSorteo'

/**
 * El día de hoy en El Salvador — la clave de la trivia diaria.
 *
 * Antes era `new Date().toISOString().split('T')[0]`, o sea el día UTC: la
 * trivia se renovaba a las 6 de la tarde de acá. Quien jugaba después de esa
 * hora quemaba las preguntas del día siguiente.
 */
function hoySV(): string {
  return diaCalendarioSV(new Date())
}

// ─── Types ──────────────────────────────────────────────────

// El tipo y el banco viven en triviaBanco.ts: el banco es CONTENIDO (lo
// editan tandas grandes de preguntas) y esto es LÓGICA. Separados, una tanda
// de preguntas nueva no toca ni una línea de código.
export type { PreguntaTrivia as TriviaQuestion, TemaTrivia } from './triviaBanco'

/** Los temas con su nombre en pantalla, en el orden del selector. */
/* Sin campo `emoji`: los temas se dibujan con íconos propios
   (`features/trivia/iconoTema.ts`, §3t). Un emoji lo pinta el sistema
   operativo y era distinto en cada teléfono. */
export const TEMAS: { id: TemaTrivia; nombre: string }[] = [
  { id: 'jedi',      nombre: 'Jedi' },
  { id: 'sith',      nombre: 'Sith' },
  { id: 'criaturas', nombre: 'Criaturas' },
  { id: 'planetas',  nombre: 'Planetas' },
  { id: 'naves',     nombre: 'Naves' },
  { id: 'juego',     nombre: 'SWU' },
]

export interface TriviaProgress {
  date: string              // YYYY-MM-DD
  questionsAnswered: number
  correctAnswers: number
  xpEarned: number
  answeredIds: string[]
}


/** Compatibilidad: el banco completo bajo el nombre histórico. */
export const TRIVIA_QUESTIONS = BANCO_TRIVIA

// ─── Medallas por tema ───────────────────────────────────────

/**
 * Umbrales de medalla, en respuestas CORRECTAS acumuladas del tema.
 *
 * Con ~14 preguntas por tema y el candado de una sesión por tema al día, el
 * oro exige varios días de volver: la medalla mide constancia, no una tarde.
 */
export const UMBRAL_MEDALLA = { bronce: 10, plata: 25, oro: 50 } as const
export type Medalla = 'bronce' | 'plata' | 'oro' | null

export function medallaDe(correctas: number): Medalla {
  if (correctas >= UMBRAL_MEDALLA.oro) return 'oro'
  if (correctas >= UMBRAL_MEDALLA.plata) return 'plata'
  if (correctas >= UMBRAL_MEDALLA.bronce) return 'bronce'
  return null
}

/** La que sigue, para pintar «te faltan N»: null si ya es oro. */
export function siguienteUmbral(correctas: number): number | null {
  if (correctas >= UMBRAL_MEDALLA.oro) return null
  if (correctas >= UMBRAL_MEDALLA.plata) return UMBRAL_MEDALLA.oro
  if (correctas >= UMBRAL_MEDALLA.bronce) return UMBRAL_MEDALLA.plata
  return UMBRAL_MEDALLA.bronce
}

export interface ProgresoTema {
  correctas: number
  respondidas: number
}

/** El progreso de todos los temas de una persona. Tema sin fila = 0/0. */
export async function getProgresoTemas(userId: string): Promise<Map<TemaTrivia, ProgresoTema>> {
  const salida = new Map<TemaTrivia, ProgresoTema>()
  if (!isSupabaseReady() || !userId) return salida
  const { data, error } = await supabase
    .from('trivia_temas')
    .select('tema, correctas, respondidas')
    .eq('user_id', userId)
  if (error) {
    console.warn('[trivia] no se pudo leer el progreso de temas:', error.message)
    return salida
  }
  for (const f of data ?? []) {
    salida.set(f.tema as TemaTrivia, { correctas: f.correctas, respondidas: f.respondidas })
  }
  return salida
}

/**
 * Suma una respuesta al tema, vía RPC.
 *
 * Es una RPC y no un update porque la tabla no concede INSERT ni UPDATE
 * directos: un update abierto dejaría escribir `correctas = 999999` y las
 * medallas serían decoración autoservida. La función suma DE A UNO del lado
 * del servidor. Verificado: el update directo rebota.
 */
export async function sumarTema(tema: TemaTrivia, correcta: boolean): Promise<ProgresoTema | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('trivia_sumar_tema', {
    p_tema: tema, p_correcta: correcta,
  })
  if (error) {
    console.warn('[trivia] no se pudo sumar al tema:', error.message)
    return null
  }
  const fila = Array.isArray(data) ? data[0] : data
  return fila ? { correctas: fila.correctas, respondidas: fila.respondidas } : null
}

// ─── Sesión por tema (práctica, sin XP) ─────────────────────


/**
 * Qué preguntas de tema ya se respondieron HOY, en este aparato.
 *
 * Es un candado LOCAL y cosmético, dicho sin vergüenza: las medallas no pagan
 * nada, así que no ameritan una tabla más. Evita lo único que importa — que
 * repetir la misma sesión el mismo día infle el contador sin aprender nada.
 */
const CLAVE_TEMA_HOY = () => `swu-trivia-tema-${hoySV()}`

export function temaRespondidasHoy(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_TEMA_HOY())
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : [])
  } catch { return new Set() }
}

export function marcarTemaRespondida(id: string): void {
  try {
    const ids = temaRespondidasHoy()
    ids.add(id)
    localStorage.setItem(CLAVE_TEMA_HOY(), JSON.stringify([...ids]))
  } catch { /* sin localStorage no hay candado; las medallas siguen siendo cosméticas */ }
}

/** Semilla del día: la misma persona ve el mismo orden todo el día. */

/** Shuffle array using seed (Fisher-Yates with seeded random) */



// ─── Supabase Integration ────────────────────────────────────

/** Get today's progress from Supabase */
export async function getTodayProgress(userId: string): Promise<TriviaProgress | null> {
  if (!isSupabaseReady()) return null
  const today = hoySV()

  const { data } = await supabase
    .from('trivia_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (!data) return null
  return {
    date: data.date,
    questionsAnswered: data.questions_answered,
    correctAnswers: data.correct_answers,
    xpEarned: data.xp_earned,
    answeredIds: data.answered_ids || [],
  }
}

/** Record an answer in Supabase */
export async function recordTriviaAnswer(
  userId: string,
  questionId: string,
  isCorrect: boolean
): Promise<{ ok: boolean; xpEarned: number }> {
  if (!isSupabaseReady()) return { ok: false, xpEarned: 0 }

  const today = hoySV()
  const xp = isCorrect ? 2 : 0

  // Get current progress
  const { data: existing } = await supabase
    .from('trivia_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (existing) {
    // Update existing record
    const newAnsweredIds = [...(existing.answered_ids || []), questionId]
    const { error } = await supabase
      .from('trivia_progress')
      .update({
        questions_answered: existing.questions_answered + 1,
        correct_answers: existing.correct_answers + (isCorrect ? 1 : 0),
        xp_earned: existing.xp_earned + xp,
        answered_ids: newAnsweredIds,
      })
      .eq('user_id', userId)
      .eq('date', today)

    if (error) return { ok: false, xpEarned: 0 }
  } else {
    // Insert new record
    const { error } = await supabase
      .from('trivia_progress')
      .insert({
        user_id: userId,
        date: today,
        questions_answered: 1,
        correct_answers: isCorrect ? 1 : 0,
        xp_earned: xp,
        answered_ids: [questionId],
      })

    if (error) return { ok: false, xpEarned: 0 }
  }

  /* Después de los DOS caminos (fila nueva y fila que ya existía), y solo
     tras comprobar que ninguno devolvió error: acá la respuesta ya quedó
     guardada. Cuenta igual si acertaste o no — la misión es contestar. */
  void updateMissionProgress(userId, 'trivia_respondida').catch(() => {})

  return { ok: true, xpEarned: xp }
}

/** Get total trivia stats for a user (all time) */
export async function getTriviaStats(userId: string): Promise<{ totalCorrect: number; totalAnswered: number; streakDays: number }> {
  if (!isSupabaseReady()) return { totalCorrect: 0, totalAnswered: 0, streakDays: 0 }

  const { data } = await supabase
    .from('trivia_progress')
    .select('date, correct_answers, questions_answered')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(60) // Last 60 days max

  if (!data || data.length === 0) return { totalCorrect: 0, totalAnswered: 0, streakDays: 0 }

  let totalCorrect = 0
  let totalAnswered = 0
  let streakDays = 0

  // La racha: días seguidos hacia atrás desde hoy.
  //
  // Se compara día contra día, en texto. Antes se mezclaban dos relojes en la
  // misma comparación —`setDate(getDate() - i)` usa el del dispositivo y
  // `toISOString()` devuelve el de UTC—, así que en El Salvador, a partir de
  // las 6 de la tarde, el día esperado salía uno adelantado y la racha se
  // rompía sola todas las noches.
  for (let i = 0; i < data.length; i++) {
    totalCorrect += data[i].correct_answers
    totalAnswered += data[i].questions_answered

    // Lo guardado ya es un `YYYY-MM-DD`; pasarlo por `new Date` solo le
    // agregaría una zona que no tiene.
    const dia = String(data[i].date).slice(0, 10)

    if (dia === diaCalendarioSVMas(-i)) {
      streakDays++
    } else if (i === 0 && dia === diaCalendarioSVMas(-1)) {
      // Todavía no jugó hoy: la racha de ayer sigue viva.
      streakDays++
    } else {
      break
    }
  }

  return { totalCorrect, totalAnswered, streakDays }
}
