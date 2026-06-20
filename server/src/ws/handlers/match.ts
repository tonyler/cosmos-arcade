import { send, broadcast } from '../rooms'
import { redis } from '../../redis'
import { settleMatch, cancelMatchOnChain, abortMatchOnChain } from '../../chain/settlement'
import { telem } from '../telemetry'
import type { BetCreate, CasualCreate, MatchCancel, Bet } from './types'

// ── Match factory ─────────────────────────────────────────────────────────────

interface Match {
  player1: string
  player2: string
  phase: 'waiting' | 'complete'
  onComplete: ((winner: string) => void) | null
  terminate(winner: string): void
}

function createMatch(p1: string, p2: string): Match {
  const m: Match = {
    player1: p1,
    player2: p2,
    phase: 'waiting',
    onComplete: null,
    terminate(winner) {
      if (m.phase === 'complete') return
      m.phase = 'complete'
      m.onComplete?.(winner)
    },
  }
  return m
}

const activeMatches = new Map<string, Match>()

export function broadcastOpenMatch(matchId: string, gameSlug: string, creator: string, isCasual: boolean, amount?: string, denom?: string) {
  broadcast('lobby:open_match', { matchId, gameSlug, creator, isCasual, amount: amount ?? null, denom: denom ?? null }, creator)
}

function cleanupMatch(matchId: string, creator?: string, opponent?: string) {
  activeMatches.delete(matchId)
  redis.del(`match:settling:${matchId}`).catch(() => {})
  const dels = [`match:bet:${matchId}`]
  if (creator)  dels.push(`match:active:${creator}`)
  if (opponent) dels.push(`match:active:${opponent}`)
  redis.del(...dels).catch(() => {})
}

function attachCompletion(match: Match, matchId: string, creator: string, opponent: string, bet: Bet) {
  match.onComplete = async (winner) => {
    if (bet.isCasual) {
      send(creator, 'match:complete', { matchId, winner })
      send(opponent, 'match:complete', { matchId, winner })
      telem('match:casual_complete', { matchId, winner, p1: creator, p2: opponent })
      cleanupMatch(matchId, creator, opponent)
      return
    }

    send(creator, 'match:settling', { matchId })
    send(opponent, 'match:settling', { matchId })
    telem('match:settling', { matchId, winner, p1: creator, p2: opponent })

    let txHash: string
    try {
      txHash = await settleMatch(matchId, winner)
    } catch (e) {
      console.error('[settlement] failed', e)
      // Keep Redis state alive — do NOT clean up. Admin/retry can recover.
      await redis.set(`match:bet:${matchId}`, JSON.stringify({
        ...bet, status: 'settlement_failed', winner, failedAt: Date.now(),
      }), 'EX', 86400)
      const errMsg = 'Settlement failed — your funds are safe on-chain. Contact support with match ID: ' + matchId
      send(creator, 'match:error', { message: errMsg })
      send(opponent, 'match:error', { message: errMsg })
      telem('match:settlement_failed', { matchId, winner, error: String(e), creator, opponent })
      activeMatches.delete(matchId)
      return  // do NOT call cleanupMatch — preserve Redis for recovery
    }

    send(creator, 'match:settled', { matchId, winner, txHash })
    send(opponent, 'match:settled', { matchId, winner, txHash })
    telem('match:settled', { matchId, winner, txHash, amount: bet.amount, denom: bet.denom, payout: bet.amount ? String(BigInt(bet.amount) * 2n) : '0' })
    cleanupMatch(matchId, creator, opponent)
  }
}

// ── Create (bet or casual) ────────────────────────────────────────────────────

export async function handleCreate(creator: string, data: BetCreate | CasualCreate, isCasual: boolean) {
  const bet = { ...data, creator, isCasual, status: 'waiting', createdAt: Date.now() }
  await Promise.all([
    redis.set(`match:bet:${data.matchId}`, JSON.stringify(bet), 'EX', 3600),
    redis.set(`match:active:${creator}`, data.matchId, 'EX', 3600),
    redis.zadd(`user:matches:${creator}`, Date.now(), data.matchId)
      .then(() => redis.zremrangebyrank(`user:matches:${creator}`, 0, -201)),
  ])
  if (data.isPublic) {
    const amount = (data as BetCreate).amount
    const denom = (data as BetCreate).denom
    await redis.zadd('match:public', Date.now(), data.matchId)
    broadcastOpenMatch(data.matchId, data.gameSlug, creator, isCasual, amount, denom)
  }
  const sharePath = data.isPublic ? null : isCasual
    ? `/?join=${data.matchId}&game=${data.gameSlug}&casual=true`
    : `/?join=${data.matchId}&game=${data.gameSlug}&amount=${(data as BetCreate).amount}&denom=${(data as BetCreate).denom}`
  send(creator, 'match:waiting', { matchId: data.matchId, sharePath })
  telem(isCasual ? 'match:casual_create' : 'match:create', { matchId: data.matchId, creator, gameSlug: data.gameSlug, isPublic: data.isPublic, ...(!isCasual && { amount: (data as BetCreate).amount, denom: (data as BetCreate).denom }) })
}

