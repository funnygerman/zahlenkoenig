// The pointer-events drag layer (concept 5.1). No HTML5 drag-and-drop — it
// doesn't fire on iOS Safari on touch, and the app is mobile first.
//
// This hook only answers two questions: was a press a tap or a drag, and if
// a drag, which drop zone (if any) was it released over? It knows nothing
// about expression.ts's tree — insert/fillGap/swap/remove/wrap/dissolve are
// the caller's job (concept 5: "Tippen kostet fast keinen zusätzlichen
// Code — dieselbe Operation mit einem anderen Auslöser" applies here too:
// `onTap` and `onDrop` both ultimately trigger the same tree operation one
// level up, this hook just decides which gesture happened).
//
// Drop zones are DOM elements the caller registers via `registerZone`
// (typically from each zone's ref callback, re-registered every render —
// cheap, it's just a Map write, not a state update). They're measured with
// getBoundingClientRect() exactly once, when a drag crosses the threshold,
// then hit purely by rectangle for the rest of that drag (concept 3.1/5.1)
// — no re-measuring mid-drag, no layout thrashing.
//
// The ghost element (concept 5.1: "ein Geisterelement folgt dem Finger über
// transform — ohne React-Render pro Bewegung") is owned by the caller —
// attach `ghostRef` to it — but its `transform` is written directly on
// every pointermove, bypassing React state entirely.
//
// Callers are responsible for `touch-action: none` and `user-select: none`
// on draggable chips and zones (concept 5.1) — that's CSS, not this hook's
// concern.

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export type DragKind = 'operand' | 'operator'

export interface DragItem<T = unknown> {
  id: string
  kind: DragKind
  /** Whatever the caller needs back in onTap/onDrop — e.g. "this is the block chip, not a number". */
  data?: T
}

export interface DropTarget {
  zoneId: string
  /** Whether a chip already sits in this zone — a swap, not a fill (concept 3.1). */
  occupied: boolean
}

export interface UseDragOptions<T = unknown> {
  /** Released without crossing the threshold — concept 5: the exact inverse of placing. */
  onTap: (item: DragItem<T>) => void
  /** Released after crossing the threshold. `target` is null when released outside every zone of a matching kind — concept 5: "herausziehen" (remove). */
  onDrop: (item: DragItem<T>, target: DropTarget | null) => void
  /** Pointer movement, in px, before a press counts as a drag rather than a tap (concept 5.1). */
  threshold?: number
}

/** The pointer handlers for one draggable chip — spread onto its root element. */
export interface DragHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
}

export interface UseDragResult<T = unknown> {
  /** Call from a zone's ref callback: `ref={el => registerZone('root-2', 'operand', false, el)}`. Pass `el = null` to deregister (e.g. on unmount). */
  registerZone: (zoneId: string, kind: DragKind, occupied: boolean, el: HTMLElement | null) => void
  /** Spread onto a chip: `<div {...dragHandlers({ id, kind })}>`. */
  dragHandlers: (item: DragItem<T>) => DragHandlers
  /** Attach to the ghost element the caller renders while `isDragging`. */
  ghostRef: RefObject<HTMLDivElement>
  /** True once the threshold has been crossed — nothing before this is a drag yet. */
  isDragging: boolean
  /** The zone currently under the pointer, or null. Changes trigger a render (for highlighting); raw pointer movement doesn't. */
  activeZoneId: string | null
  /** The kind of item being dragged, so callers can dim zones of the other kind (concept 5: "beim Ziehen einer Zahl leuchten nur Operand-Flächen"). */
  draggingKind: DragKind | null
}

interface ZoneEntry {
  el: HTMLElement
  kind: DragKind
  occupied: boolean
}

interface MeasuredZone {
  zoneId: string
  occupied: boolean
  rect: DOMRect
}

export function useDrag<T = unknown>(options: UseDragOptions<T>): UseDragResult<T> {
  const { onTap, onDrop, threshold = 6 } = options

  const zonesRef = useRef(new Map<string, ZoneEntry>())
  const measuredRef = useRef<MeasuredZone[]>([])

  const itemRef = useRef<DragItem<T> | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false) // synchronous mirror of isDragging — pointermove needs it before the next render
  const activeZoneIdRef = useRef<string | null>(null)

  const ghostRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null)
  const [draggingKind, setDraggingKind] = useState<DragKind | null>(null)

  const registerZone = useCallback((zoneId: string, kind: DragKind, occupied: boolean, el: HTMLElement | null) => {
    if (el) zonesRef.current.set(zoneId, { el, kind, occupied })
    else zonesRef.current.delete(zoneId)
  }, [])

  const hitTest = useCallback((x: number, y: number): MeasuredZone | null => {
    for (const zone of measuredRef.current) {
      if (x >= zone.rect.left && x <= zone.rect.right && y >= zone.rect.top && y <= zone.rect.bottom) {
        return zone
      }
    }
    return null
  }, [])

  const reset = useCallback(() => {
    itemRef.current = null
    pointerIdRef.current = null
    startRef.current = null
    draggingRef.current = false
    activeZoneIdRef.current = null
    measuredRef.current = []
    setIsDragging(false)
    setActiveZoneId(null)
    setDraggingKind(null)
    if (ghostRef.current) ghostRef.current.style.transform = ''
  }, [])

  const dragHandlers = useCallback((item: DragItem<T>) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      itemRef.current = item
      pointerIdRef.current = e.pointerId
      startRef.current = { x: e.clientX, y: e.clientY }
    },

    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!itemRef.current || !startRef.current || e.pointerId !== pointerIdRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y

      if (!draggingRef.current) {
        if (Math.hypot(dx, dy) < threshold) return
        draggingRef.current = true
        // Measure now, once, and only zones of the matching kind (concept
        // 3.1/5): a dragged number never lights up an operator slot.
        measuredRef.current = [...zonesRef.current.entries()]
          .filter(([, zone]) => zone.kind === item.kind)
          .map(([zoneId, zone]) => ({ zoneId, occupied: zone.occupied, rect: zone.el.getBoundingClientRect() }))
        setIsDragging(true)
        setDraggingKind(item.kind)
      }

      if (ghostRef.current) ghostRef.current.style.transform = `translate(${dx}px, ${dy}px)`

      const hit = hitTest(e.clientX, e.clientY)
      const zoneId = hit?.zoneId ?? null
      if (zoneId !== activeZoneIdRef.current) {
        activeZoneIdRef.current = zoneId
        setActiveZoneId(zoneId)
      }
    },

    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      if (!itemRef.current || e.pointerId !== pointerIdRef.current) return
      const draggedItem = itemRef.current
      const wasDragging = draggingRef.current
      const hitZoneId = activeZoneIdRef.current
      const hitOccupied = measuredRef.current.find(z => z.zoneId === hitZoneId)?.occupied ?? false
      reset()
      if (wasDragging) onDrop(draggedItem, hitZoneId ? { zoneId: hitZoneId, occupied: hitOccupied } : null)
      else onTap(draggedItem)
    },

    onPointerCancel: () => {
      // A cancelled gesture (e.g. the OS takes over for a system gesture)
      // is neither a tap nor a completed drop — just let go of it.
      reset()
    },
  }), [threshold, hitTest, reset, onDrop, onTap])

  return { registerZone, dragHandlers, ghostRef, isDragging, activeZoneId, draggingKind }
}
