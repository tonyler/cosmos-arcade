import { useEffect, useRef, useState } from 'react'
import {
  ARENA_W, ARENA_H, KILL_LIMIT,
  initGame, update, serializeState, createInputHandler,
  type ShooterState, type StatePacket
} from './engine'
import { render } from './renderer'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../overlays/types'
import { useCanvasScale } from '../../hooks/useCanvasScale'

const MAX_SCALE = 1.4
const SYNC_INTERVAL = 40  // ms — send state at ~25Hz

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function ShooterGame({ matchCtx, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mySlot = (matchCtx?.mySlot ?? 1) as 1 | 2
  const stateRef = useRef<ShooterState>(initGame(mySlot))
  const inputHandlerRef = useRef(createInputHandler())
  const lastSyncRef = useRef(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const winnerSentRef = useRef(false)
  const oppPacketRef = useRef<StatePacket | null>(null)
  const displayPhaseRef = useRef<ShooterState['phase']>('ready')
  const [displayKills, setDisplayKills] = useState({ my: 0, opp: 0 })
  const [displayPhase, setDisplayPhase] = useState<ShooterState['phase']>('ready')
  const [restartKey, setRestartKey] = useState(0)
  const scale = useCanvasScale(MAX_SCALE, ARENA_W, ARENA_H, 160)

  const restart = () => {
    winnerSentRef.current = false
    oppPacketRef.current = null
    stateRef.current = initGame(mySlot)
    setDisplayKills({ my: 0, opp: 0 })
    setDisplayPhase('ready')
    setRestartKey((k) => k + 1)
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const input = inputHandlerRef.current
    const detach = input.attach(window, canvas)
    stateRef.current = initGame(mySlot)
    winnerSentRef.current = false
    oppPacketRef.current = null

    // WS: receive opponent state
    let offWs: (() => void) | undefined
    if (matchCtx) {
      offWs = ws.on('game:state', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        oppPacketRef.current = data as StatePacket
      })
    }

    const loop = (ts: number) => {
      const dt = Math.min(ts - (lastRef.current || ts), 50)
      lastRef.current = ts

      const s = stateRef.current
      const inp = input.state

      // Update mouse angle from raw mouse pos
      if (inp._mouseX !== undefined) {
        inp.angle = Math.atan2(
          (inp._mouseY ?? 0) - s.myPlayer.y,
          inp._mouseX - s.myPlayer.x
        )
      }

      const { next } = update(s, dt, inp, oppPacketRef.current)
      oppPacketRef.current = null  // consume packet
      stateRef.current = next

      // Send state to opponent
      if (matchCtx && ts - lastSyncRef.current >= SYNC_INTERVAL) {
        lastSyncRef.current = ts
        ws.send('game:state', { matchId: matchCtx.matchId, ...serializeState(next) })
      }

      if (next.phase === 'gameOver' && !winnerSentRef.current && matchCtx) {
        winnerSentRef.current = true
        const addr = next.winner === 1 ? matchCtx.p1Address : matchCtx.p2Address
        onWinner?.(addr)
      }

      render(ctx, next, mySlot)

      // Update HUD
      const myK = next.myPlayer.kills
      const oppK = next.oppPlayer.kills
      setDisplayKills((prev) =>
        prev.my !== myK || prev.opp !== oppK ? { my: myK, opp: oppK } : prev
      )
      if (next.phase !== displayPhaseRef.current) {
        displayPhaseRef.current = next.phase
        setDisplayPhase(next.phase)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      detach()
      offWs?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCtx?.matchId, restartKey])

  const myColor = mySlot === 1 ? '#00d4ff' : '#ff6b35'
  const oppColor = mySlot === 1 ? '#ff6b35' : '#00d4ff'
  const myLabel = matchCtx ? 'YOU' : 'P1'
  const oppLabel = matchCtx ? 'OPPONENT' : 'P2'

  return (
    <div className="flex flex-col items-center gap-3 py-3 select-none">
      {/* Kill counter HUD */}
      <div className="flex items-center justify-between w-full px-2" style={{ maxWidth: ARENA_W * scale }}>
        <KillHUD label={myLabel} kills={displayKills.my} color={myColor} limit={KILL_LIMIT} />
        <div className="flex flex-col items-center">
          <span className="font-px text-[7px] text-slate-500 tracking-widest">KILLS</span>
          <span className="font-px text-[8px] text-slate-400">{KILL_LIMIT}</span>
        </div>
        <KillHUD label={oppLabel} kills={displayKills.opp} color={oppColor} limit={KILL_LIMIT} right />
      </div>

      {/* Canvas */}
      <div className="relative border border-c-border" style={{ boxShadow: '0 0 40px rgba(0,100,200,0.2)' }}>
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          style={{ display: 'block', width: ARENA_W * scale, height: ARENA_H * scale, cursor: 'crosshair' }}
        />
        {displayPhase === 'gameOver' && !matchCtx && (
          <div className="absolute inset-0 flex items-end justify-center pb-16">
            <button
              onClick={restart}
              className="font-px text-[8px] text-white bg-violet-700 hover:bg-violet-600 px-6 py-3
                shadow-[0_3px_0_#3b0f8a] active:translate-y-[3px] active:shadow-none transition-all"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="flex gap-6 opacity-40">
        <span className="font-px text-[7px] text-slate-400 tracking-widest">WASD MOVE</span>
        <span className="font-px text-[7px] text-slate-400 tracking-widest">MOUSE AIM</span>
        <span className="font-px text-[7px] text-slate-400 tracking-widest">CLICK / SPACE SHOOT</span>
      </div>
    </div>
  )
}

function KillHUD({ label, kills, color, limit, right = false }: {
  label: string; kills: number; color: string; limit: number; right?: boolean
}) {
  const bars = Array.from({ length: limit }, (_, i) => i < kills)
  return (
    <div className={`flex flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-px text-[7px] text-slate-400 tracking-wider">{label}</span>
      </div>
      <span className="font-px text-[14px]" style={{ color }}>{kills}</span>
      <div className={`flex gap-0.5 flex-wrap ${right ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: 100 }}>
        {bars.map((filled, i) => (
          <div
            key={i}
            className="w-2 h-1.5 rounded-sm"
            style={{ backgroundColor: filled ? color : '#1e293b' }}
          />
        ))}
      </div>
    </div>
  )
}
