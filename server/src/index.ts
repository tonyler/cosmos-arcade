import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { redis } from './redis'
import { attachWS } from './ws'
import apiRouter from './api'

const PORT = Number(process.env.PORT ?? 4000)

async function main() {
  await redis.connect()
  console.log('[redis] connected')

  const app = express()
  app.use(express.json())
  app.use('/api', apiRouter)

  const server = createServer(app)
  attachWS(server)

  server.listen(PORT, () => console.log(`[server] listening on :${PORT}`))
}

main().catch((e) => { console.error(e); process.exit(1) })
