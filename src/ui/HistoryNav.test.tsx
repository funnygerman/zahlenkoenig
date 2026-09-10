import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryNav } from './HistoryNav'

// The footer/history round's puzzle-browsing strip: two arrows over
// core/solvedHistory.ts's archive. This component owns only the render —
// whether an arrow is enabled given `index`/`total`, and that tapping one
// calls back — not the archive itself (solvedHistory.test.ts) or the
// live/replay wiring in Game.tsx (that class of bug can only be caught
// where the two are actually joined, same reasoning Game.test.tsx's own
// banner gives for tap/drag).

const noop = () => {}
const baseProps = {
  onBack: noop,
  onForward: noop,
  backLabel: 'Previous solved puzzle',
  forwardLabel: 'Next puzzle',
}

describe('HistoryNav — visibility', () => {
  it('renders nothing with an empty archive', () => {
    const { container } = render(<HistoryNav {...baseProps} index={null} total={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders once there is at least one solved puzzle', () => {
    render(<HistoryNav {...baseProps} index={null} total={1} />)
    expect(screen.getByRole('button', { name: 'Previous solved puzzle' })).toBeInTheDocument()
  })
})

describe('HistoryNav — arrow state while live (index === null)', () => {
  it('back is enabled, forward is not — there is nothing "ahead" of the live puzzle', () => {
    render(<HistoryNav {...baseProps} index={null} total={3} />)
    expect(screen.getByRole('button', { name: 'Previous solved puzzle' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next puzzle' })).toBeDisabled()
  })

  it('shows no position number while live', () => {
    render(<HistoryNav {...baseProps} index={null} total={3} />)
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument()
  })
})

describe('HistoryNav — arrow state while browsing', () => {
  it('shows the 1-indexed position out of the total', () => {
    render(<HistoryNav {...baseProps} index={1} total={5} />)
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('both arrows enabled in the middle of the archive', () => {
    render(<HistoryNav {...baseProps} index={2} total={5} />)
    expect(screen.getByRole('button', { name: 'Previous solved puzzle' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next puzzle' })).toBeEnabled()
  })

  it('back disables at the oldest entry (index 0)', () => {
    render(<HistoryNav {...baseProps} index={0} total={5} />)
    expect(screen.getByRole('button', { name: 'Previous solved puzzle' })).toBeDisabled()
  })

  it('forward stays enabled at the newest entry — it steps back to live from there', () => {
    render(<HistoryNav {...baseProps} index={4} total={5} />)
    expect(screen.getByRole('button', { name: 'Next puzzle' })).toBeEnabled()
  })
})

describe('HistoryNav — callbacks', () => {
  it('calls onBack when the back arrow is tapped', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<HistoryNav {...baseProps} onBack={onBack} index={null} total={2} />)
    await user.click(screen.getByRole('button', { name: 'Previous solved puzzle' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('calls onForward when the forward arrow is tapped', async () => {
    const user = userEvent.setup()
    const onForward = vi.fn()
    render(<HistoryNav {...baseProps} onForward={onForward} index={0} total={2} />)
    await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
    expect(onForward).toHaveBeenCalledTimes(1)
  })
})
