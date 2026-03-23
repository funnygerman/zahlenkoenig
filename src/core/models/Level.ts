export type Operator = '+' | '-' | '*' | '/'

export interface Level {
  id: string
  baseId: string
  subLevel: 1 | 2 | 3 | null
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
}

export const LEVELS: Level[] = [
  { id:'A1',   baseId:'A1', subLevel:null, group:'beginner',  numberCount:2, operators:['+','-'],               maxBracketDepth:0, targetRange:{min:1,   max:18 }, maxTarget:18  },
  { id:'A2',   baseId:'A2', subLevel:null, group:'beginner',  numberCount:3, operators:['+','-'],               maxBracketDepth:0, targetRange:{min:1,   max:27 }, maxTarget:27  },
  { id:'A3',   baseId:'A3', subLevel:null, group:'beginner',  numberCount:4, operators:['+','-'],               maxBracketDepth:0, targetRange:{min:1,   max:36 }, maxTarget:36  },
  { id:'F1',   baseId:'F1', subLevel:null, group:'advanced',  numberCount:2, operators:['+','-','*','/'],       maxBracketDepth:0, targetRange:{min:1,   max:81 }, maxTarget:81  },
  { id:'F2.1', baseId:'F2', subLevel:1,    group:'advanced',  numberCount:3, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:1,   max:50 }, maxTarget:162 },
  { id:'F2.2', baseId:'F2', subLevel:2,    group:'advanced',  numberCount:3, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:51,  max:100}, maxTarget:162 },
  { id:'F2.3', baseId:'F2', subLevel:3,    group:'advanced',  numberCount:3, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:101, max:162}, maxTarget:162 },
  { id:'F3.1', baseId:'F3', subLevel:1,    group:'advanced',  numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:1,   max:50 }, maxTarget:171 },
  { id:'F3.2', baseId:'F3', subLevel:2,    group:'advanced',  numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:51,  max:100}, maxTarget:171 },
  { id:'F3.3', baseId:'F3', subLevel:3,    group:'advanced',  numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:1, targetRange:{min:101, max:171}, maxTarget:171 },
  { id:'E1.1', baseId:'E1', subLevel:1,    group:'expert',    numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:2, targetRange:{min:1,   max:50 }, maxTarget:324 },
  { id:'E1.2', baseId:'E1', subLevel:2,    group:'expert',    numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:2, targetRange:{min:51,  max:100}, maxTarget:324 },
  { id:'E1.3', baseId:'E1', subLevel:3,    group:'expert',    numberCount:4, operators:['+','-','*','/'],       maxBracketDepth:2, targetRange:{min:101, max:324}, maxTarget:324 },
]

export function getLevelById(id: string): Level {
  const level = LEVELS.find(l => l.id === id)
  if (!level) throw new Error(`Level ${id} not found`)
  return level
}

export const LEVEL_GROUPS = [
  { key: 'beginner',  label: '🌱', ids: ['A1','A2','A3'] },
  { key: 'advanced',  label: '🔥', ids: ['F1','F2.1','F2.2','F2.3','F3.1','F3.2','F3.3'] },
  { key: 'expert',    label: '🧠', ids: ['E1.1','E1.2','E1.3'] },
]
