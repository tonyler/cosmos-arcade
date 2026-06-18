import type { WebSocket } from 'ws'

const admins = new Set<WebSocket>()

export function subscribeAdmin(ws: WebSocket) { admins.add(ws) }
export function unsubscribeAdmin(ws: WebSocket) { admins.delete(ws) }

export function telem(type: string, data: Record<string, unknown> = {}) {
  if (admins.size === 0) return
  const msg = JSON.stringify({ type: 'telem', data: { type, ts: Date.now(), ...data } })
  for (const ws of admins) {
    if (ws.readyState === 1) ws.send(msg)
  }
}
