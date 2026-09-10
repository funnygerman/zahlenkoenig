import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'

// The footer/history round's replay wiring — Game.tsx is the one place
// core/solvedHistory.ts and Board.tsx are actually joined (same reasoning
// Game.test.tsx's own banner gives for tap/drag: neither half's own tests
// can see a mistake in how they're wired together). Solves via repeated
// hint presses rather than building a known expression: nextPuzzle() draws
// at random here (unlike Game.test.tsx's own fixture), so there's no fixed
// solution to build by hand — Hint.test.tsx's own "press through to the
// end" pattern, just driven through the header button rather than a ref.
//
// vitest.setup.ts pins jsdom's navigator.language to German, so every
// label asserted here is the German copy, matching every other Game-level
// test in this codebase.

async function solveCurrentPuzzle(user: ReturnType<typeof userEvent.setup>) {
  const hint = screen.getByRole('button', { name: 'Tipp' })
  for (let i = 0; i < 12; i++) await user.click(hint) // generous upper bound, same margin Hint.test.tsx uses
  await user.click(screen.getByText('=', { selector: 'button' }))
}

const targetValue = () => document.querySelector('[class*="_target_"] [class*="_val_"]')!.textContent

describe('Game — solving a puzzle archives it (footer/history round)', () => {
  beforeEach(() => {
    localStorage.clear()
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
})
