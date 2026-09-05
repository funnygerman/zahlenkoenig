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
