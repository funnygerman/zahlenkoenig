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

import type { ReactNode } from 'react'
import type { Expression as ExpressionTree, Group, Leaf, Operator } from '../core/expression'
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

/** Parses a zone id produced above; returns null for anything else (e.g. a tray zone). */
export function parseZoneId(zoneId: string): { groupId: string | null; index: number } | null {
  if (zoneId.startsWith('root-')) {
    const index = Number(zoneId.slice('root-'.length))
    return Number.isInteger(index) ? { groupId: null, index } : null
  }
  const match = /^group-(.+)-(\d+)$/.exec(zoneId)
  if (!match) return null
  return { groupId: match[1], index: Number(match[2]) }
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
  registerZone?: (zoneId: string, kind: 'operand' | 'operator', occupied: boolean, el: HTMLElement | null) => void
  /** `data.role` tells the drop handler what kind of chip this is without guessing from the id string. */
  dragHandlers?: (item: { id: string; kind: 'operand' | 'operator'; data: { role: 'number' | 'operator'; operator?: Operator; value?: number; scale?: 'tray' | 'field' } }) => DragHandlers
  /** the zone currently under the pointer during a drag (concept 3.1's "gestrichelte Fläche in Akzentfarbe"). */
  activeZoneId?: string | null
}

function GhostSlot({ kind, active = false }: { kind: 'operand' | 'operator'; active?: boolean }) {
  return <Chip variant={kind === 'operand' ? 'number' : 'operator'} scale="field" ghost className={active ? styles.activeZone : undefined} />
}

function LeafChip({
  leaf, inGroup, zoneId, active, onTapLeaf, registerZone, dragHandlers,
}: {
  leaf: Leaf
  inGroup: boolean
  zoneId: string
  active: boolean
  onTapLeaf: (id: string) => void
  registerZone?: ExpressionProps['registerZone']
  dragHandlers?: ExpressionProps['dragHandlers']
}) {
  const kind = leaf.kind === 'number' ? 'operand' : 'operator'
  // Same reasoning as Tray.tsx's chips: once drag is wired up, useDrag's
  // own tap-vs-drag detection is the only tap path, or a real tap would
  // fire both the native click and useDrag's onTap.
  return (
    <Chip
      variant={leaf.kind === 'number' ? 'number' : 'operator'}
      value={leaf.kind === 'number' ? leaf.value : undefined}
      operator={leaf.kind === 'operator' ? leaf.value : undefined}
      scale="field"
      inGroup={inGroup}
      className={active ? styles.activeZone : undefined}
      onClick={dragHandlers ? undefined : () => onTapLeaf(leaf.id)}
      ref={el => registerZone?.(zoneId, kind, true, el)}
      {...(dragHandlers ? dragHandlers({
        id: leaf.id,
        kind,
        data: {
          role: leaf.kind === 'number' ? 'number' : 'operator',
          value: leaf.kind === 'number' ? leaf.value : undefined,
          operator: leaf.kind === 'operator' ? leaf.value : undefined,
          scale: 'field',
        },
      }) : undefined)}
    />
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
  // a thin wrapper around it instead.
  return (
    <div ref={el => registerZone?.(zoneId, kind, false, el)} className={active ? styles.activeZone : undefined}>
      <GhostSlot kind={kind} />
    </div>
  )
}

function GroupView({
  group, onTapLeaf, onDissolveGroup, registerZone, dragHandlers, activeZoneId,
}: {
  group: Group
  onTapLeaf: (id: string) => void
  onDissolveGroup: (groupId: string) => void
  registerZone?: ExpressionProps['registerZone']
  dragHandlers?: ExpressionProps['dragHandlers']
  activeZoneId?: string | null
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

  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.bracketEdge + ' ' + styles.bracketLeft}
        onClick={() => onDissolveGroup(group.id)}
        aria-label="Klammer auflösen"
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
            onTapLeaf={onTapLeaf}
            registerZone={registerZone}
            dragHandlers={dragHandlers}
          />
        )
      })}
      <div
        ref={el => registerZone?.(frontierZoneId, zones[frontierIndex].kind, false, el)}
        className={cx(styles.groupFrontier, frontierActive && styles.activeZone)}
      />
      <button
        type="button"
        className={styles.bracketEdge + ' ' + styles.bracketRight}
        onClick={() => onDissolveGroup(group.id)}
        aria-label="Klammer auflösen"
      />
    </div>
  )
}

export function Expression({
  expr, scaffoldOperands = 0, scaffoldOperators = 0, onTapLeaf, onDissolveGroup, registerZone, dragHandlers, activeZoneId,
}: ExpressionProps) {
  const { children } = expr.root
  const zones = dropZones(children)

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
          registerZone={registerZone}
          dragHandlers={dragHandlers}
          activeZoneId={activeZoneId}
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
        onTapLeaf={onTapLeaf}
        registerZone={registerZone}
        dragHandlers={dragHandlers}
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
  const totalScaffold = scaffoldOperands + scaffoldOperators
  const frontierIndex = children.length
  const frontierZoneId = rootZoneId(frontierIndex)
  const frontierKind = zones[frontierIndex].kind
  const frontierActive = activeZoneId === frontierZoneId

  const scaffold: ReactNode[] = []
  let nextKind: 'operand' | 'operator' = frontierKind === 'operand' ? 'operator' : 'operand'
  for (let i = 1; i < totalScaffold; i++) {
    scaffold.push(<GhostSlot key={`scaffold-${i}`} kind={nextKind} />)
    nextKind = nextKind === 'operand' ? 'operator' : 'operand'
  }

  // The registered element covers the frontier ghost, every decorative
  // scaffold slot behind it, AND the empty rest of the field (`.frontier`
  // grows into whatever room is left). That's deliberately one big target
  // for one zone: only the frontier is ever live — the slots behind it are
  // decorative (concept 6.4: "keine eigenen Ablageziele") — and a release
  // over the field's empty right-hand end can't mean anything but "at the
  // end". Where the field is full there's no leftover room to grow into,
  // so this costs no width (concept 12.5).
  //
  // The highlight stays precise: with something left to place it's on the
  // frontier ghost, the actual slot the chip lands in. Only when there's
  // no ghost to mark does the container itself take it.
  const frontierGhost = totalScaffold > 0
  return (
    <div className={styles.field}>
      {rendered}
      <div
        ref={el => registerZone?.(frontierZoneId, frontierKind, false, el)}
        className={cx(styles.frontier, frontierActive && !frontierGhost && styles.activeZone)}
      >
        {frontierGhost && <GhostSlot kind={frontierKind} active={frontierActive} />}
        {scaffold}
      </div>
    </div>
  )
}
