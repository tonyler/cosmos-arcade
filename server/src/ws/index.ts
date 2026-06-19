import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import { register, unregister } from './rooms'
import { handleLobbyJoin, handleLobbyLeave, handleLobbyPing } from './handlers/lobby'
import { handleChatMessage, getChatHistory } from './handlers/chat'
import {
  handleChallenge, handleAccept, handleReject,
  handleCreateBet, handleJoinBet, handlePlayerReady,
  handleGameInput, handleGameOver, handleGameEvent,
  handleCreateCasual, handleJoinCasual,
} from './handlers/match'
import { subscribeAdmin, unsubscribeAdmin } from './telemetry'

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
          case 'chat:message':  await handleChatMessage(address, data.text, data.username); break
          case 'chat:history': {
            const history = await getChatHistory()
            ws.send(JSON.stringify({ type: 'chat:history', data: { messages: history } }))
            break
          }
          case 'match:challenge': await handleChallenge(address, data); break
          case 'match:accept':    await handleAccept(address, data.challenger); break
          case 'match:reject':    await handleReject(address, data.challenger); break
          case 'match:create':         await handleCreateBet(address, data); break
          case 'match:join':           await handleJoinBet(address, data); break
          case 'match:casual_create':  await handleCreateCasual(address, data); break
          case 'match:casual_join':    await handleJoinCasual(address, data); break
          case 'match:ready':     await handlePlayerReady(address, data.matchId); break
          case 'match:event':     await handleGameEvent(address, data.matchId, data); break
          // Hot path — sync relay, no await needed
          case 'game:input':      handleGameInput(address, data.matchId, data.slot, data.dir); break
          case 'game:over':       await handleGameOver(address, data.matchId, data.winner); break
          case 'admin:subscribe': subscribeAdmin(ws); break
        }
      } catch (e) {
        console.error('[ws] error', e)
      }
    })

    ws.on('close', () => {
      unregister(address)
      unsubscribeAdmin(ws)
      handleLobbyLeave(address)
    })
  })

  return wss
}
