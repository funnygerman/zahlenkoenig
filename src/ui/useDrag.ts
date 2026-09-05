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
// attach `ghostRef` to it, and render the dragged chip inside it (see
// `draggingItem`) — but its `transform` is written directly on every
// pointermove, bypassing React state entirely. The transform is the
// pointer's *viewport position*, so the ghost must be `position: fixed`
// with its own `translate(-50%, -50%)` folded in by this hook, not by CSS
// (an inline transform would overwrite a stylesheet one). The chip the
// drag started from is dimmed for the duration, directly on its style —
// same reason: no render per drag.
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
  /**
   * How far outside a zone's rectangle a release still counts as hitting
   * it, in px. Every root position is registered at its row's full height
   * (Expression's `.slot`), so this isn't about reaching *up* to a slot —
   * it only bridges the horizontal seams between them: the 4px flex gap,
   * the field's 5px padding, a group's zero-width frontier. Keeping it
   * small is what makes "herausziehen" (concept 5) reliable — the tray
   * starts 11px below the field's slots, so letting go over the tray
   * always means the tray, never the slot above it.
   */
  tolerance?: number
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
  /** The item currently being dragged, so the caller can render it inside the ghost. Null until the threshold is crossed. */
  draggingItem: DragItem<T> | null
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

/** Whether the pointer is inside a rectangle. */
function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

export function useDrag<T = unknown>(options: UseDragOptions<T>): UseDragResult<T> {
  const { onTap, onDrop, threshold = 6, tolerance = 8 } = options

  const zonesRef = useRef(new Map<string, ZoneEntry>())
  const measuredRef = useRef<MeasuredZone[]>([])
  const otherKindRef = useRef<DOMRect[]>([]) // zones of the kind NOT being dragged — see hitTest

  const itemRef = useRef<DragItem<T> | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false) // synchronous mirror of isDragging — pointermove needs it before the next render
  const activeZoneIdRef = useRef<string | null>(null)

  const sourceElRef = useRef<HTMLElement | null>(null)

  const ghostRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null)
  const [draggingItem, setDraggingItem] = useState<DragItem<T> | null>(null)

  const registerZone = useCallback((zoneId: string, kind: DragKind, occupied: boolean, el: HTMLElement | null) => {
    if (el) zonesRef.current.set(zoneId, { el, kind, occupied })
    else zonesRef.current.delete(zoneId)
  }, [])

  // Containment first, then the nearest zone within `tolerance` — see the
  // option's own note on why a rectangle alone isn't enough. Distance is
  // measured to the rectangle, not to its centre, so a wide zone isn't
  // beaten by a small one that happens to sit closer to its middle.
  //
  // Between the two: a pointer squarely inside a zone of the *other* kind
  // is a refusal, not a near miss. Without that, letting go on the middle
  // of an empty number slot while dragging an operator reached past it to
  // the operator 20px away and replaced that one instead — aiming at a
  // slot and hitting its neighbour. Tolerance is for the space between
  // slots, never for crossing one.
  const hitTest = useCallback((x: number, y: number): MeasuredZone | null => {
    let nearest: MeasuredZone | null = null
    let nearestDistance = Infinity
    for (const zone of measuredRef.current) {
      if (contains(zone.rect, x, y)) return zone
      const { left, right, top, bottom } = zone.rect
      const dx = x < left ? left - x : x > right ? x - right : 0
      const dy = y < top ? top - y : y > bottom ? y - bottom : 0
      const distance = Math.hypot(dx, dy)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = zone
      }
    }
    if (otherKindRef.current.some(rect => contains(rect, x, y))) return null
    return nearestDistance <= tolerance ? nearest : null
  }, [tolerance])

  const reset = useCallback(() => {
    itemRef.current = null
    pointerIdRef.current = null
    startRef.current = null
    draggingRef.current = false
    activeZoneIdRef.current = null
    measuredRef.current = []
    otherKindRef.current = []
    setIsDragging(false)
    setActiveZoneId(null)
    setDraggingItem(null)
    if (sourceElRef.current) sourceElRef.current.style.opacity = ''
    sourceElRef.current = null
    if (ghostRef.current) ghostRef.current.style.transform = ''
  }, [])

  // The ghost is centred on the pointer, in viewport coordinates — not
  // offset by however far the finger has travelled since pointerdown, which
  // is what the pointer *delta* would give (with `position: fixed; top: 0;
  // left: 0` that put the ghost in the top-left corner of the screen, tens
  // of pixels above the expression field, wherever you actually dragged).
  const moveGhost = useCallback((x: number, y: number) => {
    const ghost = ghostRef.current
    if (ghost) ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  }, [])

  const dragHandlers = useCallback((item: DragItem<T>) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      // A second finger landing mid-drag would otherwise overwrite the
      // first one's item and leave the original chip dimmed forever.
      if (pointerIdRef.current !== null) return
      e.currentTarget.setPointerCapture(e.pointerId)
      itemRef.current = item
      pointerIdRef.current = e.pointerId
      startRef.current = { x: e.clientX, y: e.clientY }
      sourceElRef.current = e.currentTarget
    },

    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!itemRef.current || !startRef.current || e.pointerId !== pointerIdRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y

      if (!draggingRef.current) {
        if (Math.hypot(dx, dy) < threshold) return
        draggingRef.current = true
        // Measure now, once. Only zones of the matching kind can be hit
        // (concept 3.1/5: a dragged number never lights up an operator
        // slot) — the rest are kept anyway, as the areas where hitTest
        // refuses rather than reaching past.
        measuredRef.current = []
        otherKindRef.current = []
        for (const [zoneId, zone] of zonesRef.current) {
          const rect = zone.el.getBoundingClientRect()
          if (zone.kind === item.kind) measuredRef.current.push({ zoneId, occupied: zone.occupied, rect })
          else otherKindRef.current.push(rect)
        }
        setIsDragging(true)
        setDraggingItem(item)
        // The chip stays in place but recedes: what moves is the ghost
        // (concept 5.1). Written straight onto the node, like the ghost's
        // own transform — a render per drag start would be one too many.
        if (sourceElRef.current) sourceElRef.current.style.opacity = '0.3'
      }

      moveGhost(e.clientX, e.clientY)

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

    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerId !== pointerIdRef.current) return
      // A cancelled gesture (e.g. the OS takes over for a system gesture)
      // is neither a tap nor a completed drop — just let go of it.
      reset()
    },
  }), [threshold, hitTest, moveGhost, reset, onDrop, onTap])

  return { registerZone, dragHandlers, ghostRef, isDragging, activeZoneId, draggingItem, draggingKind: draggingItem?.kind ?? null }
}
