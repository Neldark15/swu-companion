/**
 * GiftListener — notifica al usuario cuando recibe un regalo, en vivo.
 *
 * Sin UI propia. Se monta en AppLayout y suscribe al canal Realtime de
 * gifts (INSERT filtrado por recipient_id). Al llegar uno, dispara el
 * toast + campanita vía notifyGiftReceived (helper que existía desde el
 * principio pero nunca se llamaba — el receptor jamás se enteraba).
 */

import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { subscribeToIncomingGifts } from '../../services/giftService'
import { notifyGiftReceived } from '../../services/notificationService'

export function GiftListener() {
  const userId = useAuth(s => s.supabaseUser?.id ?? null)

  useEffect(() => {
    if (!userId) return
    const unsub = subscribeToIncomingGifts(userId, ({ senderName, giftLabel, giftIcon, xp }) => {
      notifyGiftReceived(senderName, `${giftIcon} ${giftLabel} (+${xp} XP)`)
    })
    return unsub
  }, [userId])

  return null
}
