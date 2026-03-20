import { SolutionResult } from './PuzzleValidator'
import { IStorage } from '../storage/IStorage'
import { LEVELS } from '../models/Level'

export interface StoredProgress {
  unlockedLevels: string[]
  unlockStreaks: Record<string, number>
  totalScore: number
  pointStreak: number
  customTargets: Record<string, number>
  language: 'de' | 'en'
  currentLevelId: string
}

const STORAGE_KEY = 'zahlenkoenig_progress'
const UNLOCK_THRESHOLD = 3

export interface IProgressService {
  recordResult(levelId: string, result: SolutionResult, points: number, newPointStreak: number): void
  isUnlocked(levelId: string): boolean
  getUnlockStreak(levelId: string): number
  getProgress(): StoredProgress
  setLevel(levelId: string): void
  setCustomTarget(levelId: string, target: number): void
  setLanguage(lang: 'de' | 'en'): void
  reset(): void
}

const defaultProgress = (): StoredProgress => ({
  unlockedLevels: ['A1'],
  unlockStreaks: {},
  totalScore: 0,
  pointStreak: 0,
  customTargets: {},
  language: navigator.language.startsWith('de') ? 'de' : 'en',
  currentLevelId: 'A1',
})

export class ProgressService implements IProgressService {
  constructor(private storage: IStorage) {}

  private load(): StoredProgress {
    return this.storage.load<StoredProgress>(STORAGE_KEY) ?? defaultProgress()
  }

  private save(progress: StoredProgress): void {
    this.storage.save(STORAGE_KEY, progress)
  }

  recordResult(levelId: string, result: SolutionResult, points: number, newPointStreak: number): void {
    const progress = this.load()
    progress.totalScore = Math.max(0, progress.totalScore + points)
    progress.pointStreak = newPointStreak

    // Update unlock streak: only count correct + no hints
    if (result.correct && result.hintsUsed === 0) {
      const current = progress.unlockStreaks[levelId] ?? 0
      progress.unlockStreaks[levelId] = current + 1

      // Unlock next level if threshold reached
      if (progress.unlockStreaks[levelId] >= UNLOCK_THRESHOLD) {
        this.unlockNextLevel(levelId, progress)
      }
    } else if (result.correct && result.hintsUsed > 0) {
      // Hints used: streak stays, don't reset
    }

    this.save(progress)
  }

  private unlockNextLevel(currentLevelId: string, progress: StoredProgress): void {
    const current = LEVELS.find(l => l.id === currentLevelId)
    if (!current) return
    const next = LEVELS.find(l => l.unlockIndex === current.unlockIndex + 1)
    if (next && !progress.unlockedLevels.includes(next.id)) {
      progress.unlockedLevels.push(next.id)
    }
  }

  isUnlocked(levelId: string): boolean {
    return this.load().unlockedLevels.includes(levelId)
  }

  getUnlockStreak(levelId: string): number {
    return this.load().unlockStreaks[levelId] ?? 0
  }

  getProgress(): StoredProgress {
    return this.load()
  }

  setLevel(levelId: string): void {
    const progress = this.load()
    progress.currentLevelId = levelId
    this.save(progress)
  }

  setCustomTarget(levelId: string, target: number): void {
    const progress = this.load()
    progress.customTargets[levelId] = target
    this.save(progress)
  }

  setLanguage(lang: 'de' | 'en'): void {
    const progress = this.load()
    progress.language = lang
    this.save(progress)
  }

  reset(): void {
    this.storage.clear()
  }
}
