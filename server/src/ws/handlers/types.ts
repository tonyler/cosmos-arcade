export interface BetCreate {
  matchId: string
  gameSlug: string
  amount: string
  denom: 'uatom' | 'uusdc'
  isPublic: boolean
  opponent: string | null
  txHash: string
}

export interface CasualCreate {
  matchId: string
  gameSlug: string
  isPublic: boolean
  opponent: string | null
}

export interface MatchCancel {
  matchId: string
}

export interface Bet {
  matchId: string
  gameSlug: string
  creator: string
  opponent: string | null
  isCasual: boolean
  isPublic: boolean
  status: 'waiting' | 'joined' | 'active' | 'settling' | 'complete' | 'settlement_failed' | 'disputed' | 'abort_failed' | 'cancelled'
  amount?: string
  denom?: string
  ready?: Record<string, boolean>
  createdAt: number
}
