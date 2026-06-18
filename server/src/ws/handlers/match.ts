import { send, broadcast } from '../rooms'
import { redis } from '../../redis'
import { settleMatch } from '../../chain/settlement'
import { telem } from '../telemetry'
import { PacManMatch } from '../../games/pacman/PacManMatch'
import type { BaseMatch } from '../../games/_base/BaseMatch'
import type { Challenge, BetCreate, BetJoin } from './types'

const activeMatches = new Map<string, BaseMatch>()

function createMatchInstance(gameSlug: string, matchId: string, p1: string, p2: string): BaseMatch {
  if (gameSlug === 'pacman') return new PacManMatch(matchId, p1, p2)
  throw new Error(`Unknown game: ${gameSlug}`)
}

function attachSettlement(match: BaseMatch, matchId: string, creator: string, opponent: string, amount: string, denom: string) {
  match.onComplete = async (winner) => {
    send(creator, 'match:settling', { matchId })
    send(opponent, 'match:settling', { matchId })
    telem('match:settling', { matchId, winner, p1: creator, p2: opponent })
    const txHash = await settleMatch(matchId, winner).catch((e) => { console.error('[settlement]', e); return 'failed' })
    send(creator, 'match:settled', { matchId, winner, txHash })
    send(opponent, 'match:settled', { matchId, winner, txHash })
    telem('match:settled', { matchId, winner, txHash, amount, denom, payout: String(BigInt(amount) * 2n) })
    activeMatches.delete(matchId)
    redis.del(`match:bet:${matchId}`).catch(() => {})
  }
}

// ── Legacy challenge flow (kept for reference) ────────────────────────────────

export async function handleChallenge(from: string, challenge: Challenge) {
  const key = `match:pending:${from}:${challenge.to}`
  await redis.set(key, JSON.stringify(challenge), 'EX', 60)
  send(challenge.to, 'match:challenged', { ...challenge, from })
}

export async function handleAccept(acceptor: string, challenger: string) {
  const key = `match:pending:${challenger}:${acceptor}`
  const raw = await redis.get(key)
  if (!raw) { send(acceptor, 'match:error', { message: 'Challenge expired' }); return }
  await redis.del(key)
  const matchId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const match = { matchId, challenger, opponent: acceptor, status: 'active', startedAt: Date.now() }
  await redis.set(`match:${matchId}`, JSON.stringify(match), 'EX', 600)
  send(challenger, 'match:started', match)
  send(acceptor, 'match:started', match)
  broadcast('lobby:match_started', { matchId, challenger, opponent: acceptor })
}

export async function handleReject(acceptor: string, challenger: string) {
  await redis.del(`match:pending:${challenger}:${acceptor}`)
  send(challenger, 'match:rejected', { by: acceptor })
}

// ── Bet flow ──────────────────────────────────────────────────────────────────

export async function handleCreateBet(creator: string, data: BetCreate) {
  const bet = { ...data, creator, status: 'waiting', createdAt: Date.now() }
  await redis.set(`match:bet:${data.matchId}`, JSON.stringify(bet), 'EX', 3600)
  if (data.isPublic) {
    await redis.zadd('match:public', Date.now(), data.matchId)
    broadcast('lobby:open_match', { matchId: data.matchId, gameSlug: data.gameSlug, amount: data.amount, denom: data.denom }, creator)
  }
  const sharePath = data.isPublic
    ? null
    : `/?join=${data.matchId}&game=${data.gameSlug}&amount=${data.amount}&denom=${data.denom}`
  send(creator, 'match:waiting', { matchId: data.matchId, sharePath })
  telem('match:create', { matchId: data.matchId, creator, gameSlug: data.gameSlug, amount: data.amount, denom: data.denom, isPublic: data.isPublic })
}

