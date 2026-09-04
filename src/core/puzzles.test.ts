import { describe, it, expect } from 'vitest'
import { nextPuzzle, uniqueOnlyAvailable, type Operator, type PuzzleSettings } from './puzzles'

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

function opSubsets(): Operator[][] {
  const out: Operator[][] = []
  for (let mask = 1; mask < 16; mask++) out.push(ALL_OPS.filter((_, i) => mask & (1 << i)))
  return out
}

const NUMBER_COUNTS: PuzzleSettings['numbers'][] = [2, 3, 4]
const BANDS: PuzzleSettings['band'][] = [0, 1, 2]

// A handful of rows from the 45-row table (concept 15.8/15.10), transcribed
// by hand from the concept doc / checkNextPuzzle.mjs output, independent of
// puzzles.ts's own BAND_TABLE — a wrong table entry inside puzzles.ts would
// still make these fail even though it agrees with itself.
const KNOWN_BANDS: { numbers: PuzzleSettings['numbers']; ops: Operator[]; bands: [[number, number], [number, number], [number, number]] }[] = [
  { numbers: 2, ops: ['+'], bands: [[2, 8], [8, 12], [12, 18]] },
  { numbers: 4, ops: ['+', '-', '*', '/'], bands: [[1, 26], [26, 73], [73, 980]] },
  { numbers: 4, ops: ['-'], bands: [[1, 5], [5, 10], [11, 26]] },
  { numbers: 4, ops: ['/'], bands: [[1, 12], [12, 42], [42, 729]] },
  { numbers: 3, ops: ['/'], bands: [[1, 5], [5, 10], [12, 81]] },
]

describe('nextPuzzle — structural validity', () => {
  for (const numbers of NUMBER_COUNTS) {
    for (const ops of opSubsets()) {
      for (const band of BANDS) {
        const uniqueOptions = uniqueOnlyAvailable(numbers, ops) ? [false, true] : [false]
        for (const uniqueOnly of uniqueOptions) {
          it(`${numbers} numbers, ops "${ops.join('')}", band ${band}${uniqueOnly ? ', uniqueOnly' : ''}`, () => {
            for (let i = 0; i < 10; i++) {
              const puzzle = nextPuzzle({ numbers, ops, band, uniqueOnly })
              expect(puzzle.numbers).toHaveLength(numbers)
              for (const n of puzzle.numbers) {
                expect(Number.isInteger(n)).toBe(true)
                expect(n).toBeGreaterThanOrEqual(1)
                expect(n).toBeLessThanOrEqual(9)
              }
              expect(Number.isInteger(puzzle.target)).toBe(true)
              expect(puzzle.target).toBeGreaterThanOrEqual(1)
              expect(puzzle.target).toBeLessThanOrEqual(999)
            }
          })
        }
      }
    }
  }
})

describe('nextPuzzle — target lands in the requested band', () => {
  for (const { numbers, ops, bands } of KNOWN_BANDS) {
    bands.forEach(([lo, hi], band) => {
      it(`${numbers} numbers, ops "${ops.join('')}", band ${band} → target in [${lo},${hi}]`, () => {
        for (let i = 0; i < 15; i++) {
          const puzzle = nextPuzzle({ numbers, ops, band: band as 0 | 1 | 2, uniqueOnly: false })
          expect(puzzle.target).toBeGreaterThanOrEqual(lo)
          expect(puzzle.target).toBeLessThanOrEqual(hi)
        }
      })
    })
  }
})

describe('uniqueOnlyAvailable', () => {
  it('is false where the 45-row table has no unique solutions (concept 15.6)', () => {
    // 4 numbers, only '+': every reachable target has multiple solutions
    // (sums commute freely with four numbers) — the switch should disable
    // itself here.
    expect(uniqueOnlyAvailable(4, ['+'])).toBe(false)
    expect(uniqueOnlyAvailable(3, ['*'])).toBe(false)
  })

  it('is true where unique puzzles exist', () => {
    expect(uniqueOnlyAvailable(2, ['+'])).toBe(true)
    expect(uniqueOnlyAvailable(4, ['+', '-', '*', '/'])).toBe(true)
    expect(uniqueOnlyAvailable(4, ['-'])).toBe(true)
    expect(uniqueOnlyAvailable(4, ['/'])).toBe(true)
  })
})

