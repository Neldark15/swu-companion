/**
 * Notification Service — Global notification system
 * Zustand store for in-app notifications (toasts + bell dropdown)
 */

import { create } from 'zustand'

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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  currentToast: null,

  addNotification: (n) => {
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
}))

// ─── HELPER: emit common notifications ──────────────────────────────

export function notifyAchievement(name: string, icon: string) {
  useNotificationStore.getState().addNotification({
    type: 'achievement',
    title: '¡Logro Desbloqueado!',
    message: name,
    icon: icon || '🏆',
    link: '/perfil',
  })
}

export function notifyLevelUp(level: number, rankName: string) {
  useNotificationStore.getState().addNotification({
    type: 'level_up',
    title: `¡Nivel ${level}!`,
    message: `Rango: ${rankName}`,
    icon: '⬆️',
    link: '/perfil',
  })
}

export function notifyTierUp(aspectLabel: string, tierLabel: string) {
  useNotificationStore.getState().addNotification({
    type: 'tier_up',
    title: '¡Tier Alcanzado!',
    message: `${aspectLabel} → ${tierLabel}`,
    icon: '🏅',
    link: '/perfil',
  })
}

export function notifyGiftReceived(senderName: string, giftLabel: string) {
  useNotificationStore.getState().addNotification({
    type: 'gift',
    title: '¡Regalo Recibido!',
    message: `${senderName} te envió ${giftLabel}`,
    icon: '🎁',
    link: '/espionaje',
  })
}

export function notifyMissionComplete(missionName: string) {
  useNotificationStore.getState().addNotification({
    type: 'mission',
    title: '¡Misión Completada!',
    message: missionName,
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

export function notifyTitleUnlocked(titleName: string) {
  useNotificationStore.getState().addNotification({
    type: 'title',
    title: '¡Título Desbloqueado!',
    message: titleName,
    icon: '👑',
    link: '/perfil',
  })
}
