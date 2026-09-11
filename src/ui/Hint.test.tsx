import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board, type BoardHandle } from './Board'
import { useGame } from './useGame'
import { hintBudget, useHint } from './useHint'
import { computeHint } from '../core/hints'
import { createExpression, createTray, type Operator } from '../core/expression'
import { reachable } from '../core/solver'
import { nextPuzzle, type PuzzleSettings } from '../core/puzzles'

/** pressHint is called directly on the imperative handle, outside any DOM event — wrap it so React flushes the resulting state update before assertions run. */
function press(ref: React.RefObject<BoardHandle | null>) {
  act(() => ref.current!.pressHint())
}

// Board-level wiring test for the hint system (concept 10, step 4, revised
// by the hint round) — same reasoning as Game.test.tsx's own banner:
// useHint.ts and core/hints.ts are covered on their own, but only rendering
// the real tree catches a mistake in how Board wires a press through to the
// tray/field.

const PUZZLE = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] as Operator[] }

/** Chips in the expression field are field-scale; the tray's are not — and a ghost scaffold slot is not a button, so it never counts as placed (Game.test.tsx uses the same selector). */
const placed = () => [...document.querySelectorAll<HTMLButtonElement>('button[class*="_chip_"][class*="_field_"]')]

describe('Board — the hint button (concept 10.3, revised by the hint round)', () => {
  it('the very first press already places a chip — nothing pulses, and no press is spent on showing rather than doing', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    expect(placed()).toHaveLength(0)
    press(ref)
    expect(placed()).toHaveLength(1)
    expect(document.querySelector('[class*="pulsing"]')).toBeNull() // the pulse is gone for good
  })

  it('gives half the chips this puzzle takes, rounded up, and no more', () => {
    // 48 is reachable flat from 6, 2, 9, 3 (6 × 9 − 2 × 3), so the canonical
    // continuation is four numbers and three operators — seven chips, four
    // hints. A puzzle whose own solution needs brackets costs more chips and
    // therefore gives more (PO: 9 chips → 5).
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    for (let i = 0; i < 4; i++) press(ref)
    expect(placed()).toHaveLength(4)

    press(ref)
    press(ref)
    expect(placed()).toHaveLength(4) // still four: the budget is spent
  })

  it('scales with the puzzle: three numbers give fewer than four do', () => {
    const four = createRef<BoardHandle>()
    const { unmount } = render(<Board ref={four} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)
    for (let i = 0; i < 9; i++) press(four)
    const fourCount = placed().length
    unmount()

    const three = createRef<BoardHandle>()
    render(<Board ref={three} numbers={[2, 1, 3]} target={8} ops={PUZZLE.ops} />)
    for (let i = 0; i < 9; i++) press(three)

    expect(placed().length).toBeLessThan(fourCount) // 3 numbers is at most 6 chips, 4 numbers at least 7
  })

  it('gives a two-number puzzle none at all, and says so rather than muting (PO)', () => {
    const ref = createRef<BoardHandle>()
    const seen: { offered: boolean; available: boolean }[] = []
    render(<Board ref={ref} numbers={[3, 4]} target={7} ops={PUZZLE.ops} onHintState={s => seen.push(s)} />)

    expect(seen[seen.length - 1]).toEqual({ offered: false, available: false })
    press(ref)
    press(ref)
    expect(placed()).toHaveLength(0) // three chips is the whole board; a hint there is the answer
  })

  it('reports itself unavailable once the budget is spent, so the header can mute the icon', () => {
    const ref = createRef<BoardHandle>()
    const seen: { offered: boolean; available: boolean }[] = []
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} onHintState={s => seen.push(s)} />)

    expect(seen[seen.length - 1]).toEqual({ offered: true, available: true })
    for (let i = 0; i < 4; i++) press(ref)
    expect(seen[seen.length - 1]).toEqual({ offered: true, available: false })
  })

})

describe('Board — the last two chips are always the player\'s (PO)', () => {
  it('mutes rather than placing when only two chips are missing', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    const seen: { offered: boolean; available: boolean }[] = []
    render(<Board ref={ref} numbers={[3, 4, 5]} target={12} ops={['+'] as Operator[]} onHintState={s => seen.push(s)} />)

    // build the row by hand to within two chips of done: 3 + 4 + _ needs
    // one operator and one number, and the hint must supply neither.
    const tapTray = async (text: string) => {
      const chip = screen.getAllByText(text, { selector: 'button' }).find(b => !b.className.includes('_field_') && !(b as HTMLButtonElement).disabled)
      if (chip) await user.click(chip)
    }
    for (const step of ['3', '+', '4']) await tapTray(step)
    expect(placed()).toHaveLength(3)

    expect(seen[seen.length - 1].available).toBe(false) // the icon is already muted
    press(ref)
    press(ref)
    expect(placed()).toHaveLength(3) // and pressing it changes nothing
  })

  it('does place the third-from-last chip — the rule is the last two, not the last three', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={[3, 4, 5]} target={12} ops={['+'] as Operator[]} />)

    const chip = screen.getAllByText('3', { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    await user.click(chip) // 4 chips left after this
    press(ref)
    expect(placed()).toHaveLength(2)
  })
})

