import { describe, expect, it } from 'vitest'
import { decodeSharedPuzzle, encodeSharedPuzzle, readSharedPuzzle, sharedPuzzleUrl, type SharedPuzzle } from './shareLink'
import { nextPuzzle } from './puzzles'

// The puzzle the whole project uses as its worked example (concept 12.5's
// worst case), and a real solution: (6 + 2) × (9 − 3).
const WORST_CASE: SharedPuzzle = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] }

describe('encode/decode', () => {
  it('round-trips a puzzle', () => {
    expect(decodeSharedPuzzle(encodeSharedPuzzle(WORST_CASE))).toEqual(WORST_CASE)
  })

  it('round-trips every number count and every operator subset it can carry', () => {
    const cases: SharedPuzzle[] = [
      { numbers: [1, 2], target: 3, ops: ['+'] },
      // 7 × (6 − 4) — CLAUDE.md's own example board, and it needs ×.
      { numbers: [4, 6, 7], target: 14, ops: ['+', '-', '*'] },
      { numbers: [1, 1, 1, 3], target: 9, ops: ['+', '*'] },
      { numbers: [9, 9], target: 81, ops: ['*', '/'] },
    ]
    for (const puzzle of cases) expect(decodeSharedPuzzle(encodeSharedPuzzle(puzzle))).toEqual(puzzle)
  })

  it('keeps the operator set, not the receiver’s own — the whole reason ops are in the payload', () => {
    // Same board, two different trays: both must survive as sent.
    const narrow = decodeSharedPuzzle(encodeSharedPuzzle({ numbers: [6, 2], target: 8, ops: ['+'] }))
    const wide = decodeSharedPuzzle(encodeSharedPuzzle({ numbers: [6, 2], target: 8, ops: ['+', '-', '*', '/'] }))
    expect(narrow?.ops).toEqual(['+'])
    expect(wide?.ops).toEqual(['+', '-', '*', '/'])
  })

  it('builds a link in the fragment, so a shared URL is never a second crawlable page', () => {
    const url = sharedPuzzleUrl(WORST_CASE, 'https://funnygerman.github.io/zahlenkoenig/')
    expect(url).toContain('#p=')
    expect(url.split('#')[0]).toBe('https://funnygerman.github.io/zahlenkoenig/')
    expect(url).not.toContain('?')
  })
})

describe('a link that arrives damaged', () => {
  const token = encodeSharedPuzzle(WORST_CASE)

  it('refuses a hand-edited target', () => {
    // The plausible manual edit: same board, a target of one's choosing.
    const tampered = token.replace('.48.', '.50.')
    expect(tampered).not.toBe(token)
    expect(decodeSharedPuzzle(tampered)).toBeNull()
  })

  it('refuses a hand-edited number', () => {
    expect(decodeSharedPuzzle(token.replace(/^6293/, '6294'))).toBeNull()
  })

  it('refuses a truncated link', () => {
    expect(decodeSharedPuzzle(token.slice(0, -1))).toBeNull()
    expect(decodeSharedPuzzle(token.split('.').slice(0, 3).join('.'))).toBeNull()
  })

  it('refuses junk, an empty token and a missing checksum', () => {
    for (const bad of ['', '.', 'hello', '6293.48.f', 'a.b.c.d']) {
      expect(decodeSharedPuzzle(bad)).toBeNull()
    }
  })

  it('refuses numbers outside what a puzzle can hold', () => {
    // Rebuilt through the encoder so the checksum is *valid* — this pins
    // the range check itself rather than re-testing the checksum.
    for (const numbers of [[0, 5], [6], [1, 2, 3, 4, 5]]) {
      const token = encodeSharedPuzzle({ numbers, target: 6, ops: ['+'] })
      expect(decodeSharedPuzzle(token)).toBeNull()
    }
  })

  it('refuses an empty operator set', () => {
    expect(decodeSharedPuzzle(encodeSharedPuzzle({ numbers: [6, 2], target: 8, ops: [] }))).toBeNull()
  })
})

describe('a link that decodes cleanly but is not a playable board', () => {
  it('refuses an unreachable target, rather than opening a puzzle nobody can solve', () => {
    // 1 and 1 under + reach 2, never 1000. A board like this would open
    // with the dead-end border already lit (the hint round's own finding),
    // which is why this is refused at the door.
    expect(decodeSharedPuzzle(encodeSharedPuzzle({ numbers: [1, 1], target: 1000, ops: ['+'] }))).toBeNull()
  })

  it('refuses a target only a fraction reaches, exactly as the generator does', () => {
    // 9 ÷ (1 ÷ 9 ÷ 9) = 729 — concept 8's own example, refused by
    // puzzles.ts's `wholeSolution` filter and refused here for the same
    // reason: it is not a puzzle for this audience, whoever sent it.
    expect(decodeSharedPuzzle(encodeSharedPuzzle({ numbers: [9, 1, 9, 9], target: 729, ops: ['/'] }))).toBeNull()
  })

  it('accepts every puzzle the generator itself draws', () => {
    // The instrument's known-good case: whatever nextPuzzle produces must
    // survive a round trip, or sharing would refuse real boards.
    for (const numbers of [2, 3, 4] as const) {
      for (let i = 0; i < 15; i++) {
        const puzzle = nextPuzzle({ numbers, ops: ['+', '-', '*', '/'], band: 0, uniqueOnly: false }, [], [])
        const shared = { numbers: puzzle.numbers, target: puzzle.target, ops: ['+', '-', '*', '/'] as const }
        expect(decodeSharedPuzzle(encodeSharedPuzzle({ ...shared, ops: [...shared.ops] }))).toEqual({ ...shared, ops: [...shared.ops] })
      }
    }
  })
})

describe('readSharedPuzzle', () => {
  it('reads the puzzle out of a real hash', () => {
    const url = sharedPuzzleUrl(WORST_CASE, 'https://example.com/zahlenkoenig/')
    expect(readSharedPuzzle(`#${url.split('#')[1]}`)).toEqual(WORST_CASE)
  })

  it('is null for an empty hash, an unrelated hash and a damaged one', () => {
    expect(readSharedPuzzle('')).toBeNull()
    expect(readSharedPuzzle('#')).toBeNull()
    expect(readSharedPuzzle('#section')).toBeNull()
    expect(readSharedPuzzle('#q=6293.48.f.abc')).toBeNull()
    expect(readSharedPuzzle('#p=nonsense')).toBeNull()
  })
})
