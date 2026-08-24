/**
 * La credencial de OTRA persona.
 *
 * ── Por qué no sirve `useDatosCredencial` ─────────────────────────────
 *
 * Ese hook lee el apodo, la ubicación, el tema y el mazo de `useSettings`, que
 * son los ajustes de ESTE aparato. Usarlo para mirar a otro jugador le
 * pondría a su placa MI apodo y MI tema — y como los dos son textos
 * plausibles, no se vería como un error: se vería como que esa persona eligió
 * lo mismo que yo.
 *
 * Por eso los ajustes ajenos se leen de `profiles.settings`, que es donde la
 * app ya los sincroniza. Medido: de 38 perfiles, **12 tienen tema elegido, 8
 * apodo y 4 ubicación** — o sea que hay algo de verdad que enseñar, y para el
 * resto los reemplazos por defecto hacen el trabajo.
 *
 * ── Un solo armado ────────────────────────────────────────────────────
 *
 * Todo termina en `armarCredencial()`, la misma función que usa la placa
 * propia. Duplicar el armado es exactamente lo que el §2y advierte: la
 * tarjeta se separa de sí misma y dos pantallas enseñan jugadores distintos.
 */

import { useEffect, useState } from 'react'
import { supabase, isSupabaseReady } from '../../services/supabase'
import { statsFromSnake } from '../../services/sync'
import { armarCredencial } from './useDatosCredencial'
import type { DatosCredencial } from './CredencialSVG'
import type { AcabadoCredencial } from './acabadosCredencial'
import {
  TEMAS_CREDENCIAL, esEmblemaCredencial,
  type TemaCredencial, type EmblemaCredencialId,
} from './credencialTemas'
import type { PlayerStats } from '../../services/gamification'

export interface CredencialAjena {
  datos: DatosCredencial
  nivel: number
  acabado: AcabadoCredencial
  tema: TemaCredencial
  emblema: EmblemaCredencialId
}

interface Ajustes {
  credencialApodo?: string
  credencialUbicacion?: string
  credencialTema?: string
  credencialEmblema?: string
  credencialMazoLider?: string
  credencialMostrarMazo?: boolean
}

/**
 * `null` mientras carga o si no se pudo armar.
 *
 * No devuelve una placa a medias: una credencial con el nombre puesto y el
 * resto en valores por defecto se ve como la placa REAL de alguien que no
 * configuró nada, y no hay forma de distinguirla de un fallo de red.
 */
export function useCredencialAjena(userId: string | undefined): CredencialAjena | null {
  const [cred, setCred] = useState<CredencialAjena | null>(null)

  useEffect(() => {
    if (!userId || !isSupabaseReady()) { return }
    let vivo = true
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, avatar, created_at, settings, subnombre, player_stats!inner(*)')
        .eq('id', userId)
        .maybeSingle()

      // §2f: sin mirar `error`, un fallo se ve igual que «esta persona no existe».
      if (error) { console.warn('[credencial ajena] no se pudo leer:', error.message); return }
      if (!data || !vivo) return

      /* Gotcha 1: un join 1:N de Supabase devuelve ARRAY aunque la relación
         sea 1:1. Sin esto, todos los campos de stats salen undefined y la
         placa muestra nivel 1 para alguien de nivel 8 — sin un solo error. */
      const fila = Array.isArray(data.player_stats) ? data.player_stats[0] : data.player_stats
      const stats: PlayerStats | null = fila ? statsFromSnake(fila, userId) : null

      const aj = (data.settings ?? {}) as Ajustes
      const { datos, nivel, acabado } = armarCredencial({
        nombre: (data.name as string) ?? '',
        // El país vive en los ajustes, no en una columna (ver `sync.ts`).
        pais: (data.settings as { country?: string } | null)?.country ?? null,
        avatar: (data.avatar as string) ?? '',
        stats,
        apodoElegido: aj.credencialApodo ?? '',
        ubicacionElegida: aj.credencialUbicacion ?? '',
        // Se respeta que lo haya APAGADO: mostrar su mazo cuando eligió
        // esconderlo es publicar algo que decidió no publicar.
        lider: aj.credencialMostrarMazo === false ? null : (aj.credencialMazoLider || null),
        subnombre: (data.subnombre as string | null) ?? null,
        alta: (data.created_at as string) ?? Date.now(),
      })

      /* El tema y el emblema salen de un JSON que escribe el CLIENTE, así que
         un valor inventado o de una versión vieja llegaría hasta el dibujo. Se
         validan contra las listas y se cae al valor por defecto: una placa con
         el tema equivocado es fea; una con un emblema que no existe deja un
         hueco negro. */
      const tema = TEMAS_CREDENCIAL.find(t => t.id === aj.credencialTema) ?? TEMAS_CREDENCIAL[0]
      const emblema: EmblemaCredencialId =
        esEmblemaCredencial(aj.credencialEmblema) ? aj.credencialEmblema : 'jedi-order'
      setCred({ datos, nivel, acabado, tema, emblema })
    })()
    return () => { vivo = false }
  }, [userId])

  return cred
}