describe('Board — a hint cannot be laundered by re-placing its chip by hand', () => {
  it('an operator taken off and replaced by an identical one does not refund the hint', async () => {
    // Reported by the PO as a way to get the whole solution: take the
    // hinted chip off, put the same thing back by hand, and the budget saw
    // the hint's chip leave and never come back — because `placeOperator`
    // mints a fresh id every time, so the id the hint recorded was gone.
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    for (let i = 0; i < 6; i++) press(ref)
    const spent = placed().length
    const operator = placed().find(b => ['+', '−', '×', '÷'].includes(b.textContent!.trim()))!
    const glyph = operator.textContent!.trim()

    await user.click(operator) // off the board — the budget refunds it, as designed
    expect(placed()).toHaveLength(spent - 1)

    const trayCopy = screen.getAllByText(glyph, { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    await user.click(trayCopy) // …and straight back on, by hand
    expect(placed()).toHaveLength(spent)

    press(ref)
    press(ref)
    expect(placed()).toHaveLength(spent) // no extra chip: the hint is still spent
  })

  it('but genuinely taking a hinted chip back still refunds it', async () => {
    // The rule the PO asked for is unchanged — this is the case it exists
    // for, an accidental press undone.
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    for (let i = 0; i < 6; i++) press(ref)
    const spent = placed().length

    await user.click(placed()[spent - 1])
    expect(placed()).toHaveLength(spent - 1)

    press(ref)
    expect(placed()).toHaveLength(spent) // the returned chip released its hint
  })
})

describe('hintBudget — half the chips a puzzle takes, rounded up (PO)', () => {
  // The PO's own three worked examples, verbatim.
  it('four numbers and three operators is seven chips and four hints', () => {
    expect(hintBudget(4, 7)).toBe(4)
  })

  it('the same plus one block is eight chips and still four hints', () => {
    expect(hintBudget(4, 8)).toBe(4)
  })

  it('the same plus two blocks is nine chips and five hints', () => {
    expect(hintBudget(4, 9)).toBe(5)
  })

  it('rounds in the player\'s favour — three numbers, five chips, three hints', () => {
    expect(hintBudget(3, 5)).toBe(3)
  })

  it('two numbers get none, whatever the formula would say', () => {
    expect(hintBudget(2, 3)).toBe(0)
  })
})

describe('Board — the chip count comes from the puzzle\'s own solution, brackets included', () => {
  // The block is what makes 7, 8 and 9 chips different puzzles at the same
  // number count, so the budget has to read the canonical continuation
  // rather than assume a flat row.
  const count = (numbers: number[], target: number) => {
    const ref = createRef<BoardHandle>()
    const { unmount } = render(<Board ref={ref} numbers={numbers} target={target} ops={PUZZLE.ops} />)
    let presses = 0
    for (let i = 0; i < 12; i++) {
      const before = document.querySelectorAll('button[class*="_chip_"][class*="_field_"], [class*="_group_"]').length
      press(ref)
      if (document.querySelectorAll('button[class*="_chip_"][class*="_field_"], [class*="_group_"]').length === before) break
      presses++
    }
    unmount()
    return presses
  }

  it('a solution needing one bracket is eight chips: four hints', () => {
    expect(count([1, 1, 1, 4], 8)).toBe(4)
  })

  it('a solution needing two brackets is nine chips: five hints', () => {
    expect(count([1, 1, 1, 3], 8)).toBe(5)
  })
})

describe('Board — a press on a dead-end board marks what is in the way (PO, hint round)', () => {
  // The other half of the reported "sometimes the hint button does
  // nothing": on a board that can no longer reach the target the press
  // used to return before touching anything at all.

  const marked = () => document.querySelectorAll('[class*="blocking"]')

  /** 6 + 2 + 9 + 3 is 20, not 48 — complete, wrong, and past saving without taking something back. */
  async function buildDeadEnd(user: ReturnType<typeof userEvent.setup>) {
    const tap = async (text: string) => {
      const candidates = screen.getAllByText(text, { selector: 'button' })
      await user.click(candidates.find(b => !b.className.includes('_field_')) ?? candidates[0])
    }
    for (const step of ['6', '+', '2', '+', '9', '+', '3']) await tap(step)
  }

  it('marks nothing until the press, then marks the chips in the way and places none of its own', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    await buildDeadEnd(user)
    expect(document.querySelector('[class*="deadEnd"]')).not.toBeNull() // the free, permanent border is already on
    expect(marked()).toHaveLength(0) // …but nothing is singled out yet

    const before = placed().length
    press(ref)
    expect(marked().length).toBeGreaterThan(0)
    expect(placed()).toHaveLength(before) // the player's board is untouched — marking, never repairing (PO)
  })

  it('the marks clear again the moment the player moves anything', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    await buildDeadEnd(user)
    press(ref)
    expect(marked().length).toBeGreaterThan(0)

    await user.click(placed()[0]) // take a chip back
    expect(marked()).toHaveLength(0)
  })

  it('costs no hint — marking is free, so a blunder cannot eat the budget', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    await buildDeadEnd(user)
    press(ref)
    press(ref)
    press(ref)

    // clear the board back to something solvable and check both hints are still there
    for (const chip of [...placed()].reverse()) await user.click(chip)
    expect(placed()).toHaveLength(0)

    press(ref)
    press(ref)
    expect(placed()).toHaveLength(2)
  })
})

