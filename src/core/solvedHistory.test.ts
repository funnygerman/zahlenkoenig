import { describe, it, expect, beforeEach } from 'vitest'
import { SOLVED_LIMIT, loadSolved, saveSolved, withSolved, type SolvedPuzzle } from './solvedHistory'

const KEY = 'zahlenkoenig:solved-v1'

// Same stand-in history.test.ts uses: core/'s tests run under `node`,
// which has no localStorage, and the module's own try/catch is written
// for exactly that (a private tab throws on read too).
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

const A: SolvedPuzzle = { numbers: [6, 2], target: 8, ops: ['+', '-'] }
const B: SolvedPuzzle = { numbers: [5, 3], target: 15, ops: ['*'] }

describe('withSolved', () => {
  it('appends the newest solve at the end', () => {
    expect(withSolved([], A)).toEqual([A])
  })

  it('keeps a repeat of the same puzzle as its own entry rather than deduplicating', () => {
    // Unlike history.ts's withPuzzle (which moves a repeat to the end
    // instead of holding two slots), this is a log of what was actually
    // solved, so solving the same puzzle twice is two entries.
    expect(withSolved(withSolved([], A), A)).toEqual([A, A])
  })

  it('keeps at most SOLVED_LIMIT entries, dropping the oldest', () => {
    let solved: SolvedPuzzle[] = []
    for (let i = 1; i <= SOLVED_LIMIT + 5; i++) {
      solved = withSolved(solved, { numbers: [1, i], target: i, ops: ['+'] })
    }
    expect(solved).toHaveLength(SOLVED_LIMIT)
    expect(solved[solved.length - 1]).toEqual({ numbers: [1, SOLVED_LIMIT + 5], target: SOLVED_LIMIT + 5, ops: ['+'] })
    expect(solved[0]).toEqual({ numbers: [1, 6], target: 6, ops: ['+'] })
  })
})

describe('loadSolved / saveSolved', () => {
  it('round-trips an archive', () => {
    saveSolved([A, B])
    expect(loadSolved()).toEqual([A, B])
  })

  it('is empty with nothing stored', () => {
    expect(loadSolved()).toEqual([])
  })

  it('survives a corrupt or hand-edited value', () => {
    localStorage.setItem(KEY, 'not json')
    expect(loadSolved()).toEqual([])
    localStorage.setItem(KEY, '{"numbers":[1,2]}')
    expect(loadSolved()).toEqual([])
    // structurally wrong entries (missing ops, an invalid operator, a
    // non-numeric number) are dropped one at a time rather than voiding
    // the whole archive
    localStorage.setItem(KEY, JSON.stringify([A, { numbers: [1, 2], target: 3 }, { ...B, ops: ['%'] }, 'nope']))
    expect(loadSolved()).toEqual([A])
  })

  it('survives storage being unavailable entirely', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = undefined
    expect(() => saveSolved([A])).not.toThrow()
    expect(loadSolved()).toEqual([])
  })
})
