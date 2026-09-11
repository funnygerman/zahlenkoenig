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

// Display glyphs (concept 13.2: typographic minus/times/divide, not the
// keyboard characters) — shared by Chip.tsx (a chip's own label) and
// notation.ts (the notation line, concept 9.2), so the two never drift.
const OPERATOR_GLYPH: Record<Operator, string> = {
  '+': '+',
  '-': '−', // −
  '*': '×', // ×
  '/': '÷', // ÷
}

export function operatorGlyph(op: Operator): string {
  return OPERATOR_GLYPH[op]
}

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

/**
 * Places a node at `index`, growing the sequence with open gaps if that
 * position doesn't exist yet. The three cases are one operation seen at
 * different distances: inside the sequence it fills a gap, exactly at the
 * end it appends, and beyond the end it opens every position in between
 * first. That last case is what lets a player drop a chip into the *third*
 * scaffold slot of an empty field and leave the first two open — the
 * scaffold (concept 6.4) shows those positions, so dropping into one has
 * to mean the position it shows, not "wherever there's room".
 *
 * Not `insertOperand`: nothing is displaced. `children[index]` is that
 * position, before and after.
 */
export function placeAt<T>(children: readonly (T | null)[], index: number, node: T): (T | null)[] {
  const next = children.slice()
  while (next.length < index) next.push(null)
  if (index === next.length) next.push(node)
  else next[index] = node
  return next
}

/**
 * Drops open positions from the end. They aren't content — the scaffold
 * re-derives exactly as many as the puzzle still needs (concept 6.4), so
 * storing them too would show them twice; and a stored trailing gap makes
 * a finished expression look unfinished (`3 + 7 ⬚` has an even length, so
 * `isExpressionComplete` says no and `=` stays disabled).
 */
