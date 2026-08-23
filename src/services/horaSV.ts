/**
 * horaSV — toda fecha que se muestra o se guarda, en hora de El Salvador.
 *
 * ── El bug que esto cierra ────────────────────────────────────────────
 *
 * 29 archivos de `src/` formateaban fechas con `toLocaleDateString('es-SV')`
 * y ninguno fijaba `timeZone`. Ese segundo argumento es el **locale** —cómo se
 * ESCRIBE la fecha, «8 ago» y no «Aug 8»— y no tiene nada que ver con **qué
 * instante** se muestra: la zona sale del dispositivo. Con el teléfono en otra
 * zona (de viaje, o mal configurado) el mismo torneo aparecía a otra hora.
 *
 * Y un torneo tiene UNA hora: la de la tienda donde se juega. No la de quien
 * mira la pantalla.
 *
 * ── Por qué el identificador IANA y no «−6» a mano ────────────────────
 *
 * `America/El_Salvador` es UTC−6 **todo el año**. Medido con `date` en enero,
 * abril, julio y octubre de 2026: CST UTC−0600 en los cuatro. No hay horario
 * de verano, así que un offset fijo de −06:00 hoy sería exacto.
 *
 * Aun así acá va el identificador, no el número: si algún día cambia la ley,
 * el sistema operativo ya lo sabe y nosotros no tendríamos por qué enterarnos.
 * Escribir −6 a mano es apostar a que una ley no cambie nunca.
 *
 * ── Lo que este módulo NO hace ────────────────────────────────────────
 *
 * Duraciones y relativos («hace 3 min», «en 5 rondas», cronómetros) no tienen
 * zona: son restas entre instantes, y un instante es absoluto. Fijarles una
 * zona no cambia nada y solo ensucia. Acá solo vive lo que se ESCRIBE como
 * fecha de calendario o como hora del reloj.
 */

/**
 * La zona de toda la app. Se fija a propósito para NO depender del reloj del
 * dispositivo: el mismo evento tiene que leerse igual en San Salvador, en un
 * viaje a Tokio y en un teléfono con la zona mal puesta.
 */
export const ZONA_SV = 'America/El_Salvador'

/**
 * El idioma con el que se escriben las fechas.
 *
 * Va con región a propósito. Medido: `'es'` (sin región) rinde la hora en
 * formato de 24 h («15:30») y `'es-SV'` en 12 h («3:30 p. m.»). El repo tenía
 * los dos mezclados —AdminAuditPage en 24 h, ProximosEventos en 12 h— y la
 * misma app mostraba la hora de dos maneras según la pantalla.
 */
const LOCALE_SV = 'es-SV'

/** Lo que aceptan todos los formateadores: lo que de verdad llega de la BD. */
export type Instante = string | number | Date | null | undefined

/**
 * Un `Intl.DateTimeFormat` por forma, construido una sola vez.
 *
 * Construir un formateador es caro (arma la data del locale) y estas funciones
 * se llaman dentro de listas: 22 filas × 2 fechas son 44 construcciones por
 * render si no se cachean. El formateador es inmutable y reusable, así que
 * alcanza con guardarlo por nombre de forma.
 */
const cacheFormato = new Map<string, Intl.DateTimeFormat>()

function formateador(
  forma: string,
  opciones: Intl.DateTimeFormatOptions,
  locale: string = LOCALE_SV,
): Intl.DateTimeFormat {
  let f = cacheFormato.get(forma)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opciones, timeZone: ZONA_SV })
    cacheFormato.set(forma, f)
  }
  return f
}

/**
 * Normaliza cualquier entrada a `Date`, o a `null` si no hay fecha.
 *
 * Está acá y no en cada llamador a propósito: con esto ningún componente
 * necesita su propio `if (!iso) return ''`, que es donde se colaban los
 * «Invalid Date» impresos en pantalla.
 */
function aFecha(v: Instante): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Formas de escribir una fecha ──────────────────────────────────────
// Una función por forma que el repo usa DE VERDAD (catalogadas con
// `grep -rn "toLocale" src/`). No hay un formateador genérico con opciones:
// eso devolvería el problema al llamador, que es de donde viene.

