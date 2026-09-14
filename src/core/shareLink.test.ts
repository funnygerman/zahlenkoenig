import { describe, expect, it } from 'vitest'
import { decodeSharedPuzzle, encodeSharedPuzzle, readSharedPuzzle, sharedPuzzleUrl, type SharedPuzzle } from './shareLink'
import { nextPuzzle } from './puzzles'

// The puzzle the whole project uses as its worked example (concept 12.5's
// worst case), and a real solution: (6 + 2) × (9 − 3).
const WORST_CASE: SharedPuzzle = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] }

/** Encode, insisting the puzzle is one the format can carry — every puzzle in this file is. */
const encode = (p: SharedPuzzle): string => {
  const token = encodeSharedPuzzle(p)
  expect(token).not.toBeNull()
  return token!
}

describe('encode/decode', () => {
  it('round-trips a puzzle', () => {
    expect(decodeSharedPuzzle(encode(WORST_CASE))).toEqual(WORST_CASE)
  })

  it('round-trips every number count and every operator subset it can carry', () => {
    const cases: SharedPuzzle[] = [
      { numbers: [1, 2], target: 3, ops: ['+'] },
      // 7 × (6 − 4) — CLAUDE.md's own example board, and it needs ×.
      { numbers: [4, 6, 7], target: 14, ops: ['+', '-', '*'] },
      { numbers: [1, 1, 1, 3], target: 9, ops: ['+', '*'] },
      { numbers: [9, 9], target: 81, ops: ['*', '/'] },
      // The largest target three 9s reach, and a four-number board near the
      // solver's own ceiling — `solver.ts` caps every target at 999
      // (concept 15.5), so there is no puzzle above that to carry.
      { numbers: [9, 9, 9], target: 729, ops: ['*'] },
      { numbers: [9, 9, 9, 9], target: 738, ops: ['+', '*'] },
    ]
    for (const puzzle of cases) expect(decodeSharedPuzzle(encode(puzzle))).toEqual(puzzle)
  })

  it('keeps the operator set, not the receiver’s own — the whole reason ops are in the payload', () => {
    const narrow = decodeSharedPuzzle(encode({ numbers: [6, 2], target: 8, ops: ['+'] }))
    const wide = decodeSharedPuzzle(encode({ numbers: [6, 2], target: 8, ops: ['+', '-', '*', '/'] }))
    expect(narrow?.ops).toEqual(['+'])
    expect(wide?.ops).toEqual(['+', '-', '*', '/'])
  })

  it('preserves the order the numbers were sent in', () => {
    // Not sorted anywhere: the tray should read as the sender saw it.
    expect(decodeSharedPuzzle(encode({ numbers: [9, 1, 4, 2], target: 16, ops: ['+', '*'] }))?.numbers)
      .toEqual([9, 1, 4, 2])
  })

  it('builds a link in the fragment, so a shared URL is never a second crawlable page', () => {
    const url = sharedPuzzleUrl(WORST_CASE, 'https://funnygerman.github.io/zahlenkoenig/')!
    expect(url).toContain('#p=')
    expect(url.split('#')[0]).toBe('https://funnygerman.github.io/zahlenkoenig/')
    expect(url).not.toContain('?')
  })
})

describe('the token itself (PO: one opaque value, nothing readable)', () => {
  const token = encode(WORST_CASE)

  it('is one short base36 word', () => {
    expect(token).toMatch(/^[0-9a-z]{1,11}$/)
  })

  it('shows none of the puzzle in plain sight', () => {
    // The old format was `6293.48.f.x7q`. Nothing like it should survive.
    expect(token).not.toContain('.')
    expect(token).not.toContain('6293')
    expect(token).not.toContain('48')
  })

  it('gives two puzzles one chip apart two completely different tokens', () => {
    // What the mixing step buys: without it, neighbouring puzzles share a
    // long prefix and the format leaks its own structure by inspection.
    const a = encode({ numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] })
    const b = encode({ numbers: [6, 2, 9, 3], target: 49, ops: ['+', '-', '*', '/'] })
    expect(a).not.toBe(b)
    let shared = 0
    while (shared < Math.min(a.length, b.length) && a[shared] === b[shared]) shared++
    expect(shared).toBeLessThanOrEqual(2)
  })

  it('reads a token back whatever case it arrives in', () => {
    expect(decodeSharedPuzzle(token.toUpperCase())).toEqual(WORST_CASE)
  })

  it('carries any target the solver can produce, with room above it', () => {
    // 999 is solver.ts's own ceiling (concept 15.5). The format must encode it
    // even though no two-number board reaches it — decode refuses this link as
    // unsolvable, which is a different check from whether it fits.
    expect(encodeSharedPuzzle({ numbers: [1, 2], target: 999, ops: ['+'] })).not.toBeNull()
    expect(encodeSharedPuzzle({ numbers: [1, 2], target: 16383, ops: ['+'] })).not.toBeNull()
  })

  it('refuses a puzzle the format cannot carry, rather than truncating it into another one', () => {
    expect(encodeSharedPuzzle({ numbers: [6], target: 6, ops: ['+'] })).toBeNull()
    expect(encodeSharedPuzzle({ numbers: [1, 2, 3, 4, 5], target: 15, ops: ['+'] })).toBeNull()
    expect(encodeSharedPuzzle({ numbers: [1, 2], target: 16384, ops: ['+'] })).toBeNull()
    expect(encodeSharedPuzzle({ numbers: [0, 2], target: 2, ops: ['+'] })).toBeNull()
    expect(encodeSharedPuzzle({ numbers: [1, 2], target: 3, ops: [] })).toBeNull()
  })
})

