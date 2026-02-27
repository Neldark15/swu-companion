/**
 * Archivos Jedi — Sistema de Trivia diaria
 * 10 preguntas diarias, 2 XP cada respuesta correcta
 * Mezcla: universo Star Wars + juego Star Wars Unlimited
 */

import { supabase, isSupabaseReady } from './supabase'

// ─── Types ──────────────────────────────────────────────────

export interface TriviaQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: 'universe' | 'swu'
  funFact: string
}

export interface TriviaProgress {
  date: string              // YYYY-MM-DD
  questionsAnswered: number
  correctAnswers: number
  xpEarned: number
  answeredIds: string[]
}

// ─── Question Bank (100+ questions) ──────────────────────────

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // === UNIVERSO STAR WARS ===
  { id: 'u01', question: '¿Cuál es el verdadero nombre de Darth Vader?', options: ['Anakin Skywalker', 'Luke Skywalker', 'Ben Solo', 'Sheev Palpatine'], correctIndex: 0, category: 'universe', funFact: 'Anakin fue descubierto en Tatooine por Qui-Gon Jinn cuando tenía 9 años.' },
  { id: 'u02', question: '¿Qué color es el sable de luz de Mace Windu?', options: ['Azul', 'Verde', 'Púrpura', 'Rojo'], correctIndex: 2, category: 'universe', funFact: 'Samuel L. Jackson pidió un sable púrpura para distinguirse en las escenas de batalla.' },
  { id: 'u03', question: '¿Quién dijo "Haz o no hagas, no hay intentar"?', options: ['Obi-Wan Kenobi', 'Yoda', 'Luke Skywalker', 'Qui-Gon Jinn'], correctIndex: 1, category: 'universe', funFact: 'Yoda entrenó a Luke en el planeta pantanoso de Dagobah.' },
  { id: 'u04', question: '¿En qué planeta vive Chewbacca originalmente?', options: ['Endor', 'Kashyyyk', 'Hoth', 'Naboo'], correctIndex: 1, category: 'universe', funFact: 'Kashyyyk es el planeta natal de los Wookiees, cubierto de bosques gigantes.' },
  { id: 'u05', question: '¿Cómo se llama la nave de Han Solo?', options: ['X-Wing', 'TIE Fighter', 'Halcón Milenario', 'Slave I'], correctIndex: 2, category: 'universe', funFact: 'El Halcón Milenario hizo el recorrido de Kessel en menos de 12 parsecs.' },
  { id: 'u06', question: '¿Quién es el padre de Leia Organa?', options: ['Han Solo', 'Bail Organa', 'Anakin Skywalker', 'Obi-Wan Kenobi'], correctIndex: 2, category: 'universe', funFact: 'Leia fue adoptada por Bail Organa, pero su padre biológico es Anakin Skywalker.' },
  { id: 'u07', question: '¿Qué especie es Jabba?', options: ['Hutt', 'Wookiee', 'Twi\'lek', 'Rodian'], correctIndex: 0, category: 'universe', funFact: 'Los Hutts son una especie longeva que puede vivir más de 1000 años.' },
  { id: 'u08', question: '¿Cuál es el planeta capital de la República/Imperio?', options: ['Naboo', 'Coruscant', 'Alderaan', 'Mustafar'], correctIndex: 1, category: 'universe', funFact: 'Coruscant es un ecumenópolis, un planeta completamente cubierto por una ciudad.' },
  { id: 'u09', question: '¿Quién construyó a C-3PO?', options: ['Obi-Wan', 'Watto', 'Anakin Skywalker', 'Padmé Amidala'], correctIndex: 2, category: 'universe', funFact: 'Anakin construyó a C-3PO cuando era niño esclavo en Tatooine.' },
  { id: 'u10', question: '¿Qué orden ejecutó el Emperador para eliminar a los Jedi?', options: ['Orden 65', 'Orden 66', 'Orden 77', 'Orden 99'], correctIndex: 1, category: 'universe', funFact: 'La Orden 66 activó los chips inhibidores en los clones, forzándolos a atacar a los Jedi.' },
  { id: 'u11', question: '¿Qué personaje dice "Yo soy tu padre"?', options: ['Obi-Wan Kenobi', 'Palpatine', 'Darth Vader', 'Yoda'], correctIndex: 2, category: 'universe', funFact: 'La frase real en inglés es "No, I am your father", no "Luke, I am your father".' },
  { id: 'u12', question: '¿Cuántos episodios tiene la saga Skywalker?', options: ['6', '7', '8', '9'], correctIndex: 3, category: 'universe', funFact: 'La saga va del Episodio I (1999) al Episodio IX (2019), 9 películas principales.' },
  { id: 'u13', question: '¿Cómo se llama el maestro Jedi de Obi-Wan?', options: ['Mace Windu', 'Yoda', 'Qui-Gon Jinn', 'Ki-Adi-Mundi'], correctIndex: 2, category: 'universe', funFact: 'Qui-Gon Jinn fue el primer Jedi en descubrir cómo mantener la consciencia tras la muerte.' },
  { id: 'u14', question: '¿Qué raza es Ahsoka Tano?', options: ['Twi\'lek', 'Togruta', 'Zabrak', 'Mirialan'], correctIndex: 1, category: 'universe', funFact: 'Los Togruta son nativos del planeta Shili y tienen montrales que detectan movimiento.' },
  { id: 'u15', question: '¿Quién creó el Ejército Clon?', options: ['Palpatine', 'Sifo-Dyas', 'Dooku', 'Jango Fett'], correctIndex: 1, category: 'universe', funFact: 'Sifo-Dyas encargó el ejército en secreto, luego fue asesinado por orden de Dooku.' },
  { id: 'u16', question: '¿Qué destruyó la primera Estrella de la Muerte?', options: ['Un torpedo de protones', 'Un sable de luz', 'Una bomba termal', 'Un ataque kamikaze'], correctIndex: 0, category: 'universe', funFact: 'Luke Skywalker disparó el torpedo que destruyó la Estrella de la Muerte en la Batalla de Yavin.' },
  { id: 'u17', question: '¿Quién es el líder de los Mandalorianos en la serie?', options: ['Boba Fett', 'Din Djarin', 'Bo-Katan Kryze', 'Pre Vizsla'], correctIndex: 1, category: 'universe', funFact: 'Din Djarin, "El Mandaloriano", es interpretado por Pedro Pascal.' },
  { id: 'u18', question: '¿Cómo se llama el bebé Yoda?', options: ['Yaddle', 'Grogu', 'Minch', 'Vandar'], correctIndex: 1, category: 'universe', funFact: 'Grogu tiene más de 50 años pero sigue siendo un infante de su especie.' },
  { id: 'u19', question: '¿Qué cristal usan los Sith para sus sables?', options: ['Cristal Kyber azul', 'Cristal Kyber sangrado', 'Cristal sintético', 'Cristal Ilum'], correctIndex: 1, category: 'universe', funFact: 'Los Sith "sangran" cristales Kyber corrompiéndolos con el Lado Oscuro, haciéndolos rojos.' },
  { id: 'u20', question: '¿En qué planeta se libró la Batalla de Hoth?', options: ['Jakku', 'Endor', 'Hoth', 'Crait'], correctIndex: 2, category: 'universe', funFact: 'Hoth es un planeta helado donde la Alianza Rebelde estableció su base Echo.' },
  { id: 'u21', question: '¿Quién es el aprendiz de Darth Sidious antes de Vader?', options: ['Darth Maul', 'General Grievous', 'Conde Dooku', 'Asajj Ventress'], correctIndex: 2, category: 'universe', funFact: 'Dooku fue un Jedi respetado antes de caer al Lado Oscuro como Darth Tyranus.' },
  { id: 'u22', question: '¿Qué planeta fue destruido por la Estrella de la Muerte?', options: ['Naboo', 'Coruscant', 'Alderaan', 'Scarif'], correctIndex: 2, category: 'universe', funFact: 'Alderaan era el planeta adoptivo de Leia, destruido por el Gran Moff Tarkin.' },
  { id: 'u23', question: '¿Cuál es la debilidad de los Stormtroopers?', options: ['Son lentos', 'Mala puntería', 'Armadura débil', 'No saben nadar'], correctIndex: 1, category: 'universe', funFact: 'La mala puntería de los Stormtroopers es uno de los memes más famosos de Star Wars.' },
  { id: 'u24', question: '¿Qué tipo de nave es un TIE Fighter?', options: ['Caza estelar', 'Crucero', 'Transporte', 'Bombardero'], correctIndex: 0, category: 'universe', funFact: 'TIE significa Twin Ion Engine (Motor de Iones Gemelo).' },
  { id: 'u25', question: '¿Quién interpreta a Han Solo en las películas originales?', options: ['Mark Hamill', 'Harrison Ford', 'Alden Ehrenreich', 'Oscar Isaac'], correctIndex: 1, category: 'universe', funFact: 'Harrison Ford casi no obtiene el papel; el estudio quería a Christopher Walken.' },

  // === STAR WARS UNLIMITED (juego de cartas) ===
  { id: 's01', question: '¿Cuántos aspectos tiene Star Wars Unlimited?', options: ['4', '5', '6', '7'], correctIndex: 2, category: 'swu', funFact: 'Los 6 aspectos son: Vigilancia, Comando, Agresión, Astucia, Heroísmo y Villanía.' },
  { id: 's02', question: '¿Cuál es el formato competitivo principal de SWU?', options: ['Standard', 'Premier', 'Draft', 'Twin Suns'], correctIndex: 1, category: 'swu', funFact: 'Premier permite cartas de todos los sets disponibles.' },
  { id: 's03', question: '¿Cuántas cartas mínimo tiene un deck en formato Premier?', options: ['40', '50', '60', '80'], correctIndex: 1, category: 'swu', funFact: 'Un deck de Premier requiere exactamente 50 cartas en el mazo principal.' },
  { id: 's04', question: '¿Cuál fue el primer set de Star Wars Unlimited?', options: ['Shadows of the Galaxy', 'Spark of Rebellion', 'Twilight of the Republic', 'A Lawless Time'], correctIndex: 1, category: 'swu', funFact: 'Spark of Rebellion se lanzó en marzo de 2024 como el set inaugural del juego.' },
  { id: 's05', question: '¿Qué aspecto se asocia con el color rojo?', options: ['Comando', 'Vigilancia', 'Agresión', 'Villanía'], correctIndex: 2, category: 'swu', funFact: 'El aspecto Agresión se enfoca en combate directo y daño al oponente.' },
  { id: 's06', question: '¿Qué aspecto se asocia con el color azul?', options: ['Heroísmo', 'Vigilancia', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Vigilancia se enfoca en defensa, escudos y protección de unidades.' },
  { id: 's07', question: '¿Qué aspecto se asocia con el color verde?', options: ['Heroísmo', 'Astucia', 'Comando', 'Vigilancia'], correctIndex: 2, category: 'swu', funFact: 'Comando se enfoca en liderazgo, torneos y control del campo de batalla.' },
  { id: 's08', question: '¿Qué aspecto se asocia con el color amarillo?', options: ['Astucia', 'Heroísmo', 'Villanía', 'Agresión'], correctIndex: 0, category: 'swu', funFact: 'Astucia se enfoca en trucos, manipulación y ventajas indirectas.' },
  { id: 's09', question: '¿Cuántos recursos se generan por turno normalmente?', options: ['1', '2', '3', 'Variable'], correctIndex: 1, category: 'swu', funFact: 'Cada jugador coloca 1 carta como recurso al inicio de su turno, comenzando con 0.' },
  { id: 's10', question: '¿Qué tipo de carta es la Base en SWU?', options: ['Unidad', 'Evento', 'Mejora', 'Base'], correctIndex: 3, category: 'swu', funFact: 'La Base tiene puntos de vida y el objetivo es destruir la base enemiga.' },
  { id: 's11', question: '¿Qué es el Sideboard en SWU?', options: ['Cartas extras para modificar el deck entre rondas', 'Un tipo de carta especial', 'Una zona del tablero', 'Un formato de juego'], correctIndex: 0, category: 'swu', funFact: 'El Sideboard permite hasta 10 cartas adicionales para adaptar tu deck entre rondas.' },
  { id: 's12', question: '¿Cuántas copias de una carta puedes tener en un deck?', options: ['2', '3', '4', 'Sin límite'], correctIndex: 1, category: 'swu', funFact: 'El máximo es 3 copias de cada carta en el mazo principal.' },
  { id: 's13', question: '¿Qué zona se usa para pagar costos de cartas?', options: ['Mano', 'Recursos', 'Descarte', 'Base'], correctIndex: 1, category: 'swu', funFact: 'Las cartas de recurso se colocan boca abajo y se agotan para pagar costos.' },
  { id: 's14', question: '¿Cuál es el segundo set de Star Wars Unlimited?', options: ['A Lawless Time', 'Shadows of the Galaxy', 'Twilight of the Republic', 'Jump to Lightspeed'], correctIndex: 1, category: 'swu', funFact: 'Shadows of the Galaxy se lanzó en julio de 2024 con mecánicas de contrabando.' },
  { id: 's15', question: '¿Qué tipo de formato es Twin Suns?', options: ['1 vs 1 con 2 líderes', 'Multiplayer', '2 vs 2', 'Draft'], correctIndex: 0, category: 'swu', funFact: 'Twin Suns permite usar 2 líderes y tiene reglas especiales de construcción de deck.' },
  { id: 's16', question: '¿Qué carta tipo Leader se despliega como unidad?', options: ['Solo el líder', 'Los eventos', 'Las mejoras', 'Las bases'], correctIndex: 0, category: 'swu', funFact: 'El líder comienza fuera del juego y puede desplegarse pagando su costo cuando se cumplen condiciones.' },
  { id: 's17', question: '¿Cuántos puntos de vida tiene típicamente una base?', options: ['10-15', '20-25', '25-30', '30-35'], correctIndex: 2, category: 'swu', funFact: 'Las bases tienen entre 25 y 30 puntos de vida dependiendo de la carta.' },
  { id: 's18', question: '¿Qué acción agota una unidad para atacar?', options: ['Exhaust', 'Deploy', 'Play', 'Smuggle'], correctIndex: 0, category: 'swu', funFact: 'Cuando una unidad ataca, se agota (exhaust) y no puede actuar de nuevo hasta reactivarse.' },
  { id: 's19', question: '¿Qué palabra clave permite jugar cartas del área de recursos?', options: ['Ambush', 'Smuggle', 'Bounty', 'Restore'], correctIndex: 1, category: 'swu', funFact: 'Smuggle permite jugar una carta desde los recursos pagando un costo alternativo.' },
  { id: 's20', question: '¿Qué palabra clave da Sentinel a una unidad?', options: ['Los enemigos deben atacarla primero', 'Gana +2 de ataque', 'Se cura al atacar', 'Puede atacar la base directamente'], correctIndex: 0, category: 'swu', funFact: 'Sentinel obliga a los oponentes a atacar esa unidad antes de poder atacar otras.' },
  { id: 's21', question: '¿Qué rango tiene un jugador de nivel 1-5 en SWU Companion?', options: ['Padawan', 'Youngling', 'Iniciado', 'Aprendiz'], correctIndex: 1, category: 'swu', funFact: 'Youngling es el primer rango, inspirado en los jóvenes aprendices del Templo Jedi.' },
  { id: 's22', question: '¿Cuál es el aspecto asociado con el color púrpura?', options: ['Heroísmo', 'Astucia', 'Villanía', 'Agresión'], correctIndex: 2, category: 'swu', funFact: 'Villanía se enfoca en sacrificios, engaños y el poder del Lado Oscuro.' },
  { id: 's23', question: '¿Qué significa BO3 en un torneo de SWU?', options: ['Best of 1', 'Best of 3', 'Battle Order 3', 'Base Operations 3'], correctIndex: 1, category: 'swu', funFact: 'BO3 significa "Best of 3" — gana el primero en obtener 2 victorias de 3 partidas.' },
  { id: 's24', question: '¿Qué aspecto se asocia con el cian/turquesa?', options: ['Vigilancia', 'Heroísmo', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Heroísmo representa valentía, sacrificio y protección de los inocentes.' },
  { id: 's25', question: '¿Cuántas arenas de combate hay en SWU?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'swu', funFact: 'Hay 2 arenas: Ground (terrestre) y Space (espacial). Las unidades solo combaten en su arena.' },

  // === MÁS UNIVERSO ===
  { id: 'u26', question: '¿Cómo se llama la espada láser de Darth Maul?', options: ['Sable doble', 'Sable de luz de doble hoja', 'Sable cruzado', 'Sable dual'], correctIndex: 1, category: 'universe', funFact: 'El sable de doble hoja de Darth Maul fue icónico en Episodio I.' },
  { id: 'u27', question: '¿Quién traicionó a los Jedi en la Orden 66 siendo clon?', options: ['Rex', 'Cody', 'Fives', 'Echo'], correctIndex: 1, category: 'universe', funFact: 'El Comandante Cody disparó contra Obi-Wan Kenobi en Utapau durante la Orden 66.' },
  { id: 'u28', question: '¿Qué planeta es la cuna de los Jedi según los Archivos?', options: ['Coruscant', 'Ahch-To', 'Tython', 'Jedha'], correctIndex: 2, category: 'universe', funFact: 'Tython es donde se fundó la primera Orden Jedi hace miles de años.' },
  { id: 'u29', question: '¿Cómo se llama el droide astromecánico de Anakin?', options: ['BB-8', 'R4-P17', 'R2-D2', 'C1-10P'], correctIndex: 2, category: 'universe', funFact: 'R2-D2 acompañó a Anakin en todas sus misiones durante las Guerras Clon.' },
  { id: 'u30', question: '¿Qué organizó la Alianza Rebelde en Rogue One?', options: ['Robo de los planos de la Estrella de la Muerte', 'Destrucción de la Estrella de la Muerte', 'Rescate de la princesa Leia', 'Batalla de Hoth'], correctIndex: 0, category: 'universe', funFact: 'El equipo Rogue One sacrificó sus vidas para transmitir los planos desde Scarif.' },
  { id: 'u31', question: '¿Quién es el villano principal de la trilogía de secuelas?', options: ['Snoke', 'Kylo Ren', 'Palpatine', 'General Hux'], correctIndex: 2, category: 'universe', funFact: 'Palpatine regresó en El Ascenso de Skywalker como el villano final de la saga.' },
  { id: 'u32', question: '¿Qué poder permite a los Jedi mover objetos?', options: ['Fuerza Push', 'Telequinesis', 'Force Grip', 'Mind Trick'], correctIndex: 1, category: 'universe', funFact: 'La telequinesis es una de las habilidades más básicas enseñadas a los Jedi.' },
  { id: 'u33', question: '¿En qué planeta se entrena Luke con Yoda?', options: ['Tatooine', 'Endor', 'Dagobah', 'Bespin'], correctIndex: 2, category: 'universe', funFact: 'Dagobah es un planeta pantanoso elegido por Yoda para esconderse del Imperio.' },
  { id: 'u34', question: '¿Quién es Cal Kestis?', options: ['Un Sith', 'Un Padawan sobreviviente de la Orden 66', 'Un Mandaloriano', 'Un piloto rebelde'], correctIndex: 1, category: 'universe', funFact: 'Cal Kestis es el protagonista de los videojuegos Jedi: Fallen Order y Survivor.' },
  { id: 'u35', question: '¿Cuántos soles tiene Tatooine?', options: ['1', '2', '3', 'Ninguno'], correctIndex: 1, category: 'universe', funFact: 'Tatooine orbita alrededor de dos soles: Tatoo I y Tatoo II.' },

  // === MÁS SWU ===
  { id: 's26', question: '¿Qué palabra clave permite atacar inmediatamente al desplegarse?', options: ['Sentinel', 'Ambush', 'Raid', 'Overwhelm'], correctIndex: 1, category: 'swu', funFact: 'Ambush permite que una unidad ataque el mismo turno en que se despliega.' },
  { id: 's27', question: '¿Qué hace la palabra clave Overwhelm?', options: ['Ignora Sentinel', 'Daño sobrante va a la base', 'Ataca dos veces', 'Gana escudo'], correctIndex: 1, category: 'swu', funFact: 'Overwhelm permite que el daño excedente al derrotar una unidad se aplique a la base enemiga.' },
  { id: 's28', question: '¿Qué hace la palabra clave Restore?', options: ['Cura la base al atacar', 'Cura una unidad aliada', 'Revive una unidad', 'Recupera recursos'], correctIndex: 0, category: 'swu', funFact: 'Restore X cura X puntos de vida a tu base cuando esa unidad ataca.' },
  { id: 's29', question: '¿Qué hace la palabra clave Raid?', options: ['Gana ataque extra al atacar la base', 'Roba cartas', 'Destruye recursos', 'Mueve unidades entre arenas'], correctIndex: 0, category: 'swu', funFact: 'Raid X da +X de ataque cuando esa unidad ataca una base.' },
  { id: 's30', question: '¿Cuál fue el tercer set de SWU?', options: ['A Lawless Time', 'Twilight of the Republic', 'Jump to Lightspeed', 'Shadows of the Galaxy'], correctIndex: 1, category: 'swu', funFact: 'Twilight of the Republic se centra en la era de las Guerras Clon.' },
]

// ─── Daily Selection Logic ──────────────────────────────────

/** Get a deterministic seed from date + userId for daily rotation */
function getDailySeed(userId: string, dateStr: string): number {
  let hash = 0
  const str = `${userId}-${dateStr}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

/** Shuffle array using seed (Fisher-Yates with seeded random) */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Get today's 10 questions for a user */
export function getDailyQuestions(userId: string): TriviaQuestion[] {
  const today = new Date().toISOString().split('T')[0]
  const seed = getDailySeed(userId, today)
  const shuffled = seededShuffle(TRIVIA_QUESTIONS, seed)
  return shuffled.slice(0, 10)
}

// ─── Supabase Integration ────────────────────────────────────

/** Get today's progress from Supabase */
export async function getTodayProgress(userId: string): Promise<TriviaProgress | null> {
  if (!isSupabaseReady()) return null
  const today = new Date().toISOString().split('T')[0]

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

  const today = new Date().toISOString().split('T')[0]
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

  // Calculate streak (consecutive days from today backwards)
  const today = new Date()
  for (let i = 0; i < data.length; i++) {
    totalCorrect += data[i].correct_answers
    totalAnswered += data[i].questions_answered

    const dayDate = new Date(data[i].date)
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)

    if (dayDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
      streakDays++
    } else if (i === 0) {
      // Today not played yet, check from yesterday
      expectedDate.setDate(expectedDate.getDate() - 1)
      if (dayDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        streakDays++
      } else {
        break
      }
    } else {
      break
    }
  }

  return { totalCorrect, totalAnswered, streakDays }
}
