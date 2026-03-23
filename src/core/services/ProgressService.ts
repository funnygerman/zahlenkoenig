import { SolutionResult } from './PuzzleValidator'
import { IStorage } from '../storage/IStorage'
import { LEVELS } from '../models/Level'

export interface StoredProgress {
  unlockStreaks: Record<string, number>
  pointStreak: number
  language: 'de' | 'en'
  currentLevelId: string
}

const STORAGE_KEY = 'zahlenkoenig_progress'
const UNLOCK_THRESHOLD = 3
const GIVE_UP_SIGNAL = 99
const ALL_LEVEL_IDS = LEVELS.map(l => l.id)

const defaultProgress = (): StoredProgress => ({
  unlockStreaks: {},
  pointStreak: 0,
  language: navigator.language.startsWith('de') ? 'de' : 'en',
  currentLevelId: 'F2.1',
})

export class ProgressService {
  constructor(private storage: IStorage) {}

  private load(): StoredProgress {
    const stored = this.storage.load<StoredProgress>(STORAGE_KEY)
    if (!stored) return defaultProgress()
    // Migrate: invalid levelId → F2.1
    if (!stored.currentLevelId || !ALL_LEVEL_IDS.includes(stored.currentLevelId)) {
      stored.currentLevelId = 'F2.1'
      this.storage.save(STORAGE_KEY, stored)
    }
    return stored
  }

  private save(p: StoredProgress): void { this.storage.save(STORAGE_KEY, p) }

  recordResult(levelId: string, result: SolutionResult, newPointStreak: number): void {
    const p = this.load()
    p.pointStreak = newPointStreak
    const isGiveUp = result.hintsUsed === GIVE_UP_SIGNAL
    if (isGiveUp) {
      p.unlockStreaks[levelId] = 0
      p.pointStreak = 0
    } else if (result.correct && result.hintsUsed === 0) {
      const cur = p.unlockStreaks[levelId] ?? 0
      p.unlockStreaks[levelId] = Math.min(cur + 1, UNLOCK_THRESHOLD)
    }
    this.save(p)
  }

  getProgress(): StoredProgress { return this.load() }
  setLevel(id: string): void { const p=this.load(); p.currentLevelId=id; this.save(p) }
  setLanguage(lang: 'de'|'en'): void { const p=this.load(); p.language=lang; this.save(p) }
  reset(): void { this.storage.clear() }
}
