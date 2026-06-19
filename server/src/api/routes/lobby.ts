import { Router } from 'express'
import { redis } from '../../redis'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const matchIds = await redis.zrevrange('match:public', 0, 49)
    const matches = []
    if (matchIds.length > 0) {
      const raws = await redis.mget(...matchIds.map((id) => `match:bet:${id}`))
      for (let i = 0; i < matchIds.length; i++) {
        const raw = raws[i]
        if (!raw) continue
        const m = JSON.parse(raw)
        if (m.status !== 'waiting') continue
        matches.push({
          matchId: matchIds[i],
          gameSlug: m.gameSlug,
          isCasual: !!m.isCasual,
          amount: m.amount ?? null,
          denom: m.denom ?? null,
          creator: m.creator,
          createdAt: m.createdAt,
        })
      }
    }
    res.json({ matches })
  } catch (e) {
    console.error('[lobby]', e)
    res.status(500).json({ matches: [] })
  }
})

export default router
