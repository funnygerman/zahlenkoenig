import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'
import { ONBOARDING_PUZZLES, saveOnboardingStep } from '../core/onboarding'

// Every `<Game>` here starts *past* the first-run introduction (onboarding
// round, core/onboarding.ts). These tests are about the ordinary loop —
// what the generator draws, what the selection panel changes, what gets
// archived — and onboarding deliberately shows two fixed puzzles before
// any of that begins, so without this they would be asserting against the
// introduction instead. `skipOnboarding()` writes the same value finishing
// it writes; Onboarding.test.tsx is where the introduction itself is
// tested, from a genuinely empty storage.
function skipOnboarding() {
  saveOnboardingStep(ONBOARDING_PUZZLES.length)
}


// The footer/history round's replay wiring — Game.tsx is the one place
// core/solvedHistory.ts and Board.tsx are actually joined (same reasoning
// Game.test.tsx's own banner gives for tap/drag: neither half's own tests
// can see a mistake in how they're wired together).
//
// The draw is mocked to a fixed sequence of two-number sums rather than
// left random. It used to be random, and each puzzle was solved by pressing
// the hint button until the board filled itself — which the hint round's
// two-hint budget (PO) ended: the hint deliberately can't finish a puzzle
// any more. A deterministic, trivially solvable draw is what replaces it,
// and it makes these tests better on their own terms too: the three
// archived entries are now known puzzles rather than whatever came up.
//
// vitest.setup.ts pins jsdom's navigator.language to German, so every
// label asserted here is the German copy, matching every other Game-level
// test in this codebase.

vi.mock('../core/puzzles', async importOriginal => {
  const actual = await importOriginal<typeof import('../core/puzzles')>()
  let drawn = 0
  return {
    ...actual,
    // 1+2=3, then 2+3=5, then 3+4=7, … — every one solvable with two taps
    // and an operator, and no puzzle whose target collides with its own
    // numbers (which would make "the tray chip showing 3" ambiguous).
    nextPuzzle: () => {
      drawn += 1
      return { numbers: [drawn, drawn + 1], target: 2 * drawn + 1 }
    },
  }
})

/** The tray's own number chips, unplaced ones first — the field's are field-scale, the target's isn't in the tray at all. */
const trayNumbers = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[class*="_tray_"] button[class*="_chip_"]')]
    .filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''))

async function solveCurrentPuzzle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trayNumbers().find(b => !b.disabled)!)
  await user.click(screen.getAllByText('+', { selector: 'button' })[0])
  await user.click(trayNumbers().find(b => !b.disabled)!)
  await user.click(screen.getByText('=', { selector: 'button' }))
}

const targetValue = () => document.querySelector('[class*="_target_"] [class*="_val_"]')!.textContent

describe('Game — solving a puzzle archives it (footer/history round)', () => {
  beforeEach(() => {
    localStorage.clear()
    skipOnboarding()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('the history strip is absent until something has been solved', () => {
    render(<Game />)
    expect(screen.queryByRole('button', { name: 'Vorheriges gelöstes Rätsel' })).not.toBeInTheDocument()
  })

  it('logs the solved puzzle to storage and the history strip appears', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Game />)

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) }) // concept 12.8's own delay, before Game.tsx's handleSolved runs

    const stored: unknown = JSON.parse(localStorage.getItem('zahlenkoenig:solved-v1') ?? 'null')
    expect(Array.isArray(stored)).toBe(true)
    expect((stored as unknown[]).length).toBe(1)
    expect(screen.getByRole('button', { name: 'Vorheriges gelöstes Rätsel' })).toBeInTheDocument()
  })

  it('browsing back shows the archived puzzle with a fresh, unsolved board', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Game />)

    const solvedTarget = targetValue()
    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })

    await user.click(screen.getByRole('button', { name: 'Vorheriges gelöstes Rätsel' }))

    // same puzzle (same target) as the one just solved, but replayed from scratch
    expect(targetValue()).toBe(solvedTarget)
    expect(screen.getByText('=', { selector: 'button' })).toBeDisabled()
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('forward from the newest archived entry returns to the live puzzle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Game />)

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })
    await user.click(screen.getByRole('button', { name: 'Vorheriges gelöstes Rätsel' }))
    expect(screen.getByText('1/1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nächstes Rätsel' }))
    expect(screen.queryByText('1/1')).not.toBeInTheDocument() // back to live: no position shown
  })

  it('solving a replayed puzzle does not add a second archive entry', async () => {
    // With only one entry it's also the newest, so this alone can't tell
    // "returns to live" apart from "advances to the next entry" — the test
    // below does, with three.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Game />)

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })
    await user.click(screen.getByRole('button', { name: 'Vorheriges gelöstes Rätsel' }))

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })

    const stored: unknown[] = JSON.parse(localStorage.getItem('zahlenkoenig:solved-v1')!)
    expect(stored).toHaveLength(1) // the replay didn't log a duplicate
  })

  it('solving the oldest replayed puzzle advances to the next one, not straight to live', async () => {
    // Reported bug: browse all the way back to the very first solved
    // puzzle and solve it — the board used to jump straight past every
    // other already-solved entry to the live, not-yet-solved puzzle,
    // instead of continuing the review one step forward.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Game />)

    for (let i = 0; i < 3; i++) {
      await solveCurrentPuzzle(user)
      await act(async () => { vi.advanceTimersByTime(1200) })
    }
    const back = screen.getByRole('button', { name: 'Vorheriges gelöstes Rätsel' })
    await user.click(back) // 3/3 (newest)
    await user.click(back) // 2/3
    await user.click(back) // 1/3 (oldest)
    expect(screen.getByText('1/3')).toBeInTheDocument()

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })
    expect(screen.getByText('2/3')).toBeInTheDocument() // advanced by one, still browsing

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })
    expect(screen.getByText('3/3')).toBeInTheDocument() // advanced again

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })
    expect(screen.queryByText('3/3')).not.toBeInTheDocument() // past the newest: back to live

    const stored: unknown[] = JSON.parse(localStorage.getItem('zahlenkoenig:solved-v1')!)
    expect(stored).toHaveLength(3) // none of the three replays logged a duplicate
  })
})
