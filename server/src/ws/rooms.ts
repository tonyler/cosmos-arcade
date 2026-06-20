import type { WebSocket } from 'ws'

const clients = new Map<string, WebSocket>()

export function register(address: string, ws: WebSocket) {
  clients.set(address, ws)
}

export function unregister(address: string, ws: WebSocket) {
  // Only remove if this is still the active connection — prevents a reconnecting
  // client's new registration from being wiped by the old socket's close event.
  if (clients.get(address) === ws) clients.delete(address)
}

export function send(address: string, type: string, data: unknown) {
  const ws = clients.get(address)
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ type, data }))
  } else {
    if (process.env.DEBUG_WS) console.log(`[rooms] send MISS type=${type} to=${address} readyState=${ws?.readyState ?? 'not-registered'}`)
  }
}

export function broadcast(type: string, data: unknown, exclude?: string) {
  const msg = JSON.stringify({ type, data })
  for (const [addr, ws] of clients) {
    if (addr !== exclude && ws.readyState === 1) ws.send(msg)
  }
}

export function onlinePlayers(): string[] {
  return [...clients.keys()]
}
