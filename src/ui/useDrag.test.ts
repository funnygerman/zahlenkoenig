import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDrag, type DragItem, type DropTarget } from './useDrag'
import type { PointerEvent as ReactPointerEvent } from 'react'

// A minimal stand-in for a React pointer event: the hook only ever reads
// pointerId/clientX/clientY and calls currentTarget.setPointerCapture, so
// that's all these fixtures provide — a real jsdom PointerEvent isn't
// needed to exercise the hook's own logic.
function pointerEvent(x: number, y: number, pointerId = 1): ReactPointerEvent<HTMLElement> {
  return {
    pointerId,
    clientX: x,
    clientY: y,
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as ReactPointerEvent<HTMLElement>
}

function zoneElement(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return this }, ...rect,
  })
  return el
}

const ITEM: DragItem = { id: 'num-3', kind: 'operand' }

describe('useDrag — tap vs drag (concept 5.1: 6px threshold)', () => {
  it('pointerdown then pointerup with no movement is a tap', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    act(() => handlers.onPointerUp(pointerEvent(100, 100)))

    expect(onTap).toHaveBeenCalledWith(ITEM)
    expect(onDrop).not.toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
  })

  it('movement under the threshold is still a tap', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    act(() => handlers.onPointerMove(pointerEvent(103, 102))) // dist ~3.6px < 6
    act(() => handlers.onPointerUp(pointerEvent(103, 102)))

    expect(onTap).toHaveBeenCalledWith(ITEM)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('movement past the threshold becomes a drag, and isDragging flips exactly once', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    expect(result.current.isDragging).toBe(false)

    act(() => handlers.onPointerMove(pointerEvent(110, 100))) // 10px > 6
    expect(result.current.isDragging).toBe(true)
    expect(result.current.draggingKind).toBe('operand')

    act(() => handlers.onPointerUp(pointerEvent(110, 100)))
    expect(onTap).not.toHaveBeenCalled()
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(result.current.isDragging).toBe(false) // reset after release
  })
})

describe('useDrag — drop targets and zone kind matching (concept 3.1)', () => {
  it('reports the zone under the pointer at release, with its occupied flag', () => {
    const onTap = vi.fn(), onDrop = vi.fn<(item: DragItem, target: DropTarget | null) => void>()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))

    act(() => result.current.registerZone('root-2', 'operand', true, zoneElement({ left: 50, right: 70, top: 50, bottom: 70 })))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(0, 0)))
    act(() => handlers.onPointerMove(pointerEvent(20, 0))) // crosses threshold, no zone here
    act(() => handlers.onPointerMove(pointerEvent(60, 60))) // now inside root-2's rect
    expect(result.current.activeZoneId).toBe('root-2')

    act(() => handlers.onPointerUp(pointerEvent(60, 60)))
    expect(onDrop).toHaveBeenCalledWith(ITEM, { zoneId: 'root-2', occupied: true })
  })

  it('released outside every zone reports a null target (concept 5: "herausziehen")', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    act(() => result.current.registerZone('root-2', 'operand', false, zoneElement({ left: 500, right: 520, top: 500, bottom: 520 })))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(0, 0)))
    act(() => handlers.onPointerMove(pointerEvent(20, 0)))
    act(() => handlers.onPointerUp(pointerEvent(20, 0)))

    expect(onDrop).toHaveBeenCalledWith(ITEM, null)
  })

  it('a zone of the other kind never lights up, even if the pointer is over it (concept 5: "nur Operand-Flächen")', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    act(() => result.current.registerZone('root-1', 'operator', false, zoneElement({ left: 0, right: 100, top: 0, bottom: 100 })))
    const handlers = result.current.dragHandlers({ id: 'num-3', kind: 'operand' })

    act(() => handlers.onPointerDown(pointerEvent(0, 0)))
    act(() => handlers.onPointerMove(pointerEvent(10, 10))) // inside the operator zone's rect, but dragging an operand
    expect(result.current.activeZoneId).toBeNull()

    act(() => handlers.onPointerUp(pointerEvent(10, 10)))
    expect(onDrop).toHaveBeenCalledWith({ id: 'num-3', kind: 'operand' }, null)
  })

  it('zones are measured once, at the threshold crossing — moving a zone afterwards has no effect on this drag', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const el = zoneElement({ left: 500, right: 520, top: 500, bottom: 520 })
    act(() => result.current.registerZone('root-2', 'operand', false, el))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(0, 0)))
    act(() => handlers.onPointerMove(pointerEvent(20, 0))) // crosses threshold; zone measured at (500-520, 500-520)

    // the zone moves after measurement (e.g. a layout shift mid-drag)
    el.getBoundingClientRect = () => ({ left: 20, right: 40, top: 0, bottom: 20, width: 20, height: 20, x: 20, y: 0, toJSON() { return this } })

    act(() => handlers.onPointerMove(pointerEvent(25, 5))) // now over the zone's *new* position, ignored
    expect(result.current.activeZoneId).toBeNull()
  })
})

describe('useDrag — ghost element (concept 5.1: transform, no re-render per move)', () => {
  it('writes the ghost transform directly once dragging starts', () => {
    const { result } = renderHook(() => useDrag({ onTap: vi.fn(), onDrop: vi.fn() }))
    const ghost = document.createElement('div')
    // JSX's `ref={ghostRef}` assignment bypasses RefObject's readonly type; simulate it directly here.
    ;(result.current.ghostRef as { current: HTMLDivElement | null }).current = ghost
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    act(() => handlers.onPointerMove(pointerEvent(110, 100)))
    expect(ghost.style.transform).toBe('translate(10px, 0px)')

    act(() => handlers.onPointerMove(pointerEvent(130, 90)))
    expect(ghost.style.transform).toBe('translate(30px, -10px)')
  })

  it('clears the ghost transform when the drag ends', () => {
    const { result } = renderHook(() => useDrag({ onTap: vi.fn(), onDrop: vi.fn() }))
    const ghost = document.createElement('div')
    // JSX's `ref={ghostRef}` assignment bypasses RefObject's readonly type; simulate it directly here.
    ;(result.current.ghostRef as { current: HTMLDivElement | null }).current = ghost
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    act(() => handlers.onPointerMove(pointerEvent(110, 100)))
    act(() => handlers.onPointerUp(pointerEvent(110, 100)))
    expect(ghost.style.transform).toBe('')
  })
})

describe('useDrag — pointer cancel', () => {
  it('neither taps nor drops on cancel', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100)))
    act(() => handlers.onPointerMove(pointerEvent(110, 100)))
    act(() => handlers.onPointerCancel(pointerEvent(110, 100)))

    expect(onTap).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(result.current.isDragging).toBe(false)
  })
})

describe('useDrag — a second pointer is ignored mid-drag', () => {
  it('only the pointerId that started the drag can move or end it', () => {
    const onTap = vi.fn(), onDrop = vi.fn()
    const { result } = renderHook(() => useDrag({ onTap, onDrop }))
    const handlers = result.current.dragHandlers(ITEM)

    act(() => handlers.onPointerDown(pointerEvent(100, 100, 1)))
    act(() => handlers.onPointerMove(pointerEvent(999, 999, 2))) // a different finger
    expect(result.current.isDragging).toBe(false)

    act(() => handlers.onPointerUp(pointerEvent(999, 999, 2)))
    expect(onTap).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()

    // the original pointer can still complete normally
    act(() => handlers.onPointerUp(pointerEvent(100, 100, 1)))
    expect(onTap).toHaveBeenCalledTimes(1)
  })
})
