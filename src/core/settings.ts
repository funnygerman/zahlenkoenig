// Settings + their LocalStorage persistence (concept section 11 /
// section 14's "settings.ts — LocalStorage"). What survives between
// sessions after v1's streaks/points/level-unlocks were removed wholesale
// (concept 11) — five fields, none of them a result.

import type { Operator } from './expression'

export interface Settings {
  language: 'de' | 'en'
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
export const DEFAULT_SETTINGS: Settings = {
  language: 'de',
  numbers: 3,
  ops: ['+', '-', '*', '/'],
  band: 0,
  uniqueOnly: false,
}

const STORAGE_KEY = 'zahlenkoenig:settings-v2'

function isOperator(x: unknown): x is Operator {
  return x === '+' || x === '-' || x === '*' || x === '/'
}

/** Defends against a corrupt or hand-edited localStorage value rather than trusting `JSON.parse`'s shape blindly — the only thing a stored Settings can't guarantee on its own. */
function sanitize(candidate: Partial<Settings> | null | undefined): Settings {
  if (!candidate || typeof candidate !== 'object') return DEFAULT_SETTINGS
  const ops = Array.isArray(candidate.ops) ? candidate.ops.filter(isOperator) : DEFAULT_SETTINGS.ops
  return {
    language: candidate.language === 'en' ? 'en' : 'de',
    numbers: candidate.numbers === 2 || candidate.numbers === 4 ? candidate.numbers : 3,
    // at least two — also catches a value saved before concept 15.6's revision from "at least one"
    ops: ops.length >= 2 ? ops : DEFAULT_SETTINGS.ops,
    band: candidate.band === 1 || candidate.band === 2 || candidate.band === 3 ? candidate.band : 0,
    uniqueOnly: candidate.uniqueOnly === true,
  }
}

/** Falls back to DEFAULT_SETTINGS on anything that isn't a valid, parseable Settings object — a private-browsing tab with localStorage disabled throws on read, not just on write. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
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
