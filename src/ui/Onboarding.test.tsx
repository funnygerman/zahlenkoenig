import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'
import { ONBOARDING_PUZZLES, loadOnboardingStep, saveOnboardingStep } from '../core/onboarding'

// The first-run introduction, from a genuinely empty storage — which is
// the one state every other Game-level test in this codebase now skips
// past (they call their own `skipOnboarding()`), so this file is where it
// gets exercised.
//
// Game.tsx is the only place core/onboarding.ts, the Intro card and the
// board are joined, and none of their own tests can see a mistake in the
// wiring — the same reasoning Game.test.tsx's banner gives for tap/drag and
// Game.history.test.tsx's gives for the archive.
//
// vitest.setup.ts pins jsdom's navigator.language to German, so the copy
// asserted here is the German copy, matching every other Game-level test.

/** The tray's own number chips — the field's are field-scale, the target's isn't in the tray at all. */
const trayNumbers = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[class*="_tray_"] button[class*="_chip_"]')]
    .filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''))

const targetValue = () => document.querySelector('[class*="_target_"] [class*="_val_"]')!.textContent
const field = () => document.querySelector('[class*="_field_"]')!
const dismissIntro = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Los geht’s' }))

describe('onboarding — a first visit lands on the introduction, not on a generated puzzle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('opens with the first card, and the rule nothing else on screen states', async () => {
    render(<Game />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Benutze jede Zahl genau einmal.')).toBeInTheDocument()
  })

  it('dismissing it reveals the two-number board, not the generator’s own draw', async () => {
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trayNumbers().map(b => Number(b.textContent))).toEqual(ONBOARDING_PUZZLES[0].numbers)
    expect(targetValue()).toBe(String(ONBOARDING_PUZZLES[0].target))
    // Its own narrower tray, not the player's stored selection: one
    // operator, because that is all this puzzle's solution needs.
    expect(screen.getAllByRole('button', { name: /^[+−×÷]$/ })).toHaveLength(1)
  })

  it('shows the tap nudge in the notation line while the field is untouched, and drops it on the first chip', async () => {
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const readout = document.querySelector('[role="status"]')!
    expect(readout.textContent).toBe('Tippe auf eine Zahl')

    await user.click(trayNumbers()[0])
    expect(readout.textContent).not.toBe('Tippe auf eine Zahl')
  })

  it('hides the selection chip, which would otherwise describe a board that isn’t there', async () => {
    // The chip shows the *stored* selection (three numbers, four operators
    // by default) while an onboarding board is fixed at two numbers and one
    // operator — and changing it would visibly do nothing, which is the
    // silent-no-op class of bug this codebase has already removed four of.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)
    expect(screen.queryByRole('button', { name: /–/ })).not.toBeInTheDocument()
  })

  it('offers no hint on the two-number board — by the ordinary rule, not a special case', async () => {
    // `hintBudget` gives two numbers none at all (PO: three chips is the
    // whole board), so this needs no onboarding-specific suppression and
    // never did.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)
    expect(screen.queryByRole('button', { name: 'Tipp' })).not.toBeInTheDocument()
  })
})

