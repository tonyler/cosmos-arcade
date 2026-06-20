import { Router } from 'express'
import { redis } from '../../redis'

const router = Router()

router.get('/:address', async (req, res) => {
  const addr = req.params.address
  if (!/^[a-z0-9_-]{1,100}$/i.test(addr)) { res.status(400).json({ error: 'Invalid address' }); return }
  const matchIds = await redis.zrevrange(`user:matches:${addr}`, 0, 49)
  if (!matchIds.length) { res.json({ matches: [] }); return }
  const raws = await redis.mget(matchIds.map((id) => `match:bet:${id}`))
  const matches = raws.flatMap((raw) => {
    if (!raw) return []
    try { return [JSON.parse(raw)] } catch { return [] }
  })
  res.json({ matches })
})

export default router
