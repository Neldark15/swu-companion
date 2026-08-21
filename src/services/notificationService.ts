/**
 * Notification Service — Global notification system
 * Zustand store for in-app notifications (toasts + bell dropdown)
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── TYPES ──────────────────────────────────────────────────────────

export type NotificationType = 'achievement' | 'gift' | 'level_up' | 'tier_up' | 'mission' | 'bond' | 'title' | 'info'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  icon?: string
  timestamp: number
  read: boolean
  /** Optional link to navigate on click */
  link?: string
  /**
   * Identidad estable del HECHO que se anuncia (`ach:agg_3`, `lvl:7`,
   * `pairing:<id>:reportado:<timestamp>`). Si viene, `addNotification`
   * descarta el aviso cuando ya hay uno con la misma clave en la campana.
   *
   * Sin clave NO hay dedup, y eso es deliberado: el acuse de algo que la
   * persona acaba de hacer («Resultado enviado», TournamentPlayerView.tsx:203)
   * tiene que sonar cada vez que lo haga. Por eso el campo es opcional y la
   * clave NUNCA se deriva del texto: «Resultado confirmado / Mesa 3» se repite
   * legítimamente en la ronda 1 y en la 5.
   */
  dedupKey?: string
}

// ─── STORE ──────────────────────────────────────────────────────────

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  /** Most recent toast (for global toast component) */
  currentToast: AppNotification | null

  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismissToast: () => void
  clearOld: () => void
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Notifications persist to localStorage so the bell survives reloads —
 * critical for a PWA, where any milestone reached with the app closed
 * used to vanish. `currentToast` is deliberately NOT persisted: a toast
 * from a previous session shouldn't pop up on launch.
 */
export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      currentToast: null,

      addNotification: (n) => {
        // La guarda de repetidos vive ACÁ, no en los helpers. Los consultaban
        // 5 helpers, y los 6 llamadores DIRECTOS quedaban fuera
        // (TournamentPlayerView.tsx:113/130/145/203, TournamentBroadcastListener.tsx:56,
        // AvisoSobreDiario.tsx:56): cada uno se inventó su propia defensa —un
        // useRef que muere al desmontar, una marca en localStorage— para el
        // mismo problema. Quien sabe si un aviso ya está en la campana es el
        // store que la guarda; una sola fuente de verdad.
        //
        // Mover la guarda acá NO cambia el comportamiento de nadie: hoy CERO
        // llamadores directos pasan `dedupKey` (grep sobre src/), así que un
        // aviso sin clave se agrega exactamente igual que antes.
        if (n.dedupKey && alreadyNotified(n.dedupKey)) return

        const notification: AppNotification = {
          ...n,
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          read: false,
        }

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // keep max 50
          unreadCount: state.unreadCount + 1,
          currentToast: notification,
        }))

        // Auto-dismiss toast after 5s
        if (_toastTimer) clearTimeout(_toastTimer)
        _toastTimer = setTimeout(() => {
          // Only dismiss if it's still the same toast
          if (get().currentToast?.id === notification.id) {
            set({ currentToast: null })
          }
        }, 5000)
      },

      markRead: (id) => set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - (
          state.notifications.find(n => n.id === id && !n.read) ? 1 : 0
        )),
      })),

      markAllRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      dismissToast: () => set({ currentToast: null }),

      clearOld: () => set((state) => {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
        const filtered = state.notifications.filter(n => n.timestamp > cutoff)
        return {
          notifications: filtered,
          unreadCount: filtered.filter(n => !n.read).length,
        }
      }),
    }),
    {
      name: 'swu-notifications',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
      onRehydrateStorage: () => (state) => {
        // Drop notifications older than 7 days on every launch
        state?.clearOld()
      },
    }
  )
)

