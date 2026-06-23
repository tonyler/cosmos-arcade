import { redis } from './redis'
import { cancelMatchOnChain, abortMatchOnChain } from './chain/settlement'
import type { Bet } from './ws/handlers/types'

const INTERVAL_MS = 60_000       // run every 60s
const PENDING_TIMEOUT_MS = 180_000  // cancel waiting matches stuck > 3min
const ACTIVE_TIMEOUT_MS  = 90_000   // abort active matches stuck > 90s (both deposited, game never started)

async function recoverMatch(matchId: string, bet: Bet) {
  const age = Date.now() - bet.createdAt

  try {
    if (bet.status === 'abort_failed') {
      // Previous abort/cancel failed — retry the appropriate on-chain call
      const fn = bet.opponent ? abortMatchOnChain : cancelMatchOnChain
      await fn(matchId)
      await redis.del(`match:bet:${matchId}`)
      if (bet.creator) await redis.del(`match:active:${bet.creator}`)
      if (bet.opponent) await redis.del(`match:active:${bet.opponent}`)
      console.log(`[recovery] resolved abort_failed match=${matchId}`)
      return
    }

    if (bet.status === 'waiting' && !bet.isCasual && age > PENDING_TIMEOUT_MS) {
      // Competitive match no one joined — refund creator
      await cancelMatchOnChain(matchId)
      await redis.del(`match:bet:${matchId}`)
      await redis.del(`match:active:${bet.creator}`)
      await redis.zrem('match:public', matchId)
      console.log(`[recovery] cancelled stale waiting match=${matchId}`)
      return
    }

    if (bet.status === 'active' && !bet.isCasual && age > ACTIVE_TIMEOUT_MS) {
      // Both deposited but game never started (server missed the disconnect) — abort both
      await abortMatchOnChain(matchId)
      await redis.del(`match:bet:${matchId}`)
      if (bet.creator) await redis.del(`match:active:${bet.creator}`)
      if (bet.opponent) await redis.del(`match:active:${bet.opponent}`)
      console.log(`[recovery] aborted stale active match=${matchId}`)
      return
    }
  } catch (e) {
    console.error(`[recovery] failed to recover match=${matchId}`, e)
    // Leave in Redis — will retry next tick
  }
}

async function runRecovery() {
  try {
    // Scan all match:bet:* keys — only competitive matches need on-chain recovery
    const keys = await redis.keys('match:bet:*')
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const bet = JSON.parse(raw) as Bet
      if (bet.isCasual) continue
      const matchId = key.replace('match:bet:', '')
      await recoverMatch(matchId, bet)
    }
  } catch (e) {
    console.error('[recovery] scan failed', e)
  }
}

export function startRecoveryJob() {
  // Stagger first run by 10s to let server finish startup
  setTimeout(() => {
    runRecovery()
    setInterval(runRecovery, INTERVAL_MS)
  }, 10_000)
  console.log('[recovery] job scheduled every 60s')
}
