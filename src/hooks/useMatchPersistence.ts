import { useCallback, useEffect, useRef } from 'react'
import { db } from '../services/db'
import type { MatchState } from '../types'

const AUTO_SAVE_INTERVAL = 30_000 // 30 seconds

export function useMatchPersistence(match: MatchState | null) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const matchRef = useRef(match)
  matchRef.current = match

  // Save match to IndexedDB
  const save = useCallback(async (m: MatchState) => {
    const toSave = { ...m, updatedAt: Date.now() }
    await db.matches.put(toSave)
    return toSave
  }, [])

  // Auto-save interval
  useEffect(() => {
    if (!match) return

    timerRef.current = setInterval(() => {
      if (matchRef.current) {
        save(matchRef.current)
      }
    }, AUTO_SAVE_INTERVAL)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [match?.id, save])

  // Save on unmount / navigate away
  useEffect(() => {
    return () => {
      if (matchRef.current) {
        save(matchRef.current)
      }
    }
  }, [save])

  // Manual save
  const saveNow = useCallback(async () => {
    if (matchRef.current) {
      return save(matchRef.current)
    }
  }, [save])

  // Load match by id
  const loadMatch = useCallback(async (id: string) => {
    return db.matches.get(id)
  }, [])

  // Get all saved matches (most recent first)
  const getSavedMatches = useCallback(async () => {
    return db.matches.orderBy('updatedAt').reverse().toArray()
  }, [])

  // Delete a match
  const deleteMatch = useCallback(async (id: string) => {
    return db.matches.delete(id)
  }, [])

  // Count active matches
  const countSaved = useCallback(async () => {
    return db.matches.count()
  }, [])

  // Finish match (mark as inactive)
  const finishMatch = useCallback(async (m: MatchState) => {
    const finished = { ...m, isActive: false, updatedAt: Date.now() }
    await db.matches.put(finished)
    return finished
  }, [])

  return { save, saveNow, loadMatch, getSavedMatches, deleteMatch, countSaved, finishMatch }
}