/**
 * ¿Ya hay un aviso vivo con esta clave?
 *
 * La memoria de la guarda ES la campana, así que la clave caduca con ella: el
 * tope de 50 de `addNotification` y los 7 días de `clearOld`. Está BIEN que
 * caduque, y hay dos razones para no darle memoria eterna:
 *
 * 1. El dedup DURABLE ya vive río arriba, contra almacenamiento que no se
 *    poda: logros y títulos se diferencian contra `player_stats` en Dexie
 *    (progressionService.ts:65 + ProfilePage.tsx:217), los regalos contra la
 *    marca `swu_gifts_last_seen` (GiftListener.tsx:19), las misiones contra la
 *    fila de `user_missions` (missionService.ts:296) y el sobre diario contra
 *    `swu_sobre_diario_visto` (sobres.ts:339). Esto es el cinturón; los
 *    tirantes están arriba.
 * 2. Hay hitos que se RE-GANAN de verdad. El tier sale de conteos vivos de
 *    Dexie —`decksCreated` y `cardsCollected` se pisan en cada carga del
 *    perfil, ProfilePage.tsx:235/237—, así que borrar mazos o la colección lo
 *    BAJA y volver a llenarlos lo vuelve a subir. Con memoria eterna,
 *    re-ganar un tier sería silencio para siempre.
 *
 * O sea: esto mata el eco —el mismo hecho anunciado dos veces en el mismo
 * minuto, o al recargar—, no lleva el libro histórico de lo ya anunciado.
 *
 * La firma es `string` y no `string | undefined` a propósito: el caso «sin
 * clave» se decide en `addNotification`. Ensancharla haría que un aviso sin
 * clave colapse contra cualquier otro sin clave, que es el bug contrario.
 */
function alreadyNotified(key: string): boolean {
  const notifications = useNotificationStore.getState().notifications
  return notifications.some(n => n.dedupKey === key)
}

// ─── HELPER: emit common notifications ──────────────────────────────
//
// Los helpers ya NO consultan la guarda: arman la clave y la pasan. Tenerla en
// dos sitios era la puerta al bug clásico —se actualiza una copia y no la
// otra— y además dejaba fuera a los seis llamadores directos del store.

export function notifyAchievement(name: string, icon: string, achievementId?: string) {
  const key = achievementId ? `ach:${achievementId}` : `ach:${name}`
  useNotificationStore.getState().addNotification({
    type: 'achievement',
    title: '¡Logro Desbloqueado!',
    message: name,
    icon: icon || '🏆',
    link: '/profile',
    dedupKey: key,
  })
}

export function notifyLevelUp(level: number, rankName: string) {
  const key = `lvl:${level}`
  useNotificationStore.getState().addNotification({
    type: 'level_up',
    title: `¡Nivel ${level}!`,
    message: `Rango: ${rankName}`,
    icon: '⬆️',
    link: '/profile',
    dedupKey: key,
  })
}

export function notifyTierUp(aspectLabel: string, tierLabel: string) {
  const key = `tier:${aspectLabel}:${tierLabel}`
  useNotificationStore.getState().addNotification({
    type: 'tier_up',
    title: '¡Tier Alcanzado!',
    message: `${aspectLabel} → ${tierLabel}`,
    icon: '🏅',
    link: '/profile',
    dedupKey: key,
  })
}

export function notifyGiftReceived(senderName: string, giftLabel: string, giftId?: string) {
  const key = giftId ? `gift:${giftId}` : undefined
  useNotificationStore.getState().addNotification({
    type: 'gift',
    title: '¡Regalo Recibido!',
    message: `${senderName} te envió ${giftLabel}`,
    icon: '🎁',
    link: '/espionaje',
    dedupKey: key,
  })
}

/**
 * Misión completada — y CUÁNTO se ganó.
 *
 * El XP viaja en el aviso porque desde que se acredita sola no hay ninguna otra
 * pantalla donde se vea. Antes había que ir a /misiones a tocar «Reclamar», y
 * ni siquiera ahí se enseñaba el número: la tarjeta se ponía gris y ya.
 *
 * Sin `xp` el mensaje es solo el nombre: así el aviso sigue sirviendo si el
 * cobro falló, en vez de mentir con un «+0 XP».
 */
export function notifyMissionComplete(missionName: string, xp?: number) {
  useNotificationStore.getState().addNotification({
    type: 'mission',
    title: '¡Misión Completada!',
    message: xp ? `${missionName} · +${xp} XP` : missionName,
    icon: '✅',
    link: '/misiones',
  })
}

export function notifyBondLevelUp(playerName: string, levelName: string) {
  useNotificationStore.getState().addNotification({
    type: 'bond',
    title: '¡Vínculo Fortalecido!',
    message: `${playerName} → ${levelName}`,
    icon: '🤝',
    link: '/espionaje',
  })
}

export function notifyTitleUnlocked(titleName: string, titleId?: string) {
  const key = `title:${titleId ?? titleName}`
  useNotificationStore.getState().addNotification({
    type: 'title',
    title: '¡Título Desbloqueado!',
    message: titleName,
    icon: '👑',
    link: '/profile',
    dedupKey: key,
  })
}
