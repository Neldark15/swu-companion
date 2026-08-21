/**
 * LA CARTA DEL DÍA — algo nuevo cada mañana sin inventar una novedad.
 *
 * ── Por qué existe y por qué NO se llama spoiler ─────────────────────
 *
 * Lo que se pedía era «que suelte un spoiler casi todos los días». Eso no tiene
 * fuente: no existe ningún API que diga cuándo se reveló una carta —el único
 * campo candidato trae el mismo valor centinela en 4.840 de 9.185 cartas— y las
 * cartas realmente nuevas entraron al catálogo 3 días de los últimos 146. Un
 * cartel diario de «spoiler» sería inventado 26 días de cada 30.
 *
 * Esto es lo honesto que queda: una carta del catálogo YA publicado, elegida
 * por el día. No es novedad y no se rotula como tal en ningún sitio.
 *
 * ── La misma para todos, y sin guardar nada ──────────────────────────
 *
 * El índice sale de una función del día (FNV-1a sobre «2026-08-20»), así que
 * los 27 ven la misma carta y no hace falta ni una tabla ni una fila. Mañana
 * cambia sola porque cambia el día, no porque alguien la rote.
 *
 * Se ordena por `id` antes de indexar: sin un orden estable, Dexie puede
 * devolver las cartas en otro orden en otro teléfono y cada quien vería una
 * carta distinta el mismo día.
 *
 * ── Por qué pesa el set más nuevo, y por qué NO el «que está por salir» ──
 *
 * Lo pedido era priorizar el set por salir (Homeworlds). Hoy eso es imposible y
 * no por pereza: **Homeworlds no está en el catálogo**. Comprobado contra el
 * API — 28 sets, ninguno con ese nombre. Sus cartas no existen todavía en
 * ninguna fuente a la que esta app tenga acceso, así que una «carta de
 * Homeworlds» solo podría salir de inventarla.
 *
 * Lo que sí se puede es dar peso al set MÁS NUEVO que tenga cartas, y ese
 * orden ya vive en `MAIN_SET_LABELS` (swuApi.ts), que está en orden de salida.
 * El día que Homeworlds entre al catálogo, se agrega su código al final de ese
 * mapa y pasa a ganar sin tocar este archivo.
 *
 * El reparto es 70 / 20 / 10: el set más nuevo, el anterior, y cualquiera del
 * resto. No es 100% del más nuevo a propósito — con ~230 cartas por set, un
 * solo set se repetiría cada 8 meses, y la gracia de la sección es que la
 * carta sorprenda.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardImage } from '../../components/CardImage'
import { db } from '../../services/db'
import { MAIN_SET_LABELS } from '../../services/swuApi'
import { diaCalendarioSV } from '../../services/horaSV'
import type { Card } from '../../types'

/** FNV-1a con la avalancha de murmur3, el mismo que usa el anillo de avatares. */
function hashDia(dia: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dia.length; i++) {
    h ^= dia.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  // `>>> 0` y no `>> 0`: con el corrimiento con signo el índice sale negativo.
  return h >>> 0
}

export function CartaDelDia() {
  const [carta, setCarta] = useState<Card | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        // Solo canónicas: las 9.185 filas son impresiones de ~2.300 cartas, y
        // sin filtrar saldría cuatro veces la misma carta en cuatro días.
        const todas = await db.cards.filter(c => c.isCanonical === true).toArray()
        if (!vivo || todas.length === 0) return
        todas.sort((a, b) => a.id.localeCompare(b.id))

        // El orden de salida. El último con cartas en el catálogo es el nuevo.
        const porSalida = Object.keys(MAIN_SET_LABELS)
        const conCartas = porSalida.filter(s => todas.some(c => c.setCode === s))
        const nuevo = conCartas[conCartas.length - 1]
        const anterior = conCartas[conCartas.length - 2]

        const h = hashDia(diaCalendarioSV(new Date()))
        // El MISMO hash decide el cajón y el índice. Con dos hashes distintos
        // haría falta una segunda semilla, y con el mismo número para las dos
        // cosas el índice quedaría correlacionado con el cajón — dividir por
        // 100 separa los dos usos sin inventar otra función.
        const cajon = h % 100
        const preferido = cajon < 70 ? nuevo : cajon < 90 ? anterior : undefined

        const bolsa = preferido ? todas.filter(c => c.setCode === preferido) : todas
        // Si el set preferido no tiene canónicas (no debería, pero el catálogo
        // local puede estar a medio bajar), se cae a todas en vez de no pintar.
        const fuente = bolsa.length > 0 ? bolsa : todas
        setCarta(fuente[Math.floor(h / 100) % fuente.length])
      } catch {
        // El catálogo local todavía no está. No es un fallo que valga contar.
      }
    })()
    return () => { vivo = false }
  }, [])

  // Sin catálogo no se dibuja NADA, ni esqueleto: es una sección de adorno y un
  // hueco gris permanente en Inicio es peor que su ausencia.
  if (!carta) return null

  return (
    <div className="px-4 pt-5">
      <h2 className="mb-1.5 px-1 text-[10px] font-black tracking-[0.22em] text-swu-muted uppercase">
        La carta del día
      </h2>
      <Link
        to={`/cards/${carta.id}`}
        className="clip-hud flex items-center gap-3 bg-swu-surface px-3 py-3"
      >
        <div className="w-[64px] shrink-0">
          <div className="relative aspect-[286/400] w-full">
            <CardImage
              src={carta.imageUrl}
              alt={carta.name}
              orientacion={carta.isLeader || carta.isBase ? 'apaisada' : 'vertical'}
              className="h-full w-full"
            />
          </div>
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-swu-text">{carta.name}</span>
          {carta.subtitle && (
            <span className="block truncate text-[11px] text-swu-muted">{carta.subtitle}</span>
          )}
          <span className="mt-1 block text-[10px] tracking-wide text-swu-muted uppercase">
            {carta.setCode} · {carta.rarity}
          </span>
        </span>
      </Link>
    </div>
  )
}
