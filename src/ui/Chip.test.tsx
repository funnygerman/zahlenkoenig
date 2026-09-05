import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip, operatorGlyph } from './Chip'

describe('Chip — content per variant (concept 12.2)', () => {
  it('number shows the value', () => {
    render(<Chip variant="number" value={6} />)
    expect(screen.getByRole('button')).toHaveTextContent('6')
  })

  it('operator shows its glyph, not the raw character (concept 13.2: typographic minus/times/divide)', () => {
    render(<Chip variant="operator" operator="-" />)
    expect(screen.getByRole('button')).toHaveTextContent('−')
    expect(operatorGlyph('*')).toBe('×')
    expect(operatorGlyph('/')).toBe('÷')
    expect(operatorGlyph('+')).toBe('+')
  })

  it('submit shows "="', () => {
    render(<Chip variant="submit" />)
    expect(screen.getByRole('button')).toHaveTextContent('=')
  })

  it('target shows "= value", stepping the value down a size at three digits (concept 12.1)', () => {
    const { rerender } = render(<Chip variant="target" value={48} />)
    expect(screen.getByRole('button')).toHaveTextContent('=48')
    const smallVal = document.querySelector('[class*="val"]')!
    expect(smallVal.className).not.toMatch(/valWide/)

    rerender(<Chip variant="target" value={324} />)
    const wideVal = document.querySelector('[class*="val"]')!
    expect(wideVal.className).toMatch(/valWide/)
  })

  it('block renders its symbol (square, open circle, square — concept 12.2 "Variante D")', () => {
    render(<Chip variant="block" />)
    const squares = document.querySelectorAll('[class*="blockSquare"]')
    const ring = document.querySelectorAll('[class*="blockRing"]')
    expect(squares).toHaveLength(2)
    expect(ring).toHaveLength(1)
  })

  it('explicit children override the default content', () => {
    render(<Chip variant="number">custom</Chip>)
    expect(screen.getByRole('button')).toHaveTextContent('custom')
  })
})

describe('Chip — placeholder (concept 6.6)', () => {
  it('renders no content, regardless of value/operator/children', () => {
    render(<Chip variant="number" value={6} placeholder />)
    expect(screen.getByRole('button')).toHaveTextContent('')
  })

  it('is still clickable — tapping a placeholder returns whatever left it', async () => {
    const onClick = vi.fn()
    render(<Chip variant="number" value={6} placeholder onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Chip — ghost scaffold slots (concept 6.4: not a placeholder, not a drop target)', () => {
  it('renders as an inert element, not a button — concept 6.4: "keine eigenen Ablageziele"', () => {
    render(<Chip variant="number" ghost />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ignores onClick — a ghost cannot be tapped', async () => {
    const onClick = vi.fn()
    const { container } = render(<Chip variant="number" ghost onClick={onClick} />)
    await userEvent.click(container.firstChild as Element)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Chip — shape (concept 12.2: numbers/target/submit/block square, operators round)', () => {
  it('operator gets the circle class, everything else gets square', () => {
    const opRender = render(<Chip variant="operator" operator="+" />)
    expect(screen.getByRole('button').className).toMatch(/circle/)
    opRender.unmount()

    for (const variant of ['number', 'target', 'submit', 'block'] as const) {
      const { unmount } = render(<Chip variant={variant} value={1} />)
      expect(screen.getByRole('button').className).toMatch(/square/)
      unmount()
    }
  })
})

describe('Chip — disabled state (concept 9.1: "=" dims until the expression is complete)', () => {
  it('disables the button and forwards the disabled prop', () => {
    render(<Chip variant="submit" disabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('a disabled chip does not fire onClick', async () => {
    const onClick = vi.fn()
    render(<Chip variant="submit" disabled onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Chip — pass-through props (drag/tap wiring is the caller\'s job, concept 5)', () => {
  it('spreads arbitrary handlers (e.g. useDrag\'s dragHandlers) onto the root element', () => {
    const onPointerDown = vi.fn()
    render(<Chip variant="number" value={3} onPointerDown={onPointerDown} data-testid="chip-3" />)
    screen.getByTestId('chip-3').dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onPointerDown).toHaveBeenCalled()
  })
})
