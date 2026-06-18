import { broadcast } from '../rooms'
import { redis } from '../../redis'

const CHAT_KEY = 'chat:general'
const MAX_HISTORY = 100

export async function handleChatMessage(address: string, text: string, username?: string) {
  const msg = {
    id: Date.now().toString(),
    user: username ?? address.slice(0, 9) + '…' + address.slice(-4),
    text: text.slice(0, 500),
    time: new Date().toISOString(),
    address,
  }
  await redis.lpush(CHAT_KEY, JSON.stringify(msg))
  await redis.ltrim(CHAT_KEY, 0, MAX_HISTORY - 1)
  broadcast('chat:message', msg)
}

export async function getChatHistory(): Promise<unknown[]> {
  const raw = await redis.lrange(CHAT_KEY, 0, 49)
  return raw.map((r) => JSON.parse(r)).reverse()
}
