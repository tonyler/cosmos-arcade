export interface MatchContext {
  matchId: string
  mySlot: 1 | 2         // 1 = creator (arrow keys), 2 = joiner (WASD)
  myAddress: string
  opponentAddress: string
  p1Address: string     // always the creator
  p2Address: string     // always the joiner
}
