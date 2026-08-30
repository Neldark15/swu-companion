/**
 * Avisarle a cada jugador CÓMO LE FUE cuando el torneo cierra.
 *
 * ── Por qué no alcanza con publicar la tabla ──────────────────────────
 *
 * Al cerrar, el torneo aparece en el Archivo y se acreditan los sobres. Las
 * dos cosas son silenciosas: nadie se entera hasta que abre la app y va a
 * buscar. El día que se armó esto, de los 12 del torneo **9 no habían
 * abierto un solo sobre**; el cuello de botella de esta app nunca fue dar
 * premios, es que se sepa que los hay.
 *
 * ── Un texto por persona, no un anuncio ──────────────────────────────
 *
 * «Terminó el torneo» obliga a abrir y buscarse en una lista de doce.
 * «Quedaste 3º de 12 · +3 sobres» ya lo dice todo. Igual que con los
 * emparejamientos, es una llamada por jugador.
 *
 * ── El número de sobres NO se calcula acá ────────────────────────────
 *
 * Viene de `premios_de_torneo`, que usa la misma `sobres_por_puesto` con la
 * que se acreditó. Si la escala cambia, cambia en un solo lugar: un aviso
 * que dice «+5» cuando el saldo subió 3 es peor que no avisar.
 *
 * ── Y lo que este aviso no puede hacer ───────────────────────────────
 *
 * El push solo llega a quien lo tenga activado: medido el día del cierre,
 * **3 de 12**. Por eso devuelve a quién le llegó y a quién no, en vez de un
 * contador: un «enviados: 12» con nueve sin push es el fallo que se ve como
 * éxito (§4d). Al que no le llega lo ve igual al abrir la app —está la
 * noticia fijada en Inicio y el torneo en el Archivo—; esto adelanta el
 * trabajo, no lo reemplaza.
 */

import { supabase, isSupabaseReady } from './supabase'

export interface AvisoResultado {
  nombre: string
  userId: string | null
  puesto: number
  total: number
  sobres: number
  /** `false` = no tiene cuenta, o no tiene los avisos puestos. */
  alcanzado: boolean
  error?: string
}

export interface ResultadoAvisoFinal {
  ok: boolean
  mensaje?: string
  avisos: AvisoResultado[]
  llegaron: number
  sinPush: number
  /** Los que ni siquiera tienen cuenta: no reciben premio NI aviso. */
  sinCuenta: string[]
}

/** De a cuántos a la vez, igual que en los emparejamientos. */
const TANDA = 6

/** El ordinal como lo diría una persona: «1º», «11º». */
function ordinal(n: number): string {
  return `${n}º`
}

export async function avisarResultados(eventCode: string): Promise<ResultadoAvisoFinal> {
  const vacio: ResultadoAvisoFinal = { ok: false, avisos: [], llegaron: 0, sinPush: 0, sinCuenta: [] }
  if (!isSupabaseReady()) return { ...vacio, mensaje: 'Sin conexión con el servidor' }

  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion?.session?.access_token
  if (!token) return { ...vacio, mensaje: 'Necesitás sesión para avisar.' }

  const { data: premios, error } = await supabase
    .rpc('premios_de_torneo', { p_code: eventCode })
  // §2f: supabase-js no lanza ante un error de PostgREST.
  if (error) return { ...vacio, mensaje: error.message }
  if (!premios || premios.length === 0) {
    return { ...vacio, mensaje: 'Ese torneo no tiene clasificación.' }
  }

  const filas = premios as {
    user_id: string | null; nombre: string; puesto: number; total: number; sobres: number
  }[]

  const avisos: AvisoResultado[] = filas.map(f => ({
    nombre: f.nombre,
    userId: f.user_id,
    puesto: f.puesto,
    total: f.total,
    // Al invitado se le muestra 0: no se le acreditó nada porque no hay a
    // quién acreditárselo. Decir «+1 sobre» ahí sería una promesa falsa.
    sobres: f.user_id ? f.sobres : 0,
    alcanzado: false,
  }))

  const conCuenta = avisos.filter(a => a.userId)
  for (let i = 0; i < conCuenta.length; i += TANDA) {
    await Promise.all(conCuenta.slice(i, i + TANDA).map(async a => {
      const podio = a.puesto <= 4
      try {
        const res = await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: a.puesto === 1
              ? '🏆 Ganaste el torneo'
              : `Terminó el torneo · ${ordinal(a.puesto)} de ${a.total}`,
            body: podio
              ? `${ordinal(a.puesto)} lugar. Te ganaste ${a.sobres} sobres y 500 XP.`
              : `Quedaste ${ordinal(a.puesto)} de ${a.total}. Te ganaste ${a.sobres} sobre y 500 XP.`,
            link: `/torneos/${eventCode}`,
            tag: `resultado-${eventCode}-${a.userId}`,
            type: 'tournament',
            targets: { userIds: [a.userId] },
          }),
        })
        const json = await res.json().catch(() => ({}))
        // `sent > 0` es lo único que significa que LLEGÓ.
        a.alcanzado = res.ok && (json.sent ?? 0) > 0
        if (!res.ok) a.error = json.error || `HTTP ${res.status}`
      } catch (e) {
        a.error = e instanceof Error ? e.message : 'falló el envío'
      }
    }))
  }

  const llegaron = avisos.filter(a => a.alcanzado).length
  return {
    ok: true,
    avisos,
    llegaron,
    sinPush: conCuenta.length - llegaron,
    sinCuenta: avisos.filter(a => !a.userId).map(a => a.nombre),
  }
}
