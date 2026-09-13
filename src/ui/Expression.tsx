// The expression field (concept 14: "Ausdrucksfeld + Flächen"): renders
// the tree from core/expression.ts and registers its drop zones with the
// shared drag layer (useDrag.ts). Reports taps and dissolves; doesn't
// mutate the tree itself — that's the caller's job (concept 5/6.5), same
// split as Chip.tsx and Tray.tsx.
//
// Not yet implemented, deliberately: concept 6.1's block-wrap preview (the
// dashed bracket that shows exactly what a hovered block chip would
// enclose before drop) needs the same right-before-left targeting rule
// that decides what a *completed* drop actually wraps — building the
// preview without the drop-time logic risks the two disagreeing.
// Game.tsx, which will own that decision, doesn't exist yet, so this file
// only highlights the currently-hit zone (`activeZoneId`) plainly, without
// previewing brackets.

import { useMemo, type ReactNode } from 'react'
import type { AbsorbSide, Expression as ExpressionTree, Group, Leaf, Operator } from '../core/expression'
import { dropZones } from '../core/expression'
import type { DragHandlers } from './useDrag'
import { Chip } from './Chip'
import styles from './Expression.module.css'

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function rootZoneId(index: number): string {
  return `root-${index}`
}

export function groupZoneId(groupId: string, index: number): string {
  return `group-${groupId}-${index}`
}

/**
 * A block's own two ends, as drop targets: the bracket edges (concept 6.6's
 * ~22px hit strips, which are already there and already the block's drag
 * handle). Dropping a chip on one means "into this block, at this end" —
 * the side is the whole message, so unlike every other zone this one isn't
 * a position and carries no index (concept 6.2, PO's fourth device round).
 */
export function blockZoneId(groupId: string, side: AbsorbSide): string {
  return `block-${side}-${groupId}`
}

export type ParsedZone =
  | { target: 'root'; groupId: null; index: number }
  | { target: 'group'; groupId: string; index: number }
  | { target: 'block'; groupId: string; side: AbsorbSide }

/** Parses a zone id produced above; returns null for anything else (e.g. a tray zone). */
export function parseZoneId(zoneId: string): ParsedZone | null {
  if (zoneId.startsWith('root-')) {
    const index = Number(zoneId.slice('root-'.length))
    return Number.isInteger(index) ? { target: 'root', groupId: null, index } : null
  }
  const block = /^block-(before|after)-(.+)$/.exec(zoneId)
  if (block) return { target: 'block', groupId: block[2], side: block[1] as AbsorbSide }
  const match = /^group-(.+)-(\d+)$/.exec(zoneId)
  if (!match) return null
  return { target: 'group', groupId: match[1], index: Number(match[2]) }
}

export interface ExpressionProps {
  expr: ExpressionTree
  /** trailing scaffold slots beyond the real content — however many more operands/operators this puzzle still needs (concept 6.4), computed by the caller from what's left in the tray. A group never needs this: its own missing slots are already stored as real `null`s (concept 6.3). */
  scaffoldOperands?: number
  scaffoldOperators?: number
  /** tapping a placed number or operator returns it to the tray — the exact inverse of placing it (concept 6.6). */
  onTapLeaf: (id: string) => void
  /** tapping a bracket edge dissolves that group; its content stays put (concept 6.5). */
  onDissolveGroup: (groupId: string) => void
  /**
   * The bracket edges' shared aria-label (i18n.ts's `dissolveGroup`) — this
   * component stays free of language lookups itself, same as Chip.tsx/
   * Tray.tsx. Defaults to German, matching Board.tsx's own default, so the
   * many tests in this file that don't care what the label says (only the
   * one dissolve test does) don't all have to pass it.
   */
  dissolveLabel?: string
  registerZone?: (zoneId: string, kind: 'operand' | 'operator' | 'both', occupied: boolean, el: HTMLElement | null) => void
  /** `data.role` tells the drop handler what kind of chip this is without guessing from the id string. */
  dragHandlers?: (item: { id: string; kind: 'operand' | 'operator'; data: { role: 'number' | 'operator' | 'block'; operator?: Operator; value?: number; origin: 'tray' | 'field' } }) => DragHandlers
  /** the zone currently under the pointer during a drag (concept 3.1's "gestrichelte Fläche in Akzentfarbe"). */
  activeZoneId?: string | null
  /** concept 10.3's free, permanent dead-end indicator: the target is no longer reachable from here (core/hints.ts's Restlöser). */
  deadEnd?: boolean
  /**
   * The chips a hint press has marked as standing between this board and
   * the target (PO, hint round) — `null` until one is pressed on a
   * dead-end board, and gone again the moment the player moves anything.
   * Like `dissolvingGroupId` this is decided a level up, in Board.tsx: the
   * marks are the *press's* answer, not a property of the tree, and this
   * component only renders what it is told.
   */
  blockingIds?: readonly string[] | null
  /** concept 13.3's FLIP animation (`useFlip.ts`) — see Tray.tsx's own note on the shared id this rides. */
  flipRef?: (id: string, el: HTMLElement | null) => void
  /**
   * The one group currently mid-fade (concept 6.7), if any — owned by
   * Board.tsx, not here: the real dissolve trigger in the running app is
   * `useDrag`'s pointer-based tap detection, resolved in Board.tsx's
   * `handleTap`, which calls its own `handleDissolve` wrapper directly
   * rather than going through this component's `onClick` prop (that path
   * only fires when `dragHandlers` is absent — tests only, since the real
   * app always wires drag). So the fade timing has to live wherever the
   * trigger actually is: Board.tsx owns the timer and passes its own
   * `handleDissolve` in as this component's `onDissolveGroup`, and this
   * component just renders whichever group id it's told is fading.
   */
  dissolvingGroupId?: string | null
  /**
   * The submitted attempt's verdict (`useGame`'s own `GameStatus`, minus
   * `'idle'` — there's nothing to color the border for before a press),
   * so the field border turns green on a correct answer and red on a
   * wrong one. `null` while unjudged or once the tree has been edited
   * since (`useGame` resets `status` to `'idle'` on any edit).
   */
  verdict?: 'correct' | 'wrong' | null
}

