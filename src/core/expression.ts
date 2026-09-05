// The v2 data model (concept section 2): an expression is a tree, not a
// token list — that's the one change everything else (block-as-chip,
// drag&drop, reordering, delete-without-a-button) follows from (concept
// section 1). No React import — see CLAUDE.md's rule that `core/` is pure
// TypeScript.
//
// Exactly two levels: the root holds numbers, operators and groups; a group
// holds only numbers and operators. No group inside a group — the type
// enforces it: `Group.children` doesn't know about `Group` (concept 2).

export type Operator = '+' | '-' | '*' | '/'

export interface NumberLeaf {
  id: string
  kind: 'number'
  value: number
  source: number // index into puzzle.numbers — distinguishes equal-valued leaves, e.g. the two 6s in [6,6,9]
}

export interface OperatorLeaf {
  id: string
  kind: 'operator'
  value: Operator
}

export type Leaf = NumberLeaf | OperatorLeaf

export interface Group {
  id: string
  kind: 'group'
  children: (Leaf | null)[]
}

export type Slot = Leaf | Group | null // null = a visible gap

export interface Expression {
  root: { id: 'root'; kind: 'group'; children: Slot[] }
}

// ------------------------------------------------------------------- ids
// Stable for the lifetime of a chip — React uses them as `key`, so chips
// survive reordering and can be animated (concept 2).

let idCounter = 0

export function makeId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

// --------------------------------------------------------------- building

export function createExpression(): Expression {
  return { root: { id: 'root', kind: 'group', children: [] } }
}

/**
 * A freshly wrapped, still-empty group always shows its minimum shape —
 * operand, operator, operand (concept 6.3: "Ein Block zeigt immer sein
 * Minimum") — rather than a single open slot, so it reads as "needs at
 * least two numbers" without anyone having to be told the rule.
 */
export function createEmptyGroup(): Group {
  return { id: makeId('group'), kind: 'group', children: [null, null, null] }
}

export function createNumberLeaf(value: number, source: number): NumberLeaf {
  return { id: makeId('num'), kind: 'number', value, source }
}

export function createOperatorLeaf(value: Operator): OperatorLeaf {
  return { id: makeId('op'), kind: 'operator', value }
}

/** One leaf per puzzle number, `source` set to its index (concept 2). */
export function createTray(numbers: number[]): NumberLeaf[] {
  return numbers.map((value, source) => createNumberLeaf(value, source))
}

// -------------------------------------------------------- the invariant
// concept 2.1: even positions hold an operand (number or group), odd
// positions hold an operator; null marks an open position. A group is
// complete when it has no null left and its length is odd; a bracket group
// additionally needs at least two operands (length >= 3).

function isFilledAndOdd<T>(children: readonly (T | null)[]): boolean {
  return children.length % 2 === 1 && children.every(c => c !== null)
}

export function isGroupComplete(group: Group): boolean {
  return group.children.length >= 3 && isFilledAndOdd(group.children)
}

export function isExpressionComplete(expr: Expression): boolean {
  const { children } = expr.root
  if (!isFilledAndOdd(children)) return false
  return children.every(slot => slot === null || slot.kind !== 'group' || isGroupComplete(slot))
}

// --------------------------------------------------- the four operations
// concept section 3. Pure: each returns a new array, leaving the input
// untouched — concept 6.9's own pseudocode mutates root.children directly,
// but a React state update wants a fresh reference, and pure functions are
// what "im Terminal testbar" (CLAUDE.md) means in practice.
//
// Generic over T (Leaf | Group at the root, Leaf inside a group — a group
// can never hold another group, concept section 4) because the alternation
// itself doesn't care which kind of node lives at which position: that's a
// logical convention (concept 2.1), not something the type system
// enforces beyond forbidding nested groups. Callers (backed by dropZones
// below) are responsible for only ever placing an operator-kind Leaf at an
// odd index and an operand-kind node at an even one.

