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

// All levels always available
const ALL_LEVEL_IDS = LEVELS.map(l => l.id)

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
  unlockedLevels: ALL_LEVEL_IDS, // All levels unlocked from the start
  unlockStreaks: {},
  totalScore: 0,
  pointStreak: 0,
  customTargets: {},
  language: navigator.language.startsWith('de') ? 'de' : 'en',
  currentLevelId: 'F2', // Default level
})

export class ProgressService implements IProgressService {
  constructor(private storage: IStorage) {}

  private load(): StoredProgress {
    const stored = this.storage.load<StoredProgress>(STORAGE_KEY)
    if (!stored) return defaultProgress()
    // Always ensure all levels are unlocked (even for existing saved data)
    stored.unlockedLevels = ALL_LEVEL_IDS
    // Migrate: if stored level is a beginner level, reset to F2
    const beginnerIds = ['A1', 'A2', 'A3', 'A4']
    if (!stored.currentLevelId || beginnerIds.includes(stored.currentLevelId)) {
      stored.currentLevelId = 'F2'
      this.storage.save(STORAGE_KEY, stored)
    }
    return stored
  }

  private save(progress: StoredProgress): void {
    this.storage.save(STORAGE_KEY, progress)
  }

  recordResult(levelId: string, result: SolutionResult, points: number, newPointStreak: number): void {
    const progress = this.load()
    progress.totalScore = Math.max(0, progress.totalScore + points)
    progress.pointStreak = newPointStreak

    // Track unlock streak for progress display (no longer gates access)
    if (result.correct && result.hintsUsed === 0) {
      const current = progress.unlockStreaks[levelId] ?? 0
      progress.unlockStreaks[levelId] = Math.min(current + 1, UNLOCK_THRESHOLD)
    }

    this.save(progress)
  }

  isUnlocked(_levelId: string): boolean {
    return true // All levels always unlocked
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
