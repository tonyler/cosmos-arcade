import { describe, it, expect } from 'vitest'
import {
  initGame, update, serializeState, forceKill,
  ARENA_W, ARENA_H, PLAYER_RADIUS, BULLET_SPEED, SHOOT_COOLDOWN,
  KILL_LIMIT, RESPAWN_SHOOT_COOLDOWN, KILL_FLASH_MS, DIED_FLASH_MS,
  NETEVENT_KILLPLAYER,
  clamp, circlesOverlap, resolvePlayer, randomSpawn,
  type ShooterInput,
} from './engine'

const noInput: ShooterInput = { up: false, down: false, left: false, right: false, angle: 0, shooting: false }

describe('initGame', () => {
  it('starts in ready phase with correct slots', () => {
    const s = initGame(1)
    expect(s.phase).toBe('ready')
    expect(s.mySlot).toBe(1)
    expect(s.nextBulletId).toBe(0)
    expect(s.myBullets).toHaveLength(0)
    expect(s.winner).toBeNull()
    expect(s.killFlash).toBe(0)
    expect(s.diedFlash).toBe(0)
  })

  it('P2 slot mirrors spawn positions', () => {
    const s1 = initGame(1)
    const s2 = initGame(2)
    expect(s2.myPlayer.x).toBeGreaterThan(ARENA_W / 2)
    expect(s1.myPlayer.x).toBeLessThan(ARENA_W / 2)
  })

  it('does not share nextBulletId across instances', () => {
    const a = initGame(1)
    const b = initGame(1)
    expect(a.nextBulletId).toBe(0)
    expect(b.nextBulletId).toBe(0)
  })
})

describe('update — ready phase', () => {
  it('counts down readyTimer and transitions to playing', () => {
    const s = initGame(1)
    const { next } = update(s, 3001, noInput, null)
    expect(next.phase).toBe('playing')
  })

  it('stays ready while timer is positive', () => {
    const s = initGame(1)
    const { next } = update(s, 1000, noInput, null)
    expect(next.phase).toBe('ready')
    expect(next.readyTimer).toBeLessThan(s.readyTimer)
  })
})

describe('update — movement', () => {
  it('moves player right when right=true', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', readyTimer: 0 }
    const input: ShooterInput = { ...noInput, right: true }
    const { next } = update(s, 16, input, null)
    expect(next.myPlayer.x).toBeGreaterThan(s.myPlayer.x)
  })

  it('clamps player within arena bounds', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, x: 0, y: 0 } }
    const input: ShooterInput = { ...noInput, up: true, left: true }
    const { next } = update(s, 100, input, null)
    expect(next.myPlayer.x).toBeGreaterThanOrEqual(PLAYER_RADIUS)
    expect(next.myPlayer.y).toBeGreaterThanOrEqual(PLAYER_RADIUS)
  })

  it('clamps player within arena upper bounds', () => {
    let s = initGame(2)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, x: ARENA_W, y: ARENA_H } }
    const input: ShooterInput = { ...noInput, down: true, right: true }
    const { next } = update(s, 100, input, null)
    expect(next.myPlayer.x).toBeLessThanOrEqual(ARENA_W - PLAYER_RADIUS)
    expect(next.myPlayer.y).toBeLessThanOrEqual(ARENA_H - PLAYER_RADIUS)
  })
})

describe('update — shooting', () => {
  it('creates a bullet when shooting and cooldown is zero', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, shootCooldown: 0 } }
    const input: ShooterInput = { ...noInput, shooting: true, angle: 0 }
    const { next } = update(s, 16, input, null)
    expect(next.myBullets).toHaveLength(1)
    expect(next.nextBulletId).toBe(1)
    expect(next.myPlayer.shootCooldown).toBe(SHOOT_COOLDOWN)
  })

  it('does not shoot when on cooldown', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, shootCooldown: 500 } }
    const input: ShooterInput = { ...noInput, shooting: true }
    const { next } = update(s, 16, input, null)
    expect(next.myBullets).toHaveLength(0)
  })

  it('bullet velocity matches angle and BULLET_SPEED', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, shootCooldown: 0 } }
    const input: ShooterInput = { ...noInput, shooting: true, angle: 0 }
    const { next } = update(s, 1, input, null)
    const b = next.myBullets[0]
    expect(Math.round(b.vx)).toBe(BULLET_SPEED)
    expect(Math.round(b.vy)).toBe(0)
  })

  it('increments nextBulletId independently across shots', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, shootCooldown: 0 } }
    const { next: s1 } = update(s, 1, { ...noInput, shooting: true }, null)
    const s2play = { ...s1, myPlayer: { ...s1.myPlayer, shootCooldown: 0 } }
    const { next: s2 } = update(s2play, 1, { ...noInput, shooting: true }, null)
    expect(s2.nextBulletId).toBe(2)
    expect(s2.myBullets[0].id).not.toBe(s2.myBullets[1]?.id ?? -1)
  })
})

