import { useEffect, useRef, useState } from 'react'
import {
  KILL_LIMIT, MAX_AMMO,
  initGame, update, serializeState, createInputHandler,
  type Arena3DState, type StatePacket3D,
} from './engine'
import { createScene, type SceneHandle } from './scene'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../types/match'

const SYNC_INTERVAL = 16  // ms (~60 Hz)
const DEAD = 30           // touch dead zone px — 30px prevents jitter on real devices

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function Arena3DGame({ matchCtx, onWinner }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef     = useRef<SceneHandle | null>(null)
  const mySlot = (matchCtx?.mySlot ?? 1) as 1 | 2
  const stateRef      = useRef<Arena3DState>(initGame(mySlot))
  const inputRef      = useRef(createInputHandler())
  const oppPacketRef  = useRef<StatePacket3D | null>(null)
  const lastSyncRef   = useRef(0)
  const lastRef       = useRef(0)
  const winnerSentRef = useRef(false)
  const rafRef        = useRef(0)
  const [displayKills, setDisplayKills] = useState({ my: 0, opp: 0 })
  const [displayPhase, setDisplayPhase] = useState<Arena3DState['phase']>('ready')
  const [displayAmmo,  setDisplayAmmo]  = useState({ ammo: MAX_AMMO, reloading: false, reloadKey: 0 })
  const [restartKey, setRestartKey]     = useState(0)

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const restart = () => {
    winnerSentRef.current = false
    oppPacketRef.current  = null
    stateRef.current      = initGame(mySlot)
    setDisplayKills({ my: 0, opp: 0 })
    setDisplayAmmo({ ammo: MAX_AMMO, reloading: false, reloadKey: 0 })
    setDisplayPhase('ready')
    setRestartKey(k => k + 1)
  }

  // Lock scroll on mobile
  useEffect(() => {
    if (!isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow    = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow    = prev
      document.body.style.touchAction = ''
    }
  }, [isMobile])

  // ── Three.js scene + game loop ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create scene
    const scene = createScene(container, isMobile)
    sceneRef.current = scene
    stateRef.current = initGame(mySlot)
    winnerSentRef.current = false
    oppPacketRef.current  = null

    // Attach keyboard + mouse input
    const detach = inputRef.current.attach(window, container)


    // WS: receive opponent state
    let offWs: (() => void) | undefined
    if (matchCtx) {
      offWs = ws.on('game:state', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        oppPacketRef.current = data as StatePacket3D
      })
    }

    // ResizeObserver — keep renderer in sync with CSS container size
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        scene.resize(width, height)
      }
    })
    ro.observe(container)

    const loop = (ts: number) => {
      const dt = Math.min(ts - (lastRef.current || ts), 50)
      lastRef.current = ts
      const inp = inputRef.current.state

      // Desktop mouse: project screen coords onto arena floor for rotY
      if (inp._mouseX !== undefined && sceneRef.current) {
        const world = sceneRef.current.getWorldXZ(inp._mouseX, inp._mouseY!)
        if (world) {
          const { x, z } = stateRef.current.myPlayer
          inp.rotY = Math.atan2(world.x - x, world.z - z)
        }
      }

      const { next } = update(stateRef.current, dt, inp, oppPacketRef.current)
      oppPacketRef.current = null
      stateRef.current = next

      // WS sync
      if (matchCtx && ts - lastSyncRef.current >= SYNC_INTERVAL) {
        lastSyncRef.current = ts
        ws.send('game:state', { matchId: matchCtx.matchId, ...serializeState(next) })
      }

      if (next.phase === 'gameOver' && !winnerSentRef.current && matchCtx) {
        winnerSentRef.current = true
        const addr = next.winner === 1 ? matchCtx.p1Address : matchCtx.p2Address
        onWinner?.(addr)
      }

      scene.render(next, mySlot)

      // HUD updates
      const myK  = next.myPlayer.kills
      const oppK = next.oppPlayer.kills
      setDisplayKills(prev => (prev.my !== myK || prev.opp !== oppK) ? { my: myK, opp: oppK } : prev)
      setDisplayPhase(prev => prev !== next.phase ? next.phase : prev)
      const myAmmo      = next.myPlayer.ammo
      const myReloading = next.myPlayer.reloadTimer > 0
      setDisplayAmmo(prev => {
      if (prev.ammo === myAmmo && prev.reloading === myReloading) return prev
      const reloadKey = !prev.reloading && myReloading ? prev.reloadKey + 1 : prev.reloadKey
      return { ammo: myAmmo, reloading: myReloading, reloadKey }
    })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      detach()
      offWs?.()
      scene.dispose()
      sceneRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCtx?.matchId, restartKey])

  // ── Mobile touch joysticks ─────────────────────────────────────────────────
  const leftZoneRef   = useRef<HTMLDivElement>(null)
  const rightZoneRef  = useRef<HTMLDivElement>(null)
  const reloadZoneRef = useRef<HTMLDivElement>(null)
  const leftKnobRef   = useRef<HTMLDivElement>(null)
  const rightKnobRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMobile) return
    const inp      = inputRef.current.state
    const leftEl   = leftZoneRef.current
    const rightEl  = rightZoneRef.current
    const reloadEl = reloadZoneRef.current
    if (!leftEl || !rightEl || !reloadEl) return

    const origins = new Map<number, { ox: number; oy: number; side: 'left' | 'right' }>()

    const clampKnob = (v: number) => Math.min(Math.max(v, -28), 28)

    const onLeftStart = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches))
        origins.set(t.identifier, { ox: t.clientX, oy: t.clientY, side: 'left' })
      if (leftKnobRef.current) leftKnobRef.current.style.transform = ''
    }
    const onRightStart = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        origins.set(t.identifier, { ox: t.clientX, oy: t.clientY, side: 'right' })
        inp.shooting = true
      }
      if (rightKnobRef.current) rightKnobRef.current.style.transform = ''
    }
    const onReloadStart = (e: TouchEvent) => { e.preventDefault(); inp.reloading = true }
    const onReloadEnd   = (e: TouchEvent) => { e.preventDefault(); inp.reloading = false }

    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        const o = origins.get(t.identifier)
        if (!o) continue
        const dx = t.clientX - o.ox, dy = t.clientY - o.oy
        if (o.side === 'left') {
          inp.left  = dx < -DEAD
          inp.right = dx >  DEAD
          inp.up    = dy < -DEAD
          inp.down  = dy >  DEAD
          if (leftKnobRef.current)
            leftKnobRef.current.style.transform = `translate(${clampKnob(dx)}px,${clampKnob(dy)}px)`
        } else {
          if (Math.hypot(dx, dy) > DEAD) inp.rotY = Math.atan2(dx, dy)
          if (rightKnobRef.current)
            rightKnobRef.current.style.transform = `translate(${clampKnob(dx)}px,${clampKnob(dy)}px)`
        }
      }
    }
    const onEnd = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        const o = origins.get(t.identifier)
        origins.delete(t.identifier)
        if (!o) continue
        if (o.side === 'left') {
          inp.left = inp.right = inp.up = inp.down = false
          if (leftKnobRef.current) leftKnobRef.current.style.transform = ''
        } else {
          if (![...origins.values()].some(v => v.side === 'right')) inp.shooting = false
          if (rightKnobRef.current) rightKnobRef.current.style.transform = ''
        }
      }
    }

    const opts: AddEventListenerOptions = { passive: false }
    leftEl.addEventListener('touchstart',  onLeftStart,  opts)
    leftEl.addEventListener('touchmove',   onMove,       opts)
    leftEl.addEventListener('touchend',    onEnd,        opts)
    leftEl.addEventListener('touchcancel', onEnd,        opts)
    rightEl.addEventListener('touchstart',  onRightStart, opts)
    rightEl.addEventListener('touchmove',   onMove,       opts)
    rightEl.addEventListener('touchend',    onEnd,        opts)
    rightEl.addEventListener('touchcancel', onEnd,        opts)
    reloadEl.addEventListener('touchstart',  onReloadStart, opts)
    reloadEl.addEventListener('touchend',    onReloadEnd,   opts)
    reloadEl.addEventListener('touchcancel', onReloadEnd,   opts)

    return () => {
      leftEl.removeEventListener('touchstart',  onLeftStart)
      leftEl.removeEventListener('touchmove',   onMove)
      leftEl.removeEventListener('touchend',    onEnd)
      leftEl.removeEventListener('touchcancel', onEnd)
      rightEl.removeEventListener('touchstart',  onRightStart)
      rightEl.removeEventListener('touchmove',   onMove)
      rightEl.removeEventListener('touchend',    onEnd)
      rightEl.removeEventListener('touchcancel', onEnd)
      reloadEl.removeEventListener('touchstart',  onReloadStart)
      reloadEl.removeEventListener('touchend',    onReloadEnd)
      reloadEl.removeEventListener('touchcancel', onReloadEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, restartKey])

  const myColor  = mySlot === 1 ? '#00d4ff' : '#ff6b35'
  const oppColor = mySlot === 1 ? '#ff6b35' : '#00d4ff'
  const myLabel  = matchCtx ? 'YOU' : 'P1'
  const oppLabel = matchCtx ? 'OPPONENT' : 'P2'

  return (
    <div className="flex flex-col gap-2 py-2 w-full h-full select-none" style={{ touchAction: 'none' }}>
      {/* Kill + Ammo HUD */}
      <div className="flex items-center justify-between w-full px-3">
        <KillHUD label={myLabel}  kills={displayKills.my}  color={myColor}  limit={KILL_LIMIT} />
        <div className="flex flex-col items-center gap-1">
          <span className="font-px text-[7px] text-slate-500 tracking-widest">VOID ARENA</span>
          <AmmoHUD ammo={displayAmmo.ammo} reloading={displayAmmo.reloading} reloadKey={displayAmmo.reloadKey} color={myColor} />
        </div>
        <KillHUD label={oppLabel} kills={displayKills.opp} color={oppColor} limit={KILL_LIMIT} right />
      </div>

      {/* 3D canvas container */}
      <div
        className="relative flex-1 w-full border border-c-border overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(0,100,255,0.15)', minHeight: 0 }}
      >
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ cursor: 'crosshair', touchAction: 'none' }}
        />


        {/* Phase overlays */}
        {displayPhase === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-px text-[18px] text-white tracking-widest" style={{ textShadow: '0 0 20px rgba(0,212,255,0.8)' }}>
              READY!
            </span>
          </div>
        )}

        {displayPhase === 'gameOver' && !matchCtx && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
            <span className="font-px text-[14px] text-white tracking-widest" style={{ textShadow: '0 0 20px rgba(0,212,255,0.8)' }}>
              {stateRef.current.winner === mySlot ? 'YOU WIN!' : 'GAME OVER'}
            </span>
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

      {/* Mobile joysticks / desktop hint */}
      {isMobile ? (
        <div
          className="flex w-full gap-2 px-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
        >
          {/* Left joystick — MOVE */}
          <div
            ref={leftZoneRef}
            className="flex-1 h-36 rounded-xl border border-slate-700 bg-slate-900/60 relative"
            style={{ touchAction: 'none' }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full border border-slate-700 opacity-40" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div ref={leftKnobRef} className="w-7 h-7 rounded-full bg-slate-600 border border-slate-400" />
            </div>
            <span className="absolute bottom-2 left-0 right-0 text-center font-px text-[6px] text-slate-500 tracking-widest pointer-events-none">MOVE</span>
          </div>

          {/* Center — RELOAD */}
          <div
            ref={reloadZoneRef}
            className="w-16 h-36 rounded-xl border border-slate-600 bg-slate-800/60 flex flex-col items-center justify-center gap-1"
            style={{ touchAction: 'none' }}
          >
            <span className="font-px text-[6px] text-slate-300 tracking-widest">
              {displayAmmo.reloading ? 'LOADING' : `${displayAmmo.ammo}/${MAX_AMMO}`}
            </span>
            <span className="font-px text-[6px] text-slate-500 tracking-widest">RELOAD</span>
          </div>

          {/* Right joystick — AIM + SHOOT */}
          <div
            ref={rightZoneRef}
            className="flex-1 h-36 rounded-xl border border-slate-700 bg-slate-900/60 relative"
            style={{ touchAction: 'none' }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full border border-slate-700 opacity-40" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div ref={rightKnobRef} className="w-7 h-7 rounded-full bg-slate-600 border border-slate-400" />
            </div>
            <span className="absolute bottom-2 left-0 right-0 text-center font-px text-[6px] text-slate-500 tracking-widest pointer-events-none">AIM · SHOOT</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 opacity-40">
          <span className="font-px text-[7px] text-slate-400 tracking-widest">WASD MOVE</span>
          <span className="font-px text-[7px] text-slate-400 tracking-widest">MOUSE AIM</span>
          <span className="font-px text-[7px] text-slate-400 tracking-widest">CLICK SHOOT</span>
          <span className="font-px text-[7px] text-slate-400 tracking-widest">RIGHT-CLICK / R RELOAD</span>
        </div>
      )}
    </div>
  )
}

function AmmoHUD({ ammo, reloading, reloadKey, color }: { ammo: number; reloading: boolean; reloadKey: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 64 }}>
      {reloading ? (
        <div className="flex flex-col items-center gap-1 w-full">
          <span className="font-px text-[6px] tracking-widest" style={{ color }}>RELOADING</span>
          <div className="w-full overflow-hidden" style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
            <div
              key={reloadKey}
              style={{
                height: '100%',
                width: '100%',
                background: color,
                boxShadow: `0 0 8px ${color}`,
                transformOrigin: 'left',
                animation: 'reload-fill 1.5s linear forwards',
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-0.5">
            {Array.from({ length: MAX_AMMO }, (_, i) => (
              <div key={i} className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: i < ammo ? color : '#1e293b' }} />
            ))}
          </div>
          <span className="font-px text-[6px] text-slate-500 tracking-widest">{ammo}/{MAX_AMMO}</span>
        </>
      )}
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
      <div className={`flex gap-0.5 flex-wrap ${right ? 'justify-end' : 'justify-start'}`} style={{ maxWidth: 80 }}>
        {bars.map((filled, i) => (
          <div key={i} className="w-2.5 h-1.5 rounded-sm" style={{ backgroundColor: filled ? color : '#1e293b' }} />
        ))}
      </div>
    </div>
  )
}
