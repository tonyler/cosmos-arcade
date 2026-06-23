import { useEffect, useRef, useState } from 'react'
import { TILE, COLS, ROWS, initGame, update, nextRound, createInputHandler, type GameState, type Dir } from './engine'
import { render } from './renderer'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../overlays/types'
import { useCanvasScale } from '../../hooks/useCanvasScale'

const W = COLS * TILE  // 448
const H = ROWS * TILE  // 496
const MAX_SCALE = 1.5

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function PacManGame({ matchCtx, onWinner: _onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(initGame())
  const inputRef = useRef(createInputHandler())
  const rafRef = useRef<number>(0)
  // Solo-only refs
  const lastRef = useRef<number>(0)
  const accumRef = useRef<number>(0)
  const winnerSentRef = useRef(false)
  const [displayState, setDisplayState] = useState(stateRef.current)
  const [restartKey, setRestartKey] = useState(0)
  const [matchWinner, setMatchWinner] = useState<1 | 2 | null>(null)
  const scale = useCanvasScale(MAX_SCALE, W, H, 140)

  const restart = () => setRestartKey((k) => k + 1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const detach = inputRef.current.attach(window)
    stateRef.current = initGame()
    winnerSentRef.current = false
    setMatchWinner(null)

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
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      let dir: Dir
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3
      else dir = dy > 0 ? 2 : 0

      if (matchCtx) {
        ws.send('game:input', { matchId: matchCtx.matchId, slot: matchCtx.mySlot, dir })
      } else {
        const useP2 = false
        if (useP2) inputRef.current.state.p2Dir = dir
        else inputRef.current.state.p1Dir = dir
      }
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })

    let offWs: (() => void) | undefined

    if (matchCtx) {
      // ── MULTIPLAYER: server runs simulation, client renders received state ──
      offWs = ws.on('game:state', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        const s = data.state as GameState
        stateRef.current = s
        setDisplayState({ ...s })
      })

      const loop = () => {
        render(ctx, stateRef.current)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)

    } else {
      // ── SOLO: local fixed-timestep simulation ────────────────────────────
      lastRef.current = 0
      accumRef.current = 0

      const FIXED_DT = 16
      const loop = (ts: number) => {
        if (lastRef.current === 0) { lastRef.current = ts; rafRef.current = requestAnimationFrame(loop); return }
        const elapsed = Math.min(ts - lastRef.current, 50)
        lastRef.current = ts
        accumRef.current += elapsed

        const local = inputRef.current.state
        const p1Dir = local.p1Dir
        const p2Dir = local.p2Dir
        local.p1Dir = null
        local.p2Dir = null

        while (accumRef.current >= FIXED_DT) {
          stateRef.current = update(stateRef.current, FIXED_DT, { p1Dir, p2Dir })
          accumRef.current -= FIXED_DT
        }

        render(ctx, stateRef.current)

        const s = stateRef.current
        if (s.phase === 'gameOver' && s.winner && !winnerSentRef.current) {
          winnerSentRef.current = true
          const p1Wins = s.p1Wins + (s.winner === 1 ? 1 : 0)
          const p2Wins = s.p2Wins + (s.winner === 2 ? 1 : 0)
          const withWins = { ...s, p1Wins, p2Wins }
          stateRef.current = withWins
          render(ctx, withWins)
          setDisplayState({ ...withWins })

          if (p1Wins >= 3 || p2Wins >= 3) {
            setMatchWinner(s.winner)
          } else {
            setTimeout(() => {
              stateRef.current = nextRound(withWins)
              lastRef.current = 0
              accumRef.current = 0
              winnerSentRef.current = false
              rafRef.current = requestAnimationFrame(loop)
            }, 1500)
          }
        } else if (s.phase !== 'gameOver') {
          if (s.phase !== displayState.phase || s.level !== displayState.level ||
              s.p1Wins !== displayState.p1Wins || s.p2Wins !== displayState.p2Wins) {
            setDisplayState({ ...s })
          }
          rafRef.current = requestAnimationFrame(loop)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      detach()
      offWs?.()
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCtx?.matchId, restartKey])

  // Also send keyboard inputs to server in multiplayer
  useEffect(() => {
    if (!matchCtx) return
    const handler = (e: KeyboardEvent) => {
      let dir: Dir | null = null
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': dir = 0; break
        case 'ArrowRight': case 'd': case 'D': dir = 1; break
        case 'ArrowDown':  case 's': case 'S': dir = 2; break
        case 'ArrowLeft':  case 'a': case 'A': dir = 3; break
      }
      if (dir !== null) {
        e.preventDefault()
        ws.send('game:input', { matchId: matchCtx.matchId, slot: matchCtx.mySlot, dir })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [matchCtx?.matchId])

  const { p1, p2, level, p1Wins, p2Wins } = displayState
  const isMobile = scale < MAX_SCALE

  const p1Label = matchCtx ? (matchCtx.mySlot === 1 ? 'YOU' : 'OPPONENT') : 'P1'
  const p2Label = matchCtx ? (matchCtx.mySlot === 2 ? 'YOU' : 'OPPONENT') : 'P2'

  return (
    <div className="flex flex-col items-center gap-3 py-3 md:gap-6 md:py-6">
      {/* HUD */}
      <div className="flex items-start justify-between w-full px-2" style={{ maxWidth: W * scale }}>
        <PlayerHUD label={p1Label} score={p1.score} color="#ffe000" powered={p1.powered} alive={p1.alive} wins={p1Wins} />
        <div className="flex flex-col items-center gap-1">
          <span className="font-px text-[7px] text-slate-500 tracking-widest">LV</span>
          <span className="font-px text-[11px] text-slate-200">{level}</span>
        </div>
        <PlayerHUD label={p2Label} score={p2.score} color="#00d4ff" powered={p2.powered} alive={p2.alive} wins={p2Wins} right />
      </div>

      {/* Canvas */}
      <div className="relative border border-c-border" style={{ boxShadow: '0 0 40px rgba(26,26,255,0.3)' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: 'block', imageRendering: 'pixelated', width: W * scale, height: H * scale }}
        />

        {matchWinner && !matchCtx && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60">
            <div className="font-px text-[13px] tracking-widest" style={{ color: matchWinner === 1 ? '#ffe000' : '#00d4ff' }}>
              PLAYER {matchWinner} WINS!
            </div>
            <div className="font-px text-[8px] text-slate-400 tracking-widest">
              {p1Wins} — {p2Wins}
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

function PlayerHUD({ label, score, color, powered, alive, wins, right = false }: {
  label: string; score: number; color: string; powered: boolean; alive: boolean; wins: number; right?: boolean
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
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full"
            style={{ backgroundColor: i < wins ? color : '#333' }} />
        ))}
      </div>
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
