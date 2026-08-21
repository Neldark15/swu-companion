/**
 * La encuesta de la comunidad: las preguntas y cómo se manda la respuesta.
 *
 * ── El anonimato es ESTRUCTURAL, no una promesa ──────────────────────
 *
 * En la base hay DOS tablas que no se pueden unir: `encuesta_contestada`
 * guarda QUIÉN contestó (sin una sola respuesta) y `encuesta_respuestas`
 * guarda QUÉ se contestó (sin `user_id`, y con la fecha al día y no al
 * instante, porque con 25 respuestas un sello de milisegundos se cruza con
 * la otra tabla y desanonimiza a todo el mundo).
 *
 * Eso importa por una razón concreta: la pregunta del precio. «¿Cuánto
 * pagarías?» ya invita a mentir; si además la respuesta lleva tu nombre y la
 * lee quien organiza los torneos, deja de servir para nada.
 *
 * ── A quién le toca lo decide el SERVIDOR ────────────────────────────
 *
 * `encuesta_pendiente()` cruza las tres condiciones —encuesta abierta, el país
 * coincide, y no la contestaste— y devuelve cero filas si no te toca. El
 * cliente no filtra por país: si lo hiciera, bastaría con abrir la consola del
 * navegador para colarse en una encuesta de otro país.
 *
 * ── Por qué estas preguntas y no otras ───────────────────────────────
 *
 * Cada una está para cambiar UNA decisión concreta, y varias reemplazan a la
 * versión obvia que no funciona:
 *
 *  · El precio NO se pregunta abierto. «¿Cuánto pagarías?» miente en las dos
 *    direcciones —hacia abajo por quedar frugal, hacia arriba por quedar
 *    comprometido—. Cinco sí/no dan una CURVA: cuánta gente queda a cada
 *    precio, para elegir el punto que junta más bolsa y más sala.
 *  · Los premios NO se preguntan con casillas. Eso se contesta «todos».
 *    Repartir cien dólares obliga a soltar algo, y lo que se suelta es el dato.
 *  · «¿Cómo aumentamos la participación?» NO se pregunta. Le pide a la gente
 *    que diseñe la solución y devuelve lugares comunes. En su lugar se
 *    pregunta por la última vez CONCRETA que no fue, que da diagnóstico.
 */

import { supabase, isSupabaseReady } from './supabase'

export const CLAVE_ENCUESTA = 'comunidad-2026-08'

export type TipoPregunta = 'una' | 'varias' | 'escalera' | 'reparto' | 'rejilla' | 'texto'

export interface Opcion { id: string; texto: string }

export interface Pregunta {
  id: string
  tipo: TipoPregunta
  enunciado: string
  /** La línea de ayuda debajo del enunciado. Una, y corta. */
  pista?: string
  opciones?: Opcion[]
  /** Escalera de precios: los peldaños, con su nota. */
  peldanos?: { valor: number; nota: string }[]
  /** Reparto: cuánto hay que repartir. */
  total?: number
  /** Rejilla: las columnas de intensidad. */
  columnas?: Opcion[]
  /** Una abierta larga espanta; el tope lo dice la pantalla. */
  maximo?: number
  /** Se puede pasar de largo. Solo la abierta y la casilla del final. */
  opcional?: boolean
}

