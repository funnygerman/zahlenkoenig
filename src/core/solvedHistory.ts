// The player's own solved-puzzle archive (footer/history round). Unlike
// history.ts's recent-puzzle window — which exists purely so the generator
// can avoid repeats, and holds only a signature string — this keeps enough
// of each solved puzzle to actually replay it: Board.tsx takes numbers,
// target and ops as plain props and doesn't care whether they came from a
// fresh draw or an old one, so storing those three is all a replay needs.
//
// `ops` matters here specifically because Game.tsx otherwise feeds Board
// the *live* `settings.ops` — which can differ from what was enabled when
// an older puzzle was solved (the player may have changed operators since).
// Replaying with today's ops could show a tray that doesn't match the
// puzzle's own solution, so each entry carries its own.

import type { Operator } from './expression'

const STORAGE_KEY = 'zahlenkoenig:solved-v1'

/** Same order of magnitude as history.ts's own windows (30/12) — enough to browse back through a session, not an unbounded log. */
export const SOLVED_LIMIT = 20

export interface SolvedPuzzle {
  numbers: number[]
  target: number
  ops: Operator[]
}

const VALID_OPS: readonly Operator[] = ['+', '-', '*', '/']

function isSolvedPuzzle(x: unknown): x is SolvedPuzzle {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  return (
    Array.isArray(p.numbers) && p.numbers.every(n => typeof n === 'number') &&
    typeof p.target === 'number' &&
    Array.isArray(p.ops) && p.ops.length > 0 && p.ops.every(o => VALID_OPS.includes(o as Operator))
  )
}

/** Oldest first, newest last. Same fallback rule as history.ts's loadRecent: anything unreadable just comes back empty. */
export function loadSolved(): SolvedPuzzle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSolvedPuzzle).slice(-SOLVED_LIMIT)
  } catch {
    return []
  }
}

export function saveSolved(solved: readonly SolvedPuzzle[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solved.slice(-SOLVED_LIMIT)))
  } catch {
    // Same as history.ts's saveRecent: without storage the archive just
    // doesn't survive a reload, no worse than having none at all.
  }
}

/**
 * The archive with this puzzle appended and trimmed to the window. Every
 * solve gets its own entry, even a replay of one already in the list —
 * this is a log of what was played and solved, not a deduplicated set the
 * way history.ts's own window is (that one exists only to answer "have I
 * just seen this", which is a different question from "what have I
 * solved").
 */
export function withSolved(solved: readonly SolvedPuzzle[], puzzle: SolvedPuzzle): SolvedPuzzle[] {
  return [...solved, puzzle].slice(-SOLVED_LIMIT)
}
