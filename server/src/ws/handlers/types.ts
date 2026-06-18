export interface Challenge {
  to: string
  gameSlug: string
  amount: string
  denom: 'uatom' | 'uusdc'
}

export interface BetCreate {
  matchId: string
  gameSlug: string
  amount: string
  denom: 'uatom' | 'uusdc'
  isPublic: boolean
  opponent: string | null
  txHash: string
}

export interface BetJoin {
  matchId: string
  txHash: string
}
