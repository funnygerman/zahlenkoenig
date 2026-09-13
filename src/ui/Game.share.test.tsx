import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'
import { ONBOARDING_PUZZLES, saveOnboardingStep } from '../core/onboarding'
import { encodeSharedPuzzle, type SharedPuzzle } from '../core/shareLink'

// The share round's wiring (PO). core/shareLink.ts's own tests cover what a
// link means; this file covers the two things only Game.tsx can be wrong
// about — *when* a shared puzzle is allowed to take over the board, and
// what happens to the fragment once it has.
//
// vitest.setup.ts pins jsdom's navigator.language to German, so the labels
// asserted here are the German copy, matching every other Game-level test.

function skipOnboarding() {
  saveOnboardingStep(ONBOARDING_PUZZLES.length)
}

/** 4 + 5 = 9 — two numbers and one operator, so it can be solved by tapping, and no target the mocked live draw ever produces. */
const SHARED: SharedPuzzle = { numbers: [4, 5], target: 9, ops: ['+'] }

function openWith(puzzle: SharedPuzzle | string) {
  window.location.hash = `#p=${typeof puzzle === 'string' ? puzzle : encodeSharedPuzzle(puzzle)}`
}

vi.mock('../core/puzzles', async importOriginal => {
  const actual = await importOriginal<typeof import('../core/puzzles')>()
  return {
    ...actual,
    // One fixed live puzzle rather than Game.history.test.tsx's counting
    // sequence: these tests care only whether the board in front of the
    // player is the *shared* one or not, and a counter that survives
    // between tests in the same file makes "not shared" a moving target.
    // 1 + 2 = 3 is solvable with two taps, and is never the shared 9.
    nextPuzzle: () => ({ numbers: [1, 2], target: 3 }),
  }
})

const trayNumbers = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[class*="_tray_"] button[class*="_chip_"]')]
    .filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''))

const targetValue = () => document.querySelector('[class*="_target_"] [class*="_val_"]')!.textContent

async function solveCurrentPuzzle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trayNumbers().find(b => !b.disabled)!)
  await user.click(screen.getAllByText('+', { selector: 'button' })[0])
  await user.click(trayNumbers().find(b => !b.disabled)!)
  await user.click(screen.getByText('=', { selector: 'button' }))
}

describe('opening a shared link', () => {
  beforeEach(() => {
    localStorage.clear()
    skipOnboarding()
    window.location.hash = ''
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.location.hash = ''
  })

  it('plays the shared puzzle instead of a generated one', () => {
    openWith(SHARED)
    render(<Game />)
    expect(targetValue()).toBe('9')
  })

  it('offers the shared puzzle’s own operators, not the player’s selection', () => {
    openWith(SHARED)
    render(<Game />)
    // The link carries `+` alone; the stored default selection has more.
    expect(screen.getAllByText('+', { selector: 'button' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('×', { selector: 'button' })).not.toBeInTheDocument()
  })

  it('clears the fragment once the puzzle is on screen, without reloading', () => {
    openWith(SHARED)
    render(<Game />)
    expect(window.location.hash).toBe('')
    // Still the shared board — clearing the address bar must not clear the puzzle.
    expect(targetValue()).toBe('9')
  })

  it('hides the selection chip, which would otherwise describe a board that is not on screen', () => {
    openWith(SHARED)
    render(<Game />)
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument()
  })

  it('falls back to an ordinary puzzle when the link is damaged', () => {
    // A hand-edited target: shareLink.ts refuses it, and the player gets a
    // game rather than an error they can do nothing about.
    openWith(encodeSharedPuzzle(SHARED).replace('.9.', '.11.'))
    render(<Game />)
    expect(targetValue()).toBe('3')
  })

  it('archives the shared puzzle when solved and moves on to the live one', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    openWith(SHARED)
    render(<Game />)

    await solveCurrentPuzzle(user)
    await act(async () => { vi.advanceTimersByTime(1200) })

    const stored = JSON.parse(localStorage.getItem('zahlenkoenig:solved-v1') ?? 'null') as SharedPuzzle[]
    expect(stored).toEqual([SHARED])
    // The live puzzle drawn at mount has been waiting behind it.
    expect(targetValue()).toBe('3')
  })
})

describe('a shared link that arrives before the player has been introduced (PO)', () => {
  beforeEach(() => {
    localStorage.clear() // no onboarding step: a genuinely first-time player
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('shows the first onboarding puzzle first, not the shared one', () => {
    openWith(SHARED)
    render(<Game />)
    expect(targetValue()).toBe(String(ONBOARDING_PUZZLES[0].target))
  })

  it('keeps the link in the fragment while onboarding runs, so a reload does not lose it', () => {
    openWith(SHARED)
    render(<Game />)
    expect(window.location.hash).toContain('p=')
  })

  it('hides the share button during onboarding', () => {
    openWith(SHARED)
    render(<Game />)
    expect(screen.queryByRole('button', { name: 'Rätsel teilen' })).not.toBeInTheDocument()
  })

  it('opens the shared puzzle once onboarding is behind the player', () => {
    saveOnboardingStep(ONBOARDING_PUZZLES.length)
    openWith(SHARED)
    render(<Game />)
    expect(targetValue()).toBe('9')
  })
})

describe('the share button', () => {
  beforeEach(() => {
    localStorage.clear()
    skipOnboarding()
    window.location.hash = ''
  })

  it('hands the board on screen to the platform’s share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    // Defined onto the real navigator rather than swapped for a stand-in:
    // vitest.setup.ts pins `navigator.language` to de-DE for every test in
    // this codebase, and a replacement object loses it (it lives on the
    // prototype, so it does not survive a spread) — which would silently
    // flip the whole app into English mid-test.
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: 'Rätsel teilen' }))

    expect(share).toHaveBeenCalledTimes(1)
    const { url, text } = share.mock.calls[0][0] as { url: string; text: string }
    // The live draw is 1 + 2 = 3 (mocked above).
    expect(url).toContain(`#p=${encodeSharedPuzzle({ numbers: [1, 2], target: 3, ops: ['+', '-', '*', '/'] })}`)
    expect(text).toContain('1 2 → 3')
    Reflect.deleteProperty(navigator, 'share')
  })
})