// ── Join (bet or casual) ──────────────────────────────────────────────────────

export async function handleJoin(joiner: string, data: { matchId: string }, isCasual: boolean) {
  const raw = await redis.get(`match:bet:${data.matchId}`)
  if (!raw) { send(joiner, 'match:error', { message: 'Match not found or expired' }); return }
  const bet = JSON.parse(raw)
  if (bet.status !== 'waiting') { send(joiner, 'match:error', { message: 'Match already full' }); return }
  if (joiner === bet.creator) { send(joiner, 'match:error', { message: 'Cannot join your own match' }); return }

  // Prevent casual/competitive type mismatch
  if (!!bet.isCasual !== isCasual) {
    send(joiner, 'match:error', { message: isCasual ? 'This is a competitive match — use competitive join' : 'This is a casual match — use casual join' })
    return
  }

  const updatedBet: Bet = { ...bet, opponent: joiner, status: 'joined' }
  await Promise.all([
    redis.set(`match:bet:${data.matchId}`, JSON.stringify(updatedBet), 'EX', 3600),
    redis.set(`match:active:${joiner}`, data.matchId, 'EX', 3600),
    redis.zadd(`user:matches:${joiner}`, Date.now(), data.matchId)
      .then(() => redis.zremrangebyrank(`user:matches:${joiner}`, 0, -201)),
  ])
  if (updatedBet.isPublic) {
    await redis.zrem('match:public', data.matchId)
    broadcast('lobby:match_taken', { matchId: data.matchId })
  }
  send(updatedBet.creator, 'match:opponent_joined', { matchId: data.matchId, opponent: joiner })
  send(joiner, 'match:opponent_joined', { matchId: data.matchId, opponent: updatedBet.creator })
  telem(updatedBet.isCasual ? 'match:casual_join' : 'match:join', { matchId: data.matchId, joiner, creator: updatedBet.creator, ...(!updatedBet.isCasual && { amount: updatedBet.amount, denom: updatedBet.denom }) })
}

// ── Ready flow ────────────────────────────────────────────────────────────────

export async function handlePlayerReady(address: string, matchId: string) {
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) { send(address, 'match:error', { message: 'Match not found' }); return }
  const bet = JSON.parse(raw) as Bet

  if (bet.status !== 'joined') { send(address, 'match:error', { message: 'Match not in ready phase' }); return }
  if (address !== bet.creator && address !== bet.opponent) { send(address, 'match:error', { message: 'Not a participant' }); return }

  const ready = { ...(bet.ready ?? {}), [address]: true }
  const updatedBet: Bet = { ...bet, ready }
  await redis.set(`match:bet:${matchId}`, JSON.stringify(updatedBet), 'EX', 3600)

  const other = updatedBet.creator === address ? updatedBet.opponent : updatedBet.creator
  if (other) send(other, 'match:opponent_ready', { matchId })
  telem('match:ready', { matchId, address })

  if (ready[updatedBet.creator] && updatedBet.opponent && ready[updatedBet.opponent]) {
    // Atomic gate — only one of the two simultaneous ready handlers starts the countdown
    const gate = await redis.set(`match:countdown:${matchId}`, '1', 'EX', 30, 'NX')
    if (!gate) return  // other handler already started countdown

    // Extend TTL to 24h now that the game is going live
    const activeBet: Bet = { ...updatedBet, status: 'active' }
    await redis.set(`match:bet:${matchId}`, JSON.stringify(activeBet), 'EX', 86400)
    await Promise.all([
      redis.expire(`match:active:${activeBet.creator}`, 86400),
      redis.expire(`match:active:${activeBet.opponent}`, 86400),
    ])

    send(activeBet.creator, 'match:countdown', { matchId, seconds: 3 })
    send(activeBet.opponent!, 'match:countdown', { matchId, seconds: 3 })
    telem('match:countdown', { matchId, p1: activeBet.creator, p2: activeBet.opponent, seconds: 3 })

    const match = createMatch(activeBet.creator, activeBet.opponent!)
    attachCompletion(match, matchId, activeBet.creator, activeBet.opponent!, activeBet)
    activeMatches.set(matchId, match)

    setTimeout(() => {
      send(activeBet.creator, 'match:begin', { matchId, p1: activeBet.creator, p2: activeBet.opponent })
      send(activeBet.opponent!, 'match:begin', { matchId, p1: activeBet.creator, p2: activeBet.opponent })
      telem('match:begin', { matchId, p1: activeBet.creator, p2: activeBet.opponent, gameSlug: activeBet.gameSlug, amount: activeBet.amount, denom: activeBet.denom })
    }, 3_000)
  }
}

