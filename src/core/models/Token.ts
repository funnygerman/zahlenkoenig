export type NumberToken = {
  type: 'number'
  value: number
  index: number // which of the 4 puzzle numbers (0–3)
}

export type OperatorToken = {
  type: 'operator'
  value: '+' | '-' | '*' | '/'
}

export type BracketToken = {
  type: 'bracket'
  value: '(' | ')'
}

export type Token = NumberToken | OperatorToken | BracketToken
