import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateHint } from './UpdateHint'

// Concept 19.3's update hint ("ein knapper Hinweis... statt eines
// Popup-Dialogs") — the one part of the PWA round that's actually this
// app's own code rather than vite-plugin-pwa's (registration, precaching
// and the actual update cycle are the library's own, already well-tested
// upstream). What's tested here is narrower: does it render exactly when
// told to, in the player's own language, and does tapping it call back.
//
// These tests moved here from Header.test.tsx unchanged in substance when
// the share round moved the pill out of the header onto its own row — the
// behaviour they pin never depended on where it sits.

describe('the update hint (concept 19.3)', () => {
  it('is absent when there is no update', () => {
    render(<UpdateHint available={false} language="en" />)
    expect(screen.queryByText('Update')).not.toBeInTheDocument()
  })

  it('shows the hint, in the current language, when an update is available', () => {
    render(<UpdateHint available language="en" />)
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('shows the German copy for a German player', () => {
    render(<UpdateHint available language="de" />)
    expect(screen.getByRole('button', { name: 'Aktualisieren' })).toBeInTheDocument()
  })

  it('shows the Russian copy for a Russian player', () => {
    render(<UpdateHint available language="ru" />)
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
  })

  it('calls onUpdate when tapped, and only then', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<UpdateHint available language="en" onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
