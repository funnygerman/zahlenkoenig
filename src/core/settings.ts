// Settings + their LocalStorage persistence (concept section 11 /
// section 14's "settings.ts — LocalStorage"). What survives between
// sessions after v1's streaks/points/level-unlocks were removed wholesale
// (concept 11) — five fields, none of them a result.

import type { Operator } from './expression'
import { LANGUAGES, type Language } from './i18n'

export interface Settings {
  language: Language
  numbers: 2 | 3 | 4
  ops: Operator[] // at least two (concept 15.6, revised), always in canonical +-*/ storage order — see setOps
  /**
   * Which target-magnitude band (concept 15.5, revised by the
   * target-ranges-display round — see puzzles.ts's BandRow): 0 for every
   * selection with one band, 0–3 (M · L · XL · XXL) for the ones with four.
   */
  band: 0 | 1 | 2 | 3
  uniqueOnly: boolean
}

// Concept 15.6/17.1: "Standardvorgabe ... 3 Zahlen, alle vier Rechenzeichen, Band klein".
// `language` here is the fallback when detection (below) finds nothing
// supported — English, per the PO's own choice, not German: a player whose
// browser isn't in German, Russian or English should land in English, not
// in a language they don't read either.
export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  numbers: 3,
  ops: ['+', '-', '*', '/'],
  band: 0,
  uniqueOnly: false,
}

const STORAGE_KEY = 'zahlenkoenig:settings-v2'

function isOperator(x: unknown): x is Operator {
  return x === '+' || x === '-' || x === '*' || x === '/'
}

function isLanguage(x: unknown): x is Language {
  return (LANGUAGES as readonly unknown[]).includes(x)
}

/**
 * A first visit's own language, read from the browser rather than asked
 * for (PO decision: no language-switcher UI — concept 12.7's own reserved
 * header-left menu icon stays unbuilt, same as before). `navigator` is a
 * browser global this file already touches for `localStorage`, so reading
 * it here doesn't cross any boundary `core/` didn't already cross; it's
 * still guarded, the same as the `localStorage` calls below, since a
 * non-browser environment (this file's own `node`-environment unit tests)
 * has neither.
 */
export function detectLanguage(): Language {
  const raw = typeof navigator !== 'undefined' ? navigator.language : ''
  const prefix = raw.slice(0, 2).toLowerCase()
  return isLanguage(prefix) ? prefix : 'en'
}

/** Defends against a corrupt or hand-edited localStorage value rather than trusting `JSON.parse`'s shape blindly — the only thing a stored Settings can't guarantee on its own. */
function sanitize(candidate: Partial<Settings> | null | undefined): Settings {
  if (!candidate || typeof candidate !== 'object') return DEFAULT_SETTINGS
  const ops = Array.isArray(candidate.ops) ? candidate.ops.filter(isOperator) : DEFAULT_SETTINGS.ops
  return {
    language: isLanguage(candidate.language) ? candidate.language : DEFAULT_SETTINGS.language,
    numbers: candidate.numbers === 2 || candidate.numbers === 4 ? candidate.numbers : 3,
    // at least two — also catches a value saved before concept 15.6's revision from "at least one"
    ops: ops.length >= 2 ? ops : DEFAULT_SETTINGS.ops,
    band: candidate.band === 1 || candidate.band === 2 || candidate.band === 3 ? candidate.band : 0,
    uniqueOnly: candidate.uniqueOnly === true,
  }
}

/**
 * Falls back to DEFAULT_SETTINGS on anything that isn't a valid, parseable
 * Settings object — a private-browsing tab with localStorage disabled
 * throws on read, not just on write. A first-ever visit (nothing stored
 * yet) is the one case that isn't really a fallback: `detectLanguage()`
 * runs once here, and whatever it finds gets saved the moment `useSettings`
 * mounts (its own `useEffect` saves on every change, the initial one
 * included) — so a returning player's stored language always wins over a
 * fresh detection from here on, even if their browser's language changes
 * later.
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, language: detectLanguage() }
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage unavailable (private mode, quota, disabled) — settings
    // just don't survive a reload, which is no worse than v1 had it.
  }
}
