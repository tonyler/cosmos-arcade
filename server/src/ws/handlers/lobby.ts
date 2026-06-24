import { redis } from '../../redis'
import { broadcast, send, onlinePlayers } from '../rooms'
import { broadcastOpenMatch, handleForfeit } from './match'
import { abortMatchOnChain, cancelMatchOnChain } from '../../chain/settlement'
import { telem } from '../telemetry'
import type { Bet } from './types'

const FORFEIT_GRACE_MS = 10_000  // 10s — no reconnection support, just enough for a page blip

export async function handleLobbyJoin(address: string) {
  await redis.set(`online:${address}`, '1', 'EX', 300)
  broadcast('lobby:player_joined', { address }, address)
  send(address, 'lobby:players', { players: onlinePlayers() })

  // Notify opponent if reconnecting during an active match
  const matchId = await redis.get(`match:active:${address}`)
  if (matchId) {
    const raw = await redis.get(`match:bet:${matchId}`)
    if (raw) {
      const bet = JSON.parse(raw) as Bet
      if (bet.status === 'active') {
        const other = bet.creator === address ? bet.opponent : bet.creator
        if (other) send(other, 'match:opponent_reconnected', { matchId })
      }
    }
  }

  telem('wallet:connect', { address })
}

// ── Disconnect sub-handlers ────────────────────────────────────────────────────

async function cancelWaiting(matchId: string, bet: Bet, address: string) {
  if (!bet.isCasual) {
    // Competitive match — refund on-chain BEFORE deleting Redis so failure is recoverable
    try {
      await cancelMatchOnChain(matchId)
    } catch (e) {
      console.error('[cancelWaiting] on-chain refund failed', e)
      await redis.set(`match:bet:${matchId}`, JSON.stringify({ ...bet, status: 'abort_failed', failedAt: Date.now() }), 'EX', 86400)
      telem('match:cancel_on_disconnect_failed', { matchId, creator: address, error: String(e) })
      return
    }
  }
  await Promise.all([
    redis.del(`match:bet:${matchId}`),
    redis.del(`match:active:${address}`),
    bet.isPublic ? redis.zrem('match:public', matchId) : Promise.resolve(),
  ])
  if (bet.isPublic) broadcast('lobby:match_cancelled', { matchId })
  telem('match:cancel_on_disconnect', { matchId, creator: address, isCasual: !!bet.isCasual })
}

async function resetJoinedOpponent(matchId: string, bet: Bet, address: string) {
  const { ready: _r, ...rest } = bet
  const updated: Bet = { ...rest, opponent: null, status: 'waiting' }
  await Promise.all([
    redis.set(`match:bet:${matchId}`, JSON.stringify(updated), 'EX', 3600),
    redis.del(`match:active:${address}`),
    updated.isPublic ? redis.zadd('match:public', updated.createdAt, matchId) : Promise.resolve(),
  ])
  if (updated.isPublic) broadcastOpenMatch(matchId, updated.gameSlug, updated.creator, !!updated.isCasual, updated.amount, updated.denom)
  send(updated.creator, 'match:opponent_left', { matchId })
  telem('match:opponent_left_on_disconnect', { matchId, opponent: address })
}

async function cancelJoinedCreator(matchId: string, bet: Bet, address: string) {
  const other = bet.opponent
  if (!other) return

  if (!bet.isCasual) {
    // Both players deposited on-chain — refund both before wiping Redis
    try {
      await abortMatchOnChain(matchId)
      await Promise.all([
        redis.del(`match:bet:${matchId}`),
        redis.del(`match:active:${address}`),
        redis.del(`match:active:${other}`),
        bet.isPublic ? redis.zrem('match:public', matchId) : Promise.resolve(),
      ])
      send(other, 'match:cancelled', { matchId, isCasual: false })
    } catch (e) {
      console.error('[creator-disconnect] on-chain refund failed', e)
      await redis.set(`match:bet:${matchId}`, JSON.stringify({ ...bet, status: 'abort_failed', failedAt: Date.now() }), 'EX', 86400)
      send(other, 'match:error', { message: 'Match creator disconnected — contact support with match ID: ' + matchId })
    }
  } else {
    await Promise.all([
      redis.del(`match:bet:${matchId}`),
      redis.del(`match:active:${address}`),
      redis.del(`match:active:${other}`),
      bet.isPublic ? redis.zrem('match:public', matchId) : Promise.resolve(),
    ])
    send(other, 'match:creator_left', { matchId })
  }

  telem('match:creator_left_on_disconnect', { matchId, creator: address })
}

function startForfeitTimer(matchId: string, address: string, other: string) {
  send(other, 'match:opponent_disconnected', { matchId, gracePeriodMs: FORFEIT_GRACE_MS })
  telem('match:disconnect_grace', { matchId, disconnected: address, gracePeriodMs: FORFEIT_GRACE_MS })

  setTimeout(async () => {
    // Check they're back online (match:active is never deleted on disconnect, so check online: key)
    const stillOnline = await redis.get(`online:${address}`)
    if (stillOnline) return

    // Re-read bet to confirm `other` is still the active participant
    const raw = await redis.get(`match:bet:${matchId}`)
    if (!raw) return
    const bet = JSON.parse(raw) as Bet
    if (bet.creator !== other && bet.opponent !== other) return

    handleForfeit(matchId, address)
    send(other, 'match:opponent_forfeited', { matchId })
    telem('match:forfeit_on_disconnect', { matchId, disconnected: address, winner: other })
  }, FORFEIT_GRACE_MS)
}

// ── Main disconnect handler ────────────────────────────────────────────────────

export async function handleLobbyLeave(address: string) {
  await redis.del(`online:${address}`)
  broadcast('lobby:player_left', { address })

  try {
    const matchId = await redis.get(`match:active:${address}`)
    if (!matchId) { telem('wallet:disconnect', { address }); return }

    const raw = await redis.get(`match:bet:${matchId}`)
    if (!raw) { await redis.del(`match:active:${address}`); telem('wallet:disconnect', { address }); return }

    const bet = JSON.parse(raw) as Bet

    if (bet.status === 'waiting' && bet.creator === address) {
      await cancelWaiting(matchId, bet, address)
    } else if (bet.status === 'joined') {
      if (bet.opponent === address) await resetJoinedOpponent(matchId, bet, address)
      else if (bet.creator === address) await cancelJoinedCreator(matchId, bet, address)
    } else if (bet.status === 'active') {
      const other = bet.creator === address ? bet.opponent : bet.creator
      if (other) startForfeitTimer(matchId, address, other)
    }
    // settling / settlement_failed / disputed / abort_failed: no-op
  } catch (e) {
    console.error('[lobby] cleanup on disconnect failed', e)
  }

  telem('wallet:disconnect', { address })
}

export async function handleLobbyPing(address: string) {
  await redis.set(`online:${address}`, '1', 'EX', 300)
}
