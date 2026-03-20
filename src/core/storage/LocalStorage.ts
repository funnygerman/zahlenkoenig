import { IStorage } from './IStorage'

export class LocalStorage implements IStorage {
  save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      console.warn('LocalStorage save failed:', key)
    }
  }

  load<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : null
    } catch {
      return null
    }
  }

  clear(): void {
    localStorage.clear()
  }
}
