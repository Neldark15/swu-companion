/**
 * Sincronización del marcador de transmisión.
 *
 * El panel (`/estudio/:code`) manda ACCIONES; el overlay (`/overlay/:code`)
 * recibe ESTADOS completos. Las acciones son reductores puros, así que un
 * choque de versión se resuelve releyendo y re-aplicando la MISMA acción
 * sobre el estado fresco — la diferencia entre «se me perdió el tap» y
 * «todo consistente» cuando el panel está abierto en dos aparatos.
 */

import { supabase } from './supabase'
import {
  ESTADO_INICIAL,
  normalizarEstado,
  restanteReloj,
  type EstadoOverlay,
  type Escena,
  type LadoOverlay,
} from '../types/stream'

export interface OverlayLeido {
  estado: EstadoOverlay
  version: number
  /** Epoch ms del último cambio, según el reloj del SERVIDOR. */
  actualizado: number
}

type Indice = 0 | 1

export type Accion =
  | { t: 'escena'; escena: Escena }
  | { t: 'ronda'; etiqueta: string }
  | { t: 'dano'; lado: Indice; delta: number }
  | { t: 'recursos'; lado: Indice; delta: number }
  | { t: 'iniciativa'; lado: Indice | null }
  | { t: 'jugador'; lado: Indice; campos: Partial<LadoOverlay> }
  | { t: 'juegos'; lado: Indice; delta: number }
  | { t: 'nuevoJuego' }
  | { t: 'reiniciar' }
  | { t: 'intercambiar' }
  | { t: 'relojIniciar'; ahora: number }
  | { t: 'relojPausar'; ahora: number }
  | { t: 'relojExtender'; minutos: number; ahora: number }
  | { t: 'relojDuracion'; minutos: number }
  | { t: 'tiempoExtra'; valor: boolean }
  | { t: 'revision'; valor: boolean }
  | { t: 'mensaje'; texto: string }
  | { t: 'patrocinio'; texto: string }
  | { t: 'ticker'; texto: string }
  | { t: 'tickerVisible'; valor: boolean }
  | { t: 'youtube'; texto: string }
  | { t: 'envivo'; valor: boolean }
  | { t: 'carta'; carta: EstadoOverlay['carta'] }

function conLado(e: EstadoOverlay, i: Indice, cambio: Partial<LadoOverlay>): EstadoOverlay {
  const lados: [LadoOverlay, LadoOverlay] = [{ ...e.lados[0] }, { ...e.lados[1] }]
  lados[i] = { ...lados[i], ...cambio }
  return { ...e, lados }
}