// ── Forfeit on disconnect (called by lobby handler after grace period) ─────────

export function handleForfeit(matchId: string, disconnectedAddress: string) {
  const match = activeMatches.get(matchId)
  if (!match || match.phase === 'complete') return
  const winner = match.player1 === disconnectedAddress ? match.player2 : match.player1
  telem('match:forfeit', { matchId, disconnected: disconnectedAddress, winner })
  match.terminate(winner)
}

// ── Abort match mid-flow (either player, joined/ready only) ──────────────────

export async function handleAbortMatch(address: string, matchId: string) {
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) return
  const bet = JSON.parse(raw) as Bet

  // Allow abort during joined AND active-but-not-yet-started (countdown window)
  if (bet.status !== 'joined' && bet.status !== 'active') return
  if (bet.status === 'active' && activeMatches.has(matchId)) return  // game in progress, forfeit handles it
  if (bet.creator !== address && bet.opponent !== address) return

  const other = bet.creator === address ? bet.opponent : bet.creator
  const cleanupKeys = [
    `match:bet:${matchId}`,
    `match:active:${address}`,
    ...(other ? [`match:active:${other}`] : []),
  ]

  if (bet.isCasual) {
    await Promise.all([
      redis.del(...cleanupKeys),
      bet.isPublic ? redis.zrem('match:public', matchId) : Promise.resolve(),
    ])
    if (other) send(other, bet.creator === address ? 'match:creator_left' : 'match:opponent_left', { matchId })
  } else {
    // For competitive: refund on-chain BEFORE deleting Redis state so recovery is possible on failure
    try {
      await abortMatchOnChain(matchId)
      await Promise.all([
        redis.del(...cleanupKeys),
        bet.isPublic ? redis.zrem('match:public', matchId) : Promise.resolve(),
      ])
      send(address, 'match:cancelled', { matchId, isCasual: false })
      if (other) send(other, 'match:cancelled', { matchId, isCasual: false })
    } catch (e) {
      console.error('[abort] on-chain refund failed', e)
      await redis.set(`match:bet:${matchId}`, JSON.stringify({ ...bet, status: 'abort_failed', failedAt: Date.now() }), 'EX', 86400)
      const msg = 'Refund failed — contact support with match ID: ' + matchId
      send(address, 'match:error', { message: msg })
      if (other) send(other, 'match:error', { message: msg })
    }
  }

  telem('match:abort', { matchId, by: address, role: bet.creator === address ? 'creator' : 'opponent' })
}

// ── Cancel public match (creator-initiated, waiting only) ─────────────────────

export async function handleCancelMatch(address: string, data: MatchCancel) {
  const raw = await redis.get(`match:bet:${data.matchId}`)
  if (!raw) { send(address, 'match:error', { message: 'Match not found' }); return }
  const bet = JSON.parse(raw) as Bet

  if (bet.creator !== address) { send(address, 'match:error', { message: 'Not your match' }); return }
  if (bet.status !== 'waiting') { send(address, 'match:error', { message: 'Match already joined — cannot cancel' }); return }

  const cleanupKeys = [`match:bet:${data.matchId}`, `match:active:${address}`]

  if (bet.isCasual) {
    await Promise.all([
      redis.del(...cleanupKeys),
      bet.isPublic ? redis.zrem('match:public', data.matchId) : Promise.resolve(),
    ])
    if (bet.isPublic) broadcast('lobby:match_cancelled', { matchId: data.matchId })
    send(address, 'match:cancelled', { matchId: data.matchId, isCasual: true })
    telem('match:cancel', { matchId: data.matchId, creator: address, isCasual: true })
    return
  }

  // Competitive: on-chain refund BEFORE deleting Redis so failure is recoverable
  try {
    const txHash = await cancelMatchOnChain(data.matchId)
    await Promise.all([
      redis.del(...cleanupKeys),
      bet.isPublic ? redis.zrem('match:public', data.matchId) : Promise.resolve(),
    ])
    if (bet.isPublic) broadcast('lobby:match_cancelled', { matchId: data.matchId })
    send(address, 'match:cancelled', { matchId: data.matchId, isCasual: false, txHash })
    telem('match:cancel', { matchId: data.matchId, creator: address, isCasual: false })
  } catch (e) {
    console.error('[cancel] on-chain refund failed', e)
    send(address, 'match:error', { message: 'Refund failed — contact support with match ID: ' + data.matchId })
  }
}

