import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board, type BoardHandle } from './Board'
import { useGame } from './useGame'
import { computeHint } from '../core/hints'
import type { Operator } from '../core/expression'

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

  it('gives two chips and no more — the third press does nothing', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    press(ref)
    press(ref)
    expect(placed()).toHaveLength(2)

    press(ref)
    press(ref)
    expect(placed()).toHaveLength(2) // still two: the budget is spent
  })

  it('reports itself unavailable once the budget is spent, so the header can mute the icon', () => {
    const ref = createRef<BoardHandle>()
    const seen: boolean[] = []
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} onHintAvailable={a => seen.push(a)} />)

    expect(seen[seen.length - 1]).toBe(true)
    press(ref)
    press(ref)
    expect(seen[seen.length - 1]).toBe(false)
  })

  it('taking a hinted chip back gives the hint back — the budget counts chips on the board, not presses (PO)', async () => {
    const user = userEvent.setup()
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    press(ref)
    press(ref)
    press(ref)
    expect(placed()).toHaveLength(2) // spent

    // tap one of them back off the board (concept 6.6's inverse gesture)
    await user.click(placed()[1])
    expect(placed()).toHaveLength(1)

    press(ref) // the returned chip released its hint, so this one lands
    expect(placed()).toHaveLength(2)
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
    render(<Board ref={ref} numbers={[3, 4]} target={7} ops={['+'] as Operator[]} />)

    press(ref)
    press(ref)
    expect(screen.getByRole('status').textContent).not.toMatch(/=/)

    // two hints are the whole of a two-number puzzle bar one chip; the
    // player still places that one and submits it themselves. A real click,
    // not fireEvent: once drag is wired the chips have no onClick at all
    // and every tap goes through useDrag's own pointer detection.
    const remaining = screen.getAllByText('4', { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    await user.click(remaining)
    await user.click(screen.getByText('=', { selector: 'button' }))
    expect(screen.getByRole('status').textContent).toMatch(/= 7$/)
  })
})
