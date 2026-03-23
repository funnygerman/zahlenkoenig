import { useState, useCallback } from 'react'
import { ProgressService, StoredProgress } from '../core/services/ProgressService'
import { SolutionResult } from '../core/services/PuzzleValidator'
import { LocalStorage } from '../core/storage/LocalStorage'

const service = new ProgressService(new LocalStorage())

export function useProgress() {
  const [progress, setProgress] = useState<StoredProgress>(() => service.getProgress())
  const refresh = useCallback(() => setProgress(service.getProgress()), [])

  const recordResult = useCallback((levelId: string, result: SolutionResult, newPointStreak: number) => {
    service.recordResult(levelId, result, newPointStreak)
    refresh()
  }, [refresh])

  const setLevel = useCallback((id: string) => { service.setLevel(id); refresh() }, [refresh])
  const setLanguage = useCallback((lang: 'de'|'en') => { service.setLanguage(lang); refresh() }, [refresh])
  const reset = useCallback(() => { service.reset(); refresh() }, [refresh])

  return { progress, recordResult, setLevel, setLanguage, reset }
}
