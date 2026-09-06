import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board } from './Board'
import type { Operator } from '../core/expression'

// End-to-end smoke test for v2 step 2's actual goal: "ein fest verdrahtetes
// Rätsel ist spielbar". Exercises the real rendered tree — Board -> useGame
// + useDrag -> Tray/Expression/Chip — not just the hooks in isolation, so
// it's the one place a wiring mistake between them (e.g. the double-fire
// bug fixed just before this file was written) would actually show up.
//
// This renders Board directly with a fixed puzzle, not Game: Game (step 3)
// draws a random one from the generator, and these tests are about the
// tap/drag wiring, not what puzzle happens to be on screen.

const PUZZLE = { numbers: [6, 2, 9, 3], target: 48, ops: ['+', '-', '*', '/'] as Operator[] }
function Game() {
  return <Board numbers={PUZZLE.numbers} target={PUZZLE.target} ops={PUZZLE.ops} />
}

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

    expect(screen.getByRole('status')).toHaveTextContent('(6 + 2) × (9 − 3) = 48')
  })
})

describe('Game — dragging a placed block (concept 6.5: "ein Block ist ein Operand")', () => {
  // jsdom has no PointerEvent constructor and no pointer-capture methods
  // (vitest.setup.ts stubs the latter), so a real fireEvent.pointerDown
  // doesn't carry clientX/clientY the way a browser's does — building the
  // event by hand and assigning the coordinates directly is what actually
  // exercises useDrag's threshold/hit-test logic instead of silently
  // no-op'ing on `undefined` coordinates.
  function pointerEvt(type: string, x: number, y: number) {
    const e = new Event(type, { bubbles: true, cancelable: true }) as unknown as {
      pointerId: number; clientX: number; clientY: number
    }
    e.pointerId = 1
    e.clientX = x
    e.clientY = y
    return e as unknown as Event
  }

  function drag(el: Element, to: { x: number; y: number }) {
    fireEvent(el, pointerEvt('pointerdown', 0, 0))
    fireEvent(el, pointerEvt('pointermove', to.x, to.y))
    fireEvent(el, pointerEvt('pointerup', to.x, to.y))
  }

  /** Every registered drop zone gets its own non-overlapping rectangle, in DOM order — real layout doesn't exist in jsdom, so the hit test needs something to measure. */
  function mockZoneRects() {
    const zones = document.querySelectorAll('[class*="_slot_"], [class*="_group_"], [class*="_groupFrontier_"]')
    zones.forEach((el, i) => {
      ;(el as HTMLElement).getBoundingClientRect = () => ({
        left: i * 100, right: i * 100 + 80, top: 500, bottom: 550, width: 80, height: 50, x: i * 100, y: 500,
        toJSON() { return this },
      }) as DOMRect
    })
    return zones
  }

  const placed = () => [...document.querySelectorAll<HTMLButtonElement>('button[class*="_chip_"][class*="_field_"]')]
  const placedText = () => placed().map(b => b.textContent?.trim()).join(' ')

  it('dragging the bracket edge out of the field dissolves the block, content stays (concept 6.8)', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    expect(placedText()).toBe('6 + 2')
    expect(document.querySelector('[class*="_group_"]')).not.toBeNull()

    mockZoneRects()
    const edge = screen.getAllByRole('button', { name: 'Klammer auflösen' })[0]
    drag(edge, { x: -999, y: -999 }) // released well outside every zone

    expect(document.querySelector('[class*="_group_"]')).toBeNull() // brackets gone
    expect(placedText()).toBe('6 + 2') // content stayed, in place
    expect(blockChip).toBeEnabled() // the block budget freed up again
  })

  it('dragging the block onto another operand swaps them, content travels with it (concept 6.5)', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('×', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('9', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    expect(placedText()).toBe('6 + 2 × 9') // (6+2) × 9, brackets excluded from the text query on purpose

    const zones = mockZoneRects()
    const nineZoneIndex = [...zones].findIndex(z => z.textContent?.includes('9'))
    expect(nineZoneIndex).toBeGreaterThan(-1)
    const nineRect = (zones[nineZoneIndex] as HTMLElement).getBoundingClientRect()

    const edge = screen.getAllByRole('button', { name: 'Klammer auflösen' })[0]
    drag(edge, { x: nineRect.left + 10, y: nineRect.top + 10 })

    expect(placedText()).toBe('9 × 6 + 2') // 9 × (6+2): the pair swapped root positions
    expect(document.querySelector('[class*="_group_"]')).not.toBeNull() // still a block, content intact
  })
})

describe('Game — growing a group past its minimum shape (concept 6.2: up to three numbers)', () => {
  // The bug this reproduces: the group's own wrapper is registered as a
  // wide 'operand' drop zone spanning the whole block (concept 6.5 — drop
  // a number on the block to swap with it), and that wrapper physically
  // *encloses* the group's own zero-width 'operator' frontier zone. Real,
  // non-overlapping mocked rects (mockZoneRects, used by the tests above)
  // never exercise this — the two zones have to actually overlap the way
  // they do in the real layout for the "other kind squarely inside is a
  // refusal" rule to blanket-refuse the nested frontier. Reproduced here
  // with rects that overlap on purpose, the way the real DOM's do.
  const placed = () => [...document.querySelectorAll<HTMLButtonElement>('button[class*="_chip_"][class*="_field_"]')]
  const placedText = () => placed().map(b => b.textContent?.trim()).join(' ')

  function pointerEvt(type: string, x: number, y: number) {
    const e = new Event(type, { bubbles: true, cancelable: true }) as unknown as {
      pointerId: number; clientX: number; clientY: number
    }
    e.pointerId = 1
    e.clientX = x
    e.clientY = y
    return e as unknown as Event
  }
  function drag(el: Element, to: { x: number; y: number }) {
    fireEvent(el, pointerEvt('pointerdown', 0, 0))
    fireEvent(el, pointerEvt('pointermove', to.x, to.y))
    fireEvent(el, pointerEvt('pointerup', to.x, to.y))
  }

  it('a drag lands in the group frontier a few px off its exact (zero-width) line', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    expect(placedText()).toBe('6 + 2')

    const groupEl = document.querySelector('[class*="_group_"]') as HTMLElement
    const frontierEl = document.querySelector('[class*="_groupFrontier_"]') as HTMLElement
    // the wrapper spans the whole block; the frontier is a zero-width line
    // inside it, near its right edge — exactly as in the real layout.
    groupEl.getBoundingClientRect = () => ({
      left: 20, right: 170, top: 100, bottom: 150, width: 150, height: 50, x: 20, y: 100, toJSON() { return this },
    }) as DOMRect
    frontierEl.getBoundingClientRect = () => ({
      left: 158, right: 158, top: 100, bottom: 150, width: 0, height: 50, x: 158, y: 100, toJSON() { return this },
    }) as DOMRect

    const trayTimes = screen.getAllByText('×', { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    drag(trayTimes, { x: 153, y: 125 }) // 5px off the frontier's exact line, still inside the group's wrapper

    expect(placedText()).toBe('6 + 2 ×') // landed *inside* the group, not bounced or placed at root
    expect(document.querySelectorAll('[class*="_group_"]')).toHaveLength(1) // still one block, not two
  })
})
