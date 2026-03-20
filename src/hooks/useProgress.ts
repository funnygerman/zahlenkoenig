import { useState, useCallback } from 'react'
import { ProgressService, StoredProgress } from '../core/services/ProgressService'
import { SolutionResult } from '../core/services/PuzzleValidator'
import { LocalStorage } from '../core/storage/LocalStorage'

const storage = new LocalStorage()
const progressService = new ProgressService(storage)

export function useProgress() {
  const [progress, setProgress] = useState<StoredProgress>(() => progressService.getProgress())

  const refresh = useCallback(() => {
    setProgress(progressService.getProgress())
  }, [])

  const recordResult = useCallback((
    levelId: string,
    result: SolutionResult,
    points: number,
    newPointStreak: number
  ) => {
    progressService.recordResult(levelId, result, points, newPointStreak)
    refresh()
  }, [refresh])

  const setLevel = useCallback((levelId: string) => {
    progressService.setLevel(levelId)
    refresh()
  }, [refresh])

  const setCustomTarget = useCallback((levelId: string, target: number) => {
    progressService.setCustomTarget(levelId, target)
    refresh()
  }, [refresh])

  const setLanguage = useCallback((lang: 'de' | 'en') => {
    progressService.setLanguage(lang)
    refresh()
  }, [refresh])

  const reset = useCallback(() => {
    progressService.reset()
    refresh()
  }, [refresh])

  const isUnlocked = useCallback((levelId: string) => {
    return progressService.isUnlocked(levelId)
  }, [])

  const getUnlockStreak = useCallback((levelId: string) => {
    return progressService.getUnlockStreak(levelId)
  }, [])

  return {
    progress,
    recordResult,
    setLevel,
    setCustomTarget,
    setLanguage,
    reset,
    isUnlocked,
    getUnlockStreak,
  }
}
