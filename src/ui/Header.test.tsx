import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Header } from './Header'
import { DEFAULT_SETTINGS } from '../core/settings'

// Step 6's update hint (concept 19.3: "ein knapper Hinweis... statt eines
// Popup-Dialogs") — the one part of the PWA round that's actually this
// app's own code rather than vite-plugin-pwa's (registration, precaching,
// the actual update cycle are the library's own, already well-tested
// upstream). What's tested here is narrower: does Header render the hint
// exactly when told to, in the player's own language, and does tapping it
// call back — the same class of bug `Game.test.tsx`'s own banner describes
// for drag/tap wiring, just for this one small prop pair instead.

const noop = () => {}
const baseProps = {
  settings: DEFAULT_SETTINGS,
  onSetNumbers: noop,
  onToggleOp: noop,
  onSetBand: noop,
  onSetUniqueOnly: noop,
  onPressHint: noop,
}

describe('Header — the update hint (concept 19.3)', () => {
  it('is absent by default', () => {
    render(<Header {...baseProps} />)
    expect(screen.queryByText('Update')).not.toBeInTheDocument()
  })

  it('shows the hint, in the current language, when an update is available', () => {
    render(<Header {...baseProps} updateAvailable />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('shows the German copy for a German player', () => {
    render(<Header {...baseProps} settings={{ ...DEFAULT_SETTINGS, language: 'de' }} updateAvailable />)
    expect(screen.getByRole('button', { name: 'Aktualisieren' })).toBeInTheDocument()
  })

  it('shows the Russian copy for a Russian player', () => {
    render(<Header {...baseProps} settings={{ ...DEFAULT_SETTINGS, language: 'ru' }} updateAvailable />)
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
  })

  it('calls onUpdate when tapped, and only then', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<Header {...baseProps} updateAvailable onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
