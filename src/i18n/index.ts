import { de, Translations } from './de'
import { en } from './en'

const translations: Record<string, Translations> = { de, en }
export type Language = 'de' | 'en'

let currentLanguage: Language = navigator.language.startsWith('de') ? 'de' : 'en'
const listeners = new Set<() => void>()

export function setLanguage(lang: Language): void {
  currentLanguage = lang
  listeners.forEach(fn => fn())
}

export function getLanguage(): Language { return currentLanguage }

export function subscribeToLanguage(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return path
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : path
}

export function t(key: string, params?: Record<string, unknown>): string {
  const lang = translations[currentLanguage] ?? translations['de']
  let text = getNestedValue(lang as unknown as Record<string, unknown>, key)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{{${k}}}`, String(v))
    }
  }
  return text
}
