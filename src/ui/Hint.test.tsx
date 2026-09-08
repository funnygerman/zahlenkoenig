import { createRef } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Board, type BoardHandle } from './Board'
import type { Operator } from '../core/expression'

/** pressHint is called directly on the imperative handle, outside any DOM event — wrap it so React flushes the resulting state update before assertions run. */
function press(ref: React.RefObject<BoardHandle | null>) {
  act(() => ref.current!.pressHint())
}

// Board-level wiring test for the hint system (concept 10, step 4) — same
// reasoning as Game.test.tsx's own banner: useHint.ts and core/hints.ts are
// covered on their own, but only rendering the real tree catches a mistake
// in how Board wires a press through to the tray/field.

const PUZZLE = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] as Operator[] }

describe('Board — the hint button (concept 10.3)', () => {
  it('the first press pulses two tray numbers and places nothing', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    expect(document.querySelector('[class*="pulsing"]')).toBeNull()
    press(ref)
    expect(document.querySelector('[class*="pulsing"]')).not.toBeNull()
    // still nothing on the board — the readout stays empty
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('every press after that places one more chip, and the pulse clears once it does', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    press(ref) // pulse
    press(ref) // first chip
    expect(document.querySelector('[class*="pulsing"]')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toBe('')
  })

  it('pressing through to the end lays the full, correct solution — 10.4: giving up is not a separate button', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)

    // generous upper bound on presses: a 4-number puzzle needs at most 4
    // numbers + 3 operators + 2 blocks = 9 taps, plus the first pulse-only press
    for (let i = 0; i < 12; i++) press(ref)

    // Not necessarily "(6 + 2) × (9 − 3)": 48 is also reachable flat, with
    // no blocks at all (6 × 9 − 2 × 3), and concept 10.2 ranks fewer blocks
    // as *smaller* — so the canonical continuation prefers that one. Only
    // the outcome is pinned down here: every number used once, correct.
    expect(screen.getByRole('status').textContent).toMatch(/= 48$/)
    // the solved board stays put — no auto-advance, unlike a correct submit (concept 12.8 is submit-only)
    expect(screen.getByText('48')).toBeInTheDocument()
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
// were actually visible: pressing the button.
describe('Board — the hint never walks the board into a dead end', () => {
  it('finishes a puzzle whose solution needs the bracket at the end, 2 × (1 + 3)', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={[2, 1, 3]} target={8} ops={PUZZLE.ops} />)

    // 1 pulse press + at most 3 numbers + 2 operators + 1 block
    for (let i = 0; i < 10; i++) press(ref)

    expect(screen.getByRole('status').textContent).toMatch(/= 8$/)
    expect(document.querySelector('[class*="deadEnd"]')).toBeNull()
  })

  it('leaves no dead-end border on the solution it just laid out', () => {
    const ref = createRef<BoardHandle>()
    render(<Board ref={ref} numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />)
    for (let i = 0; i < 12; i++) press(ref)

    expect(screen.getByRole('status').textContent).toMatch(/= 48$/)
    expect(document.querySelector('[class*="deadEnd"]')).toBeNull()
  })
})
