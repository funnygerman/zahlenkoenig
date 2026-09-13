import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import { DEFAULT_SETTINGS } from '../core/settings'

// The header's two edge slots (concept 12.7): sharing on the left, the hint
// on the right. Concept 19.3's update pill used to be tested here too and
// moved out with the pill itself, to UpdateHint.test.tsx.
//
// What's worth pinning at this level is only that each slot renders exactly
// when it is supposed to and calls back when tapped — where the buttons sit
// is a layout question, settled by looking at a real browser rather than by
// asserting geometry jsdom does not have.

const noop = () => {}
const baseProps = {
  settings: DEFAULT_SETTINGS,
  onSetNumbers: noop,
  onToggleOp: noop,
  onSetBand: noop,
  onSetUniqueOnly: noop,
  onPressHint: noop,
}

describe('Header — the share button (share round)', () => {
  it('is absent when the header is given nothing to share with', () => {
    render(<Header {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Share this puzzle' })).not.toBeInTheDocument()
  })

  it('appears when an onShare handler is given, and calls it when tapped', async () => {
    const user = userEvent.setup()
    const onShare = vi.fn()
    render(<Header {...baseProps} onShare={onShare} />)
    await user.click(screen.getByRole('button', { name: 'Share this puzzle' }))
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('is hidden while an onboarding puzzle is on the board', () => {
    render(<Header {...baseProps} onShare={noop} shareHidden />)
    expect(screen.queryByRole('button', { name: 'Share this puzzle' })).not.toBeInTheDocument()
  })

  it('labels itself in the player’s own language', () => {
    render(<Header {...baseProps} settings={{ ...DEFAULT_SETTINGS, language: 'de' }} onShare={noop} />)
    expect(screen.getByRole('button', { name: 'Rätsel teilen' })).toBeInTheDocument()
  })

  it('shows the clipboard confirmation only once a copy has happened', () => {
    const { rerender } = render(<Header {...baseProps} onShare={noop} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    rerender(<Header {...baseProps} onShare={noop} shareCopied />)
    expect(screen.getByRole('status').textContent).toBe('Link copied')
  })
})

describe('Header — the hint button (concept 10.3)', () => {
  it('is present and live by default', () => {
    render(<Header {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled()
  })

  it('is muted rather than absent once a press would do nothing', () => {
    render(<Header {...baseProps} hintMuted />)
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
  })

  it('is absent entirely on a puzzle that has no hints to give', () => {
    render(<Header {...baseProps} hintHidden />)
    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
  })
})
