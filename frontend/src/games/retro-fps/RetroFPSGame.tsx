import { useEffect, useRef, useCallback } from 'react'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../types/match'

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

// postMessage protocol between this wrapper and /retro-fps/arcade.html
type PlayerPos = { id: number; x: number; y: number; angle: number; walking: number }

type FromIframe =
  | { type: 'pvp:ready' }
  | { type: 'pvp:winner'; slot: 1 | 2 }
  | { type: 'pvp:send'; event: unknown[] }
  | { type: 'pvp:pos'; pos: PlayerPos }

type ToIframe =
  | { type: 'pvp:init'; slot: 1 | 2 }
  | { type: 'pvp:solo' }
  | { type: 'pvp:event'; event: unknown[] }
  | { type: 'pvp:pos'; pos: PlayerPos }

export default function RetroFPSGame({ matchCtx, onWinner }: Props) {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const winnerSentRef = useRef(false)
  const matchId      = matchCtx?.matchId
  const mySlot       = (matchCtx?.mySlot ?? 1) as 1 | 2

  const postToIframe = useCallback((msg: ToIframe) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin)
  }, [])

  useEffect(() => {
    winnerSentRef.current = false

    // --- bridge: WS relay → iframe ---
    // Both P1 and P2 receive events via 'game:state', forwarding them into the iframe
    let offWs: (() => void) | undefined
    if (matchCtx) {
      offWs = ws.on('game:state', (data: any) => {
        if (data?.matchId !== matchId) return
        if (data?.pvpEvent) {
          postToIframe({ type: 'pvp:event', event: data.pvpEvent })
        }
        // Per-frame position sync — forwarded separately to keep event queue clean
        if (data?.pvpPos) {
          postToIframe({ type: 'pvp:pos', pos: data.pvpPos })
        }
      })
    }

    // --- bridge: iframe → WS relay ---
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const msg = e.data as FromIframe
      if (!msg?.type) return

      if (msg.type === 'pvp:ready') {
        // Arcade HTML finished loading — tell it which slot we are
        if (matchCtx) {
          postToIframe({ type: 'pvp:init', slot: mySlot })
        } else {
          postToIframe({ type: 'pvp:solo' })
        }
        return
      }

      if (msg.type === 'pvp:send') {
        if (matchCtx) {
          ws.send('game:state', { matchId, pvpEvent: msg.event })
        }
        return
      }

      if (msg.type === 'pvp:pos') {
        if (matchCtx) {
          ws.send('game:state', { matchId, pvpPos: msg.pos })
        }
        return
      }

      if (msg.type === 'pvp:winner') {
        if (winnerSentRef.current) return
        winnerSentRef.current = true
        // Convert pvp slot (1 or 2) to wallet address
        const winnerAddr = msg.slot === 1
          ? matchCtx?.p1Address
          : matchCtx?.p2Address
        if (winnerAddr) {
          onWinner?.(winnerAddr)
        } else {
          // Solo test mode — no addresses
          onWinner?.(`slot${msg.slot}`)
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      offWs?.()
    }
  }, [matchCtx, matchId, mySlot, onWinner, postToIframe])

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <iframe
        ref={iframeRef}
        src={`${import.meta.env.BASE_URL}retro-fps/arcade.html`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay; pointer-lock"
        title="Retro FPS"
      />
    </div>
  )
}
