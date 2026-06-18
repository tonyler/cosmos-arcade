import { Router } from 'express'
import { redis } from '../../redis'

const router = Router()

router.get('/:address', async (req, res) => {
  const keys = await redis.keys(`match:*`)
  const matches = []
  for (const key of keys) {
    const raw = await redis.get(key)
    if (!raw) continue
    const m = JSON.parse(raw)
    if (m.challenger === req.params.address || m.opponent === req.params.address) {
      matches.push(m)
    }
  }
  matches.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
  res.json({ matches: matches.slice(0, 50) })
})

export default router