describe('update — hit detection', () => {
  it('registers a kill when bullet hits opponent', () => {
    let s = initGame(1)
    s = {
      ...s,
      phase: 'playing',
      oppPlayer: { ...s.oppPlayer, x: 200, y: 300, alive: true },
      myBullets: [{ id: 1, x: 200, y: 300, vx: 0, vy: 0, age: 0 }],
    }
    const { next, didKill } = update(s, 1, noInput, null)
    expect(didKill).toBe(true)
    expect(next.myPlayer.kills).toBe(1)
    expect(next.myBullets).toHaveLength(0)
  })

  it('respawns opponent after kill with shoot cooldown', () => {
    let s = initGame(1)
    s = {
      ...s,
      phase: 'playing',
      myPlayer: { ...s.myPlayer, x: 55, y: 300 },
      oppPlayer: { ...s.oppPlayer, x: 200, y: 300, alive: true },
      myBullets: [{ id: 1, x: 200, y: 300, vx: 0, vy: 0, age: 0 }],
    }
    const { next } = update(s, 1, noInput, null)
    expect(next.oppPlayer.alive).toBe(true)
    expect(next.oppPlayer.shootCooldown).toBe(RESPAWN_SHOOT_COOLDOWN)
  })

  it('transitions to gameOver when kills reach KILL_LIMIT', () => {
    let s = initGame(1)
    s = {
      ...s,
      phase: 'playing',
      myPlayer: { ...s.myPlayer, kills: KILL_LIMIT - 1 },
      oppPlayer: { ...s.oppPlayer, x: 200, y: 300, alive: true },
      myBullets: [{ id: 1, x: 200, y: 300, vx: 0, vy: 0, age: 0 }],
    }
    const { next, didWin } = update(s, 1, noInput, null)
    expect(didWin).toBe(true)
    expect(next.phase).toBe('gameOver')
    expect(next.winner).toBe(1)
  })
})

describe('update — opponent packet', () => {
  it('applies validated opponent packet during playing phase', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const pkt = { x: 400, y: 300, angle: 1.5, kills: 3, alive: true, bullets: [] }
    const { next } = update(s, 1, noInput, pkt)
    expect(next.oppPlayer.x).toBe(400)
    expect(next.oppPlayer.kills).toBe(3)
  })

  it('clamps spoofed kill count to KILL_LIMIT', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    // Opponent tries to spoof kills above KILL_LIMIT to trigger instant win
    const pkt = { x: 400, y: 300, angle: 0, kills: 9999, alive: true, bullets: [] }
    const { next } = update(s, 1, noInput, pkt)
    expect(next.oppPlayer.kills).toBeLessThanOrEqual(KILL_LIMIT)
  })

  it('clamps out-of-bounds opponent position', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const pkt = { x: -500, y: 99999, angle: 0, kills: 0, alive: true, bullets: [] }
    const { next } = update(s, 1, noInput, pkt)
    expect(next.oppPlayer.x).toBeGreaterThanOrEqual(PLAYER_RADIUS)
    expect(next.oppPlayer.y).toBeLessThanOrEqual(ARENA_H - PLAYER_RADIUS)
  })

  it('caps excessive bullet count from packet', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const manyBullets = Array.from({ length: 100 }, (_, i) => ({ id: i, x: 400, y: 300, vx: 0, vy: 0 }))
    const pkt = { x: 400, y: 300, angle: 0, kills: 0, alive: true, bullets: manyBullets }
    const { next } = update(s, 1, noInput, pkt)
    expect(next.oppBullets.length).toBeLessThanOrEqual(20)
  })
})