function GhostSlot({ kind, active = false }: { kind: 'operand' | 'operator'; active?: boolean }) {
  return <Chip variant={kind === 'operand' ? 'number' : 'operator'} scale="field" ghost className={active ? styles.activeZone : undefined} />
}

function LeafChip({
  leaf, inGroup, zoneId, active, blocking = false, onTapLeaf, registerZone, dragHandlers, flipRef,
}: {
  leaf: Leaf
  inGroup: boolean
  zoneId: string
  active: boolean
  /** marked by a hint press on a dead-end board as standing in the way of the target (core/hints.ts's `findBlockers`). */
  blocking?: boolean
  onTapLeaf: (id: string) => void
  registerZone?: ExpressionProps['registerZone']
  dragHandlers?: ExpressionProps['dragHandlers']
  flipRef?: ExpressionProps['flipRef']
}) {
  const kind = leaf.kind === 'number' ? 'operand' : 'operator'
  // Same reasoning as Tray.tsx's chips: once drag is wired up, useDrag's
  // own tap-vs-drag detection is the only tap path, or a real tap would
  // fire both the native click and useDrag's onTap.
  //
  // The drop zone is the wrapper, not the chip: an occupied slot is a
  // target too (dropping on it swaps), and it should be as easy to hit as
  // an empty one. Same `.slot` wrapper, same row height, so every position
  // in a row is one full-height column and the whole row is covered.
  return (
    <div ref={el => registerZone?.(zoneId, kind, true, el)} className={styles.slot}>
    <Chip
      variant={leaf.kind === 'number' ? 'number' : 'operator'}
      value={leaf.kind === 'number' ? leaf.value : undefined}
      operator={leaf.kind === 'operator' ? leaf.value : undefined}
      scale="field"
      inGroup={inGroup}
      blocking={blocking}
      className={active ? styles.activeZone : undefined}
      onClick={dragHandlers ? undefined : () => onTapLeaf(leaf.id)}
      // Keyboard operation isn't supported (open product question, CLAUDE.md) —
      // once drag is wired up this chip's onClick above is gone, so Enter/Space
      // would land on it and do nothing. Taking it out of tab order is honest
      // about that, rather than leaving a focusable button that looks broken.
      tabIndex={dragHandlers ? -1 : undefined}
      ref={flipRef ? (el => flipRef(leaf.id, el)) : undefined}
      {...(dragHandlers ? dragHandlers({
        id: leaf.id,
        kind,
        data: {
          role: leaf.kind === 'number' ? 'number' : 'operator',
          value: leaf.kind === 'number' ? leaf.value : undefined,
          operator: leaf.kind === 'operator' ? leaf.value : undefined,
          origin: 'field',
        },
      }) : undefined)}
    />
    </div>
  )
}