describe('Board — the dead-end border (concept 10.3: "kostenlos, dauerhaft")', () => {
  it('shows immediately, with no press needed, when the target is no longer reachable', () => {
    const unsolvable = { numbers: [1, 1, 1, 1], target: 1000, ops: ['+', '-', '*', '/'] as Operator[] }
    render(<Board numbers={unsolvable.numbers} target={unsolvable.target} ops={unsolvable.ops} />)
    expect(document.querySelector('[class*="deadEnd"]')).not.toBeNull()
  })

  it('does not show for a puzzle that is still reachable', () => {
    render(<Board numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)
    expect(document.querySelector('[class*="deadEnd"]')).toBeNull()
  })

  // The regression `scripts/checkHintReachable.ts` found. `completions`
  // proposes groups of two and no more (a hint move is a tap; growing a
  // group past its minimum is drag-only, concept 6.2), so on a puzzle whose
  // only solutions need a *three*-number group `computeHint` returns null —
  // at every stage, empty field included. `deadEnd` used to be exactly
  // `hint === null`, so such a board opened already outlined as
  // unsolvable, before the player had touched a chip. Measured at 39.8% of
  // four-number draws.
  //
  // `[1,1,1,3] → 9` is the case `hints.test.ts` pins at the core level:
  // `(1+1+1)×3`, solvable by drag, invisible to the hint.
  it('is withheld on a puzzle the hint could never walk, however solvable that puzzle is', () => {
    const dragOnly = { numbers: [1, 1, 1, 3], target: 9, ops: ['+', '*'] as Operator[] }
    expect(computeHint(createExpression(), createTray(dragOnly.numbers), dragOnly.target, dragOnly.ops, 4)).toBeNull()

    render(<Board numbers={dragOnly.numbers} target={dragOnly.target} ops={dragOnly.ops} />)
    expect(document.querySelector('[class*="deadEnd"]')).toBeNull()
  })

  // The border must stay withheld for the *whole* puzzle, not just while
  // the field is empty: on these boards `computeHint` is null at every
  // stage, so a player two chips in is no more to blame than one who has
  // touched nothing.
  it('stays withheld once chips are down on such a puzzle', async () => {
    const user = userEvent.setup()
    render(<Board numbers={[1, 1, 1, 3]} target={9} ops={['+', '*']} />)

    await user.click(screen.getAllByText('1', { selector: 'button' })[0])
    await user.click(screen.getByText('+', { selector: 'button' }))
    expect(placed()).toHaveLength(2)
    expect(document.querySelector('[class*="deadEnd"]')).toBeNull()
  })

  // The distinction the fix turns on, and the reason `reachable()` is
  // consulted rather than trusting `hint === null`: a null hint on a
  // genuinely unsolvable board is honest and keeps its border (the test
  // above this block), while a null hint on a solvable one is the search's
  // own blind spot and says nothing about the player.
  it('tells "the search cannot see it" apart from "the puzzle cannot be solved"', () => {
    const blind = reachable([1, 1, 1, 3], ['+', '*']).some(e => e.target === 9)
    const impossible = reachable([1, 1, 1, 1], ['+', '-', '*', '/']).some(e => e.target === 1000)
    expect(blind).toBe(true)       // solvable — border withheld
    expect(impossible).toBe(false) // not solvable — border kept
  })
})

