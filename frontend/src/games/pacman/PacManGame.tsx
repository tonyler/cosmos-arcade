import { useEffect, useRef, useState } from 'react'
import { TILE, COLS, ROWS, initGame, update, createInputHandler, type GameState, type Dir } from './engine'
import { render } from './renderer'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../plugins/types'
import { useCanvasScale } from '../../hooks/useCanvasScale'

const W = COLS * TILE  // 448
const H = ROWS * TILE  // 496
const MAX_SCALE = 1.5

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function PacManGame({ matchCtx, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(initGame())
  const inputRef = useRef(createInputHandler())
  const wsInputRef = useRef<{ p1Dir: Dir | null; p2Dir: Dir | null }>({ p1Dir: null, p2Dir: null })
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const winnerSentRef = useRef(false)
  const [displayState, setDisplayState] = useState(stateRef.current)
  const [restartKey, setRestartKey] = useState(0)
  const scale = useCanvasScale(MAX_SCALE, W, H, 140)

  const restart = () => setRestartKey((k) => k + 1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const detach = inputRef.current.attach(window)
    stateRef.current = initGame()
    winnerSentRef.current = false
    wsInputRef.current = { p1Dir: null, p2Dir: null }

    let offWs: (() => void) | undefined
    if (matchCtx) {
      offWs = ws.on('game:input', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        if (data.slot === 1) wsInputRef.current.p1Dir = data.dir
        else wsInputRef.current.p2Dir = data.dir
      })
    }

    // ── Swipe controls ──────────────────────────────────────────────────────
    let touchStartX = 0
    let touchStartY = 0
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      touchStartX = e.changedTouches[0].clientX
      touchStartY = e.changedTouches[0].clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return  // tap — ignore
      let dir: Dir
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 1 : 3  // RIGHT : LEFT
      } else {
        dir = dy > 0 ? 2 : 0  // DOWN : UP
      }
      const useP2 = matchCtx ? matchCtx.mySlot === 2 : false
      if (useP2) inputRef.current.state.p2Dir = dir
      else inputRef.current.state.p1Dir = dir
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    // ── Game loop ────────────────────────────────────────────────────────────
    const loop = (ts: number) => {
      const dt = Math.min(ts - (lastRef.current || ts), 50)
      lastRef.current = ts

      const local = inputRef.current.state
      const wsIn = wsInputRef.current

      let p1Dir: Dir | null
      let p2Dir: Dir | null

      if (matchCtx) {
        if (matchCtx.mySlot === 1) {
          if (local.p1Dir !== null) ws.send('game:input', { matchId: matchCtx.matchId, slot: 1, dir: local.p1Dir })
          p1Dir = local.p1Dir
          p2Dir = wsIn.p2Dir
        } else {
          if (local.p2Dir !== null) ws.send('game:input', { matchId: matchCtx.matchId, slot: 2, dir: local.p2Dir })
          p1Dir = wsIn.p1Dir
          p2Dir = local.p2Dir
        }
      } else {
        p1Dir = local.p1Dir
        p2Dir = local.p2Dir
      }

      stateRef.current = update(stateRef.current, dt, { p1Dir, p2Dir })

      local.p1Dir = null
      local.p2Dir = null
      wsIn.p1Dir = null
      wsIn.p2Dir = null

      render(ctx, stateRef.current)

      if (matchCtx && stateRef.current.phase === 'gameOver' && !winnerSentRef.current) {
        winnerSentRef.current = true
        const addr = stateRef.current.winner === 1 ? matchCtx.p1Address : matchCtx.p2Address
        onWinner?.(addr)
      }

      if (stateRef.current.phase !== displayState.phase ||
          stateRef.current.level !== displayState.level) {
        setDisplayState({ ...stateRef.current })
      }

      if (stateRef.current.phase !== 'gameOver') {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        render(ctx, stateRef.current)
        setDisplayState({ ...stateRef.current })
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      detach()
      offWs?.()
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCtx?.matchId, restartKey])

  const { p1, p2, phase, winner, level } = displayState
  const isMobile = scale < MAX_SCALE

  const p1Label = matchCtx ? (matchCtx.mySlot === 1 ? 'YOU' : 'OPPONENT') : 'P1'
  const p2Label = matchCtx ? (matchCtx.mySlot === 2 ? 'YOU' : 'OPPONENT') : 'P2'

  return (
    <div className="flex flex-col items-center gap-3 py-3 md:gap-6 md:py-6">
      {/* HUD */}
      <div className="flex items-start justify-between w-full px-2" style={{ maxWidth: W * scale }}>
        <PlayerHUD label={p1Label} score={p1.score} color="#ffe000" powered={p1.powered} alive={p1.alive} />
        <div className="flex flex-col items-center gap-1">
          <span className="font-px text-[7px] text-slate-500 tracking-widest">LV</span>
          <span className="font-px text-[11px] text-slate-200">{level}</span>
        </div>
        <PlayerHUD label={p2Label} score={p2.score} color="#00d4ff" powered={p2.powered} alive={p2.alive} right />
      </div>

      {/* Canvas */}
      <div className="relative border border-c-border" style={{ boxShadow: '0 0 40px rgba(26,26,255,0.3)' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: 'block', imageRendering: 'pixelated', width: W * scale, height: H * scale }}
        />

        {phase === 'gameOver' && !matchCtx && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60">
            <div className="font-px text-[13px] tracking-widest" style={{ color: winner === 1 ? '#ffe000' : '#00d4ff' }}>
              PLAYER {winner} WINS!
            </div>
            <button onClick={restart}
              className="font-px text-[8px] text-white bg-violet-700 hover:bg-violet-600 px-6 py-3
                shadow-[0_3px_0_#3b0f8a] active:translate-y-[3px] active:shadow-none transition-all">
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Controls legend */}
      <div className="flex gap-6 opacity-50">
        {isMobile ? (
          <span className="font-px text-[7px] text-slate-400 tracking-widest">SWIPE TO MOVE</span>
        ) : (
          <>
            {(!matchCtx || matchCtx.mySlot === 1) && (
              <Legend label={matchCtx ? 'MOVE' : 'P1'} keys={['↑', '←', '↓', '→']} color="#ffe000" />
            )}
            {(!matchCtx || matchCtx.mySlot === 2) && (
              <Legend label={matchCtx ? 'MOVE' : 'P2'} keys={['W', 'A', 'S', 'D']} color="#00d4ff" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PlayerHUD({ label, score, color, powered, alive, right = false }: {
  label: string; score: number; color: string; powered: boolean; alive: boolean; right?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 ${right ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full"
          style={{ backgroundColor: alive ? color : '#444', boxShadow: alive && powered ? `0 0 8px ${color}` : undefined }} />
        <span className="font-px text-[7px] text-slate-400 tracking-wider">{label}</span>
        {!alive && <span className="font-px text-[7px] text-red-500">✗</span>}
      </div>
      <span className="font-px text-[11px]" style={{ color }}>{score}</span>
      {powered && <span className="font-px text-[6px] animate-pulse" style={{ color }}>POWERED!</span>}
    </div>
  )
}

function Legend({ label, keys, color }: { label: string; keys: string[]; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-px text-[7px]" style={{ color }}>{label}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="font-px text-[7px] bg-c-surface border border-c-border px-1.5 py-0.5 text-slate-300">{k}</kbd>
        ))}
      </div>
    </div>
  )
}