function EmptySlot({
  kind, zoneId, active, registerZone,
}: {
  kind: 'operand' | 'operator'
  zoneId: string
  active: boolean
  registerZone?: ExpressionProps['registerZone']
}) {
  // An open gap is both a rendered ghost AND a live drop zone — concept
  // 6.4's scaffold ghosts and concept 3.1's "jede null-Position ist eine
  // offene Fläche" are the same slot, seen from two angles. Chip's `ghost`
  // mode renders inert (no ref, no button), so the registerable element is
  // a thin wrapper around it instead. The wrapper is the full height of
  // its row while the ghost inside stays chip-sized: a slot is ~32px in a
  // 64px field, and the 32px of dead space above and below it is exactly
  // where a thumb aiming at the slot actually lands.
  return (
    <div ref={el => registerZone?.(zoneId, kind, false, el)} className={styles.slot}>
      <GhostSlot kind={kind} active={active} />
    </div>
  )
}

function GroupView({
  group, onTapLeaf, onDissolveGroup, dissolveLabel, registerZone, dragHandlers, activeZoneId, flipRef, dissolving = false, blockingIds,
}: {
  group: Group
  onTapLeaf: (id: string) => void
  onDissolveGroup: (groupId: string) => void
  dissolveLabel: string
  registerZone?: ExpressionProps['registerZone']
  dragHandlers?: ExpressionProps['dragHandlers']
  activeZoneId?: string | null
  flipRef?: ExpressionProps['flipRef']
  /** Concept 6.7: the bracket's own chrome fades over ~150ms rather than vanishing instantly — the chips inside don't move at all. */
  dissolving?: boolean
  /** the dead-end marks (see ExpressionProps) — the block itself can be one of them, which marks its brackets rather than any one chip inside. */
  blockingIds?: ReadonlySet<string>
}) {
  const zones = dropZones(group.children)
  // The group's own trailing frontier (concept 6.2: a third number joins a
  // group the same way any operand joins anything else — drag operator+
  // number in after the last one). Registered but not shown as a ghost:
  // unlike the root, a group's shape isn't derived from anything external
  // (concept 6.3 only promises the *initial* minimum shape), so there's
  // nothing to preview here, just a live drop target.
  const frontierIndex = group.children.length
  const frontierZoneId = groupZoneId(group.id, frontierIndex)
  const frontierActive = activeZoneId === frontierZoneId

  const beforeZone = blockZoneId(group.id, 'before')
  const afterZone = blockZoneId(group.id, 'after')

  // The two bracket edges carry everything the block itself takes part in.
  // Each is at once the block's drag handle (concept 6.5), its dissolve
  // button (6.6's ~22px hit strip) and — new with the fourth device round —
  // a drop zone standing for that *end* of the block: a chip released there
  // joins the block on that side (concept 6.2). One element, because they
  // are one thing to a player: the left edge is where the left end of the
  // block is.
  //
  // The block's own wrapper is deliberately NOT a zone any more. It used to
  // be registered as one wide 'operand' zone so a number dropped anywhere
  // on the block would swap with it (6.5's old rule); since a drop on a
  // block now means "put this in", a zone that big would swallow both edges
  // and leave the side undecidable. What is left uncovered between the
  // chips is a few px of flex gap, which `useDrag`'s tolerance bridges to
  // the nearest slot exactly as it does everywhere else.
  //
  // `dragHandlers` still go on the edges only, never on the wrapper — a
  // press on a child chip must stay that chip's own drag.
  return (
    <div className={cx(styles.group, dissolving && styles.dissolving, blockingIds?.has(group.id) && styles.blocking)}>
      <button
        type="button"
        ref={el => registerZone?.(beforeZone, 'both', true, el)}
        className={cx(styles.bracketEdge, styles.bracketLeft, activeZoneId === beforeZone && styles.activeEdge, dissolving && styles.dissolving)}
        onClick={dragHandlers ? undefined : () => onDissolveGroup(group.id)}
        aria-label={dissolveLabel}
        {...(dragHandlers ? dragHandlers({ id: group.id, kind: 'operand', data: { role: 'block', origin: 'field' } }) : undefined)}
      />
      {group.children.map((child, i) => {
        const zoneId = groupZoneId(group.id, i)
        const active = activeZoneId === zoneId
        if (child === null) {
          return <EmptySlot key={i} kind={zones[i].kind} zoneId={zoneId} active={active} registerZone={registerZone} />
        }
        return (
          <LeafChip
            key={child.id}
            leaf={child}
            inGroup
            zoneId={zoneId}
            active={active}
            blocking={blockingIds?.has(child.id)}
            onTapLeaf={onTapLeaf}
            registerZone={registerZone}
            dragHandlers={dragHandlers}
            flipRef={flipRef}
          />
        )
      })}
      <div
        ref={el => registerZone?.(frontierZoneId, zones[frontierIndex].kind, false, el)}
        className={cx(styles.groupFrontier, frontierActive && styles.activeZone)}
      />
      <button
        type="button"
        ref={el => registerZone?.(afterZone, 'both', true, el)}
        className={cx(styles.bracketEdge, styles.bracketRight, activeZoneId === afterZone && styles.activeEdge, dissolving && styles.dissolving)}
        onClick={dragHandlers ? undefined : () => onDissolveGroup(group.id)}
        aria-label={dissolveLabel}
        {...(dragHandlers ? dragHandlers({ id: group.id, kind: 'operand', data: { role: 'block', origin: 'field' } }) : undefined)}
      />
    </div>
  )
}

