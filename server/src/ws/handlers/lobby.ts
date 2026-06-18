import type { WebSocket } from 'ws'
import { redis } from '../../redis'
import { broadcast, onlinePlayers } from '../rooms'
import { telem } from '../telemetry'

export async function handleLobbyJoin(ws: WebSocket, address: string) {
  await redis.set(`online:${address}`, '1', 'EX', 300)
  broadcast('lobby:player_joined', { address }, address)
  ws.send(JSON.stringify({ type: 'lobby:players', data: { players: onlinePlayers() } }))
  telem('wallet:connect', { address })
}

export async function handleLobbyLeave(address: string) {
  await redis.del(`online:${address}`)
  broadcast('lobby:player_left', { address })
  telem('wallet:disconnect', { address })
}

export async function handleLobbyPing(address: string) {
  await redis.set(`online:${address}`, '1', 'EX', 300)
}
