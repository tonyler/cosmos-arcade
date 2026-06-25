import { useEffect, useRef, useState } from 'react'
import { initGame, update, createInputHandler, type GameState, type Dir } from './engine'
import { render, CANVAS_W, CANVAS_H } from './renderer'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../types/match'
import { useCanvasScale } from '../../hooks/useCanvasScale'

const MAX_SCALE = 1.2

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function SnakeGame({ matchCtx, onWinner }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const stateRef        = useRef<GameState>(initGame(matchCtx?.matchId))
  const inputRef        = useRef(createInputHandler(matchCtx?.mySlot))
  const wsInputRef      = useRef<{ p1Dir: Dir | null; p2Dir: Dir | null }>({ p1Dir: null, p2Dir: null })
  const rafRef          = useRef<number>(0)
  const lastRef         = useRef<number>(0)
  const winnerSentRef   = useRef(false)
  const [phase, setPhase] = useState<GameState['phase']>('ready')
  const [restartKey, setRestartKey] = useState(0)
  const scale = useCanvasScale(MAX_SCALE, CANVAS_W, CANVAS_H, 140)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    stateRef.current    = initGame(matchCtx?.matchId)
    winnerSentRef.current = false
    wsInputRef.current  = { p1Dir: null, p2Dir: null }
    inputRef.current    = createInputHandler(matchCtx?.mySlot)
    lastRef.current     = 0

    const detach = inputRef.current.attach(window)

    // ── WS input relay ──────────────────────────────────────────────────────
    let offWs: (() => void) | undefined
    if (matchCtx) {
      offWs = ws.on('game:input', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        if (data.slot === 1) wsInputRef.current.p1Dir = data.dir
        else wsInputRef.current.p2Dir = data.dir
      })
    }

    // ── Touch swipe ─────────────────────────────────────────────────────────
    let tx = 0, ty = 0
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      tx = e.changedTouches[0].clientX
      ty = e.changedTouches[0].clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const dx = e.changedTouches[0].clientX - tx
      const dy = e.changedTouches[0].clientY - ty
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      const dir: Dir = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up')
      const inp = inputRef.current.state
      if (!matchCtx || matchCtx.mySlot === 1) inp.p1Dir = dir
      else inp.p2Dir = dir
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    // ── Game loop ────────────────────────────────────────────────────────────
    const loop = (ts: number) => {
      const dt = Math.min(ts - (lastRef.current || ts), 100)
      lastRef.current = ts

      const local = inputRef.current.state
      const wsIn  = wsInputRef.current

      let p1Dir: Dir | null, p2Dir: Dir | null
      if (matchCtx) {
        if (matchCtx.mySlot === 1) {
          if (local.p1Dir !== null) ws.send('game:input', { matchId: matchCtx.matchId, slot: 1, dir: local.p1Dir })
          p1Dir = local.p1Dir; p2Dir = wsIn.p2Dir
        } else {
          if (local.p2Dir !== null) ws.send('game:input', { matchId: matchCtx.matchId, slot: 2, dir: local.p2Dir })
          p1Dir = wsIn.p1Dir; p2Dir = local.p2Dir
        }
      } else {
        p1Dir = local.p1Dir; p2Dir = local.p2Dir
      }

      stateRef.current = update(stateRef.current, dt, { p1Dir, p2Dir })

      local.p1Dir = null; local.p2Dir = null
      wsIn.p1Dir  = null; wsIn.p2Dir  = null

      render(ctx, stateRef.current)

      // Announce winner to match system
      if (matchCtx && stateRef.current.phase === 'gameOver' && !winnerSentRef.current) {
        winnerSentRef.current = true
        const addr = stateRef.current.winner === 1 ? matchCtx.p1Address : matchCtx.p2Address
        onWinner?.(addr)
      }

      if (stateRef.current.phase !== phase) {
        setPhase(stateRef.current.phase)
      }

      if (stateRef.current.phase !== 'gameOver') {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        render(ctx, stateRef.current)
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

  const isMobile   = scale < MAX_SCALE
  const p1Label    = matchCtx ? (matchCtx.mySlot === 1 ? 'YOU' : 'OPP') : 'P1'
  const p2Label    = matchCtx ? (matchCtx.mySlot === 2 ? 'YOU' : 'OPP') : 'P2'
  return (
    <div className="flex flex-col items-center gap-3 py-3 md:gap-5 md:py-6">
      {/* Player labels */}
      <div className="flex items-center justify-between w-full px-2" style={{ maxWidth: CANVAS_W * scale }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5bc235]" style={{ boxShadow: '0 0 6px #5bc235' }} />
          <span className="font-px text-[8px] text-slate-400 tracking-widest">{p1Label}</span>
        </div>
        <span className="font-px text-[7px] text-slate-600 tracking-widest">SNAKE DUEL</span>
        <div className="flex items-center gap-2">
          <span className="font-px text-[8px] text-slate-400 tracking-widest">{p2Label}</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#9b35e8]" style={{ boxShadow: '0 0 6px #9b35e8' }} />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border border-[#1e3050]" style={{ boxShadow: '0 0 40px rgba(0,100,200,0.2)' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', imageRendering: 'pixelated', width: CANVAS_W * scale, height: CANVAS_H * scale }}
        />

        {/* Solo-mode restart overlay */}
        {phase === 'gameOver' && !matchCtx && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pt-24">
            <button
              onClick={() => setRestartKey(k => k + 1)}
              className="font-px text-[8px] text-white bg-violet-700 hover:bg-violet-600 px-6 py-3
                shadow-[0_3px_0_#3b0f8a] active:translate-y-[3px] active:shadow-none transition-all"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* Controls legend */}
      <div className="flex gap-6 opacity-50">
        {isMobile ? (
          <span className="font-px text-[7px] text-slate-400 tracking-widest">SWIPE TO MOVE</span>
        ) : matchCtx ? (
          <span className="font-px text-[7px] text-slate-400 tracking-widest">
            ↑↓←→ / WASD — eat atoms to grow
          </span>
        ) : (
          <>
            <span className="font-px text-[7px] text-[#5bc235]">P1: ↑↓←→</span>
            <span className="font-px text-[7px] text-[#9b35e8]">P2: WASD</span>
          </>
        )}
      </div>
    </div>
  )
}