export function trimTrailingGaps<T>(children: readonly (T | null)[]): (T | null)[] {
  let end = children.length
  while (end > 0 && children[end - 1] === null) end -= 1
  return children.slice(0, end)
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
 * The first position of this kind entirely past the content: `end` itself
 * when the parity matches, the one after it otherwise.
 *
 * The "otherwise" is what lets a player tap two numbers in a row. After
 * `6` the content ends at index 1, an operator position; the next *number*
 * belongs at index 2, and the operator position it steps over simply stays
 * open (`placeAt` opens it). Returning nothing there instead — which is
 * what this used to do — meant a tapped number was silently ignored unless
 * an operator had been tapped immediately before it. `entwurf.html`'s own
 * `nextOpenOperand` has had the same `+ 1` from the start.
 */
function positionPastEnd(end: number, kind: DropZoneKind): number {
  const parity = kind === 'operand' ? 0 : 1
  return end % 2 === parity ? end : end + 1
}

/**
 * The next open surface of the given kind, walking the tree in document
 * order. Purely structural, and never null — the sequence can always grow,
 * so a position of either kind always exists. Whether the puzzle has
 * another chip of that kind left to put there is the caller's concern:
 * `useGame` gates numbers by the tray and operators by n − 1.
 */
export function nextOpenSurface(expr: Expression, kind: DropZoneKind): Surface {
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
  return { groupId: null, index: positionPastEnd(children.length, kind), kind }
}

/**
 * Like `nextOpenSurface`, but never descends into a group's interior — for
 * placing a *new* block, which only ever targets a root-level position
 * (concept section 4: a group can't contain another group, so a block
 * dropped inside one isn't a valid target — `resolveBlockDrop` already
 * enforces this for drag; a tapped block needs the same restriction, or it
 * finds a group's own open interior slot and overwrites the group sitting
 * there instead of adding a second one alongside it).
 */
export function nextOpenRootSurface(expr: Expression, kind: DropZoneKind): Surface {
  const { children } = expr.root
  for (let i = 0; i < children.length; i++) {
    const slot = children[i]
    if (slot !== null && slot.kind === 'group') continue
    const zoneKind: DropZoneKind = i % 2 === 0 ? 'operand' : 'operator'
    if (slot === null && zoneKind === kind) return { groupId: null, index: i, kind }
  }
  return { groupId: null, index: positionPastEnd(children.length, kind), kind }
}

// ------------------------------------------------------- block drop targeting
// concept 6.1: what placing the block chip encloses, for a drag *and* for a
// tap (PO). Only resolves operand-position targets for now — 6.1 also lets
// an operator position work identically to the operand-pair it belongs to
// (the "nützliche Überschneidung"), but wiring that up needs the drag layer
// to treat a dragged block as matching both zone kinds, which useDrag.ts
// doesn't support yet (TODO, noted where the block chip's drag is wired).
//
// **A block always encloses exactly three root positions** (PO revision).
// The three cases this used to have — an empty slot gets a bare block, a
// number with a real partner gets a pair, a number with none gets wrapped
// alone — are the same operation seen at different degrees of fullness,
// because a group is minimum-shaped to three slots regardless (concept
// 6.3). Collapsing them is what lets `a +` become `(a + ⬚)`: the old rule
// asked whether the operand two to the right was a *real placed number*,
// found none, and fell back to wrapping the `a` by itself.

/** A real, placed operand or operator — not an open gap, not past the end, and not a group (a group can't hold another group, concept section 4). */
function isPlainLeaf(children: RootChildren, index: number): boolean {
  const slot = children[index]
  return slot !== null && slot !== undefined && slot.kind !== 'group'
}

function isGroupAt(children: RootChildren, index: number): boolean {
  const slot = children[index]
  return slot !== null && slot !== undefined && slot.kind === 'group'
}

/**
 * How many root positions this board has: 2n−1 board positions in all
 * (concept 15: n numbers always take n−1 operators), less 2 for every group
 * already placed — a group shows three board positions inside a single root
 * slot. This is what keeps a block from enclosing positions the puzzle
 * doesn't have: without it, a wrap near the right edge silently invents a
 * fourth number's worth of slots that nothing could ever fill.
 */
export function rootWidth(children: RootChildren, numbersCount: number): number {
  let groups = 0
  for (let i = 0; i < children.length; i++) if (isGroupAt(children, i)) groups += 1
  return (2 * numbersCount - 1) - 2 * groups
}

/** Whether a bracket may begin at `start`: on the board, and crossing no existing group (concept section 4 — brackets never nest, so they never overlap either). */
function bracketFits(children: RootChildren, start: number, width: number): boolean {
  if (start < 0 || start % 2 !== 0 || start + 2 > width - 1) return false
  return !isGroupAt(children, start) && !isGroupAt(children, start + 1) && !isGroupAt(children, start + 2)
}

/**
 * Where a block released at root `index` puts its brackets — the root
 * position its left edge lands on, or null when nothing fits there.
 *
 * An **empty** slot keeps concept 6.1's first row: the block lands exactly
 * where it was put, enclosing that position and the two after it. Only a
 * slot that already holds something looks sideways, and then it is **right
 * before left** (6.1: "weil eine angetippte Zahl sich wie 'hier beginnt die
 * Klammer' liest — in Leserichtung"). "Something to the right" means a
 * placed operator *or* a placed operand two along: either one makes the
 * rightward pair the one being read, and requiring the operand alone was
 * what left `a +` wrapping its `a` by itself. Keeping the operand half of
 * that test is what preserves `6, ⬚, 2` — two numbers with no operator
 * tapped between them yet (concept 3.1) — as a pair.
 */
export function resolveBlockDrop(children: RootChildren, index: number, width: number): number | null {
  if (index % 2 !== 0) return null // operator position — not resolved in this pass, see the note above
  if (isGroupAt(children, index)) return null // already a group — not a valid block target
  if (!isPlainLeaf(children, index)) return bracketFits(children, index, width) ? index : null

  const rightIsReadable = isPlainLeaf(children, index + 1) || isPlainLeaf(children, index + 2)
  const order = rightIsReadable ? [index, index - 2] : [index - 2, index]
  for (const start of order) if (bracketFits(children, start, width)) return start
  return null
}

/**
 * Where a *tapped* block chip lands (PO). Tapping names no position, so it
 * borrows one: `anchor` is the root position the player last worked at (the
 * number they placed, moved, or took back). From there it is the very same
 * resolution a drag would find — concept section 3's "Tippen ist dieselbe
 * Operation mit anderem Auslöser" is literally true again, which it stopped
 * being once tapping got its own document-order rule.
 *
 * Scanning outward from the anchor is what makes a second bracket need no
 * rule of its own: with one bracket down there is at most one place three
 * consecutive bracket-free positions still fit, so the scan finds it or
 * finds nothing and the tap does nothing at all.
 */
export function tapBlockTarget(children: RootChildren, anchor: number, width: number): number | null {
  const candidates = [anchor]
  for (let step = 2; step <= width; step += 2) candidates.push(anchor + step, anchor - step)
  for (const index of candidates) {
    if (index < 0 || index > width - 1) continue
    const start = resolveBlockDrop(children, index, width)
    if (start !== null) return start
  }
  return null
}

/** concept 6.3: "Ein Block zeigt immer sein Minimum" — operand, operator, operand. A freshly wrapped or placed group always shows at least this much, even when the leaf(ves) it encloses don't fill it. */
export function withMinimumShape(children: (Leaf | null)[]): (Leaf | null)[] {
  const next = children.slice()
  while (next.length < 3) next.push(null)
  return next
}

/**
 * Applies a resolved block placement (concept 6.1/6.9): the three root
 * positions from `start` become one group, minimum-shaped (concept 6.3) so
 * a bracket over still-empty positions shows `⬚ ○ ⬚` like any other.
 *
 * `children` is padded to the board's full width first, because the
 * positions a bracket encloses are frequently ones the *scaffold* draws and
 * the tree has never stored (`trimTrailingGaps`): without the padding,
 * wrapping at index 4 of a one-element array splices the group in at the
 * end instead of at position 4.
 */
export function applyBlockDrop(children: RootChildren, start: number, width: number): (Leaf | Group | null)[] {
  const padded: (Leaf | Group | null)[] = children.slice()
  while (padded.length < width) padded.push(null)
  const wrapped = wrapGroup(padded, start, 3)
  const group = wrapped[start]
  if (group !== null && group.kind === 'group') {
    wrapped[start] = { ...group, children: withMinimumShape(group.children) }
  }
  return wrapped
}

// --------------------------------------------------- growing past minimum
// concept 6.2: a group can grow past its initial pair to a third (or
// fourth) number by absorbing a root-level neighbor it's already
// connected to.

export type AbsorbSide = 'before' | 'after'

/**
 * Absorbs the root-level (operand, operator) pair immediately next to the
 * group at `groupIndex`, on the given side, into that group — as one
 * atomic step, not as two independent moves. Moving only the operand or
 * only the operator into the group would strand the other half at the
 * root: an operand always needs *some* operator beside it and vice versa,
 * and once anything is fully placed the puzzle's own budget is exactly
 * tight (concept 15: n numbers, n−1 operators, no spare) — so a stranded
 * half has nothing left anywhere to plug it with, and the expression
 * becomes permanently uncompletable. Absorbing the whole pair together
 * never has that problem: a group's own shape only ever needs to stay an
 * odd length (concept 2.1), and adding a matched pair keeps it odd.
 *
 * Returns null when there's no complete pair to absorb on that side —
 * missing content, an open gap, or the neighbor being a group itself (a
 * group can never contain another group, concept section 4).
 */
export function absorbIntoGroup(children: RootChildren, groupIndex: number, side: AbsorbSide): (Leaf | Group | null)[] | null {
  const group = children[groupIndex]
  if (!group || group.kind !== 'group') return null

  const operatorIndex = side === 'before' ? groupIndex - 1 : groupIndex + 1
  const operandIndex = side === 'before' ? groupIndex - 2 : groupIndex + 2
  const operator = children[operatorIndex]
  const operand = children[operandIndex]
  if (!operator || operator.kind !== 'operator') return null
  if (!operand || operand.kind === 'group') return null

  const pair: Leaf[] = side === 'before' ? [operand, operator] : [operator, operand]
  const newGroup: Group = {
    ...group,
    children: side === 'before' ? [...pair, ...group.children] : [...group.children, ...pair],
  }

  const next = children.slice()
  next[groupIndex] = newGroup
  next.splice(Math.min(operatorIndex, operandIndex), 2)
  return next
}

/**
 * The two root positions that travel together when a root-level leaf is
 * drawn into a block: the leaf itself and the slot next to it *on the side
 * facing the group*. Which one is the operand and which the operator falls
 * out of the parity — a pair is always `(operand, operator)` with the
 * operator nearer the block, so the leaf keeps a partner whichever half of
 * it was grabbed. That is concept 6.1's "nützliche Überschneidung" seen
 * from the other end: `× c` and `c ×` are the same gesture.
 *
 * Returns the index of the pair's first (leftmost) position, or null when
 * the leaf can't be paired at all: it isn't a root-level leaf, it *is* the
 * group, or a second group sits between the two (a block can never travel
 * through another block — concept section 4).
 *
 * Unlike `absorbIntoGroup` below, the pair's other half may be an open gap
 * (or missing entirely, past the end of the row). Moving `⬚ ×` into a
 * block is how a player prepares a three-number block before deciding
 * which number goes in it — the gap travels along and stays a gap.
 */
export function connectingPair(children: RootChildren, leafIndex: number, groupIndex: number): number | null {
  const group = children[groupIndex]
  if (!group || group.kind !== 'group') return null
  const leaf = children[leafIndex]
  if (!leaf || leaf.kind === 'group') return null
  if (leafIndex === groupIndex) return null

  const before = leafIndex < groupIndex
  const start = before
    ? (leafIndex % 2 === 0 ? leafIndex : leafIndex - 1)
    : (leafIndex % 2 === 0 ? leafIndex - 1 : leafIndex)
  if (start < 0) return null

  const operand = children[start + (before ? 0 : 1)] ?? null
  const operator = children[start + (before ? 1 : 0)] ?? null
  if (operand !== null && operand.kind !== 'number') return null
  if (operator !== null && operator.kind !== 'operator') return null

  // nothing but plain content between the pair and the block it joins
  const from = before ? start + 2 : groupIndex + 1
  const to = before ? groupIndex : start
  for (let i = from; i < to; i++) {
    const between = children[i]
    if (between !== null && between !== undefined && between.kind === 'group') return null
  }
  return start
}

/** Splices a pair into a group's children at the given end (concept 6.2). A group's own length stays odd either way, so the invariant holds. */
function withPair(group: Group, side: AbsorbSide, operand: Leaf | null, operator: Leaf | null): Group {
  return {
    ...group,
    children: side === 'before'
      ? [operand, operator, ...group.children]
      : [...group.children, operator, operand],
  }
}

/**
 * Draws the root-level leaf at `leafIndex` into the group at `groupIndex`,
 * together with its `connectingPair` partner, and inserts the pair at the
 * given end of the block — **the end the player dropped on**, which is not
 * necessarily the side the leaf came from (PO, fourth device round). `(a+b)
 * × c` with `× c` dropped on the block's left edge is `(c × a + b)`: the
 * pair is what the leaf brings along, the drop tells it where to go.
 *
 * Distance doesn't matter either: in `(a+b) × c − d`, `− d` is two
 * positions away from the block and still joins it — everything between
 * simply closes up. What can't be crossed is another block.
 */
export function absorbPairIntoGroup(
  children: RootChildren,
  groupIndex: number,
  leafIndex: number,
  side: AbsorbSide
): (Leaf | Group | null)[] | null {
  const start = connectingPair(children, leafIndex, groupIndex)
  if (start === null) return null
  const group = children[groupIndex] as Group
  const before = leafIndex < groupIndex
  const operand = (children[start + (before ? 0 : 1)] ?? null) as Leaf | null
  const operator = (children[start + (before ? 1 : 0)] ?? null) as Leaf | null

  const next = children.slice()
  next[groupIndex] = withPair(group, side, operand, operator)
  next.splice(start, 2)
  return next
}

/**
 * Adds a single tray chip to one end of a block, with an open slot for the
 * partner it doesn't have yet (concept 6.2, PO's "damit er den Block schon
 * für drei Zahlen vorbereiten kann"). A number arrives with an empty
 * operator slot beside it, an operator with an empty number slot — the
 * same shape `absorbPairIntoGroup` moves, just assembled from the tray
 * rather than from the row. The caller checks the puzzle's budget: this
 * function only knows shapes.
 */
export function insertLeafIntoGroup(
  children: RootChildren,
  groupIndex: number,
  side: AbsorbSide,
  leaf: Leaf
): (Leaf | Group | null)[] | null {
  const group = children[groupIndex]
  if (!group || group.kind !== 'group') return null
  const operand = leaf.kind === 'number' ? leaf : null
  const operator = leaf.kind === 'operator' ? leaf : null
  const next = children.slice()
  next[groupIndex] = withPair(group, side, operand, operator)
  return next
}

/**
 * Moves an already-placed block to a new position over the row, keeping
 * its own length: the brackets slide, the content stays where it is
 * (concept 6.5, revised — PO, fourth device round). `(a × b) + c − d`
 * dropped on `c` is `a × b + (c − d)`; dropped on its own `b` it is
 * `a × (b + c) − d`. Content never travels with the block any more, so a
 * player re-brackets by moving the brackets rather than by dissolving and
 * wrapping again.
 *
 * `anchor` is a position in the *flattened* row (the row as it reads with
 * this block's own brackets taken off); an operator position anchors the
 * pair it belongs to, exactly as it does for a fresh block (concept 6.1's
 * "nützliche Überschneidung"). `maxLength` caps how far right the block
 * can reach — 2n−1 positions is everything an n-number puzzle can ever
 * hold (concept 6.4) — and positions the row hasn't grown into yet open as
 * gaps, the same way `placeAt` opens them.
 *
 * Returns null when the move is impossible or changes nothing: no block
 * there, another block inside the span it would enclose (concept section
 * 4), or the block ending up exactly where it started.
 */
export function moveGroup(
  children: RootChildren,
  groupIndex: number,
  anchor: number,
  maxLength: number
): (Leaf | Group | null)[] | null {
  const group = children[groupIndex]
  if (!group || group.kind !== 'group') return null
  const span = group.children.length

  const flat: (Leaf | Group | null)[] = children.slice()
  flat.splice(groupIndex, 1, ...group.children)

  const limit = Math.max(0, maxLength - span)
  let start = anchor % 2 === 0 ? anchor : anchor - 1
  start = Math.min(start, limit % 2 === 0 ? limit : limit - 1)
  start = Math.max(0, start)
  if (start === groupIndex) return null // already there

  while (flat.length < start + span) flat.push(null)
  const enclosed = flat.slice(start, start + span)
  if (enclosed.some(c => c !== null && c.kind === 'group')) return null

  const next = flat.slice()
  next.splice(start, span, { ...group, children: enclosed as (Leaf | null)[] })
  return next
}