/** «8 ago» — sin año. La forma más usada: feeds, noticias, historiales. */
export function diaMes(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('diaMes', { day: 'numeric', month: 'short' }).format(d)
}

/** «8 ago 2026» — con año, para cosas que pueden ser de otro año. */
export function fechaCorta(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaCorta', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

/**
 * «13 mar 25» — con el año en dos cifras.
 *
 * Para listas densas en tipografía monoespaciada, donde la fecha comparte
 * renglón con el nombre del torneo, la cantidad de jugadores y el organizador.
 * Ahí las dos cifras de más del año empujan el renglón a una segunda línea.
 */
export function fechaCompacta(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaCompacta', {
    day: 'numeric', month: 'short', year: '2-digit',
  }).format(d)
}

/** «8 de agosto de 2026» — para el blog y los encabezados que respiran. */
export function fechaLarga(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaLarga', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

/**
 * «sáb, 8 ago» — con día de la semana.
 *
 * El día de la semana no es adorno en un evento: es lo que decide si podés ir.
 */
export function fechaConDia(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaConDia', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

/** «sáb, 8 de agosto de 2026» — la ficha completa de un evento. */
export function fechaConDiaLarga(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaConDiaLarga', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}

/** «3:30 p. m.» — solo la hora del reloj, en El Salvador. */
export function hora(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('hora', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
}

/**
 * «sáb, 8 ago · 3:30 p. m.» — la forma canónica para anunciar un evento.
 *
 * Se arma con dos formateadores en vez de uno solo porque el separador es
 * nuestro: `Intl` pone «, » y acá queremos el punto medio, que separa mejor
 * dos datos distintos de un vistazo.
 */
export function fechaYHora(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return `${fechaConDia(d)} · ${hora(d)}`
}

/** «8 ago 2026, 3:30 p. m.» — resumen con año, para confirmaciones y fichas. */
export function fechaCortaYHora(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaCortaYHora', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
}

/**
 * «8/8/26, 3:30 p. m.» — compacta, para tablas de administración y tooltips
 * donde la fecha es un dato de bitácora y no el protagonista.
 */
export function fechaNumericaYHora(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  return formateador('fechaNumericaYHora', {
    day: 'numeric', month: 'numeric', year: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
}

// ─── Calendario ────────────────────────────────────────────────────────
//
// Acá es donde se cuelan los bugs, y ninguno de estos se puede hacer con
// `setHours(0, 0, 0, 0)`: ese método mueve el instante a la medianoche **del
// dispositivo**. En un teléfono en Tokio (UTC+9) la «medianoche» cae a las
// 15 h del día anterior en El Salvador, así que «hoy» y «mañana» se corren un
// día entero para cualquiera que viaje.
//
// La única forma correcta es pedirle a `Intl` las partes del calendario YA
// convertidas a la zona SV, y hacer la aritmética sobre esas partes.

interface PartesSV {
  anio: number
  mes: number   // 1-12, como se escribe, no como lo numera Date
  dia: number
  hora: number  // 0-23
  minuto: number
}

/**
 * Descompone un instante en las partes del calendario salvadoreño.
 *
 * Se lee con `formatToParts` y no partiendo el string formateado: el string
 * cambia de orden y de separadores según el locale, las partes vienen
 * etiquetadas. Y el `hourCycle: 'h23'` es obligatorio: con `hour12: false`
 * hay ICU que rinden la medianoche como «24», y `24` como número de hora
 * corre el día al siguiente.
 */
function partesSV(d: Date): PartesSV {
  const partes = formateador('partesSV', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }, 'en-CA').formatToParts(d)

  const leer = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const p = partes.find(x => x.type === tipo)
    return p ? Number(p.value) : 0
  }

  return {
    anio: leer('year'),
    mes: leer('month'),
    dia: leer('day'),
    hora: leer('hour'),
    minuto: leer('minute'),
  }
}

/**
 * Cuántos milisegundos hay que sumarle a un instante para que su reloj de
 * pared en SV se lea como si fuera UTC. Para El Salvador es siempre −6 h.
 *
 * Se calcula preguntando en vez de escribirlo: es lo que hace que
 * `aISOdesdeSV` siga siendo correcto si algún día El Salvador adopta DST.
 */
function desfaseSVenMs(instante: number): number {
  const p = partesSV(new Date(instante))
  const comoSiFueraUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto)
  // El segundero se pierde en el redondeo a minutos; se devuelve al comparar.
  const segundosYms = instante - Math.floor(instante / 60_000) * 60_000
  return comoSiFueraUTC + segundosYms - instante
}

/**
 * El instante UTC en que el reloj de El Salvador marca la fecha y hora dadas.
 *
 * Dos pasadas a propósito: la primera estima el desfase con un instante
 * aproximado y la segunda lo confirma con el instante ya corregido. En SV,
 * sin DST, la segunda nunca cambia nada; en una zona con cambio de hora es lo
 * que impide equivocarse por una hora en los días de la transición.
 */
function instanteDesdeSV(
  anio: number, mes: number, dia: number, hora24 = 0, minuto = 0,
): Date {
  const deseado = Date.UTC(anio, mes - 1, dia, hora24, minuto)
  let t = deseado - desfaseSVenMs(deseado)
  t = deseado - desfaseSVenMs(t)
  return new Date(t)
}

/** El día del calendario salvadoreño como «2026-08-08». La clave para comparar. */
export function diaCalendarioSV(v: Instante): string {
  const d = aFecha(v)
  if (!d) return ''
  const p = partesSV(d)
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/**
 * El día del calendario SV corrido `dias` días (negativo va hacia atrás).
 *
 * Es lo que hace falta para una racha: «¿jugó ayer? ¿y anteayer?». Se corre el
 * NÚMERO del día y `Date.UTC` normaliza —el 0 de septiembre es el 31 de
 * agosto—, en vez de restarle 86.400.000 ms a un instante, que es lo que
 * rompía las rachas en los cambios de mes.
 */
export function diaCalendarioSVMas(dias: number, v?: Instante): string {
  const d = aFecha(v) ?? new Date()
  const p = partesSV(d)
  const t = new Date(Date.UTC(p.anio, p.mes - 1, p.dia + dias))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/**
 * ¿Los dos instantes caen el mismo día del calendario EN EL SALVADOR?
 *
 * Se compara por día, no por horas de diferencia: un evento a las 9 de la
 * mañana de mañana está a menos de 24 h, y decir «hoy» sería mentir.
 */
export function mismoDiaSV(a: Instante, b: Instante): boolean {
  const da = diaCalendarioSV(a)
  const db = diaCalendarioSV(b)
  return da !== '' && da === db
}

/** ¿Es hoy, en El Salvador? */
export function esHoySV(v: Instante): boolean {
  return mismoDiaSV(v, new Date())
}

/**
 * ¿Es mañana, en El Salvador?
 *
 * Por `inicioDelDiaSiguienteSVenUTC` y no sumando 86.400.000 ms: era la única
 * función del módulo que usaba el atajo que el propio módulo condena (en una
 * zona con cambio de hora un día dura 23 o 25 horas, y el instante resultante
 * podía caer en el día equivocado). En SV hoy da igual; el punto de todo este
 * archivo es no depender de que siga dando igual.
 */
export function esMananaSV(v: Instante): boolean {
  return mismoDiaSV(v, inicioDelDiaSiguienteSVenUTC())
}

/**
 * Cuántos días de calendario SV faltan para esa fecha. Hoy = 0, mañana = 1,
 * ayer = −1.
 *
 * Se restan las dos medianoches salvadoreñas, nunca los instantes crudos:
 * restar instantes y dividir entre 86.400.000 da 0 para un evento que es
 * mañana temprano.
 */
export function diasHastaSV(v: Instante): number | null {
  const d = aFecha(v)
  if (!d) return null
  const objetivo = inicioDelDiaSVenUTC(d).getTime()
  const hoy = inicioDelDiaSVenUTC().getTime()
  return Math.round((objetivo - hoy) / 86_400_000)
}

/**
 * El instante UTC de la medianoche salvadoreña del día que se le pase (por
 * defecto, hoy). Para El Salvador siempre da las 06:00Z de ese mismo día.
 *
 * Es el corte que hay que mandarle a Postgres cuando se pregunta «lo que pasa
 * de hoy en adelante»: con un corte fijo en UTC, acá —seis horas detrás— los
 * eventos se caerían de la lista a las 6 de la tarde del día anterior.
 */
export function inicioDelDiaSVenUTC(v?: Instante): Date {
  const d = aFecha(v) ?? new Date()
  const p = partesSV(d)
  return instanteDesdeSV(p.anio, p.mes, p.dia, 0, 0)
}

/**
 * La medianoche salvadoreña SIGUIENTE. El otro extremo de un día.
 *
 * Se calcula sumándole uno al número del día y dejando que `Date.UTC` normalice
 * (un 32 de agosto es el 1 de septiembre), no sumándole 86.400.000 ms al inicio
 * del día: en una zona con cambio de hora un día dura 23 o 25 horas y el corte
 * caería una hora corrido. En El Salvador da igual hoy; la diferencia es que
 * esta versión no depende de que siga dando igual.
 */
export function inicioDelDiaSiguienteSVenUTC(v?: Instante): Date {
  const d = aFecha(v) ?? new Date()
  const p = partesSV(d)
  return instanteDesdeSV(p.anio, p.mes, p.dia + 1, 0, 0)
}

/** El mes del calendario salvadoreño como «2026-08». La clave de los rankings mensuales. */
export function mesCalendarioSV(v?: Instante): string {
  const d = aFecha(v) ?? new Date()
  const p = partesSV(d)
  return `${p.anio}-${String(p.mes).padStart(2, '0')}`
}

/**
 * El mes anterior y el siguiente, a partir de un «2026-08».
 *
 * Es aritmética sobre una clave que ya está bien, no sobre un instante, así
 * que acá no hay zona que valga: se corre el número del mes y `Date.UTC`
 * normaliza el cruce de año (el mes −1 de 2026 es diciembre de 2025).
 *
 * Vivían duplicadas en MonthlyRank y RankingPage con `new Date(y, m, 1)` y
 * `getMonth()`. Esa versión también daba bien —construía y leía en el mismo
 * marco, el del dispositivo—, pero dejaba a la vista un patrón que copiado a
 * medias sí se rompe. Acá no queda nada que copiar mal.
 */
function correrMes(mes: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) return mes
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** «2026-08» → «2026-07». */
export function mesAnterior(mes: string): string { return correrMes(mes, -1) }

/** «2026-08» → «2026-09». */
export function mesSiguiente(mes: string): string { return correrMes(mes, 1) }

/** El año del calendario salvadoreño. */
export function anioSV(v?: Instante): number {
  const d = aFecha(v) ?? new Date()
  return partesSV(d).anio
}

// Acá vivía un `diaSemanaSV()`. Se fue con su único llamador: el contador del
// reinicio semanal de las misiones lo usaba para calcular a mano «el próximo
// lunes», y ese cálculo apuntaba a un día distinto del que de verdad reinicia
// las misiones (ver `getTimeUntilWeeklyReset` en missionService). Ahora el
// borde de la semana se le pregunta a la MISMA función que arma la clave, así
// que no queda a quién decirle qué día de la semana es — y no se deja acá un
// helper suelto que invite a volver a inventar el borde por tercera vez.

// ─── Fechas que NO tienen zona ─────────────────────────────────────────
//
// Un `2026-08-01` de la agenda mundial de torneos, o el `2026-08-01T09:00:00`
// que publica melee, **no son instantes**: son el día del calendario de un
// torneo que se juega en otro lugar del mundo. Nadie dijo en qué zona.
//
// Pasarlos por `new Date()` les inventa una —la del dispositivo, por
// especificación— y desde ahí ya se pueden correr un día en cualquier
// dirección. Medido con la fecha de melee `2026-08-01T09:00:00`: en un
// teléfono en Tokio ese instante es el 31 de julio a las 18:00 en El Salvador,
// así que formatearlo «en hora de El Salvador» mostraría **31 jul** un torneo
// que melee publica como el 1 de agosto.
//
// Por eso acá no se convierte nada: se lee el día del string tal cual está
// escrito y se muestra ese. Es lo único honesto que se puede hacer con una
// fecha de la que solo sabemos el día.

interface DiaSinZona {
  anio: number
  mes: number
  dia: number
}

/**
 * Lee el día de un `2026-08-01` o de un `2026-08-01T09:00:00`, partiendo el
 * string. `null` si no tiene esa forma.
 */
export function partesDeDiaSinZona(v: string | null | undefined): DiaSinZona | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '')
  if (!m) return null
  const anio = Number(m[1]); const mes = Number(m[2]); const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { anio, mes, dia }
}

/**
 * Corre una clave `YYYY-MM-DD` tantos días, sin pasar por ninguna zona.
 *
 * Hace falta aparte de `diaCalendarioSVMas` porque esa toma un INSTANTE, y una
 * clave de día no lo es. Pasarle `'2026-08-20'` la hace parsear medianoche
 * **UTC**, que en El Salvador todavía es el 19: el «ayer» salía con un día de
 * menos y una racha de días seguidos nunca pasaba de 1. Medido con una prueba
 * que simula 30 días corridos; a ojo no se ve.
 *
 * `Date.UTC` normaliza el desborde —el 0 de septiembre es el 31 de agosto, el
 * 32 de enero es el 1 de febrero—, así que los cambios de mes, de año y el 29
 * de febrero salen solos.
 */
export function diaSinZonaMas(clave: string | null | undefined, dias: number): string {
  const p = partesDeDiaSinZona(clave)
  if (!p) return ''
  const t = new Date(Date.UTC(p.anio, p.mes - 1, p.dia + dias))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

/**
 * El instante del mediodía salvadoreño de ese día, solo para poder reusar los
 * formateadores de arriba y no duplicar acá una lista de nombres de meses.
 *
 * El mediodía y no la medianoche a propósito: queda a doce horas de los dos
 * bordes del día, así que ningún redondeo ni ninguna zona puede empujarlo al
 * día vecino.
 */
function mediodiaDe(p: DiaSinZona): Date {
  return instanteDesdeSV(p.anio, p.mes, p.dia, 12, 0)
}

/** «1 ago» a partir de un día sin zona. '' si no se puede leer. */
export function diaMesSinZona(v: string | null | undefined): string {
  const p = partesDeDiaSinZona(v)
  return p ? diaMes(mediodiaDe(p)) : ''
}

/** «1 ago 2026» a partir de un día sin zona. '' si no se puede leer. */
export function fechaCortaSinZona(v: string | null | undefined): string {
  const p = partesDeDiaSinZona(v)
  return p ? fechaCorta(mediodiaDe(p)) : ''
}

/**
 * Cuántos días faltan, del hoy salvadoreño hasta ese día del calendario.
 *
 * Las dos patas son días de calendario, no instantes: el «hoy» se resuelve en
 * SV —que es donde está quien mira— y el otro se toma como viene escrito.
 */
export function diasHastaDiaSinZona(v: string | null | undefined): number | null {
  const p = partesDeDiaSinZona(v)
  if (!p) return null
  const objetivo = Date.UTC(p.anio, p.mes - 1, p.dia)
  const h = partesSV(new Date())
  const hoy = Date.UTC(h.anio, h.mes - 1, h.dia)
  return Math.round((objetivo - hoy) / 86_400_000)
}

// ─── Entrada: lo que se teclea y lo que se guarda ──────────────────────

/** Lo que llenan un `<input type="date">` y un `<input type="time">`. */
export interface InputsFechaHora {
  /** «2026-08-08» */
  fecha: string
  /** «15:30», siempre en 24 h, que es lo único que acepta el input. */
  hora: string
}

/**
 * Toma una fecha y una hora TECLEADAS COMO HORA DE EL SALVADOR y devuelve el
 * instante UTC que hay que guardar. `null` si falta o viene mal alguna parte.
 *
 * Esto arregla la mitad que quedaba rota de un bug ya conocido. La versión
 * original mandaba `2026-08-08T15:30:00` pelado, sin zona, y Postgres lo leía
 * como UTC: quien escribía las 15:30 guardaba las 09:30 de El Salvador, seis
 * horas de corrimiento. Se cambió a `new Date(...).toISOString()`, que sí pone
 * la zona — pero la del DISPOSITIVO. Un organizador con el teléfono en otra
 * zona volvía a guardar mal, solo que ahora en silencio y por un número
 * distinto. La hora que se teclea es la de la tienda, siempre.
 *
 * Devuelve `null` en vez de tirar excepción porque el llamador es un formulario:
 * un `null` se convierte en un mensaje en pantalla, una excepción en una
 * pantalla en blanco.
 */
export function aISOdesdeSV(fecha: string, hora: string): string | null {
  const mf = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  if (!mf) return null

  // Algunos navegadores rinden el `type="time"` con segundos («15:30:00»).
  const mh = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hora || '00:00')
  if (!mh) return null

  const anio = Number(mf[1]); const mes = Number(mf[2]); const dia = Number(mf[3])
  const h = Number(mh[1]); const min = Number(mh[2])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || h > 23 || min > 59) return null

  const instante = instanteDesdeSV(anio, mes, dia, h, min)

  // Un 31 de febrero pasa el rango pero `Date.UTC` lo corre al 3 de marzo:
  // se comprueba que el día que vuelve sea el que se pidió.
  const p = partesSV(instante)
  if (p.anio !== anio || p.mes !== mes || p.dia !== dia) return null

  return instante.toISOString()
}

/**
 * El camino de vuelta: descompone un instante guardado en los valores que van
 * a los inputs, EN ZONA SV.
 *
 * Sin esto, editar un evento desde otra zona lo movía: los inputs se llenaban
 * con la hora del dispositivo y al guardar se volvía a convertir, así que
 * abrir el editor y darle guardar sin tocar nada ya cambiaba la fecha.
 */
export function aInputsSV(v: Instante): InputsFechaHora {
  const d = aFecha(v)
  if (!d) return { fecha: '', hora: '' }
  const p = partesSV(d)
  return {
    fecha: `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`,
    hora: `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`,
  }
}

// ─── El mismo par, para el input de UN solo campo ──────────────────────
//
// Un `<input type="datetime-local">` guarda fecha y hora en un único string
// `2026-08-08T15:30`, y ese string **no lleva zona** — la especificación lo
// define como hora local de pared, sin más.
//
// Ese detalle es exactamente el que dejó al editor de eventos oficiales fuera
// de la migración: no usa `toLocaleDateString` ni dos inputs, así que ninguno
// de los rastreos lo encontró, y las dos mitades del camino quedaron rotas.
// Leía el instante guardado cortando el ISO a 16 caracteres —el reloj **UTC**,
// que en El Salvador va seis horas adelante— y lo devolvía con
// `new Date(...).toISOString()`, que interpreta lo que ve en la zona del
// **dispositivo**. Con las dos juntas, abrir el editor y darle Guardar sin
// tocar nada corría el evento +6 h desde El Salvador, y el corrimiento se
// acumulaba en cada pasada.
//
// Estas dos funciones son `aInputsSV`/`aISOdesdeSV` con el string pegado y
// partido acá adentro, para que ningún componente vuelva a tener que saber
// dónde va la «T».

/**
 * El valor que va a un `<input type="datetime-local">`: «2026-08-08T15:30»,
 * con la fecha y la hora del reloj de El Salvador. '' si no hay fecha.
 */
export function aDatetimeLocalSV(v: Instante): string {
  const { fecha, hora: horaDelDia } = aInputsSV(v)
  return fecha ? `${fecha}T${horaDelDia}` : ''
}

/**
 * El camino de vuelta: toma lo que rinde un `<input type="datetime-local">`
 * —TECLEADO COMO HORA DE EL SALVADOR— y devuelve el instante UTC que se guarda.
 * `null` si viene vacío o mal formado, igual que `aISOdesdeSV`.
 */
export function aISOdesdeDatetimeLocalSV(valor: string | null | undefined): string | null {
  // Se parte por la primera «T» y nada más: los segundos que algunos
  // navegadores agregan («…T15:30:00») los absorbe `aISOdesdeSV`.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/.exec(valor ?? '')
  if (!m) return null
  return aISOdesdeSV(m[1], m[2])
}
