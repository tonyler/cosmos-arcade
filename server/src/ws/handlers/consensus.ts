import type { Bet } from './types'

export type ConsensusResult =
  | { action: 'settle'; winner: string }
  | { action: 'dispute'; p1: string; p1Winner: string; p2: string; p2Winner: string }
  | { action: 'wait' }

/**
 * Pure function: given one player's game-over report and the other's (if any),
 * return what should happen. No I/O, no side effects — testable in isolation.
 *
 * When reports disagree, server-tracked kill counts act as tiebreaker:
 * if one player has a clear kill lead (>= 2 kills ahead), settle in their favor.
 * Otherwise mark as disputed for admin review.
 */
export function evaluateGameOver(
  from: string,
  winner: string,
  otherReport: string | null,
  bet: Pick<Bet, 'creator' | 'opponent'>,
  serverKills?: Record<string, number>
): ConsensusResult {
  if (otherReport === null) return { action: 'wait' }
  if (otherReport === winner) return { action: 'settle', winner }

  const other = from === bet.creator ? (bet.opponent ?? '') : bet.creator

  // Disagreement — try to resolve via server-tracked kill counts
  if (serverKills) {
    const fromKills = serverKills[from] ?? 0
    const otherKills = serverKills[other] ?? 0
    // Require a clear lead (>=2) to auto-settle; ties go to dispute
    if (fromKills >= otherKills + 2) return { action: 'settle', winner }
    if (otherKills >= fromKills + 2) return { action: 'settle', winner: otherReport }
  }

  return { action: 'dispute', p1: from, p1Winner: winner, p2: other, p2Winner: otherReport }
}