// ── Real-time state relay (hot path — sync, no Redis) ─────────────────────────

export function handleGameState(from: string, matchId: string, stateData: unknown) {
  const match = activeMatches.get(matchId)
  if (!match || (from !== match.player1 && from !== match.player2)) return
  // ponytail: 8KB cap on relayed state — increase if game state grows
  if (JSON.stringify(stateData).length > 8192) return
  const other = match.player1 === from ? match.player2 : match.player1
  send(other, 'game:state', stateData)
}

// ── Real-time input relay (hot path — sync, no Redis) ─────────────────────────

export function handleGameInput(from: string, matchId: string, slot: 1 | 2, dir: number) {
  const match = activeMatches.get(matchId)
  if (!match || (from !== match.player1 && from !== match.player2)) return
  const other = match.player1 === from ? match.player2 : match.player1
  send(other, 'game:input', { matchId, slot, dir })
}

// ── Game over (client-reported, consensus model) ──────────────────────────────
// Security model:
//   - Both players must report the same winner (consensus)
//   - If they disagree → disputed state, funds stay locked for admin
//   - If one player crashes/disconnects, 10s timeout accepts the single report
//   - Winner and sender must both be verified match participants

const CONSENSUS_TIMEOUT_MS = 10_000
const SETTLED_STATUSES = new Set(['settling', 'complete', 'settlement_failed', 'disputed'])

async function doSettle(matchId: string, winner: string, claimedBy: string) {
  const claimed = await redis.set(`match:settling:${matchId}`, claimedBy, 'EX', 300, 'NX')
  if (!claimed) return
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) return
  const bet = JSON.parse(raw)
  if (SETTLED_STATUSES.has(bet.status)) { await redis.del(`match:settling:${matchId}`); return }
  await redis.set(`match:bet:${matchId}`, JSON.stringify({ ...bet, status: 'settling' }), 'EX', 86400)
  telem('game:over', { matchId, winner, reportedBy: claimedBy })
  activeMatches.get(matchId)?.terminate(winner)
}

async function markDisputed(matchId: string, bet: any, p1: string, p1Winner: string, p2: string, p2Winner: string) {
  await redis.set(`match:bet:${matchId}`, JSON.stringify({
    ...bet, status: 'disputed', dispute: { [p1]: p1Winner, [p2]: p2Winner }, disputedAt: Date.now(),
  }), 'EX', 86400)
  send(bet.creator, 'match:disputed', { matchId })
  send(bet.opponent, 'match:disputed', { matchId })
  telem('game:over:disputed', { matchId, [p1]: p1Winner, [p2]: p2Winner })
}

export async function handleGameOver(from: string, matchId: string, winner: string) {
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) return
  const bet = JSON.parse(raw)

  if (from !== bet.creator && from !== bet.opponent) return
  if (winner !== bet.creator && winner !== bet.opponent) {
    telem('game:over:invalid_winner', { matchId, from, winner })
    return
  }
  if (SETTLED_STATUSES.has(bet.status)) return

  // Record this player's report (NX = first report only, no changing votes)
  const stored = await redis.set(`match:gameover:${matchId}:${from}`, winner, 'EX', 300, 'NX')
  if (!stored) return  // already reported

  const other = from === bet.creator ? bet.opponent : bet.creator
  const otherReport = other ? await redis.get(`match:gameover:${matchId}:${other}`) : null

  if (otherReport !== null) {
    if (otherReport !== winner) {
      await markDisputed(matchId, bet, from, winner, other, otherReport)
    } else {
      await doSettle(matchId, winner, from)
    }
    return
  }

  // Only one report so far — wait for other player before settling
  setTimeout(async () => {
    const alreadySettling = await redis.exists(`match:settling:${matchId}`)
    if (alreadySettling) return
    const myReport = await redis.get(`match:gameover:${matchId}:${from}`)
    if (!myReport) return  // key expired
    await doSettle(matchId, myReport, from)
  }, CONSENSUS_TIMEOUT_MS)
}
