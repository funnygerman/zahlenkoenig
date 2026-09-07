import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Game } from './Game'

// Step 3's "vollständige Spielschleife": settings drive generation, the
// header chip is the selection's own display and control (concept 12.7),
// and the panel underneath it is concept 15.6's selection UI. These don't
// pin down which puzzle nextPuzzle() draws (it's random) — only that
// changing a setting is reflected on the board.

describe('Game — the header chip opens and closes the selection panel (concept 15.6)', () => {
  beforeEach(() => localStorage.clear())

  it('is closed at first, opens on tap, closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Game />)

    expect(screen.queryByText('Wie viele Zahlen')).not.toBeInTheDocument()

    const chip = screen.getByRole('button', { name: /–/ }) // the header chip shows the target range, e.g. "1–9"
    await user.click(chip)
    expect(screen.getByText('Wie viele Zahlen')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Wie viele Zahlen')).not.toBeInTheDocument()
  })
})

describe('Game — changing the number-count setting redraws the puzzle (concept 15.10)', () => {
  beforeEach(() => localStorage.clear())

  it('a 4-numbers puzzle shows four number chips in the tray', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: /–/ }))
    const fourOption = screen.getAllByRole('button').find(b => b.querySelectorAll('i').length === 4)!
    await user.click(fourOption)

    // the tray's number row: 4 real number cells, none of them "nichts" (concept 12.3)
    const trayNumbers = document.querySelectorAll('button[class*="_chip_"][class*="_number_"]:not([class*="_field_"])')
    expect(trayNumbers).toHaveLength(4)
  })
})

describe('Game — the last two remaining operators cannot be deselected (concept 15.6, revised: at least two)', () => {
  beforeEach(() => localStorage.clear())

  it('stops deselecting at two and the third attempt stays pressed', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: /–/ }))
    const opButtons = screen.getAllByRole('button', { name: /^[+−×÷]$/ })
    for (const b of opButtons.slice(0, 2)) await user.click(b) // deselect two of the four — allowed, two remain

    const stillPressed = () => screen.getAllByRole('button', { name: /^[+−×÷]$/ }).filter(b => b.getAttribute('aria-pressed') === 'true')
    expect(stillPressed()).toHaveLength(2)

    const [thirdAttempt] = stillPressed()
    await user.click(thirdAttempt) // try to go below two
    expect(thirdAttempt).toHaveAttribute('aria-pressed', 'true')
    expect(stillPressed()).toHaveLength(2)
  })
})