/**
 * New operand at an even position. At the trailing frontier (`index ===
 * children.length`) this is a plain append — nothing follows yet, so no
 * companion gap is needed, and the result stays complete when this was the
 * expression's last operand (concept 2.1's "no null" requirement). Inserted
 * into the middle of an existing sequence, splicing in `[operand, null]`
 * makes room for it AND opens a fresh operator gap to its right — concept
 * 3's example: `3 + 7`, insert 5 before 7 → `3 + 5 ⬚ 7`.
 */
export function insertOperand<T>(children: readonly (T | null)[], index: number, operand: T): (T | null)[] {
  const next = children.slice()
  if (index === next.length) next.push(operand)
  else next.splice(index, 0, operand, null)
  return next
}

/** `children[i] = node` — fills an already-open gap without changing length. */
export function fillGap<T>(children: readonly (T | null)[], index: number, node: T): (T | null)[] {
  const next = children.slice()
  next[index] = node
  return next
}

/** Exchange two positions of the same parity (concept 3: "Tauschen"). */
export function swapSlots<T>(children: readonly (T | null)[], i: number, j: number): (T | null)[] {
  const next = children.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * Remove an operand together with one adjacent operator, so nobody is left
 * sitting on a dangling operator (concept 3). Prefers the operator that
 * follows; if there isn't one (this operand is last), takes the one before
 * it instead — concept 3's example: `3 + 7`, remove 7 → `3`.
 */
export function removeOperand<T>(children: readonly (T | null)[], index: number): (T | null)[] {
  const next = children.slice()
  if (index + 1 < next.length) next.splice(index, 2)
  else next.splice(index - 1, 2)
  return next
}

/** Removing an operator leaves a gap — whoever removes one almost always wants a different one, not fewer numbers (concept 3). */
export function removeOperator<T>(children: readonly (T | null)[], index: number): (T | null)[] {
  const next = children.slice()
  next[index] = null
  return next
}

// ------------------------------------------------------- block: wrap/dissolve
// concept 6.9. `wrap` only makes sense at the root — a group can't contain
// another group, so these operate on `(Leaf | Group | null)[]` specifically
// rather than the generic `T` above.

type RootChildren = readonly (Leaf | Group | null)[]

/**
 * Encloses `span` existing root children (3 for a pair, 1 for a lone
 * number — concept 6.1/6.2) in a new group. 3-against-1 and 1-against-1
 * both preserve the parity of everything after them, so the invariant
 * still holds (concept 6.9).
 */
export function wrapGroup(children: RootChildren, index: number, span: 1 | 3): (Leaf | Group | null)[] {
  const next = children.slice()
  const enclosed = next.slice(index, index + span) as (Leaf | null)[]
  const group: Group = { id: makeId('group'), kind: 'group', children: enclosed }
  next.splice(index, span, group)
  return next
}

/**
 * The inverse of `wrapGroup`: the group at `index` is replaced by its own
 * children, in place — concept 6.5: "Die Klammern verschwinden. [...] Es
 * fällt nichts heraus."
 */
export function dissolveGroup(children: RootChildren, index: number): (Leaf | Group | null)[] {
  const target = children[index]
  if (!target || target.kind !== 'group') {
    throw new Error(`dissolveGroup: no group at index ${index}`)
  }
  const next = children.slice()
  next.splice(index, 1, ...target.children)
  return next
}

// --------------------------------------------------------------- drop zones
// concept 3.1: computed, not stored. Every null position is open, the
// position after the last child is open, and every occupied position is a
// swap target for a chip of the same kind.

export type DropZoneKind = 'operand' | 'operator'

export interface DropZone {
  index: number
  kind: DropZoneKind
  /** true if dropping here swaps with the chip already there, rather than filling an empty gap. */
  occupied: boolean
}

export function dropZones<T>(children: readonly (T | null)[]): DropZone[] {
  const zones: DropZone[] = []
  for (let i = 0; i <= children.length; i++) {
    const kind: DropZoneKind = i % 2 === 0 ? 'operand' : 'operator'
    const occupied = i < children.length && children[i] !== null
    zones.push({ index: i, kind, occupied })
  }
  return zones
}

// ----------------------------------------------------------- next open surface
// concept 3.1: "nächste offene Fläche" for tapping a tray chip into place —
// strictly document order, and a group's own interior comes before the
// surface behind the group.

export interface Surface {
  /** `null` for a root-level surface, the enclosing group's id otherwise. */
  groupId: string | null
  index: number
  kind: DropZoneKind
}

/**
 * The next open surface of the given kind, walking the tree in document
 * order, or null if there isn't one. Purely structural: the trailing
 * frontier always counts as "open" for whichever kind matches its parity,
 * even once a puzzle's own chip budget is exhausted (e.g. the frontier
 * after a complete 2-number expression is technically an open operator
 * surface). Whether there's actually another chip of that kind left to put
 * there is the caller's concern, not this function's.
 */
export function nextOpenSurface(expr: Expression, kind: DropZoneKind): Surface | null {
  const { children } = expr.root
  for (let i = 0; i < children.length; i++) {
    const slot = children[i]
    if (slot !== null && slot.kind === 'group') {
      for (let j = 0; j < slot.children.length; j++) {
        const zoneKind: DropZoneKind = j % 2 === 0 ? 'operand' : 'operator'
        if (slot.children[j] === null && zoneKind === kind) {
          return { groupId: slot.id, index: j, kind }
        }
      }
      continue
    }
    const zoneKind: DropZoneKind = i % 2 === 0 ? 'operand' : 'operator'
    if (slot === null && zoneKind === kind) return { groupId: null, index: i, kind }
  }
  const frontierKind: DropZoneKind = children.length % 2 === 0 ? 'operand' : 'operator'
  return frontierKind === kind ? { groupId: null, index: children.length, kind } : null
}

// ------------------------------------------------------- block drop targeting
// concept 6.1: what dropping the block chip onto existing content encloses.
// Only resolves operand-position targets for now — 6.1 also lets an
// operator position work identically to the operand-pair it belongs to
// (the "nützliche Überschneidung"), but wiring that up needs the drag layer
// to treat a dragged block as matching both zone kinds, which useDrag.ts
// doesn't support yet (TODO, noted where the block chip's drag is wired).

export type BlockDropResult =
  | { kind: 'empty' } // an empty operand slot: place a bare, still-empty group there (concept 6.1's first row)
  | { kind: 'wrap'; span: 1 | 3; start: number } // existing content: enclose it (concept 6.1/6.2)

function isPlainLeaf(children: RootChildren, index: number): boolean {
  const slot = children[index]
  return slot !== null && slot !== undefined && slot.kind !== 'group'
}

/**
 * Resolves what dropping a block chip at root `index` (an operand
 * position) would enclose. Right-before-left (concept 6.1: "weil eine
 * angetippte Zahl sich wie 'hier beginnt die Klammer' liest — in
 * Leserichtung"): prefers the pair to the right, falls back to the pair on
 * the left, and finally encloses the lone number if neither pair is
 * available. Never reaches into or across an existing group — a group
 * can't contain another group (concept section 4), so `isPlainLeaf`
 * treats a neighboring group the same as a missing neighbor.
 */
export function resolveBlockDrop(children: RootChildren, index: number): BlockDropResult | null {
  if (index % 2 !== 0) return null // operator position — not resolved in this pass, see the note above
  const slot = children[index]
  // `undefined` (the trailing frontier, beyond the array's current length)
  // is an open operand slot exactly like a stored `null` — only the
  // reason differs, not the outcome.
  if (slot === null || slot === undefined) return { kind: 'empty' }
  if (slot.kind === 'group') return null // already a group — not a valid block target

  if (isPlainLeaf(children, index + 1) && isPlainLeaf(children, index + 2)) {
    return { kind: 'wrap', span: 3, start: index }
  }
  if (isPlainLeaf(children, index - 1) && isPlainLeaf(children, index - 2)) {
    return { kind: 'wrap', span: 3, start: index - 2 }
  }
  return { kind: 'wrap', span: 1, start: index }
}
