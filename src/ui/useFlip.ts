// Concept 13.3's "Wege zwischen Ablage und Ausdruck laufen als FLIP-
// Animation über die stabile `id`" — First/Last/Invert/Play: measure a
// chip's rect before a re-render, measure it again after, and if it moved,
// play the difference back as a transform animation instead of letting the
// chip simply appear in its new spot. The stable `id` this needs already
// exists — `useGame.ts`'s `tray = createTray(numbers)` gives every number
// leaf one `id` for its whole lifetime, whether it's currently sitting in
// the tray or placed in the expression (confirmed by reading `trayNumbers`:
// it's the same tray array, filtered by whether `placedIds` has that same
// id) — so a chip crossing that boundary is genuinely one continuous thing
// to animate, not two different elements that happen to look alike.
//
// Operators and the block chip don't get the tray→field half of this: the
// tray's own operator/block chips are one permanent chip per *type*
// (concept section 4/12.1), not one per placement, so a placed operator
// leaf's `id` (from `createOperatorLeaf`) never matches the tray chip's id
// (`tray-op-${op}`) it came from — there is no stable id to FLIP across
// for that crossing. Within the expression tree itself, every leaf
// (number or operator) does keep one stable id across a move (absorbing
// into a group, a root-level swap, ...), so that half still FLIPs.
//
// The "federnd" (springy) half of 13.3 rides the same animation rather
// than needing a second one: an overshoot easing curve on the translate
// reads as a spring without a second, competing `transform` animation
// fighting this one for the same CSS property.
import { useCallback, useLayoutEffect, useRef } from 'react'

const SPRING_DURATION_MS = 280
const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)' // ease-out-back: overshoots slightly, then settles — the "federnd" 13.3 asks for

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Returns a ref-callback: pass `(el) => registerFlipNode(id, el)` as a
 * chip's `ref`. Call this hook once per surface that shares one set of
 * moving ids (Board.tsx calls it once, covering both Tray and Expression,
 * since a number's id is the same set either way).
 */
export function useFlip() {
  const nodes = useRef(new Map<string, HTMLElement>())
  const rects = useRef(new Map<string, DOMRect>())

  const registerFlipNode = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodes.current.set(id, el)
    else nodes.current.delete(id)
  }, [])

  // Layout effect, not a regular one: it has to read rects and apply the
  // inverted starting transform *before* the browser paints the new
  // layout, or the chip would flash in its new position for a frame first.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion()
    const nextRects = new Map<string, DOMRect>()

    for (const [id, el] of nodes.current) {
      const nextRect = el.getBoundingClientRect()
      nextRects.set(id, nextRect)
      if (reduced) continue

      const prevRect = rects.current.get(id)
      if (!prevRect) continue // new chip, nothing to FLIP from
      const dx = prevRect.left - nextRect.left
      const dy = prevRect.top - nextRect.top
      if (!dx && !dy) continue

      el.style.transition = 'none'
      el.style.transform = `translate(${dx}px, ${dy}px)`
      el.getBoundingClientRect() // force a reflow so the browser commits the jump before the next line reverses it
      el.style.transition = `transform ${SPRING_DURATION_MS}ms ${SPRING_EASING}`
      el.style.transform = ''
      // Clears the inline transition afterward — left set, it would still
      // be there for the next *unrelated* style change on this same
      // persistent DOM node (React patches chips in place, it doesn't
      // recreate them) and animate something FLIP was never about.
      const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear) }
      el.addEventListener('transitionend', clear)
    }

    rects.current = nextRects
  })

  return registerFlipNode
}
