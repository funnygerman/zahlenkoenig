import { describe, it, expect, beforeEach } from 'vitest'
import { RECENT_LIMIT, loadRecent, saveRecent, withPuzzle } from './history'
import { puzzleSignature } from './puzzles'

const KEY = 'zahlenkoenig:recent-v1'

// core/'s tests run under `node`, where there is no localStorage — the
// module's own try/catch is written for exactly that (a private tab throws
// on read too), so the round-trip cases install a minimal stand-in rather
// than pulling in jsdom for four assignments.
class MemoryStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
}

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
})

describe('puzzleSignature', () => {
  it('is the same puzzle whatever order the numbers came out in', () => {
    expect(puzzleSignature({ numbers: [9, 3, 6, 2], target: 48 }))
      .toBe(puzzleSignature({ numbers: [2, 3, 6, 9], target: 48 }))
  })

  it('separates two puzzles with the same numbers and different targets', () => {
    expect(puzzleSignature({ numbers: [6, 2], target: 8 }))
      .not.toBe(puzzleSignature({ numbers: [6, 2], target: 12 }))
  })

  it('separates two puzzles with the same target and different numbers', () => {
    expect(puzzleSignature({ numbers: [6, 2], target: 8 }))
      .not.toBe(puzzleSignature({ numbers: [5, 3], target: 8 }))
  })
})

describe('withPuzzle', () => {
  it('appends the newest puzzle at the end', () => {
    const recent = withPuzzle([], { numbers: [6, 2], target: 8 })
    expect(recent).toEqual([puzzleSignature({ numbers: [6, 2], target: 8 })])
  })

  it('moves a puzzle already in the window to the end instead of holding two slots', () => {
    const a = { numbers: [6, 2], target: 8 }
    const b = { numbers: [5, 3], target: 15 }
    const recent = withPuzzle(withPuzzle(withPuzzle([], a), b), a)
    expect(recent).toEqual([puzzleSignature(b), puzzleSignature(a)])
  })

  it('keeps at most RECENT_LIMIT entries, dropping the oldest', () => {
    let recent: string[] = []
    for (let i = 1; i <= RECENT_LIMIT + 5; i++) recent = withPuzzle(recent, { numbers: [1, i], target: i })
    expect(recent).toHaveLength(RECENT_LIMIT)
    expect(recent[recent.length - 1]).toBe(puzzleSignature({ numbers: [1, RECENT_LIMIT + 5], target: RECENT_LIMIT + 5 }))
    expect(recent).not.toContain(puzzleSignature({ numbers: [1, 1], target: 1 }))
  })
})

describe('loadRecent / saveRecent', () => {
  it('round-trips a window', () => {
    saveRecent(['a', 'b'])
    expect(loadRecent()).toEqual(['a', 'b'])
  })

  it('is empty with nothing stored', () => {
    expect(loadRecent()).toEqual([])
  })

  it('survives a corrupt or hand-edited value', () => {
    localStorage.setItem(KEY, 'not json')
    expect(loadRecent()).toEqual([])
    localStorage.setItem(KEY, '{"numbers":[1,2]}')
    expect(loadRecent()).toEqual([])
    localStorage.setItem(KEY, '["ok", 7, null]')
    expect(loadRecent()).toEqual(['ok'])
  })

  it('survives storage being unavailable entirely', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = undefined
    expect(() => saveRecent(['a'])).not.toThrow()
    expect(loadRecent()).toEqual([])
  })
})
