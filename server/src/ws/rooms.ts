import type { WebSocket } from 'ws'

const clients = new Map<string, WebSocket>()

export function register(address: string, ws: WebSocket) {
  clients.set(address, ws)
}

export function unregister(address: string) {
  clients.delete(address)
}

export function send(address: string, type: string, data: unknown) {
  const ws = clients.get(address)
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type, data }))
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
