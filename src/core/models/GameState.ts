import { Token } from './Token'
import { Puzzle } from './Puzzle'

export type GameStatus = 'idle' | 'correct' | 'wrong'

export interface GameState {
  puzzle: Puzzle
  tokens: Token[]
  status: GameStatus
  warning: string | null
  hintsUsed: number
  firstAttempt: boolean
}
