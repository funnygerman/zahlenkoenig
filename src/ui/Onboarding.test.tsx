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
    expect(screen.getByText('Benutze jede Zahl genau einmal')).toBeInTheDocument()
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

  it('marks the chip to tap next and names the gesture, following the player move by move', async () => {
    // The guidance round (PO): the earlier one-shot "tap a number" nudge
    // only ever spoke on an untouched board and went quiet exactly when a
    // beginner started wondering what comes next. `guidance.ts` decides
    // what it says; here it is the wiring that is under test — that the
    // line appears, that the marked chip is the one the line means, and
    // that both follow the board rather than standing still.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const line = () => document.querySelector('[class*="_guideLine_"]')!.textContent
    const marked = () => [...document.querySelectorAll('[class*="_tray_"] [class*="_guide_"]')].map(el => el.textContent?.trim())

    expect(line()).toBe('Tippe auf die leuchtende Zahl')
    expect(marked()).toEqual(['1'])

    await user.click(trayNumbers()[0])
    expect(line()).toBe('Tippe auf das leuchtende Rechenzeichen')
    expect(marked()).toEqual(['+'])

    await user.click(screen.getByRole('button', { name: '+' }))
    expect(line()).toBe('Tippe auf die leuchtende Zahl')
    expect(marked()).toEqual(['2'])

    await user.click(trayNumbers()[0])
    expect(line()).toBe('Tippe auf das leuchtende =')

    // And the notation line above is untouched by any of it — the guidance
    // has its own row precisely so the player can still read what they
    // have built (this is why it is not the old nudge's slot).
    expect(document.querySelector('[role="status"]')!.textContent).toBe('1 + 2')
  })

  it('says nothing on a generated puzzle — this is the introduction only', async () => {
    saveOnboardingStep(ONBOARDING_PUZZLES.length)
    render(<Game />)
    // The guided row belongs to the introduction alone — a generated
    // puzzle has no row at all, and the dead-end recovery note it *can*
    // show is an overlay that only exists while it speaks. Nothing is
    // marked in the tray either: the walking is what onboarding owns.
    expect(document.querySelector('[class*="_guideLine_"]')).toBeNull()
    expect(document.querySelector('[class*="_recoveryNote_"]')).toBeNull()
    expect(document.querySelector('[class*="_tray_"] [class*="_guide_"]')).toBeNull()
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

describe('onboarding — the second board teaches the bracket with nothing but taps', () => {
  // The board this round inserted, after a report that the block lesson
  // arrived all at once. What it has to be is a bracket a player can build
  // with the vocabulary the first board taught — so the test that matters
  // is that the whole of it can be tapped.
  beforeEach(() => {
    localStorage.clear()
    saveOnboardingStep(1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('opens on its scripted first beat, not on the search\'s own advice', async () => {
    // This board leads the player into a bracket in the wrong place on
    // purpose (core/onboarding.ts's `script`), so its first instruction is
    // the `3` — where the derived guidance, left alone, would open with
    // the block chip (`guidance.test.tsx` pins that it still does). A
    // scripted beat is the one thing that outranks the search.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)
    expect(document.querySelector('[class*="_guideLine_"]')!.textContent)
      .toBe('Tippe auf die leuchtende Zahl')
    const marked = document.querySelector('[class*="_tray_"] [class*="_guide_"]')!
    expect(marked.textContent).toBe('3')
  })

  it('its card names the bracket and asks for taps, not a drag', () => {
    render(<Game />)
    expect(screen.getByText('Dieses Rätsel braucht eine Klammer')).toBeInTheDocument()
    expect(screen.getByText('Und wenn sie falsch sitzt, kannst du sie verschieben')).toBeInTheDocument()
    expect(screen.queryByText(/Zieh eine Zahl auf den Klammerrand/)).not.toBeInTheDocument()
  })

  it('can be solved by tapping alone, and solving it opens the drag lesson', async () => {
    // The whole reason this board exists between the other two: one new
    // chip (the block), no new gesture. If any step here needed a drag,
    // the board would be teaching the same two things at once that the
    // third board already does.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    // The card's own order, tap for tap: open the bracket, fill it, then
    // finish the row. `trayNumbers()` is re-read every time because a
    // placed chip leaves the tray, so [0] is always the leftmost number
    // still to place — 1, then 2, then 3.
    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    await user.click(trayNumbers()[0])
    await user.click(screen.getByRole('button', { name: '+' }))
    await user.click(trayNumbers()[0])
    await user.click(screen.getByRole('button', { name: '×' }))
    await user.click(trayNumbers()[0])
    expect(document.querySelector('[role="status"]')!.textContent).toBe('(1 + 2) × 3')
    await user.click(screen.getByText('=', { selector: 'button' }))

    // concept 12.8's 1200ms pause before the board is replaced.
    await vi.advanceTimersByTimeAsync(1300)

    expect(loadOnboardingStep()).toBe(2)
    expect(screen.getByText('Diesmal gehören drei Zahlen in die Klammer')).toBeInTheDocument()
    expect(screen.getByText(/Zieh eine Zahl auf den Klammerrand/)).toBeInTheDocument()
  })

  it('shows no dead-end border on the empty field', () => {
    render(<Game />)
    expect(field().className).not.toMatch(/_deadEnd_/)
  })

  it('puts the instruction above the tray, not below it, and on the same pill the recovery note wears', async () => {
    // Reported as easy to miss, and the spot was two problems rather than
    // one: below the tray is past the end of everything, floating in the
    // empty space under the board, and on a phone it is exactly where the
    // hand holding the device sits. Asserted as document order rather
    // than as pixels, which is what the flex column follows (there is no
    // `order` property anywhere in Game.module.css).
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const line = document.querySelector('[class*="_guideLine_"]')!
    const tray = document.querySelector('[class*="_tray_"]')!
    expect(line.compareDocumentPosition(tray) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // One pill, two placements (PO: *"ich mag den tooltip viel mehr"*).
    // `.note` is the shape both lines share; what differs is that this one
    // keeps a row of its own while `.recoveryNote` floats over the board —
    // measured, not chosen: laid over the board here a two-line
    // instruction covers the top 13px of the tray, which is exactly what a
    // guided line points at. A second, separately styled pill is the kind
    // of drift this asserts against.
    const pill = line.querySelector('[class*="_note_"]')!
    expect(pill).not.toBeNull()
    expect(pill.textContent).toBe('Tippe auf die leuchtende Zahl')
  })

  it('leads the player into a misplaced bracket, marks it, and names the repair', async () => {
    // The scripted mistake and its repair, through the real component
    // rather than through `nextGuidance` — `guidance.test.tsx` plays the
    // same sequence at the hook level with its own copy of the beat
    // matching, and this is the test that holds **Board's** copy to it.
    //
    // What it pins beyond the sequence: the line and the mark name the
    // same chip. A recovery line says "the marked bracket", so a mark
    // derived separately from the line would be this round's version of
    // the pulse this codebase deleted.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const line = () => document.querySelector('[class*="_guideLine_"]')!.textContent
    await user.click(trayNumbers().find(b => b.textContent === '3')!)
    expect(line()).toBe('Tippe auf das leuchtende Rechenzeichen')
    await user.click(screen.getByRole('button', { name: '×' }))
    expect(line()).toBe('Tippe auf den leuchtenden Chip — er öffnet eine Klammer')

    // The mistake. A tapped block lands at the player's own anchor — the
    // `3` — so this one tap puts the bracket where 9 is out of reach, and
    // the board says so at once rather than waiting for `=`.
    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    expect(document.querySelector('[role="status"]')!.textContent).toBe('(3 ×)')
    expect(field().className).toMatch(/_deadEnd_/)
    expect(line()).toBe('Orange heißt: so geht es nicht auf. Zieh die Klammer auf die markierte Stelle')

    // The bracket the line calls "marked" is marked, and the spot it is to
    // go to is marked too — a destination the player would otherwise have
    // to guess.
    expect(document.querySelector('[class*="_group_"][class*="_blocking_"]')).not.toBeNull()
    expect(document.querySelector('[class*="_guideZone_"], [class*="_guideEdge_"]')).not.toBeNull()
  })

  it('offers a hint, and its budget stops it before the puzzle is finished', async () => {
    // Six chips (a block, three numbers, two operators), budget is half
    // rounded up — so three presses, and three chips left for the player.
    // Pinned because the hint is the beginner's other way through this
    // board: the card says "tap this to open one", and a player who does
    // not find the chip is shown it instead of being left on an empty
    // field.
    const user = userEvent.setup()
    render(<Game />)
    await dismissIntro(user)

    const hint = screen.getByRole('button', { name: 'Tipp' })
    let presses = 0
    while (hint.getAttribute('aria-disabled') !== 'true' && presses < 10) {
      await user.click(hint)
      presses++
    }
    expect(presses).toBe(3)
    expect(document.querySelector('[role="status"]')!.textContent).toContain('(')
  })
})

describe('onboarding — the third board is not marked as a dead end', () => {
  beforeEach(() => {
    localStorage.clear()
    saveOnboardingStep(2)
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

    expect(targetValue()).toBe(String(ONBOARDING_PUZZLES[2].target))
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
    // aria-disabled, not the native `disabled` property (hintMuted's own
    // note in Header.tsx) — the button stays clickable once muted, it just
    // explains itself instead of placing a chip.
    while (hint.getAttribute('aria-disabled') !== 'true' && presses < 10) {
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

  it('its card teaches growing a bracket, since nothing else in the game can', () => {
    render(<Game />)
    expect(screen.getByText('Diesmal gehören drei Zahlen in die Klammer')).toBeInTheDocument()
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
    expect(screen.getByText('Dieses Rätsel braucht eine Klammer')).toBeInTheDocument()
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

  it('once all three are behind the player, the board is a generated puzzle again and no card appears', () => {
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
