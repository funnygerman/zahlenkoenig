export type Operator = '+' | '-' | '*' | '/'

export interface Level {
  id: string
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
  unlockIndex: number // order for unlocking
}

export const LEVELS: Level[] = [
  { id: 'A1', group: 'beginner',  numberCount: 2, operators: ['+', '-'],                    maxBracketDepth: 0, targetRange: { min: 1, max: 10  }, maxTarget: 18,  unlockIndex: 0 },
  { id: 'A2', group: 'beginner',  numberCount: 2, operators: ['+', '-'],                    maxBracketDepth: 0, targetRange: { min: 1, max: 20  }, maxTarget: 18,  unlockIndex: 1 },
  { id: 'A3', group: 'beginner',  numberCount: 3, operators: ['+', '-'],                    maxBracketDepth: 0, targetRange: { min: 1, max: 20  }, maxTarget: 27,  unlockIndex: 2 },
  { id: 'A4', group: 'beginner',  numberCount: 4, operators: ['+', '-'],                    maxBracketDepth: 0, targetRange: { min: 1, max: 30  }, maxTarget: 36,  unlockIndex: 3 },
  { id: 'F1', group: 'advanced',  numberCount: 2, operators: ['+', '-', '*', '/'],          maxBracketDepth: 0, targetRange: { min: 1, max: 20  }, maxTarget: 81,  unlockIndex: 4 },
  { id: 'F2', group: 'advanced',  numberCount: 3, operators: ['+', '-', '*', '/'],          maxBracketDepth: 1, targetRange: { min: 1, max: 50  }, maxTarget: 500, unlockIndex: 5 },
  { id: 'F3', group: 'advanced',  numberCount: 4, operators: ['+', '-', '*', '/'],          maxBracketDepth: 1, targetRange: { min: 1, max: 50  }, maxTarget: 500, unlockIndex: 6 },
  { id: 'E1', group: 'expert',    numberCount: 3, operators: ['+', '-', '*', '/'],          maxBracketDepth: 1, targetRange: { min: 1, max: 100 }, maxTarget: 500, unlockIndex: 7 },
  { id: 'E2', group: 'expert',    numberCount: 4, operators: ['+', '-', '*', '/'],          maxBracketDepth: 2, targetRange: { min: 1, max: 100 }, maxTarget: 500, unlockIndex: 8 },
]

export function getLevelById(id: string): Level {
  const level = LEVELS.find(l => l.id === id)
  if (!level) throw new Error(`Level ${id} not found`)
  return level
}