describe('the two exception-list selections (concept 15.11)', () => {
  // Both lists collapse to one closed form each — every entry is [a,b,b,b]
  // (three equal numbers, one different), because that's the only shape a
  // single non-commutative operator can force into a unique solution.
  // Checking the formula independently (rather than re-reading the same
  // hardcoded list nextPuzzle drew from) is the actual test: it fails if
  // the exception list or the filtering around it is wrong, not just if it
  // disagrees with itself.

  it('4 numbers, only "-": returns [a,b,b,b] with target = 3b-a', () => {
    for (let i = 0; i < 50; i++) {
      const band = [0, 1, 2][i % 3] as 0 | 1 | 2
      const puzzle = nextPuzzle({ numbers: 4, ops: ['-'], band, uniqueOnly: true })
      const counts = new Map<number, number>()
      for (const n of puzzle.numbers) counts.set(n, (counts.get(n) ?? 0) + 1)
      const entries = [...counts.entries()]
      expect([1, 2]).toContain(entries.length) // one value (aaaa) or two ([a,b,b,b])
      const [b, bCount] = entries.length === 1 ? [entries[0][0], 4] : entries.sort((x, y) => y[1] - x[1])[0]
      expect(bCount).toBe(entries.length === 1 ? 4 : 3)
      const a = entries.length === 1 ? b : entries.find(([v]) => v !== b)![0]
      expect(puzzle.target).toBe(3 * b - a)
    }
  })

  it('4 numbers, only "/": returns [a,b,b,b] with target = b^3/a', () => {
    for (let i = 0; i < 50; i++) {
      const band = [0, 1, 2][i % 3] as 0 | 1 | 2
      const puzzle = nextPuzzle({ numbers: 4, ops: ['/'], band, uniqueOnly: true })
      const counts = new Map<number, number>()
      for (const n of puzzle.numbers) counts.set(n, (counts.get(n) ?? 0) + 1)
      const entries = [...counts.entries()]
      expect([1, 2]).toContain(entries.length)
      const [b, bCount] = entries.length === 1 ? [entries[0][0], 4] : entries.sort((x, y) => y[1] - x[1])[0]
      expect(bCount).toBe(entries.length === 1 ? 4 : 3)
      const a = entries.length === 1 ? b : entries.find(([v]) => v !== b)![0]
      expect(puzzle.target).toBe(b ** 3 / a)
    }
  })
})

describe('single-operator arithmetic sanity (2 numbers)', () => {
  it('"+": numbers sum to the target', () => {
    for (let i = 0; i < 20; i++) {
      const p = nextPuzzle({ numbers: 2, ops: ['+'], band: (i % 3) as 0 | 1 | 2, uniqueOnly: false })
      expect(p.numbers[0] + p.numbers[1]).toBe(p.target)
    }
  })

  it('"*": numbers multiply to the target', () => {
    for (let i = 0; i < 20; i++) {
      const p = nextPuzzle({ numbers: 2, ops: ['*'], band: (i % 3) as 0 | 1 | 2, uniqueOnly: false })
      expect(p.numbers[0] * p.numbers[1]).toBe(p.target)
    }
  })

  it('"-": target is the (non-negative) difference, larger minus smaller', () => {
    for (let i = 0; i < 20; i++) {
      const p = nextPuzzle({ numbers: 2, ops: ['-'], band: (i % 3) as 0 | 1 | 2, uniqueOnly: false })
      const [x, y] = p.numbers
      expect(p.target).toBe(Math.abs(x - y))
    }
  })

  it('"/": target is one number divided by the other, evenly', () => {
    for (let i = 0; i < 20; i++) {
      const p = nextPuzzle({ numbers: 2, ops: ['/'], band: (i % 3) as 0 | 1 | 2, uniqueOnly: false })
      const [x, y] = p.numbers
      const viaXY = x / y, viaYX = y / x
      expect(Number.isInteger(viaXY) && viaXY === p.target || Number.isInteger(viaYX) && viaYX === p.target).toBe(true)
    }
  })
})

describe('nextPuzzle — throws on a selection with no band data', () => {
  it('rejects an empty operator list rather than looping forever', () => {
    expect(() => nextPuzzle({ numbers: 4, ops: [], band: 0, uniqueOnly: false })).toThrow()
  })
})
