import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tray, type TrayNumberSlot } from './Tray'

function numberSlots(values: number[], usedIds: string[] = []): TrayNumberSlot[] {
  return values.map((value, i) => ({ id: `n${i}`, value, used: usedIds.includes(`n${i}`) }))
}

const noop = () => {}

describe('Tray — right-aligned numbers (concept 12.1/12.3)', () => {
  it('pads a 2-number puzzle with two empty ("nichts") cells, not placeholders', () => {
    render(
      <Tray
        numberSlots={numberSlots([5, 9])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    expect(screen.getAllByText('5')).toHaveLength(1)
    expect(screen.getAllByText('9')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="emptyCell"]')).toHaveLength(2)
    expect(document.querySelectorAll('[class*="placeholder"]')).toHaveLength(0)
    // 2 numbers, 1 block, 1 operator, 1 submit — no placeholder buttons for
    // the two missing number slots
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2 + 1 + 1 + 1)
  })

  it('a 4-number puzzle needs no padding', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2, 3, 4])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    expect(document.querySelectorAll('[class*="emptyCell"]')).toHaveLength(0)
  })
})

describe('Tray — used numbers become placeholders (concept 6.6)', () => {
  it('a used number renders as an empty, dashed chip and still responds to tap', async () => {
    const onTapNumber = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([6, 6, 9], ['n0'])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={onTapNumber} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    // both 6s render one visible "6" (the unused one) and one empty placeholder
    expect(screen.getAllByText('6')).toHaveLength(1)
    const placeholder = document.querySelector('[class*="placeholder"]')!
    await userEvent.click(placeholder)
    expect(onTapNumber).toHaveBeenCalledWith('n0')
  })
})

describe('Tray — operators (concept 12.1: fixed × ÷ + − order, only enabled ones shown)', () => {
  it('shows only the enabled operators, in fixed order regardless of input order', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockDisabled={false}
        operators={['-', '+']} // deliberately out of order
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    const opButtons = screen.getAllByRole('button').filter(b => ['+', '−', '×', '÷'].includes(b.textContent ?? ''))
    expect(opButtons.map(b => b.textContent)).toEqual(['+', '−'])
  })

  it('tapping an operator reports which one', async () => {
    const onTapOperator = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockDisabled={false}
        operators={['+', '*']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={onTapOperator} onSubmit={noop}
      />
    )
    await userEvent.click(screen.getByText('×'))
    expect(onTapOperator).toHaveBeenCalledWith('*')
  })
})

describe('Tray — block chip (concept 4: a single, permanent chip like an operator)', () => {
  it('is enabled while the budget allows another block', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2, 3, 4])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    const blockIcon = document.querySelector('[class*="blockIcon"]')!
    expect(blockIcon.closest('button')).toBeEnabled()
  })

  it('disables (not hides) once the budget is used up', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2, 3, 4])}
        blockDisabled
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    const blockIcon = document.querySelector('[class*="blockIcon"]')!
    expect(blockIcon.closest('button')).toBeDisabled()
  })

  it('tapping the block chip calls onTapBlock', async () => {
    const onTapBlock = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={onTapBlock} onTapOperator={noop} onSubmit={noop}
      />
    )
    const blockIcon = document.querySelector('[class*="blockIcon"]')!
    await userEvent.click(blockIcon.closest('button')!)
    expect(onTapBlock).toHaveBeenCalledTimes(1)
  })
})

describe('Tray — submit (concept 9.1: dimmed until the expression is complete)', () => {
  it('is disabled when submitEnabled is false', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    expect(screen.getByText('=', { selector: 'button' })).toBeDisabled()
  })

  it('fires onSubmit when enabled and clicked', async () => {
    const onSubmit = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={onSubmit}
      />
    )
    const submitBtn = screen.getByText('=', { selector: 'button' })
    expect(submitBtn).toBeEnabled()
    await userEvent.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('Tray — drag wiring (concept 5.1)', () => {
  it('wires dragHandlers onto every number and the block chip, used placeholders included', () => {
    // Not conditioned on `used`: a tap's pointerup already re-renders with
    // the flipped `used` value before the browser's trailing native click
    // for that same gesture fires, so a `used`-conditioned wiring would
    // undo the tap it just made (see Tray.tsx's own note on this). onTap
    // itself already handles both directions, so drag stays wired
    // regardless of `used`.
    const dragHandlers = vi.fn((_item: { id: string; kind: 'operand' | 'operator' }) => (
      { onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }
    ))
    render(
      <Tray
        numberSlots={numberSlots([6, 6], ['n0'])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
        dragHandlers={dragHandlers}
      />
    )
    const calledIds = dragHandlers.mock.calls.map(([item]) => item.id)
    expect(calledIds).toContain('n0')
    expect(calledIds).toContain('n1')
    expect(calledIds).toContain('tray-block')
  })

  it("doesn't also attach a plain onClick where drag is wired — a real tap would otherwise fire both the native click and useDrag's own tap detection", async () => {
    const dragHandlers = vi.fn((_item: { id: string; kind: 'operand' | 'operator' }) => (
      { onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }
    ))
    const onTapNumber = vi.fn(), onTapOperator = vi.fn(), onTapBlock = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([6])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={onTapNumber} onTapBlock={onTapBlock} onTapOperator={onTapOperator} onSubmit={noop}
        dragHandlers={dragHandlers}
      />
    )
    for (const el of screen.getAllByRole('button')) await userEvent.click(el)
    expect(onTapNumber).not.toHaveBeenCalled()
    expect(onTapBlock).not.toHaveBeenCalled()
    expect(onTapOperator).not.toHaveBeenCalled()
  })

  it('without dragHandlers, taps still work directly (tap-only usage stays supported)', async () => {
    const onTapNumber = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([6])}
        blockDisabled={false}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={onTapNumber} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    await userEvent.click(screen.getByText('6'))
    expect(onTapNumber).toHaveBeenCalledWith('n0')
  })
})