export async function handleJoinBet(joiner: string, data: BetJoin) {
  const raw = await redis.get(`match:bet:${data.matchId}`)
  if (!raw) { send(joiner, 'match:error', { message: 'Match not found or expired' }); return }
  const bet = JSON.parse(raw)
  if (bet.status !== 'waiting') { send(joiner, 'match:error', { message: 'Match already full' }); return }
  if (joiner === bet.creator) { send(joiner, 'match:error', { message: 'Cannot join your own match' }); return }
  bet.opponent = joiner
  bet.status = 'joined'
  await redis.set(`match:bet:${data.matchId}`, JSON.stringify(bet), 'EX', 3600)
  if (bet.isPublic) redis.zrem('match:public', data.matchId).catch(() => {})
  send(bet.creator, 'match:opponent_joined', { matchId: data.matchId, opponent: joiner })
  send(joiner, 'match:opponent_joined', { matchId: data.matchId, opponent: bet.creator })
  telem('match:join', { matchId: data.matchId, joiner, creator: bet.creator, amount: bet.amount, denom: bet.denom })
}

export async function handlePlayerReady(address: string, matchId: string) {
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) { send(address, 'match:error', { message: 'Match not found' }); return }
  const bet = JSON.parse(raw)
  if (!bet.ready) bet.ready = {}
  bet.ready[address] = true
  await redis.set(`match:bet:${matchId}`, JSON.stringify(bet), 'EX', 3600)
  const other = bet.creator === address ? bet.opponent : bet.creator
  if (other) send(other, 'match:opponent_ready', { matchId })
  telem('match:ready', { matchId, address })
  if (bet.ready[bet.creator] && bet.ready[bet.opponent]) {
    send(bet.creator, 'match:countdown', { matchId, seconds: 15 })
    send(bet.opponent, 'match:countdown', { matchId, seconds: 15 })
    telem('match:countdown', { matchId, p1: bet.creator, p2: bet.opponent, seconds: 15 })
    const match = createMatchInstance(bet.gameSlug, matchId, bet.creator, bet.opponent)
    attachSettlement(match, matchId, bet.creator, bet.opponent, bet.amount, bet.denom)
    activeMatches.set(matchId, match)
    setTimeout(() => {
      send(bet.creator, 'match:begin', { matchId, p1: bet.creator, p2: bet.opponent })
      send(bet.opponent, 'match:begin', { matchId, p1: bet.creator, p2: bet.opponent })
      telem('match:begin', { matchId, p1: bet.creator, p2: bet.opponent, gameSlug: bet.gameSlug, amount: bet.amount, denom: bet.denom })
    }, 15_000)
  }
}

// ── Real-time input relay (hot path — sync, no Redis) ─────────────────────────

export function handleGameInput(from: string, matchId: string, slot: 1 | 2, dir: number) {
  const match = activeMatches.get(matchId)
  if (!match) return
  const other = match.player1 === from ? match.player2 : match.player1
  send(other, 'game:input', { matchId, slot, dir })
}

// ── Game over (client-reported, deduplicated via bet status) ──────────────────

export async function handleGameOver(from: string, matchId: string, winner: string) {
  const raw = await redis.get(`match:bet:${matchId}`)
  if (!raw) return
  const bet = JSON.parse(raw)
  if (bet.status === 'settling' || bet.status === 'complete') return  // already processing
  bet.status = 'settling'
  await redis.set(`match:bet:${matchId}`, JSON.stringify(bet), 'EX', 3600)
  telem('game:over', { matchId, winner, reportedBy: from })
  activeMatches.get(matchId)?.terminate(winner)
}

// ── Legacy event relay ────────────────────────────────────────────────────────

export async function handleGameEvent(from: string, matchId: string, event: unknown) {
  const match = activeMatches.get(matchId)
  if (match) {
    match.handleEvent(from, event)
    return
  }
  const raw = await redis.get(`match:${matchId}`)
  if (!raw) return
  const m = JSON.parse(raw)
  send(m.challenger, 'match:event', event)
  send(m.opponent, 'match:event', event)
}
