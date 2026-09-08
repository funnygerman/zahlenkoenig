// The last few puzzles the player was actually shown, persisted like the
// settings are (concept section 11's LocalStorage, one key per concern).
// Its whole job is to answer "have I just seen this one?" for
// puzzles.ts's draw loop.
//
// Why this exists at all: the generator draws numbers at random and picks
// a target among the ones that land in the selected band (concept 15.10),
// with nothing remembering what came before — so an immediate repeat is
// not a bug in the draw, it is the birthday problem. The thin selections
// make it visible: two numbers with a narrow band have only a handful of
// (numbers, target) pairs in the whole search space, and a memoryless
// sampler hands the same one out twice in a row at a rate of one in that
// handful. Remembering the last few and asking for something else is the
// smallest fix that addresses the cause; puzzles.ts stays free to ignore
// the list when a selection genuinely has nothing else to offer.

import { puzzleSignature, type Puzzle } from './puzzles'

const STORAGE_KEY = 'zahlenkoenig:recent-v1'

/**
 * How many puzzles back the generator is asked to avoid. Deliberately
 * generous rather than tuned per selection: `nextPuzzle` relaxes on its
 * own when a selection's pool is smaller than this (see its own note), so
 * a window too long costs a few extra draws, never a failure — while a
 * window too short is exactly the bug being fixed.
 */
export const RECENT_LIMIT = 30

/** Oldest first, newest last. Falls back to an empty history on anything unreadable — same rule as loadSettings. */
export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(-RECENT_LIMIT)
  } catch {
    return []
  }
}

export function saveRecent(recent: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(-RECENT_LIMIT)))
  } catch {
    // Same as saveSettings: without storage the history just doesn't
    // survive a reload, which is no worse than having none at all.
  }
}

/** The history with this puzzle appended, trimmed to the window, and with an older sighting of the same puzzle dropped so one repeat can't hold a slot twice. */
export function withPuzzle(recent: readonly string[], puzzle: Puzzle): string[] {
  const signature = puzzleSignature(puzzle)
  return [...recent.filter(s => s !== signature), signature].slice(-RECENT_LIMIT)
}
