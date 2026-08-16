/**
 * La PORTADA del perfil: una carta elegida, en tira ancha, detrás de un velo.
 *
 * ── Por qué existe este archivo ──────────────────────────────────────
 *
 * `banner_card_id` estaba en la base y lo contaba el chequeo de completitud,
 * pero NO había dónde elegirla NI dónde se mostraba: un campo fantasma que
 * dejaba el perfil trabado en «te falta la portada» sin forma de completarlo.
 * Esto le da cara: se elige en Personalizar y se ve acá.
 *
 * Es autosuficiente: se le pasa el id de la carta y resuelve el arte solo. Si
 * no hay portada, o la carta no está en la base local, no dibuja nada — el
 * perfil se ve igual que antes, sin huecos.
 */

import { useEffect, useState } from 'react'
import { CardImage } from '../../components/CardImage'
import { getCardById } from '../../services/swuApi'
import { getPersonalizacion } from '../../services/profileCustomService'
import type { Card } from '../../types'

/** Elige la cara apaisada si la carta la tiene; si no, la vertical recortada. */
function BannerConCarta({ card, className = '' }: { card: Card; className?: string }) {
  // La portada es una franja ANCHA; para una carta vertical se recorta el
  // centro (`object-cover`), que es donde vive la ilustración.
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <CardImage
        src={card.imageUrl}
        alt=""
        fit="cover"
        className="absolute inset-0 h-full w-full"
      />
      {/* Velo de abajo hacia arriba: sostiene el texto que se pinte encima y
          funde la carta con el fondo del perfil. */}
      <div className="absolute inset-0 bg-gradient-to-t from-swu-bg via-swu-bg/40 to-transparent" />
    </div>
  )
}

/** Portada a partir del id de una carta. `null` = no dibuja nada. */
export function BannerPortada({ cardId, className }: { cardId: string | null | undefined; className?: string }) {
  // Se guarda la carta JUNTO a su id. Así, al cambiar de portada, la carta
  // vieja no se pinta un instante con el id nuevo, y no hace falta limpiar el
  // estado dentro del efecto (lo que dispararía `set-state-in-effect`): el
  // render simplemente descarta un `loaded` cuyo id ya no coincide.
  const [loaded, setLoaded] = useState<{ id: string; card: Card } | null>(null)

  useEffect(() => {
    if (!cardId) return
    let vivo = true
    void getCardById(cardId).then(c => { if (vivo && c) setLoaded({ id: cardId, card: c }) })
    return () => { vivo = false }
  }, [cardId])

  const card = loaded && loaded.id === cardId ? loaded.card : null
  if (!cardId || !card) return null
  return <BannerConCarta card={card} className={className} />
}

/**
 * Portada de un USUARIO: carga su personalización y pinta su portada.
 *
 * Para las pantallas que tienen el id del usuario pero no su `banner_card_id`
 * a mano (el perfil propio, sin cargar la personalización aparte). Una consulta
 * liviana; si falla, no dibuja nada.
 */
export function BannerPortadaUsuario({ userId, className }: { userId: string | null | undefined; className?: string }) {
  // Igual que arriba: el resultado se guarda junto a su userId para no arrastrar
  // la portada de un usuario al siguiente, y para no limpiar dentro del efecto.
  const [loaded, setLoaded] = useState<{ userId: string; cardId: string | null } | null>(null)

  useEffect(() => {
    if (!userId) return
    let vivo = true
    void getPersonalizacion(userId)
      .then(p => { if (vivo) setLoaded({ userId, cardId: p.banner_card_id }) })
      .catch(() => {})
    return () => { vivo = false }
  }, [userId])

  const cardId = loaded && loaded.userId === userId ? loaded.cardId : null
  return <BannerPortada cardId={cardId} className={className} />
}
