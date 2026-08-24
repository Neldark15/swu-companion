/**
 * ¿Esta cuenta puede entrar al Taller Kyber?
 *
 * ── Para qué sirve y para qué NO ──────────────────────────────────────
 *
 * Sirve para decidir si se DIBUJA la entrada de menú. No es una cerradura y no
 * pretende serlo: `isAdmin` y los roles ya viven en localStorage y cualquier
 * gate de cliente se salta con la consola. Lo que cierra de verdad es el
 * `if not es_probador_sable()` que está DENTRO de cada RPC del taller.
 *
 * Enseñar un enlace de menos a alguien que sí tiene acceso es un fastidio;
 * enseñarlo de más a quien no lo tiene solo le da una pantalla que le va a decir
 * «cerrado». Ninguna de las dos cosas es un agujero.
 *
 * ── Se pregunta UNA vez por sesión ────────────────────────────────────
 *
 * La respuesta no cambia mientras la app está abierta, y este hook lo usan el
 * menú de escritorio y el de móvil a la vez: sin la caché a nivel de módulo
 * serían dos viajes por cada navegación, para pintar un enlace.
 */

import { useEffect, useState } from 'react'
import { supabase, isSupabaseReady } from '../../services/supabase'

/** `undefined` = todavía no se preguntó. Se guarda por cuenta. */
let cache: { uid: string; puede: boolean } | undefined

export function useEsProbadorSable(uid: string | undefined): boolean {
  /* El valor se DERIVA de la caché en el render; el estado solo existe para
     forzar un repintado cuando la respuesta llega. Guardarlo en estado y
     sincronizarlo desde el efecto es escritura síncrona de estado dentro de un
     efecto, que en este repo es error de lint y además dispara renders en
     cascada — el mismo patrón que ya hubo que corregir en la pantalla del
     taller y en la de sobres. */
  const [, repintar] = useState(0)

  useEffect(() => {
    if (!uid || !isSupabaseReady()) return
    if (cache && cache.uid === uid) return
    let vivo = true
    void (async () => {
      // §2f: sin mirar `error`, un fallo de red se vería igual que «no tenés
      // acceso» — y acá eso significa esconderle el módulo a su dueño.
      const { data, error } = await supabase.rpc('es_probador_sable')
      if (!vivo) return
      if (error) { console.warn('[Sable] no se pudo comprobar el acceso:', error.message); return }
      cache = { uid, puede: data === true }
      repintar(n => n + 1)
    })()
    return () => { vivo = false }
  }, [uid])

  return !!uid && cache?.uid === uid && cache.puede
}