export function Expression({
  expr, scaffoldOperands = 0, scaffoldOperators = 0, onTapLeaf, onDissolveGroup, dissolveLabel = 'Klammer auflösen', registerZone, dragHandlers, activeZoneId, deadEnd = false, flipRef, dissolvingGroupId = null, blockingIds = null, verdict = null,
}: ExpressionProps) {
  const { children } = expr.root
  const zones = dropZones(children)
  const blocking = useMemo(() => (blockingIds === null ? null : new Set(blockingIds)), [blockingIds])

  const rendered = children.map((slot, i) => {
    const zoneId = rootZoneId(i)
    const active = activeZoneId === zoneId
    if (slot === null) {
      return <EmptySlot key={i} kind={zones[i].kind} zoneId={zoneId} active={active} registerZone={registerZone} />
    }
    if (slot.kind === 'group') {
      return (
        <GroupView
          key={slot.id}
          group={slot}
          onTapLeaf={onTapLeaf}
          onDissolveGroup={onDissolveGroup}
          dissolveLabel={dissolveLabel}
          registerZone={registerZone}
          dragHandlers={dragHandlers}
          activeZoneId={activeZoneId}
          flipRef={flipRef}
          dissolving={dissolvingGroupId === slot.id}
          blockingIds={blocking ?? undefined}
        />
      )
    }
    return (
      <LeafChip
        key={slot.id}
        leaf={slot}
        inGroup={false}
        zoneId={zoneId}
        active={active}
        blocking={blocking?.has(slot.id)}
        onTapLeaf={onTapLeaf}
        registerZone={registerZone}
        dragHandlers={dragHandlers}
        flipRef={flipRef}
      />
    )
  })

  // The trailing frontier (dropZones' last entry, index === children.length)
  // is always a live drop zone regardless of whether anything is left to
  // place there — register it unconditionally. Whether it *shows* a ghost
  // depends on the caller's scaffold count (concept 6.4: derived from what's
  // left in the tray, which this component doesn't know on its own). Any
  // scaffold slots beyond that first one are decorative only — concept 6.4:
  // "keine eigenen Ablageziele" — since only one splice position is ever
  // live at a time; placing into the frontier moves it forward by one.
  // Every trailing scaffold slot is a drop target of its own, at the root
  // index it stands for — not just the first one. Concept 6.4 originally
  // made them decorative ("keine eigenen Ablageziele"); the product owner
  // overruled that after playing the fixed drag: if a chip can only ever
  // land in the next free slot, dragging says nothing tapping doesn't
  // already say. Dropping into the third slot means the third slot, and
  // `placeAt` opens the positions in between.
  //
  // They are the same component as an interior gap, deliberately: at this
  // point "a null the tree already holds" and "a position the puzzle still
  // needs" are one thing to a player, and were only ever two to the code.
  const totalScaffold = scaffoldOperands + scaffoldOperators
  const scaffold: ReactNode[] = []
  for (let i = 0; i < totalScaffold; i++) {
    const index = children.length + i
    const zoneId = rootZoneId(index)
    scaffold.push(
      <EmptySlot
        key={zoneId}
        kind={index % 2 === 0 ? 'operand' : 'operator'}
        zoneId={zoneId}
        active={activeZoneId === zoneId}
        registerZone={registerZone}
      />
    )
  }

  return (
    <div className={cx(styles.field, deadEnd && styles.deadEnd, verdict === 'correct' && styles.correct, verdict === 'wrong' && styles.wrong)}>
      {rendered}
      {scaffold}
    </div>
  )
}
