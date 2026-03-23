export type NumberToken  = { type: 'number';   value: number; index: number }
export type OperatorToken = { type: 'operator'; value: '+' | '-' | '*' | '/' }
export type BracketToken  = { type: 'bracket';  value: '(' | ')' }
export type Token = NumberToken | OperatorToken | BracketToken