export const PREGUNTAS: Pregunta[] = [
  {
    id: 'sede', tipo: 'una',
    enunciado: '¿Desde dónde te queda más fácil llegar a un torneo?',
    pista: 'Hay dos sedes a 65 km y el calendario les reparte el mismo sábado a las dos.',
    opciones: [
      { id: 'ss', texto: 'San Salvador y alrededores' },
      { id: 'sonsonate', texto: 'Sonsonate y occidente' },
      { id: 'ambas', texto: 'Me da igual: viajo a cualquiera' },
      { id: 'otro', texto: 'Otro punto del país' },
    ],
  },
  {
    id: 'cuantos_mes', tipo: 'una',
    enunciado: 'En un mes normal, ¿a cuántos torneos podés ir de verdad?',
    opciones: [
      { id: '0', texto: 'A ninguno' }, { id: '1', texto: 'A uno' },
      { id: '2', texto: 'A dos' }, { id: '3+', texto: 'A tres o más' },
    ],
  },
  {
    id: 'fui_3meses', tipo: 'una',
    enunciado: 'En los últimos tres meses, ¿a cuántos torneos presenciales fuiste?',
    pista: 'Con esto se lee todo lo demás: un plan y un deseo no se parecen.',
    opciones: [
      { id: '0', texto: 'A ninguno' }, { id: '1', texto: 'A uno' },
      { id: '2-3', texto: 'A dos o tres' }, { id: '4+', texto: 'A cuatro o más' },
    ],
  },
  {
    id: 'por_que_no', tipo: 'una',
    enunciado: 'Pensá en el último torneo del que te enteraste y al que NO fuiste. ¿Cuál fue la razón principal?',
    opciones: [
      { id: 'tarde', texto: 'Me enteré tarde, o no me enteré' },
      { id: 'horario', texto: 'Ese día o esa hora no podía' },
      { id: 'lejos', texto: 'Me queda lejos / el transporte' },
      { id: 'costo', texto: 'El costo' },
      { id: 'mazo', texto: 'Sentía que mi mazo no da para competir' },
      { id: 'solo', texto: 'No tenía con quién ir' },
      { id: 'fui', texto: 'Fui a los que quería; no fue falta de ganas' },
    ],
  },
  {
    id: 'como_me_entero', tipo: 'varias',
    enunciado: '¿Por dónde te enterás de los torneos?',
    pista: 'Marcá todas las que apliquen.',
    opciones: [
      { id: 'whatsapp', texto: 'El grupo de WhatsApp' },
      { id: 'app', texto: 'La app (Holocrón)' },
      { id: 'redes', texto: 'Instagram u otras redes' },
      { id: 'tienda', texto: 'Me lo dicen en la tienda' },
      { id: 'amigo', texto: 'Un amigo me avisa' },
      { id: 'nunca', texto: 'Casi nunca me entero a tiempo' },
    ],
  },
  {
    id: 'pague', tipo: 'una',
    enunciado: '¿Cuánto pagaste de inscripción la última vez que fuiste a un torneo?',
    pista: 'Un hecho, no una opinión: es la línea base de la pregunta que sigue.',
    opciones: [
      { id: 'gratis', texto: 'Nada, era gratis' },
      { id: '3', texto: 'Hasta $3' },
      { id: '4-5', texto: 'Entre $4 y $5' },
      { id: '6-8', texto: 'Entre $6 y $8' },
      { id: '8+', texto: 'Más de $8' },
      { id: 'ninguno', texto: 'No he ido a ninguno' },
    ],
  },
  {
    id: 'escalera', tipo: 'escalera',
    enunciado: 'Con premios acordes, ¿irías a un torneo de sábado a este precio?',
    pista: 'Contestá sí o no en cada renglón. No es «elegí uno».',
    peldanos: [
      { valor: 3, nota: 'semanal' },
      { valor: 5, nota: 'semanal' },
      { valor: 8, nota: 'semanal' },
      { valor: 12, nota: 'semanal' },
      { valor: 20, nota: 'torneo grande, una vez al mes' },
    ],
  },
  {
    id: 'premios', tipo: 'reparto', total: 100,
    enunciado: 'Si la bolsa de premios fueran $100, ¿cómo la repartirías?',
    pista: 'Tiene que sumar 100. Repartir obliga a elegir; una lista de casillas se contesta «todo».',
    opciones: [
      { id: 'sobres', texto: 'Sobres o producto sellado' },
      { id: 'promos', texto: 'Cartas promo o exclusivas' },
      { id: 'accesorios', texto: 'Playmat, sleeves, deck box' },
      { id: 'credito', texto: 'Crédito en la tienda' },
      { id: 'efectivo', texto: 'Efectivo' },
      { id: 'trofeo', texto: 'Trofeo o algo simbólico' },
    ],
  },
  {
    id: 'hasta_que_puesto', tipo: 'una',
    enunciado: '¿Hasta qué puesto debería llevarse algo?',
    opciones: [
      { id: 'campeon', texto: 'Solo el campeón' },
      { id: 'top4', texto: 'Los primeros cuatro' },
      { id: 'top8', texto: 'Los primeros ocho' },
      { id: 'todos', texto: 'Algo para todo el que juegue las rondas completas' },
    ],
  },
  {
    id: 'actividades', tipo: 'rejilla',
    enunciado: '¿A cuál de estas irías?',
    pista: 'Una respuesta por renglón. Un «tal vez» es un no cortés, y se cuenta aparte.',
    columnas: [
      { id: 'seguro', texto: 'Seguro' },
      { id: 'talvez', texto: 'Tal vez' },
      { id: 'no', texto: 'No' },
    ],
    opciones: [
      { id: 'semanal', texto: 'Torneo competitivo semanal (Premier)' },
      { id: 'mensual', texto: 'Torneo grande al mes, más premio y más precio' },
      { id: 'sellado', texto: 'Sellado o draft' },
      { id: 'liga', texto: 'Liga casual sin inscripción' },
      { id: 'ensenar', texto: 'Noche de enseñar a jugar / traer a alguien nuevo' },
      { id: 'equipos', texto: 'Torneo por equipos de dos o tres' },
      { id: 'online', texto: 'Torneo en línea' },
    ],
  },
  {
    id: 'dia_hora', tipo: 'una',
    enunciado: '¿Qué día y hora te sirve más?',
    pista: 'Hoy el calendario siembra sábado 3:00 p.m. Nunca se preguntó: se eligió.',
    opciones: [
      { id: 'sab-am', texto: 'Sábado por la mañana' },
      { id: 'sab-pm', texto: 'Sábado por la tarde' },
      { id: 'dom-am', texto: 'Domingo por la mañana' },
      { id: 'dom-pm', texto: 'Domingo por la tarde' },
      { id: 'semana', texto: 'Entre semana por la noche' },
    ],
  },
  {
    id: 'una_cosa', tipo: 'texto', maximo: 160, opcional: true,
    enunciado: 'Si pudieras cambiar UNA cosa de los torneos, ¿cuál sería?',
    pista: 'Un renglón basta. Es la única abierta, y va al final a propósito.',
  },
]