describe('serializeState', () => {
  it('round-trips player state', () => {
    const s = initGame(1)
    const pkt = serializeState(s)
    expect(pkt.x).toBe(s.myPlayer.x)
    expect(pkt.y).toBe(s.myPlayer.y)
    expect(pkt.kills).toBe(0)
    expect(pkt.alive).toBe(true)
    expect(pkt.bullets).toHaveLength(0)
    expect(pkt.pvpEvent).toBeUndefined()
  })

  it('includes pvpEvent when provided', () => {
    const s = initGame(1)
    const pkt = serializeState(s, [NETEVENT_KILLPLAYER])
    expect(pkt.pvpEvent).toEqual([NETEVENT_KILLPLAYER])
  })
})

describe('forceKill', () => {
  it('increments kills and sets killFlash', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const next = forceKill(s)
    expect(next.myPlayer.kills).toBe(1)
    expect(next.killFlash).toBe(KILL_FLASH_MS)
    expect(next.oppPlayer.alive).toBe(true)
    expect(next.oppPlayer.shootCooldown).toBe(RESPAWN_SHOOT_COOLDOWN)
  })

  it('triggers gameOver at KILL_LIMIT', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', myPlayer: { ...s.myPlayer, kills: KILL_LIMIT - 1 } }
    const next = forceKill(s)
    expect(next.phase).toBe('gameOver')
    expect(next.winner).toBe(1)
  })

  it('is no-op when not in playing phase', () => {
    const s = initGame(1)
    expect(s.phase).toBe('ready')
    expect(forceKill(s)).toBe(s)
  })
})

describe('flash timers', () => {
  it('sets killFlash on bullet hit', () => {
    let s = initGame(1)
    s = {
      ...s,
      phase: 'playing',
      oppPlayer: { ...s.oppPlayer, x: 200, y: 300, alive: true },
      myBullets: [{ id: 1, x: 200, y: 300, vx: 0, vy: 0, age: 0 }],
    }
    const { next } = update(s, 1, noInput, null)
    expect(next.killFlash).toBe(KILL_FLASH_MS)
  })

  it('sets diedFlash when opponent kill count increases via packet', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const pkt = { x: 400, y: 300, angle: 0, kills: 1, alive: true, bullets: [] }
    const { next } = update(s, 1, noInput, pkt)
    expect(next.diedFlash).toBe(DIED_FLASH_MS)
  })

  it('ticks down flash timers each frame', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing', killFlash: 500, diedFlash: 300 }
    const { next } = update(s, 100, noInput, null)
    expect(next.killFlash).toBe(400)
    expect(next.diedFlash).toBe(200)
  })

  it('_testKill sets killFlash and increments kills', () => {
    let s = initGame(1)
    s = { ...s, phase: 'playing' }
    const input: ShooterInput = { ...noInput, _testKill: true }
    const { next } = update(s, 1, input, null)
    expect(next.myPlayer.kills).toBe(1)
    // killFlash is set by forceKill then ticked down 1ms in the same frame
    expect(next.killFlash).toBe(KILL_FLASH_MS - 1)
  })
})

describe('geometry helpers', () => {
  it('clamp works at boundaries', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('circlesOverlap detects collision', () => {
    expect(circlesOverlap(0, 0, 5, 5, 10)).toBe(true)
    expect(circlesOverlap(0, 0, 20, 20, 5)).toBe(false)
  })

  it('resolvePlayer clamps to arena bounds', () => {
    const r = resolvePlayer(-100, -100)
    expect(r.x).toBeGreaterThanOrEqual(PLAYER_RADIUS)
    expect(r.y).toBeGreaterThanOrEqual(PLAYER_RADIUS)
  })

  it('randomSpawn returns position far from killer', () => {
    const sp = randomSpawn(400, 300)
    expect(sp.x).toBeGreaterThanOrEqual(0)
    expect(sp.y).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(sp.x - 400, sp.y - 300)).toBeGreaterThan(0)
  })
})
