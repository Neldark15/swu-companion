/**
 * GiftListener — notifica al usuario cuando recibe un regalo.
 *
 * Sin UI propia. Se monta en AppLayout y hace dos cosas:
 *  1. Catch-up: al entrar, anuncia los regalos que llegaron mientras la app
 *     estaba cerrada (Realtime solo entrega con la pestaña abierta).
 *  2. En vivo: suscribe al canal Realtime de gifts (INSERT filtrado por
 *     recipient_id).
 *
 * Ambos caminos usan notifyGiftReceived con el id del regalo como dedupKey,
 * así un mismo regalo nunca se anuncia dos veces.
 */

import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { subscribeToIncomingGifts, getReceivedGifts, GIFT_TYPES } from '../../services/giftService'
import { notifyGiftReceived } from '../../services/notificationService'

const LAST_SEEN_KEY = 'swu_gifts_last_seen'

export function GiftListener() {
  const userId = useAuth(s => s.supabaseUser?.id ?? null)

  // 1. Catch-up de regalos recibidos con la app cerrada
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const catchUp = async () => {
      let lastSeen = 0
      try { lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || 0) } catch { /* private mode */ }

      const gifts = await getReceivedGifts(userId, 20)
      if (cancelled || gifts.length === 0) return

      // Primera vez en este dispositivo: solo marcamos el punto de partida,
      // sin inundar la campanita con el historial completo.
      if (lastSeen > 0) {
        const fresh = gifts
          .filter(g => new Date(g.createdAt).getTime() > lastSeen)
          .reverse() // más antiguos primero, para que el orden final sea correcto
        for (const g of fresh) {
          const info = GIFT_TYPES.find(t => t.type === g.type)
          notifyGiftReceived(
            g.senderName || 'Alguien',
            `${info?.icon ?? '🎁'} ${info?.label ?? 'un regalo'} (+${g.xpAmount} XP)`,
            g.id,
          )
        }
      }

      const newest = Math.max(...gifts.map(g => new Date(g.createdAt).getTime()))
      try { localStorage.setItem(LAST_SEEN_KEY, String(newest)) } catch { /* private mode */ }
    }

    catchUp().catch(() => { /* best-effort */ })
    return () => { cancelled = true }
  }, [userId])

  // 2. Regalos en vivo
  useEffect(() => {
    if (!userId) return
    const unsub = subscribeToIncomingGifts(userId, ({ id, senderName, giftLabel, giftIcon, xp, createdAt }) => {
      notifyGiftReceived(senderName, `${giftIcon} ${giftLabel} (+${xp} XP)`, id)
      try { localStorage.setItem(LAST_SEEN_KEY, String(createdAt)) } catch { /* private mode */ }
    })
    return unsub
  }, [userId])

  return null
}
