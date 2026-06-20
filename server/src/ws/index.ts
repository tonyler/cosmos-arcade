import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import { register, unregister } from './rooms'
import { handleLobbyJoin, handleLobbyLeave, handleLobbyPing } from './handlers/lobby'
import { handleChatMessage, getChatHistory } from './handlers/chat'
import {
  handleCreate, handleJoin, handlePlayerReady,
  handleGameInput, handleGameState, handleGameOver,
  handleCancelMatch, handleAbortMatch,
} from './handlers/match'
import { subscribeAdmin, unsubscribeAdmin } from './telemetry'

// Validate that all required keys are non-empty strings under 200 chars
function hasStrings(data: any, ...keys: string[]): boolean {
  if (!data || typeof data !== 'object') return false
  return keys.every(k => typeof data[k] === 'string' && data[k].length > 0 && data[k].length < 200)
}

export function attachWS(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const address = url.searchParams.get('address') ?? ''
    if (!address) { ws.close(1008, 'address required'); return }

    if (address === '__admin__') {
      ws.on('message', async (raw) => {
        try {
          const { type } = JSON.parse(raw.toString())
          if (type === 'admin:subscribe') subscribeAdmin(ws)
        } catch {}
      })
      ws.on('close', () => unsubscribeAdmin(ws))
      return
    }

    register(address, ws)
    handleLobbyJoin(ws, address)

    ws.on('message', async (raw) => {
      try {
        const { type, data } = JSON.parse(raw.toString())
        switch (type) {
          case 'lobby:ping':    await handleLobbyPing(address); break
          case 'chat:message':
            if (hasStrings(data, 'text') && data.text.length <= 500)
              await handleChatMessage(address, data.text, data.username)
            break
          case 'chat:history': {
            const history = await getChatHistory()
            ws.send(JSON.stringify({ type: 'chat:history', data: { messages: history } }))
            break
          }
          case 'match:create':
            if (hasStrings(data, 'matchId', 'gameSlug', 'txHash', 'amount', 'denom'))
              await handleCreate(address, data, false)
            break
          case 'match:join':
            if (hasStrings(data, 'matchId')) await handleJoin(address, data, false)
            break
          case 'match:casual_create':
            if (hasStrings(data, 'matchId', 'gameSlug')) await handleCreate(address, data, true)
            break
          case 'match:casual_join':
            if (hasStrings(data, 'matchId')) await handleJoin(address, data, true)
            break
          case 'match:cancel':
            if (hasStrings(data, 'matchId')) await handleCancelMatch(address, data)
            break
          case 'match:abort':
            if (hasStrings(data, 'matchId')) await handleAbortMatch(address, data.matchId)
            break
          case 'match:ready':
            if (hasStrings(data, 'matchId')) await handlePlayerReady(address, data.matchId)
            break
          // Hot path — sync relay, no await needed
          case 'game:input':
            if (hasStrings(data, 'matchId') && (data.slot === 1 || data.slot === 2) && typeof data.dir === 'number')
              handleGameInput(address, data.matchId, data.slot, data.dir)
            break
          case 'game:state':
            if (hasStrings(data, 'matchId')) handleGameState(address, data.matchId, data)
            break
          case 'game:over':
            if (hasStrings(data, 'matchId', 'winner')) await handleGameOver(address, data.matchId, data.winner)
            break
          case 'admin:subscribe': subscribeAdmin(ws); break
        }
      } catch (e) {
        console.error('[ws] error', e)
      }
    })

    ws.on('close', () => {
      unregister(address, ws)
      unsubscribeAdmin(ws)
      handleLobbyLeave(address)
    })
  })

  return wss
}
