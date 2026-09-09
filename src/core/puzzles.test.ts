import { describe, it, expect } from 'vitest'
import { bandRanges, nextPuzzle, puzzleSignature, uniqueOnlyAvailable, type Operator, type Puzzle, type PuzzleSettings } from './puzzles'
import { reachable } from './solver'

/** Every multiset of three digits 1..9 — the whole three-number search space. */
function multisetsOfThree(): number[][] {
  const out: number[][] = []
  for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) out.push([a, b, c])
  return out
}

const ALL_OPS: Operator[] = ['+', '-', '*', '/']

function opSubsets(): Operator[][] {
  const out: Operator[][] = []
  for (let mask = 1; mask < 16; mask++) out.push(ALL_OPS.filter((_, i) => mask & (1 << i)))
  return out
}

const NUMBER_COUNTS: PuzzleSettings['numbers'][] = [2, 3, 4]
const BANDS: PuzzleSettings['band'][] = [0, 1, 2]

// A handful of rows from the table, transcribed by hand from
// generateBandTable.ts's output rather than read back out of puzzles.ts —
// a wrong table entry inside puzzles.ts would still make these fail even
// though it agrees with itself.
//
// The ÷ rows shrank hard when the whole-number rule came in: `4 Zahlen, nur
// ÷` went from 922 puzzles reaching 729 to 218 reaching 9, because almost
// every large ÷ target is only reachable by dividing by a fraction.
const KNOWN_BANDS: { numbers: PuzzleSettings['numbers']; ops: Operator[]; bands: [number, number][] }[] = [
  { numbers: 2, ops: ['+'], bands: [[2, 8], [9, 12], [13, 18]] },
  { numbers: 4, ops: ['+', '-', '*', '/'], bands: [[1, 15], [16, 40], [41, 980]] },
  { numbers: 4, ops: ['-'], bands: [[1, 5], [6, 10], [11, 26]] },
  { numbers: 4, ops: ['/'], bands: [[1, 2], [3, 4], [5, 9]] },
  { numbers: 3, ops: ['/'], bands: [[1, 2], [3, 5], [6, 9]] },
  // One band, not three: with two single digits a − b ≤ 8 and a ÷ b ≤ 9,
  // so any third band starts above everything − and ÷ can reach.
  { numbers: 2, ops: ['+', '-', '*', '/'], bands: [[1, 81]] },
]

