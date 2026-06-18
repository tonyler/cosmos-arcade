import { Router } from 'express'
import { redis } from '../../redis'

const router = Router()

router.get('/:address', async (req, res) => {
  const name = await redis.get(`username:${req.params.address}`)
  res.json({ address: req.params.address, username: name ?? null })
})

router.post('/', async (req, res) => {
  const { address, username, sig } = req.body
  if (!address || !username || !sig) { res.status(400).json({ error: 'missing fields' }); return }
  if (username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: 'invalid username' }); return
  }
  const existing = await redis.get(`username_addr:${username}`)
  if (existing && existing !== address) { res.status(409).json({ error: 'username taken' }); return }
  await redis.set(`username:${address}`, username)
  await redis.set(`username_addr:${username}`, address)
  res.json({ address, username })
})

export default router
