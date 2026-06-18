export type MatchStatus = 'pending' | 'active' | 'complete' | 'refunded'
export type Token = 'uatom' | 'uusdc'

export interface Match {
  matchId: string
  gameSlug: string
  challenger: string
  opponent: string
  amount: string
  denom: Token
  status: MatchStatus
  winner?: string
  createdAt: number
}

export interface Challenge {
  from: string
  to: string
  gameSlug: string
  amount: string
  denom: Token
}
