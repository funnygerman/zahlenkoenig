// Tree → number, replacing `Function('return ' + expr)()` from v1's
// PuzzleValidator and HintEngine (concept section 8). No React import.

import { type Expression, type Group, type Leaf, type Operator, isExpressionComplete, isGroupComplete } from './expression'

function apply(a: number, op: Operator, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? NaN : a / b
  }
}

// Two passes over a children list, same as any flat +-*/ chain: * and /
// first, then + and - (concept 8). Groups have already been reduced to a
// number by the time this runs, so `values`/`ops` are flat.
function evalPass(values: number[], ops: Operator[]): number {
  const n = [values[0]]
  const o: Operator[] = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      n[n.length - 1] = apply(n[n.length - 1], ops[i], values[i + 1])
    } else {
      o.push(ops[i]); n.push(values[i + 1])
    }
  }
  let acc = n[0]
  for (let i = 0; i < o.length; i++) acc = apply(acc, o[i], n[i + 1])
  return acc
}

function evalChildren(children: readonly (Leaf | Group | null)[]): number | null {
  const values: number[] = []
  const ops: Operator[] = []
  for (const child of children) {
    if (child === null) return null // defensive — callers only reach here via isExpressionComplete/isGroupComplete
    if (child.kind === 'operator') {
      ops.push(child.value)
    } else if (child.kind === 'number') {
      values.push(child.value)
    } else {
      const v = evaluateGroup(child)
      if (v === null) return null
      values.push(v)
    }
  }
  const result = evalPass(values, ops)
  return isFinite(result) ? result : null // division by zero (concept 8) — only reachable through a group like (3-3)/...
}

function evaluateGroup(group: Group): number | null {
  if (!isGroupComplete(group)) return null
  return evalChildren(group.children)
}

/**
 * Evaluates a complete expression to a number, or `null` if it isn't
 * evaluable: incomplete (still has an open gap — concept 2.1), a division
 * by zero (only reachable through a group, concept 8), or a negative final
 * result (concept 8: "das Endergebnis muss ≥ 0 sein").
 *
 * That last rule reads, in context, as a constraint on the evaluator's own
 * result — not a rule about what the notation line (concept 9.2) may
 * display for a wrong answer, which is a separate concern for whoever
 * calls this. Worth confirming against the running app once step 2 exists
 * (spec/entwurf.html doesn't wire evaluate.ts up).
 *
 * Intermediate results may be fractional (concept 8: `9 ÷ 2 × 4 = 18`
 * stays valid); only the final comparison against a target needs the
 * caller's own epsilon (1e-9), not this function.
 */
export function evaluate(expr: Expression): number | null {
  if (!isExpressionComplete(expr)) return null
  const result = evalChildren(expr.root.children)
  if (result === null || result < 0) return null
  return result
}
