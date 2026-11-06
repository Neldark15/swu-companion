import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../services/db'
import { crearGuardadorPartidas } from '../services/guardadoPartidas'
import type { MatchState } from '../types'

export function useMatchPersistence(match: MatchState | null) {
  const matchRef = useRef(match)
  const [escribir] = useState(() => crearGuardadorPartidas(partida => db.matches.put(partida)))
  const [errorGuardado, setErrorGuardado] = useState(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  const save = useCallback((m: MatchState) => escribir(m).then(
    guardado => {
      if (montado.current) setErrorGuardado(false)
      return guardado
    },
    error => {
      if (montado.current) setErrorGuardado(true)
      throw error
    },
  ), [escribir])

  // Cada cambio confirmado por React se persiste, incluso el estado final.
  // El llamador mantiene estable la instantánea y espera la carga al reanudar.
  useEffect(() => {
    matchRef.current = match
    if (match) void save(match).catch(() => {})
  }, [match, save])

  // Refuerzo al ocultar o salir; no depende de que el navegador avise al cerrar.
  useEffect(() => {
    const guardarActual = () => {
      if (matchRef.current) void save(matchRef.current).catch(() => {})
    }
    const alOcultar = () => { if (document.hidden) guardarActual() }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', guardarActual)
    return () => {
      document.removeEventListener('visibilitychange', alOcultar)
      window.removeEventListener('pagehide', guardarActual)
      guardarActual()
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
    const finished = { ...m, isActive: false }
    matchRef.current = finished
    return save(finished)
  }, [save])

  return { save, saveNow, loadMatch, getSavedMatches, deleteMatch, countSaved, finishMatch, errorGuardado }
}