// Stated as the invariant rather than as the bug: whatever the generator
// draws, a fresh board must never greet the player with a dead-end border.
// This is what `scripts/checkHintReachable.ts` measures exhaustively, kept
// here as a fast sample so a regression fails the suite rather than waiting
// for someone to run a script — and it keeps passing, unchanged, once
// `completions` learns three-number groups.
describe('a freshly drawn puzzle never opens as a dead end', () => {
  const SELECTIONS: PuzzleSettings[] = [
    { numbers: 4, ops: ['+', '*', '/'], band: 2, uniqueOnly: false },   // 40% walled before the fix
    { numbers: 4, ops: ['-', '*', '/'], band: 2, uniqueOnly: true },    // 100% walled before the fix
    { numbers: 4, ops: ['+', '-', '*', '/'], band: 3, uniqueOnly: false },
    { numbers: 3, ops: ['+', '-', '*', '/'], band: 0, uniqueOnly: false },
  ]

  for (const settings of SELECTIONS) {
    const name = `${settings.numbers}n ${settings.ops.join('')} band ${settings.band}${settings.uniqueOnly ? ' uniqueOnly' : ''}`
    it(`holds across draws from ${name}`, () => {
      for (let i = 0; i < 8; i++) {
        const puzzle = nextPuzzle(settings, [], [])
        const { result, unmount } = renderHook(() => useHint({
          expr: createExpression(),
          tray: createTray(puzzle.numbers),
          target: puzzle.target,
          opsAllowed: settings.ops,
          numbersCount: puzzle.numbers.length,
          onApplyMove: () => {},
        }))
        expect(result.current.deadEnd, `[${puzzle.numbers}] -> ${puzzle.target}`).toBe(false)
        unmount()
      }
    })
  }
})

// The two hint failures a browser QA pass found, at the level where they
// were actually visible: applying the hint's own moves through the real
// placement functions. This used to be driven through the button, which
// can't reach the end any more (two hints per puzzle, PO) — so it drives
// `useGame.applyHintMove` directly instead, which is exactly what a press
// does, minus the budget.
describe('the hint never walks the board into a dead end', () => {
  function walkOut(numbers: number[], target: number, ops: Operator[]) {
    const { result } = renderHook(() => useGame({ numbers, target, ops }))
    for (let i = 0; i < 12; i++) {
      const hint = computeHint(result.current.expr, result.current.tray, target, ops, numbers.length)
      expect(hint).not.toBeNull() // never walked itself into a corner along the way
      if (hint!.moves.length === 0) break
      act(() => result.current.applyHintMove(hint!.moves[0]))
    }
    return result
  }

  it('finishes a puzzle whose solution needs the bracket at the end, 2 × (1 + 3)', () => {
    const result = walkOut([2, 1, 3], 8, PUZZLE.ops)
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(8)
  })

  it('finishes the canonical worst case, and leaves no dead end behind it', () => {
    // Not necessarily "(6 + 2) × (9 − 3)": 48 is also reachable flat, with
    // no blocks at all (6 × 9 − 2 × 3), and concept 10.2 ranks fewer blocks
    // as *smaller* — so the canonical continuation prefers that one. Only
    // the outcome is pinned down here: every number used once, correct.
    const result = walkOut(PUZZLE.numbers, PUZZLE.target, PUZZLE.ops)
    expect(result.current.submitEnabled).toBe(true)
    expect(result.current.result).toBe(48)
  })
})

describe('Board — the hint lays chips the way a tap does', () => {
  it('never presses `=` itself: the readout holds the result back until the player does', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={[3, 4, 5]} target={12} ops={['+'] as Operator[]} />)

    for (let i = 0; i < 4; i++) press(ref) // the whole budget: three of the five chips
    expect(screen.getByRole('status').textContent).not.toMatch(/=/)

    // the player places whatever the hints left and submits it themselves. A
    // real click, not fireEvent: once drag is wired the chips have no onClick
    // at all and every tap goes through useDrag's own pointer detection.
    for (const value of ['3', '4', '5']) {
      const chip = screen.getAllByText(value, { selector: 'button' }).find(b => !b.className.includes('_field_') && !(b as HTMLButtonElement).disabled)
      if (chip) await user.click(chip)
    }
    while (screen.getByText('=', { selector: 'button' }).hasAttribute('disabled')) {
      await user.click(screen.getAllByText('+', { selector: 'button' }).find(b => !b.className.includes('_field_'))!)
    }
    await user.click(screen.getByText('=', { selector: 'button' }))
    expect(screen.getByRole('status').textContent).toMatch(/= 12$/)
  })
})
