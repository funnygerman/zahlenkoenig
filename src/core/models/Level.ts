export type Operator = '+' | '-' | '*' | '/'

export interface Level {
  id: string
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
  unlockIndex: number
}

export const LEVELS: Level[] = [
  { id: 'A1', group: 'beginner',  numberCount: 2, operators: ['+', '-'],               maxBracketDepth: 0, targetRange: { min: 1, max: 18  }, maxTarget: 18,  unlockIndex: 0 },
  { id: 'A2', group: 'beginner',  numberCount: 3, operators: ['+', '-'],               maxBracketDepth: 0, targetRange: { min: 1, max: 27  }, maxTarget: 27,  unlockIndex: 1 },
  { id: 'A3', group: 'beginner',  numberCount: 4, operators: ['+', '-'],               maxBracketDepth: 0, targetRange: { min: 1, max: 36  }, maxTarget: 36,  unlockIndex: 2 },
  { id: 'F1', group: 'advanced',  numberCount: 2, operators: ['+', '-', '*', '/'],     maxBracketDepth: 0, targetRange: { min: 1, max: 81  }, maxTarget: 81,  unlockIndex: 3 },
  { id: 'F2', group: 'advanced',  numberCount: 3, operators: ['+', '-', '*', '/'],     maxBracketDepth: 1, targetRange: { min: 1, max: 100 }, maxTarget: 162, unlockIndex: 4 },
  { id: 'F3', group: 'advanced',  numberCount: 4, operators: ['+', '-', '*', '/'],     maxBracketDepth: 1, targetRange: { min: 1, max: 100 }, maxTarget: 171, unlockIndex: 5 },
  { id: 'E1', group: 'expert',    numberCount: 4, operators: ['+', '-', '*', '/'],     maxBracketDepth: 2, targetRange: { min: 1, max: 100 }, maxTarget: 324, unlockIndex: 6 },
]

export function getLevelById(id: string): Level {
  const level = LEVELS.find(l => l.id === id)
  if (!level) throw new Error(`Level ${id} not found`)
  return level
}
