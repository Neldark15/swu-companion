/**
 * Un solo lugar que arma los DATOS de la credencial.
 *
 * La placa se pinta ahora en tres pantallas —Inicio, Perfil y /credencial— y
 * las tres tienen que decir lo mismo. Con la lógica repetida, la de Inicio se
 * hubiera quedado atrás en cuanto alguien tocara una regla: es exactamente lo
 * que ya pasó con TarjetaJugador antes de existir como componente compartido.
 *
 * Lo caro (la fecha de alta) se pide UNA vez por cuenta y se guarda en un mapa
 * de módulo: entrar a Inicio, al perfil y a la credencial no son tres viajes a
 * la red.
 */

import { useEffect, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useAuth } from '../../hooks/useAuth'
import { getCountryByCode } from '../../data/regions'
import { calculateLevel, type PlayerStats } from '../../services/gamification'
import { getTitleById } from '../../services/cosmeticsService'
import { supabase } from '../../services/supabase'
import type { UserProfile } from '../../services/db'
import type { DatosCredencial } from './CredencialSVG'
import { acabadoDe, type AcabadoCredencial } from './acabadosCredencial'

/** Fecha de alta ya resuelta, por id de cuenta. Sobrevive al cambio de pantalla. */
const altaPorCuenta = new Map<string, string>()

/** «12 ENE 2026» — corto, en mayúsculas, como cualquier placa impresa. */
export function fechaDespliegue(cuando: number | string): string {
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  const f = new Date(cuando)
  if (Number.isNaN(f.getTime())) return '—'
  return `${String(f.getDate()).padStart(2, '0')} ${meses[f.getMonth()]} ${f.getFullYear()}`
}

export function useDatosCredencial(
  perfil: UserProfile,
  stats: PlayerStats | null,
): { datos: DatosCredencial; nivel: number; acabado: AcabadoCredencial } {
  const { supabaseUser } = useAuth()
  const apodoElegido = useSettings((s) => s.credencialApodo)
  const ubicacionElegida = useSettings((s) => s.credencialUbicacion)
  const mostrarMazo = useSettings((s) => s.credencialMostrarMazo)
  const liderGuardado = useSettings((s) => s.credencialMazoLider)

  const idCuenta = supabaseUser?.id ?? ''
  // Se lee del mapa EN EL RENDER, no en un efecto: si otra pantalla ya la
  // pidió, la fecha correcta sale en la primera pintada y no hay un parpadeo
  // de «hoy» seguido de la fecha real. El estado solo existe para volver a
  // pintar cuando la consulta termina.
  const [pedida, setPedida] = useState<string | null>(null)
  const alta = altaPorCuenta.get(idCuenta) ?? pedida
  // «Hoy», congelado al montar (inicializador perezoso): `Date.now()` en el
  // cuerpo del render es impuro y el compilador de React lo veta.
  const [hoy] = useState(() => Date.now())

  useEffect(() => {
    if (!idCuenta) return
    if (altaPorCuenta.has(idCuenta)) return
    let vivo = true
    void (async () => {
      // La fecha de DESPLIEGUE sale de la CUENTA, no del aparato.
      //
      // `perfil.createdAt` lo estampa el espejo local de Dexie con Date.now()
      // la primera vez que esta cuenta se abre EN ESTE APARATO: en el teléfono
      // decía una fecha y en la compu otra, y borrar los datos del sitio la
      // reseteaba a hoy. En una credencial que se imprime, eso es un dato
      // inventado. `profiles.created_at` es la de verdad.
      const { data, error } = await supabase
        .from('profiles').select('created_at').eq('id', idCuenta).maybeSingle()
      if (error) { console.warn('[credencial] no se pudo leer la fecha de alta:', error.message); return }
      if (!data?.created_at) return
      altaPorCuenta.set(idCuenta, data.created_at)
      if (vivo) setPedida(data.created_at)
    })()
    return () => { vivo = false }
  }, [idCuenta])

  const titulo = stats ? getTitleById(stats.activeTitle)?.name : undefined
  const pais = perfil.country ? getCountryByCode(perfil.country)?.name : undefined
  const nivel = stats ? calculateLevel(stats.xp).level : 1

  return {
    nivel,
    acabado: acabadoDe(nivel),
    datos: {
      nombre: perfil.name || 'Jugador',
      apodo: apodoElegido.trim() || titulo || 'Recluta',
      ubicacion: ubicacionElegida.trim() || pais || 'Borde Exterior',
      rango: stats ? calculateLevel(stats.xp).rank.name : 'Iniciado del Borde Exterior',
      // Mientras la fecha real no llegue va la del espejo local: es la única
      // que hay sin red, y un guion en la placa se ve peor que un día corrido.
      desplegado: fechaDespliegue(alta ?? perfil.createdAt ?? hoy),
      avatar: perfil.avatar,
      mazo: mostrarMazo && liderGuardado ? liderGuardado : null,
    },
  }
}
