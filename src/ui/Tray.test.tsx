import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tray, type TrayNumberSlot, type TrayBlockSlot } from './Tray'

function numberSlots(values: number[], usedIds: string[] = []): TrayNumberSlot[] {
  return values.map((value, i) => ({ id: `n${i}`, value, used: usedIds.includes(`n${i}`) }))
}

const noop = () => {}

describe('Tray — right-aligned numbers (concept 12.1/12.3)', () => {
  it('pads a 2-number puzzle with two empty ("nichts") cells, not placeholders', () => {
    render(
      <Tray
        numberSlots={numberSlots([5, 9])}
        blockSlots={[]}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    expect(screen.getAllByText('5')).toHaveLength(1)
    expect(screen.getAllByText('9')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="emptyCell"]')).toHaveLength(2)
    expect(document.querySelectorAll('[class*="placeholder"]')).toHaveLength(0)
    // only 2 real chips (the numbers) plus the operator and submit — no
    // placeholder buttons for the two missing number slots
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2 + 1 + 1) // 2 numbers, 1 operator, 1 submit
  })

  it('a 4-number puzzle needs no padding', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2, 3, 4])}
        blockSlots={[]}
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
        blockSlots={[]}
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
        blockSlots={[]}
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
        blockSlots={[]}
        operators={['+', '*']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={onTapOperator} onSubmit={noop}
      />
    )
    await userEvent.click(screen.getByText('×'))
    expect(onTapOperator).toHaveBeenCalledWith('*')
  })
})

describe('Tray — block chips (concept 4: floor(n/2) chips)', () => {
  it('renders as many block chips as given, each independently used/available', () => {
    const blockSlots: TrayBlockSlot[] = [{ id: 'b0', used: false }, { id: 'b1', used: true }]
    render(
      <Tray
        numberSlots={numberSlots([1, 2, 3, 4])}
        blockSlots={blockSlots}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
      />
    )
    const placeholders = document.querySelectorAll('[class*="placeholder"]')
    expect(placeholders).toHaveLength(1) // only b1, the used one
  })

  it('tapping an available block chip reports its id', async () => {
    const onTapBlock = vi.fn()
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockSlots={[{ id: 'b0', used: false }]}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={onTapBlock} onTapOperator={noop} onSubmit={noop}
      />
    )
    const blockIcon = document.querySelector('[class*="blockIcon"]')!
    await userEvent.click(blockIcon.closest('button')!)
    expect(onTapBlock).toHaveBeenCalledWith('b0')
  })
})

describe('Tray — submit (concept 9.1: dimmed until the expression is complete)', () => {
  it('is disabled when submitEnabled is false', () => {
    render(
      <Tray
        numberSlots={numberSlots([1, 2])}
        blockSlots={[]}
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
        blockSlots={[]}
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
  it('wires dragHandlers onto unused number and block chips, not placeholders', () => {
    const dragHandlers = vi.fn((_item: { id: string; kind: 'operand' | 'operator' }) => (
      { onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn() }
    ))
    render(
      <Tray
        numberSlots={numberSlots([6, 6], ['n0'])}
        blockSlots={[{ id: 'b0', used: false }]}
        operators={['+']}
        submitEnabled={false}
        onTapNumber={noop} onTapBlock={noop} onTapOperator={noop} onSubmit={noop}
        dragHandlers={dragHandlers}
      />
    )
    // called for: n1 (unused number), b0 (unused block), and the '+' operator chip — not n0 (used)
    const calledIds = dragHandlers.mock.calls.map(([item]) => item.id)
    expect(calledIds).toContain('n1')
    expect(calledIds).toContain('b0')
    expect(calledIds).not.toContain('n0')
  })
})
