export type MatchPhase = 'waiting' | 'active' | 'complete'

export abstract class BaseMatch {
  readonly matchId: string
  readonly gameSlug: string
  readonly player1: string
  readonly player2: string
  phase: MatchPhase = 'waiting'
  winner: string | null = null
  startedAt: number

  constructor(matchId: string, gameSlug: string, player1: string, player2: string) {
    this.matchId = matchId
    this.gameSlug = gameSlug
    this.player1 = player1
    this.player2 = player2
    this.startedAt = Date.now()
  }

  abstract handleEvent(from: string, event: unknown): void

  onComplete: ((winner: string) => void) | null = null

  protected end(winner: string) {
    this.phase = 'complete'
    this.winner = winner
    this.onComplete?.(winner)
  }

  /** Called by server when client reports game over — idempotent */
  terminate(winner: string) {
    if (this.phase === 'complete') return
    this.end(winner)
  }

  toJSON() {
    return {
      matchId: this.matchId,
      gameSlug: this.gameSlug,
      player1: this.player1,
      player2: this.player2,
      phase: this.phase,
      winner: this.winner,
      startedAt: this.startedAt,
    }
  }
}
