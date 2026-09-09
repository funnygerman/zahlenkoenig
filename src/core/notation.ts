// The notation line (concept 9.2): real mathematical notation that grows
// as the player builds, e.g. "(6 + 2) × (9 − 3)". No React import.
//
// "Precedence-aware" doesn't mean an operator-precedence algorithm here —
// the tree already carries its own grouping (a Group *is* a bracket,
// concept section 2), so printing it is a straight walk that always
// wraps a group in parens and never has to decide whether one is needed.
// A flat run of leaves prints with ordinary left-to-right precedence
// (× and ÷ bind tighter than + and − at evaluation time, concept 8) but
// needs no parens of its own, because nothing here ever reorders it.

import { operatorGlyph, type Expression, type Leaf, type Slot } from './expression'

function notateLeaf(leaf: Leaf): string {
  return leaf.kind === 'number' ? String(leaf.value) : operatorGlyph(leaf.value)
}

/**
 * Renders a (possibly incomplete) sequence of slots — open gaps are simply
 * skipped, which is what lets the line grow chip by chip while the player
 * is still building rather than only appearing once the expression is
 * complete.
 */
function notateChildren(children: readonly Slot[]): string {
  const parts: string[] = []
  for (const child of children) {
    if (child === null) continue
    if (child.kind === 'group') parts.push(`(${notateChildren(child.children)})`)
    else parts.push(notateLeaf(child))
  }
  return parts.join(' ')
}

/** The full notation line for the current tree, without a result — concept 9.2's "(6 + 2) × (9 − 3)". */
export function notate(expr: Expression): string {
  return notateChildren(expr.root.children)
}

/**
 * A result value the way the notation line prints it — negative included
 * (result-on-submit round: a wrong, negative-result attempt shows its own
 * "= −3" now instead of nothing). Uses the same typographic minus as
 * `operatorGlyph('-')` rather than JS's plain `-`, so a negative result
 * doesn't sit in a different typeface from the "−" earlier in the line.
 */
export function formatResult(result: number): string {
  return result < 0 ? `−${-result}` : String(result)
}