describe('nextPuzzle — structural validity', () => {
  for (const numbers of NUMBER_COUNTS) {
    for (const ops of opSubsets()) {
      for (const band of BANDS) {
        // Band-aware: a selection can have unique-solution puzzles overall
        // and none in this band (`3 Zahlen, +÷, groß`).
        const uniqueOptions = uniqueOnlyAvailable(numbers, ops, band) ? [false, true] : [false]
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
  })

  it('is false for 4 numbers with only ÷ — every unique one was fractional', () => {
    // 9 ÷ (1 ÷ 9 ÷ 9) = 729 is the shape of all of them, and the
    // whole-number rule refuses it, so the switch turns itself off.
    expect(uniqueOnlyAvailable(4, ['/'])).toBe(false)
  })

  it('answers per band, not only per selection', () => {
    // 3 Zahlen, +÷ has 74 unique-solution puzzles and not one of them in
    // groß. Leaving the switch on there made nextPuzzle exhaust its
    // attempts and throw — a blank screen, one level in from the case
    // reconcile() already guarded.
    expect(uniqueOnlyAvailable(3, ['+', '/'])).toBe(true)
    expect(uniqueOnlyAvailable(3, ['+', '/'], 0)).toBe(true)
    expect(uniqueOnlyAvailable(3, ['+', '/'], 2)).toBe(false)
  })
})

describe('the exception-list selections (concept 15.11)', () => {
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

  it('4 numbers, only "/": has no list any more, and no uniqueOnly either', () => {
    // Every entry of the old list — [a,b,b,b] with target b³/a — reaches its
    // target by dividing by a fraction: 9 ÷ (1 ÷ 9 ÷ 9) = 729. Under the
    // whole-number rule the generated list came back empty, so the table's
    // `unique: 0` turns the switch off and nothing asks for a list.
    expect(uniqueOnlyAvailable(4, ['/'])).toBe(false)
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

// An immediate repeat isn't a flaw in the draw, it's what a memoryless
// draw does: the thinnest selection here (two numbers, × and ÷, band
// klein) has a single-figure pool in its entire search space, so a blind
// draw lands on the one still on screen every few goes. `recent` is what fixes it — and
// since the window (history.ts's 30) is *larger* than that pool, this is
// also the case where the loop has to give up on "unseen" and fall back
// to the least recently played candidate instead of throwing.
describe('nextPuzzle — draws around the puzzles just played', () => {
  const THIN: PuzzleSettings = { numbers: 2, ops: ['*', '/'], band: 0, uniqueOnly: false }

  function play(settings: PuzzleSettings, rounds: number, window: number) {
    const signatures: string[] = []
    let recent: string[] = []
    for (let i = 0; i < rounds; i++) {
      const puzzle = nextPuzzle(settings, recent)
      const signature = puzzleSignature(puzzle)
      expect(puzzle.numbers).toHaveLength(settings.numbers)
      signatures.push(signature)
      recent = [...recent.filter(s => s !== signature), signature].slice(-window)
    }
    return signatures
  }

  it('never repeats immediately, even when the window is bigger than the pool', () => {
    const played = play(THIN, 200, 30)
    const immediate = played.filter((s, i) => i > 0 && s === played[i - 1])
    expect(immediate).toEqual([])
  })

  it('keeps at least ten other puzzles between two sightings of the same one', () => {
    const played = play(THIN, 200, 30)
    const tooSoon = played.filter((s, i) => played.slice(Math.max(0, i - 10), i).includes(s))
    expect(tooSoon).toEqual([])
  })

  it('does the same for a selection with a large pool', () => {
    const played = play({ numbers: 3, ops: ['+', '-', '*', '/'], band: 1, uniqueOnly: false }, 100, 30)
    const immediate = played.filter((s, i) => i > 0 && s === played[i - 1])
    expect(immediate).toEqual([])
  })

  // Enumerated, not sampled: the draw is nowhere near uniform (it picks
  // numbers first, then a target among that draw's own in-band hits), so a
  // rare pool member can go missing from even a few hundred draws — and a
  // pool with one member missing from `recent` is exactly what these two
  // cases must not be handed by accident.
  function wholePool(settings: PuzzleSettings): string[] {
    const [lo, hi] = bandRanges(settings.numbers, settings.ops)[settings.band]
    const out: string[] = []
    const walk = (start: number, numbers: number[]) => {
      if (numbers.length === settings.numbers) {
        for (const e of reachable(numbers, settings.ops)) {
          if (e.target >= lo && e.target <= hi && (!settings.uniqueOnly || e.uniqueSolution)) {
            out.push(puzzleSignature({ numbers, target: e.target }))
          }
        }
        return
      }
      for (let v = start; v <= 9; v++) walk(v, [...numbers, v])
    }
    walk(1, [])
    return out
  }

  // 19 before the whole-number rule, 13 after it: `2 ÷ 1 = 2` survives,
  // while the fractional routes into the same band do not.
  it('has 13 puzzles in its whole search space — small enough for a blind draw to repeat one in thirteen times', () => {
    expect(wholePool(THIN)).toHaveLength(13)
  })

  it('goes looking for the one puzzle left when the window covers everything else', () => {
    // A preference, not a guarantee: the draw picks numbers at random and
    // gives up after `recencyAttempts` draws that turned up nothing new,
    // so the one unseen puzzle is what comes back almost always rather
    // than always — the rest of the time it's the least recently played
    // one, which is 18 puzzles ago here.
    const pool = wholePool(THIN)
    const wanted = pool[0]
    const recent = pool.filter(s => s !== wanted)
    const drawn = Array.from({ length: 20 }, () => puzzleSignature(nextPuzzle(THIN, recent)))
    expect(drawn.filter(s => s === wanted).length).toBeGreaterThanOrEqual(15)
  })

  it('still returns a valid puzzle when every puzzle in the pool is in the window', () => {
    const pool = wholePool(THIN)
    for (let i = 0; i < 5; i++) {
      const puzzle = nextPuzzle(THIN, pool)
      expect(pool).toContain(puzzleSignature(puzzle)) // in band, right numbers — it had to repeat, and repeated something real
    }
  })

  it('an empty window is the plain draw — same puzzles, no error', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = nextPuzzle(THIN, [])
      expect(puzzle.numbers).toHaveLength(2)
    }
  })
})

// "If I select fewer operators, often only one of them is actually used"
// (PO). The generator only ever asked whether a target was *reachable*
// under the selected operators — never whether reaching it needs more than
// one of them — so `5+5+5+5 = 20` was a perfectly good puzzle for a player
// who had asked for + and ×.
describe('nextPuzzle — a puzzle that needs the operators the player picked', () => {
  function distinctOpsNeeded(puzzle: Puzzle, ops: Operator[]): number {
    return reachable(puzzle.numbers, ops).find(e => e.target === puzzle.target)!.minDistinctOps
  }

  function share(settings: PuzzleSettings, rounds: number, needs: (d: number) => boolean) {
    let hits = 0
    for (let i = 0; i < rounds; i++) {
      if (needs(distinctOpsNeeded(nextPuzzle(settings), settings.ops))) hits += 1
    }
    return hits / rounds
  }

  it('three numbers with + and ×: a solution needs both, not one repeated', () => {
    for (const band of [0, 1, 2] as const) {
      expect(share({ numbers: 3, ops: ['+', '*'], band, uniqueOnly: false }, 40, d => d >= 2)).toBeGreaterThanOrEqual(0.9)
    }
  })

  // Deliberately *not* three any more. The draw used to demand as many
  // distinct operators as it could get, and that ceiling was the single
  // biggest cause of the monotony the product owner reported: three
  // distinct operators from four numbers admits 3 of the 25 shapes the pool
  // holds, which is how 91% of `4 Zahlen, alle vier, groß` came back as
  // `(n+n)×n−n`. It is a floor of two now, and the shapes above it are the
  // point — see `operatorFloor`.
  it('four numbers with all four operators: a solution needs at least two', () => {
    expect(share({ numbers: 4, ops: ['+', '-', '*', '/'], band: 1, uniqueOnly: false }, 25, d => d >= 2)).toBeGreaterThanOrEqual(0.9)
  })

  it('holds under uniqueOnly too', () => {
    expect(share({ numbers: 3, ops: ['+', '*'], band: 1, uniqueOnly: true }, 25, d => d >= 2)).toBeGreaterThanOrEqual(0.9)
  })

  // Exhaustively true, not a sampling artefact: with only + and −, or only
  // × and ÷, *no* puzzle needs both operators at any number count — the
  // bracket turns one into the other (a−(b−c) = a−b+c, a÷(b÷c) = a·c÷b).
  // The preference has to be a preference for that reason alone.
  it('two numbers can only ever use one operator — one position, whatever is selected', () => {
    for (let i = 0; i < 20; i++) {
      const puzzle = nextPuzzle({ numbers: 2, ops: ['+', '-', '*', '/'], band: 1, uniqueOnly: false })
      expect(distinctOpsNeeded(puzzle, ['+', '-', '*', '/'])).toBe(1)
    }
  })

  it('+ and − alone: no puzzle can need both, and asking for one does not starve the draw', () => {
    for (const numbers of [3, 4] as const) {
      for (let i = 0; i < 10; i++) {
        const puzzle = nextPuzzle({ numbers, ops: ['+', '-'], band: 1, uniqueOnly: false })
        expect(puzzle.numbers).toHaveLength(numbers)
        expect(distinctOpsNeeded(puzzle, ['+', '-'])).toBe(1)
      }
    }
  })

  // × and ÷ used to be the same story, and no longer are. The identity
  // a÷(b÷c) = a·c÷b still holds, but the one-operator side of it goes
  // through b÷c — which is usually a fraction, and puzzles.ts no longer
  // offers a target whose only route leaves the whole numbers. So once
  // fractional routes stop counting, 14% of three-number ×÷ puzzles and 48%
  // of four-number ones genuinely need both: 3 × 4 ÷ 2 = 6 is whole, while
  // its one-operator twin 3 ÷ (2 ÷ 4) passes through 0.5.
  it('× and ÷ alone: a whole-number puzzle can need both', () => {
    const e = reachable([2, 3, 4], ['*', '/']).find(x => x.target === 6)
    expect(e!.wholeSolution).toBe(true)
    expect(e!.minDistinctOps).toBe(2)
  })

  it('+ and − alone: no puzzle can need both, anywhere in the search space', () => {
    // Here the identity a−(b−c) = a−b+c stays on the whole numbers, so the
    // one-operator route always survives the whole-number rule. Exhaustive,
    // not sampled — this is what the operator preference has to relax for.
    for (const nums of multisetsOfThree()) {
      for (const e of reachable(nums, ['+', '-'])) {
        expect(e.minDistinctOps).toBe(1)
      }
    }
  })

  it('× and ÷ alone: the draw does not starve either way', () => {
    for (let i = 0; i < 10; i++) {
      const puzzle = nextPuzzle({ numbers: 3, ops: ['*', '/'], band: 1, uniqueOnly: false })
      const needed = distinctOpsNeeded(puzzle, ['*', '/'])
      expect(needed).toBeGreaterThanOrEqual(1)
      expect(needed).toBeLessThanOrEqual(2)
    }
  })

  it('still keeps its other promises — the band, and no immediate repeat', () => {
    const settings: PuzzleSettings = { numbers: 3, ops: ['+', '*'], band: 2, uniqueOnly: false }
    const [lo, hi] = bandRanges(3, ['+', '*'])[2]
    let recent: string[] = []
    let previous = ''
    for (let i = 0; i < 60; i++) {
      const puzzle = nextPuzzle(settings, recent)
      expect(puzzle.target).toBeGreaterThanOrEqual(lo)
      expect(puzzle.target).toBeLessThanOrEqual(hi)
      const signature = puzzleSignature(puzzle)
      expect(signature).not.toBe(previous)
      previous = signature
      recent = [...recent.filter(s => s !== signature), signature].slice(-30)
    }
  })
})
