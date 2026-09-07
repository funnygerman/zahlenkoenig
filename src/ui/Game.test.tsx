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
  /** What is inside the brackets right now — the other half of "did the block move or did its content?". */
  const inGroupText = () => [...document.querySelectorAll('[class*="inGroup"]')].map(b => b.textContent?.trim()).join(' ')

  /**
   * Rects the way the real stylesheet lays them out, not the flat
   * non-overlapping row `mockZoneRects` invents: a block's wrapper spans
   * its content plus padding, and each bracket edge is a ~22px strip at one
   * end of it that overlaps the outermost chip by a few px (concept 6.6,
   * Expression.module.css). The overlaps are the whole point — a drop on a
   * bracket edge has to reach the edge and not the chip behind it.
   */
  const CHIP = 32, GAP = 4, PAD = 12, EDGE = 16
  function setRect(el: Element, left: number, right: number) {
    ;(el as HTMLElement).getBoundingClientRect = () => ({
      left, right, top: 100, bottom: 150, width: right - left, height: 50, x: left, y: 100,
      toJSON() { return this },
    }) as DOMRect
  }
  function layoutField() {
    const field = document.querySelector('div[class*="_field_"]')!
    let x = 0
    for (const child of field.children) {
      if (!child.className.includes('_group_')) {
        setRect(child, x, x + CHIP)
        x += CHIP + GAP
        continue
      }
      const start = x
      x += PAD
      for (const gc of child.children) {
        if (gc.getAttribute('aria-label') === 'Klammer auflösen') continue
        // the frontier is a zero-width line hard against the last chip
        // (Expression.module.css cancels the row gap for it), which is
        // exactly where the right bracket edge's strip begins
        if (gc.className.includes('_groupFrontier_')) { setRect(gc, x - GAP, x - GAP); continue }
        setRect(gc, x, x + CHIP)
        x += CHIP + GAP
      }
      x = x - GAP + PAD
      setRect(child, start, x)
      const edges = child.querySelectorAll('[aria-label="Klammer auflösen"]')
      setRect(edges[0], start, start + EDGE)
      setRect(edges[1], x - EDGE, x)
      x += GAP
    }
  }
  /** The middle of one bracket edge of the (single) block on the board. */
  function edgeCentre(side: 'left' | 'right') {
    const edges = document.querySelectorAll('[aria-label="Klammer auflösen"]')
    const rect = edges[side === 'left' ? 0 : 1].getBoundingClientRect()
    return { x: (rect.left + rect.right) / 2, y: 125 }
  }

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

  it('dragging the block over the row moves the brackets, not the content (concept 6.5, revised)', async () => {
    // The PO's fourth device round replaced 6.5's swap rule: a block that
    // travels with its content can only ever trade places with another
    // operand, and re-bracketing — the thing a player actually wants — took
    // a dissolve and a fresh wrap. Now the brackets slide over the row and
    // the row itself never changes. `(6+2) × 9` dropped on its own `2` is
    // `6 + (2 × 9)`: 6.5's own worked example, in one gesture.
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
    expect(inGroupText()).toBe('6 + 2')

    layoutField()
    const two = [...document.querySelectorAll('[class*="_slot_"]')].find(el => el.textContent?.trim() === '2')!
    const twoRect = two.getBoundingClientRect()
    const edge = screen.getAllByRole('button', { name: 'Klammer auflösen' })[0]
    drag(edge, { x: (twoRect.left + twoRect.right) / 2, y: 125 })

    expect(placedText()).toBe('6 + 2 × 9') // the row reads exactly as before
    expect(inGroupText()).toBe('2 × 9') // only the brackets moved: 6 + (2 × 9)
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

describe('Game — dragging a neighbor into an adjacent block absorbs it whole, not just the one chip (concept 6.2)', () => {
  // Reported bug: build a flat expression, wrap part of it into a block,
  // then drag the *one* leftover chip next to the block into it. Moving
  // only that chip used to leave its own connector — an operand or
  // operator with nothing next to it any more — stranded at the root,
  // permanently unfillable once the puzzle's budget for that kind was
  // already exactly spent. Dragging either half of the connecting pair
  // now brings both in together, via real (unmocked-geometry) pointer
  // drags end to end, same as the tests above.
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

  it('dragging the leftover operator into the block absorbs it and its number together', async () => {
    const user = userEvent.setup()
    render(<Game />)

    // build 6 + 2 × 9 flat (three of the puzzle's four numbers)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('×', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('9', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    expect(placedText()).toBe('6 + 2 × 9')

    // drag the block chip onto "2" — wraps the right pair (2 × 9), concept 6.1
    let zones = mockZoneRects()
    let twoZoneIndex = [...zones].findIndex(z => z.textContent?.trim() === '2')
    const twoRect = (zones[twoZoneIndex] as HTMLElement).getBoundingClientRect()
    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    drag(blockChip, { x: twoRect.left + 10, y: twoRect.top + 10 })
    expect(placedText()).toBe('6 + 2 × 9') // same content, now (2×9) is a block
    expect(document.querySelectorAll('[class*="_group_"]')).toHaveLength(1)

    // drag the leftover "+" (outside the block) into the block's own frontier
    zones = mockZoneRects()
    const frontier = document.querySelector('[class*="_groupFrontier_"]')!
    const frontierRect = frontier.getBoundingClientRect()
    const rootPlus = screen.getAllByText('+', { selector: 'button' }).find(b => b.className.includes('_field_'))!
    drag(rootPlus, { x: frontierRect.left + 10, y: frontierRect.top + 10 })

    expect(placedText()).toBe('6 + 2 × 9') // "6" came along too — nothing left outside the block
    expect(document.querySelectorAll('[class*="_group_"]')).toHaveLength(1) // still just one block
    expect(screen.getByRole('status')).toHaveTextContent('(6 + 2 × 9)')
  })
})

describe('Game — a chip dropped on a block’s bracket edge joins the block there (concept 6.2, PO 4th round)', () => {
  // Reported after the fourth device round, with a block already holding
  // two numbers: "if I move the operator onto the left side of the block it
  // removes the operator; the right side works" and "if I move the number,
  // that number and its operator end up on the other side of the block —
  // outside it".
  //
  // Both are the same missing thing seen twice. The block's own wrapper was
  // one wide *operand* zone spanning the whole block, so an operator
  // released on the left half of a block found no operator-kind zone within
  // reach at all and counted as "dragged out of the field" (concept 5) —
  // it vanished. A number found the wrapper, which meant 6.5's old rule:
  // swap the block and the number, which puts the number and its operator
  // outside the block, on the far side. Neither gesture could say *which
  // end* of the block was meant, because one zone can't.
  //
  // The two bracket edges are now that zone, one per end, and take a chip
  // of either kind. Real (unmocked) pointer drags, with the rects laid out
  // the way the stylesheet actually lays them out — overlaps and all.
  const placed = () => [...document.querySelectorAll<HTMLButtonElement>('button[class*="_chip_"][class*="_field_"]')]
  const placedText = () => placed().map(b => b.textContent?.trim()).join(' ')
  const inGroupText = () => [...document.querySelectorAll('[class*="inGroup"]')].map(b => b.textContent?.trim()).join(' ')

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

  const CHIP = 32, GAP = 4, PAD = 12, EDGE = 16
  function setRect(el: Element, left: number, right: number) {
    ;(el as HTMLElement).getBoundingClientRect = () => ({
      left, right, top: 100, bottom: 150, width: right - left, height: 50, x: left, y: 100,
      toJSON() { return this },
    }) as DOMRect
  }
  function layoutField() {
    const field = document.querySelector('div[class*="_field_"]')!
    let x = 0
    for (const child of field.children) {
      if (!child.className.includes('_group_')) {
        setRect(child, x, x + CHIP)
        x += CHIP + GAP
        continue
      }
      const start = x
      x += PAD
      for (const gc of child.children) {
        if (gc.getAttribute('aria-label') === 'Klammer auflösen') continue
        // the frontier is a zero-width line hard against the last chip
        // (Expression.module.css cancels the row gap for it), which is
        // exactly where the right bracket edge's strip begins
        if (gc.className.includes('_groupFrontier_')) { setRect(gc, x - GAP, x - GAP); continue }
        setRect(gc, x, x + CHIP)
        x += CHIP + GAP
      }
      x = x - GAP + PAD
      setRect(child, start, x)
      const edges = child.querySelectorAll('[aria-label="Klammer auflösen"]')
      setRect(edges[0], start, start + EDGE)
      setRect(edges[1], x - EDGE, x)
      x += GAP
    }
  }
  function edgeCentre(side: 'left' | 'right') {
    const edges = document.querySelectorAll('[aria-label="Klammer auflösen"]')
    const rect = edges[side === 'left' ? 0 : 1].getBoundingClientRect()
    return { x: (rect.left + rect.right) / 2, y: 125 }
  }

  /** 6 + 2 × 9 flat, then the tray's block chip dropped on the "2" — wrapping (2 × 9) and leaving "6 +" outside it. */
  async function boardWithBlock() {
    const user = userEvent.setup()
    render(<Game />)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('×', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('9', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    layoutField()
    const two = [...document.querySelectorAll('[class*="_slot_"]')].find(el => el.textContent?.trim() === '2')!
    const twoRect = two.getBoundingClientRect()
    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    drag(blockChip, { x: (twoRect.left + twoRect.right) / 2, y: 125 })
    expect(inGroupText()).toBe('2 × 9')
    layoutField()
  }

  const fieldChip = (text: string) =>
    screen.getAllByText(text, { selector: 'button' }).find(b => b.className.includes('_field_'))!

  it('an operator on the LEFT edge joins the block on the left — it used to vanish instead', async () => {
    await boardWithBlock()
    drag(fieldChip('+'), edgeCentre('left'))

    expect(placedText()).toBe('6 + 2 × 9') // nothing lost — the "+" is still on the board
    expect(inGroupText()).toBe('6 + 2 × 9') // and its "6" came along, inside the block
    expect(screen.getByRole('status')).toHaveTextContent('(6 + 2 × 9)')
  })

  it('the same operator on the RIGHT edge joins the block on the right — the side of the drop decides', async () => {
    await boardWithBlock()
    drag(fieldChip('+'), edgeCentre('right'))

    expect(inGroupText()).toBe('2 × 9 + 6')
    expect(screen.getByRole('status')).toHaveTextContent('(2 × 9 + 6)')
  })

  it('a number on the RIGHT edge joins the block too — it used to trade places with the whole block', async () => {
    await boardWithBlock()
    drag(fieldChip('6'), edgeCentre('right'))

    expect(inGroupText()).toBe('2 × 9 + 6') // inside, not swapped to the far side of the brackets
    expect(screen.getByRole('status')).toHaveTextContent('(2 × 9 + 6)')
  })

  it('a number on the LEFT edge joins on the left, and the block is then the whole expression', async () => {
    await boardWithBlock()
    drag(fieldChip('6'), edgeCentre('left'))

    expect(inGroupText()).toBe('6 + 2 × 9')
    expect(screen.getByRole('status')).toHaveTextContent('(6 + 2 × 9)')
  })

  it('an operator let go a few px too far, on a number inside the block, bounces back instead of vanishing', async () => {
    // The other half of the same report. Concept 3.2 makes a surface of the
    // other kind a refusal rather than a near miss — but a refusal was
    // reported as "no zone at all", which the board reads as concept 5's
    // "herausziehen" and removes the chip. Missing the edge by 2px cost you
    // the operator.
    await boardWithBlock()
    const two = [...document.querySelectorAll('[class*="_slot_"]')].find(el => el.textContent?.trim() === '2')!
    const twoRect = two.getBoundingClientRect()
    drag(fieldChip('+'), { x: (twoRect.left + twoRect.right) / 2, y: 125 })

    expect(placedText()).toBe('6 + 2 × 9') // the "+" is still on the board
    expect(inGroupText()).toBe('2 × 9') // and nothing moved
  })

  it('a tray chip on an edge brings an open slot with it, so a block can be prepared for a third number', async () => {
    const user = userEvent.setup()
    render(<Game />)
    const blockChip = screen.getAllByRole('button').find(b => b.querySelector('[class*="blockIcon"]'))!
    await user.click(blockChip)
    await user.click(screen.getAllByText('6', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await user.click(screen.getAllByText('+', { selector: 'button' })[0])
    await user.click(screen.getAllByText('2', { selector: 'button' }).find(b => !(b as HTMLButtonElement).disabled)!)
    expect(inGroupText()).toBe('6 + 2')

    layoutField()
    const trayNine = screen.getAllByText('9', { selector: 'button' }).find(b => !b.className.includes('_field_'))!
    drag(trayNine, edgeCentre('right'))

    expect(inGroupText()).toBe('6 + 2 9') // (6 + 2 ⬚ 9): the empty operator slot came with it
    expect(screen.getByRole('status')).toHaveTextContent('(6 + 2 9)') // 9.2's line skips open gaps
    expect(screen.getByText('=', { selector: 'button' })).toBeDisabled() // still a slot to fill
  })
})