describe('a link that arrives damaged', () => {
  const token = encode(WORST_CASE)

  it('refuses every single-character edit of a real token', () => {
    // The whole point of the checksum, and much sharper than one hand-picked
    // tamper case: every neighbour of a valid token must be refused.
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
    let checked = 0
    for (let i = 0; i < token.length; i++) {
      for (const ch of alphabet) {
        if (ch === token[i]) continue
        const edited = token.slice(0, i) + ch + token.slice(i + 1)
        expect(decodeSharedPuzzle(edited)).toBeNull()
        checked++
      }
    }
    expect(checked).toBeGreaterThan(300)
  })

  it('refuses a truncated or extended link', () => {
    expect(decodeSharedPuzzle(token.slice(0, -1))).toBeNull()
    expect(decodeSharedPuzzle(token.slice(1))).toBeNull()
    expect(decodeSharedPuzzle(token + 'a')).toBeNull()
  })

  it('refuses junk, an empty token and anything outside base36', () => {
    for (const bad of ['', '.', '!!', 'hello world', '-1', 'zzzzzzzzzzzzzzzzzz']) {
      expect(decodeSharedPuzzle(bad)).toBeNull()
    }
  })
})

describe('a link that decodes cleanly but is not a playable board', () => {
  it('refuses an unreachable target, rather than opening a puzzle nobody can solve', () => {
    // 1 and 1 under + reach 2, never 1000. A board like this would open with
    // the dead-end border already lit (the hint round's own finding), which
    // is why it is refused at the door.
    expect(decodeSharedPuzzle(encode({ numbers: [1, 1], target: 1000, ops: ['+'] }))).toBeNull()
  })

  it('refuses a target only a fraction reaches, exactly as the generator does', () => {
    // 9 ÷ (1 ÷ 9 ÷ 9) = 729 — concept 8's own example, refused by puzzles.ts's
    // `wholeSolution` filter and refused here for the same reason.
    expect(decodeSharedPuzzle(encode({ numbers: [9, 1, 9, 9], target: 729, ops: ['/'] }))).toBeNull()
  })

  it('accepts every puzzle the generator itself draws', () => {
    // The instrument's known-good case: whatever nextPuzzle produces must
    // survive a round trip, or sharing would refuse real boards.
    const ops = ['+', '-', '*', '/'] as const
    for (const numbers of [2, 3, 4] as const) {
      for (let i = 0; i < 15; i++) {
        const puzzle = nextPuzzle({ numbers, ops: [...ops], band: 0, uniqueOnly: false }, [], [])
        const shared: SharedPuzzle = { numbers: puzzle.numbers, target: puzzle.target, ops: [...ops] }
        expect(decodeSharedPuzzle(encode(shared))).toEqual(shared)
      }
    }
  })
})

describe('readSharedPuzzle', () => {
  it('reads the puzzle out of a real hash', () => {
    const url = sharedPuzzleUrl(WORST_CASE, 'https://example.com/zahlenkoenig/')!
    expect(readSharedPuzzle(`#${url.split('#')[1]}`)).toEqual(WORST_CASE)
  })

  it('is null for an empty hash, an unrelated hash and a damaged one', () => {
    expect(readSharedPuzzle('')).toBeNull()
    expect(readSharedPuzzle('#')).toBeNull()
    expect(readSharedPuzzle('#section')).toBeNull()
    expect(readSharedPuzzle(`#q=${encode(WORST_CASE)}`)).toBeNull()
    expect(readSharedPuzzle('#p=nonsense')).toBeNull()
  })
})

describe('the mixing step is a bijection, not a hash', () => {
  it('round-trips every puzzle of a large exhaustive slice', () => {
    // Every two-number board with a reachable target, all four operators:
    // if the packing, the mixing or its inverse were wrong anywhere in the
    // range, this finds it rather than trusting one worked example.
    let checked = 0
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        for (const target of [a + b, a * b]) {
          const puzzle: SharedPuzzle = { numbers: [a, b], target, ops: ['+', '-', '*', '/'] }
          expect(decodeSharedPuzzle(encode(puzzle))).toEqual(puzzle)
          checked++
        }
      }
    }
    expect(checked).toBe(162)
  })
})
