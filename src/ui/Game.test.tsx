import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'

// End-to-end smoke test for v2 step 2's actual goal: "ein fest verdrahtetes
// Rätsel ist spielbar". Exercises the real rendered tree — Game -> useGame
// + useDrag -> Tray/Expression/Chip — not just the hooks in isolation, so
// it's the one place a wiring mistake between them (e.g. the double-fire
// bug fixed just before this file was written) would actually show up.

describe('Game — renders the hardcoded puzzle (concept 12.5: (6+2)×(9−3)=48)', () => {
  it('shows the target and all four tray numbers, nothing placed yet', () => {
    render(<Game />)
    expect(screen.getByText('48')).toBeInTheDocument()
    for (const n of ['6', '2', '9', '3']) expect(screen.getAllByText(n).length).toBeGreaterThan(0)
    expect(screen.getByText('=', { selector: 'button' })).toBeDisabled()
  })
})

describe('Game — tapping a placed chip returns it (concept 6.6)', () => {
  // The tap dispatch used to switch on *what* a chip is and never on
  // *where* it is, so a placed operator was indistinguishable from the
  // tray's: tapping the `+` in the expression placed a second `+` in the
  // next free operator slot instead of removing the one tapped. Numbers
  // escaped it only because useGame's onTapNumber happens to check whether
  // the id is already placed. Neither hook test could see this — the
  // mistake is in the wiring, so it belongs here.

  /** Chips in the expression field are field-scale; the tray's are not. */
  const placed = () => [...document.querySelectorAll<HTMLButtonElement>('button[class*="_chip_"][class*="_field_"]')]
  const placedText = () => placed().map(b => b.textContent?.trim()).join(' ')

  it('tapping a placed operator removes it, and does not add another one', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const trayPlus = screen.getAllByText('+', { selector: 'button' })[0]
    await user.click(trayPlus)
    expect(placedText()).toBe('+')

    await user.click(placed()[0])
    expect(placed()).toHaveLength(0) // gone, not duplicated
  })

  it('tapping a placed number returns it to the tray', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const traySix = screen.getAllByText('6', { selector: 'button' })[0]
    await user.click(traySix)
    expect(placedText()).toBe('6')

    await user.click(placed()[0])
    expect(placed()).toHaveLength(0)
  })

  it('a tapped operator still places from the tray while one is already on the board', async () => {
    // The other half of the same distinction: the tray must keep placing.
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getAllByText('6', { selector: 'button' })[0])
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    expect(placedText()).toBe('6 +')

    // now tap the tray's × — the field already holds an operator, and this
    // must add to it rather than being read as a return
    const trayTimes = screen.getAllByText('×', { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    await user.click(trayTimes)
    expect(placedText()).toBe('6 + ×')
  })
})

describe('Game — a full playthrough via tap alone reaches a correct answer', () => {
  it('build (6+2)×(9−3), submit, and see the correct readout', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const tapNumber = async (value: string) => {
      // the tray always shows an unplaced instance of each number as a
      // plain (non-disabled) button; Expression shows placed ones — so the
      // first *enabled* match with this text is always the tray's.
      const candidates = screen.getAllByText(value, { selector: 'button' })
      const el = candidates.find(b => !(b as HTMLButtonElement).disabled) ?? candidates[0]
      await user.click(el)
    }
    const tapOperator = async (glyph: string) => user.click(screen.getAllByText(glyph, { selector: 'button' })[0])
    const tapBlock = async () => {
      const blockButtons = screen.getAllByRole('button').filter(b => b.querySelector('[class*="blockIcon"]'))
      await user.click(blockButtons[0])
    }

    await tapBlock()
    await tapNumber('6')
    await tapOperator('+')
    await tapNumber('2')
    await tapOperator('×')
    await tapBlock()
    await tapNumber('9')
    await tapOperator('−')
    await tapNumber('3')

    const submit = screen.getByText('=', { selector: 'button' })
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(screen.getByRole('status')).toHaveTextContent('= 48')
  })
})