function acotar(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Reductor puro. Sin efectos, sin relojes propios: el `ahora` entra como dato
 * para que re-aplicar una acción tras un choque de versión dé exactamente el
 * mismo resultado.
 */
export function reducir(e: EstadoOverlay, a: Accion): EstadoOverlay {
  switch (a.t) {
    case 'escena':
      return { ...e, escena: a.escena }

    case 'ronda':
      return { ...e, etiquetaRonda: a.etiqueta }

    case 'dano': {
      const lado = e.lados[a.lado]
      return conLado(e, a.lado, { dano: acotar(lado.dano + a.delta, 0, lado.hpMax) })
    }

    case 'recursos': {
      const lado = e.lados[a.lado]
      return conLado(e, a.lado, { recursos: acotar(lado.recursos + a.delta, 0, 30) })
    }

    case 'iniciativa':
      return { ...e, iniciativa: a.lado }

    case 'jugador': {
      const cambio = { ...a.campos }
      // Si cambia la base, el daño se re-acota al HP nuevo. Sin esto, pasar de
      // una base de 30 a una de 26 con 28 de daño pintaría vida negativa.
      if (typeof cambio.hpMax === 'number') {
        cambio.dano = acotar(e.lados[a.lado].dano, 0, cambio.hpMax)
      }
      return conLado(e, a.lado, cambio)
    }

    case 'juegos': {
      const lado = e.lados[a.lado]
      return conLado(e, a.lado, { juegosGanados: acotar(lado.juegosGanados + a.delta, 0, 3) })
    }

    case 'nuevoJuego':
      // Daño a cero e iniciativa en blanco, pero se CONSERVAN líder, base y —lo
      // importante— el HP máximo real de cada base. Es exactamente el bug que
      // arrastra el tracker viejo, que reinicia a 30 fijo entre juegos de un Bo3.
      return {
        ...e,
        juego: acotar(e.juego + 1, 1, 5),
        iniciativa: null,
        tiempoExtra: false,
        enRevision: false,
        carta: null,
        lados: [
          { ...e.lados[0], dano: 0, recursos: 0, liderDesplegado: false },
          { ...e.lados[1], dano: 0, recursos: 0, liderDesplegado: false },
        ],
      }

    case 'reiniciar':
      // Se conservan los nombres: reiniciar el match no cambia quién juega.
      return {
        ...ESTADO_INICIAL,
        escena: e.escena,
        etiquetaRonda: e.etiquetaRonda,
        patrocinio: e.patrocinio,
        lados: [
          { ...ESTADO_INICIAL.lados[0], nombre: e.lados[0].nombre },
          { ...ESTADO_INICIAL.lados[1], nombre: e.lados[1].nombre },
        ],
      }

    case 'intercambiar':
      // Para cuando el lado de cámara no coincide con el del panel. Evita
      // reescribir los dos jugadores enteros a mano en vivo.
      return {
        ...e,
        lados: [e.lados[1], e.lados[0]],
        iniciativa: e.iniciativa === null ? null : ((1 - e.iniciativa) as Indice),
      }

    case 'relojIniciar': {
      const restante = e.reloj.restanteAlPausar ?? e.reloj.duracionMs
      return {
        ...e,
        reloj: { duracionMs: restante, iniciadoEn: a.ahora, restanteAlPausar: null },
      }
    }

    case 'relojPausar':
      return {
        ...e,
        reloj: {
          ...e.reloj,
          iniciadoEn: null,
          restanteAlPausar: restanteReloj(e.reloj, a.ahora) ?? e.reloj.duracionMs,
        },
      }

    case 'relojExtender': {
      const extra = a.minutos * 60 * 1000
      if (e.reloj.iniciadoEn !== null) {
        return { ...e, reloj: { ...e.reloj, duracionMs: e.reloj.duracionMs + extra } }
      }
      const base = e.reloj.restanteAlPausar ?? e.reloj.duracionMs
      return { ...e, reloj: { ...e.reloj, restanteAlPausar: Math.max(0, base + extra) } }
    }

    case 'relojDuracion':
      return {
        ...e,
        reloj: { duracionMs: a.minutos * 60 * 1000, iniciadoEn: null, restanteAlPausar: null },
      }

    case 'tiempoExtra':
      return { ...e, tiempoExtra: a.valor }

    case 'revision':
      return { ...e, enRevision: a.valor }

    case 'mensaje':
      return { ...e, mensaje: a.texto }

    case 'patrocinio':
      return { ...e, patrocinio: a.texto }

    case 'ticker':
      return { ...e, ticker: a.texto }

    case 'tickerVisible':
      return { ...e, tickerVisible: a.valor }

    case 'youtube':
      return { ...e, youtube: a.texto }

    case 'envivo':
      return { ...e, envivo: a.valor }

    case 'carta':
      return { ...e, carta: a.carta }
  }
}

/** Lee el estado actual. Si la fila no existe todavía, devuelve el inicial. */
export async function leerOverlay(code: string): Promise<OverlayLeido> {
  // §2f: supabase-js NO lanza. Sin desestructurar `error`, un fallo se ve
  // idéntico a «no hay datos» y el overlay pintaría un marcador vacío al aire.
  const { data, error } = await supabase
    .from('stream_overlay')
    .select('estado, version, updated_at')
    .eq('code', code)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    return { estado: ESTADO_INICIAL, version: 0, actualizado: 0 }
  }

  return {
    estado: normalizarEstado(data.estado),
    version: typeof data.version === 'number' ? data.version : 0,
    actualizado: data.updated_at ? new Date(data.updated_at as string).getTime() : 0,
  }
}

/** Crea la fila si no existe. Idempotente. */
export async function asegurarOverlay(code: string): Promise<void> {
  const { error } = await supabase
    .from('stream_overlay')
    .upsert({ code, estado: ESTADO_INICIAL, version: 0 }, { onConflict: 'code', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}

const REINTENTOS = 4

/**
 * Aplica una acción con control optimista de versión.
 *
 * Un UPDATE con `version = $previa` que afecta 0 filas significa que alguien
 * más escribió en el medio. En vez de perder el toque, se relee y se re-aplica
 * la misma acción sobre el estado fresco.
 */
export async function aplicarAccion(code: string, accion: Accion): Promise<EstadoOverlay> {
  let ultimoError = 'No se pudo guardar'

  for (let intento = 0; intento < REINTENTOS; intento++) {
    const { estado, version } = await leerOverlay(code)
    const siguiente = reducir(estado, accion)

    const { data, error } = await supabase
      .from('stream_overlay')
      .update({ estado: siguiente, version: version + 1 })
      .eq('code', code)
      .eq('version', version)
      .select('code')

    if (error) {
      ultimoError = error.message
      break
    }

    // Afectó una fila → listo.
    if (data && data.length > 0) return siguiente

    // 0 filas: o hubo choque de versión (reintentar), o la fila no existe.
    if (version === 0) {
      await asegurarOverlay(code)
    }
  }

  throw new Error(ultimoError)
}

/**
 * Se suscribe a los cambios. Devuelve la función de limpieza.
 *
 * Patrón `postgres_changes`, el mismo que ya funciona en `tournamentCloud.ts`.
 * OJO: el poll de respaldo NO va acá, va en el componente — un WebSocket que
 * muere en silencio a la hora 3 no emite ningún evento, así que la única
 * defensa es releer cada tanto.
 */
export function suscribirOverlay(
  code: string,
  onEstado: (leido: OverlayLeido) => void
): () => void {
  const canal = supabase
    .channel(`overlay-${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stream_overlay', filter: `code=eq.${code}` },
      payload => {
        const fila = payload.new as { estado?: unknown; version?: number; updated_at?: string } | null
        if (!fila || !('estado' in fila)) return
        onEstado({
          estado: normalizarEstado(fila.estado),
          version: typeof fila.version === 'number' ? fila.version : 0,
          actualizado: fila.updated_at ? new Date(fila.updated_at).getTime() : Date.now(),
        })
      }
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(canal)
  }
}