export type Respuestas = Record<string, unknown>

export interface EncuestaPendiente {
  clave: string
  titulo: string
  descripcion: string | null
  cierra: string | null
}

/**
 * La encuesta que me toca, o null.
 *
 * Devuelve null también cuando falla: una encuesta que no se pudo consultar no
 * se anuncia. Molestar con un cartel por un fallo de red sería peor que
 * perderse una respuesta.
 */
export async function encuestaPendiente(): Promise<EncuestaPendiente | null> {
  if (!isSupabaseReady()) return null
  const { data, error } = await supabase.rpc('encuesta_pendiente')
  // Gotcha 2f: supabase-js no lanza ante un error de PostgREST.
  if (error) { console.warn('[encuesta] no se pudo consultar:', error.message); return null }
  const filas = (data ?? []) as EncuestaPendiente[]
  return filas[0] ?? null
}

export type Envio = { ok: true } | { ok: false; mensaje: string }

export async function responderEncuesta(
  clave: string, respuestas: Respuestas, ayuda: boolean, contacto: string,
): Promise<Envio> {
  if (!isSupabaseReady()) return { ok: false, mensaje: 'Sin conexión con la nube.' }
  const { error } = await supabase.rpc('responder_encuesta', {
    p_clave: clave, p_respuestas: respuestas,
    p_ayuda: ayuda, p_contacto: contacto.trim() || null,
  })
  if (error) {
    // El 23505 es «ya contestaste», y no es un error para quien mira: es que
    // llegó dos veces el mismo envío. Se trata como éxito.
    if (error.code === '23505') return { ok: true }
    return { ok: false, mensaje: 'No se pudo enviar. Probá otra vez.' }
  }
  return { ok: true }
}

// ─── Cuándo volver a preguntar ───────────────────────────────────────

const CLAVE_POSPUESTA = 'encuesta_pospuesta_hasta'

/**
 * «Ahora no» pospone UN DÍA, y no hay «no me lo recuerdes».
 *
 * Es la diferencia entre casi obligatorio y obligatorio, y está puesta a
 * propósito. Un muro sin puerta enseña a cerrar avisos sin leerlos —y después
 * no se leen los que sí importan—; un silencio permanente convierte la
 * encuesta en opcional, que es justo lo que no se quiere. Un día vuelve, y la
 * encuesta dura siete: quien la aplace todos los días la vio siete veces y
 * decidió, que ya es una respuesta.
 *
 * Y desaparece PARA SIEMPRE al contestar, porque eso no lo decide esta marca
 * sino el servidor: `encuesta_pendiente()` deja de devolverla.
 */
export function encuestaPospuesta(): boolean {
  try {
    const hasta = localStorage.getItem(CLAVE_POSPUESTA)
    return hasta !== null && Date.now() < Number(hasta)
  } catch { return false }
}

export function posponerEncuesta(): void {
  try {
    localStorage.setItem(CLAVE_POSPUESTA, String(Date.now() + 24 * 60 * 60 * 1000))
  } catch { /* modo privado: entonces vuelve a preguntar, que es el lado seguro */ }
}