describe('onboarding — the second board is not marked as a dead end', () => {
  beforeEach(() => {
    localStorage.clear()
    saveOnboardingStep(1)
  })

  it('shows no dead-end border on the empty field', async () => {
    // This board used to open already outlined as unsolvable. `(1+1+1)×3`
    // needs a three-number group; `core/hints.ts` could not propose one, so
    // `computeHint` returned null and `useHint`'s `deadEnd` was true from
    // the first render — before a first-time player had touched anything.
    //
    // Two rounds fixed it in turn and the special case is gone with them:
    // the verdict was withheld wherever the search was blind, and then the
    // search stopped being blind. Nothing here is onboarding-specific any
    // more; this board is clean for the same reason every other board is.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    expect(targetValue()).toBe(String(ONBOARDING_PUZZLES[1].target))
    expect(field().className).not.toMatch(/_deadEnd_/)
  })

  it('offers a hint on the bracket board, and it stops before the drag the card teaches', async () => {
    // **This used to assert there was no hint button** — `Board` had an
    // `onboarding` prop that forced one off. The PO removed it once the
    // three-number-group round gave this puzzle a real budget: withholding
    // the hint meant a beginner met the game's hardest gesture with no help
    // at all.
    //
    // What makes that safe is the budget rather than a special case. The
    // plan is eight chips, the budget is half rounded up, so four presses
    // land the setup and stop — the `grow` drag is the seventh move and
    // stays the player's, which is exactly the lesson the card is asking
    // for. Pinned here because it is the whole argument for showing it.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const hint = screen.getByRole('button', { name: 'Tipp' })
    let presses = 0
    while (!(hint as HTMLButtonElement).disabled && presses < 10) {
      await user.click(hint)
      presses++
    }
    expect(presses).toBe(4)

    // Four chips down, and the bracket is open but not yet grown: no
    // three-number group, so the drag is still ahead of the player.
    const readout = document.querySelector('[role="status"]')!.textContent!
    expect(readout).toContain('(')
    expect(readout).not.toMatch(/\(.*[+×].*[+×].*\)/) // only one operator inside the bracket so far
  })

  it('its card teaches the bracket, since nothing else in the game can', async () => {
    render(<Game />)
    expect(screen.getByText('Dieses Rätsel braucht eine Klammer.')).toBeInTheDocument()
    expect(screen.getByText(/Zieh eine Zahl auf den Klammerrand/)).toBeInTheDocument()
  })
})

describe('onboarding — solving one advances to the next, and then hands over to the generator', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('solving the first board steps to the second, archives it, and shows the second card', async () => {
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    // [1, 2] -> 3 with a single `+`: three taps and the submit chip.
    await user.click(trayNumbers()[0])
    await user.click(screen.getByRole('button', { name: '+' }))
    await user.click(trayNumbers().find(b => !b.disabled)!)
    await user.click(screen.getByText('=', { selector: 'button' }))

    // concept 12.8's 1200ms pause before the board is replaced.
    await vi.advanceTimersByTimeAsync(1300)

    expect(loadOnboardingStep()).toBe(1)
    expect(screen.getByText('Dieses Rätsel braucht eine Klammer.')).toBeInTheDocument()
    // The archive is no longer empty, but the browse arrows stay away
    // until onboarding is over — otherwise they turn up mid-lesson and
    // browsing away empties the board.
    expect(screen.queryByRole('button', { name: 'Vorheriges gelöstes Rätsel' })).not.toBeInTheDocument()
    // Archived like any other solved puzzle, with the ops it was solved
    // under rather than the player's own selection.
    expect(JSON.parse(localStorage.getItem('zahlenkoenig:solved-v1')!)).toEqual([
      { numbers: [1, 2], target: 3, ops: ['+'] },
    ])
  })

  it('once both are behind the player, the board is a generated puzzle again and no card appears', () => {
    saveOnboardingStep(ONBOARDING_PUZZLES.length)
    render(<Game />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The stored default is three numbers (concept 17.1), which neither
    // onboarding puzzle is — so this is the generator's own draw.
    expect(trayNumbers()).toHaveLength(3)
    expect(document.querySelector('[role="status"]')!.textContent).toBe('')
    // And everything onboarding held back is there again.
    expect(screen.getByRole('button', { name: /–/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tipp' })).toBeInTheDocument()
  })
})

describe('onboarding — the card is recoverable, the step is not', () => {
  beforeEach(() => localStorage.clear())

  it('a card dismissed by accident comes back on the next visit; a solved puzzle does not', async () => {
    // Why `introDismissedAt` is component state and the step is persisted:
    // dismissing the card is cheap to undo (reload) and easy to do by
    // accident, while finishing a puzzle is a deliberate act that should
    // stick. This is the recovery path that let this round drop the
    // permanent help button (PO).
    const user = userEvent.setup()
    const first = render(<Game />)
    await dismissIntro(user)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    first.unmount()

    render(<Game />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(loadOnboardingStep()).toBe(0)
  })
})
