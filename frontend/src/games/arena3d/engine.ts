// Void Arena — 3D arena shooter engine (pure logic, no Three.js deps)
// Movement on x-z plane. First to KILL_LIMIT kills wins.
// Facing direction: (sin(rotY), 0, cos(rotY)) in world space.

export const ARENA_W = 80   // x: -40 to 40
export const ARENA_D = 52   // z: -26 to 26
export const PLAYER_RADIUS = 0.8
export const BULLET_RADIUS = 0.2
export const BULLET_SPEED = 40    // units/s
export const BULLET_MAX_AGE = 2200 // ms
export const PLAYER_SPEED = 12    // units/s
export const SHOOT_COOLDOWN = 550  // ms
export const KILL_LIMIT = 5
export const MAX_AMMO = 6
export const RELOAD_TIME = 1500   // ms

// Obstacle boxes (center + half-extents on x-z plane, height=2 in scene)
export interface Box { cx: number; cz: number; hw: number; hd: number }

export const OBSTACLES: Box[] = [
  // center
  { cx:  0,   cz:  0,   hw: 3,   hd: 2   },
  // inner quad covers
  { cx: -10,  cz: -7,   hw: 2,   hd: 1   },
  { cx:  10,  cz: -7,   hw: 2,   hd: 1   },
  { cx: -10,  cz:  7,   hw: 2,   hd: 1   },
  { cx:  10,  cz:  7,   hw: 2,   hd: 1   },
  // mid side pillars
  { cx: -18,  cz:  0,   hw: 0.8, hd: 4   },
  { cx:  18,  cz:  0,   hw: 0.8, hd: 4   },
  // extended side walls (new width)
  { cx: -32,  cz:  0,   hw: 0.8, hd: 5   },
  { cx:  32,  cz:  0,   hw: 0.8, hd: 5   },
  // top/bottom mid covers (new depth)
  { cx:  0,   cz: -19,  hw: 3.5, hd: 1   },
  { cx:  0,   cz:  19,  hw: 3.5, hd: 1   },
  // corner covers
  { cx: -26,  cz: -14,  hw: 1.5, hd: 1   },
  { cx:  26,  cz: -14,  hw: 1.5, hd: 1   },
  { cx: -26,  cz:  14,  hw: 1.5, hd: 1   },
  { cx:  26,  cz:  14,  hw: 1.5, hd: 1   },
]

export const SPAWN_P1 = { x: -34, z: 0 }
export const SPAWN_P2 = { x:  34, z: 0 }

const SPAWN_POINTS = [
  { x: -34, z:  0 }, { x: -34, z: -12 }, { x: -34, z:  12 },
  { x: -10, z: -20 }, { x: -10, z:  20 },
  { x:  10, z: -20 }, { x:  10, z:  20 },
  { x:  34, z:  0 }, { x:  34, z: -12 }, { x:  34, z:  12 },
  { x:   0, z: -22 }, { x:   0, z:  22 },
  { x: -20, z:  0 }, { x:  20, z:  0 },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Player3D {
  x: number
  z: number
  rotY: number       // facing: (sin(rotY), 0, cos(rotY))
  kills: number
  alive: boolean
  shootCooldown: number // ms
  ammo: number
  reloadTimer: number  // ms remaining; 0 = not reloading
}

export interface Bullet3D {
  id: number
  x: number; z: number
  vx: number; vz: number
  age: number
}

export type Arena3DPhase = 'ready' | 'playing' | 'gameOver'

export interface Arena3DState {
  phase: Arena3DPhase
  myPlayer: Player3D
  oppPlayer: Player3D
  myBullets: Bullet3D[]
  oppBullets: Bullet3D[]
  winner: 1 | 2 | null
  readyTimer: number
  message: string
  mySlot: 1 | 2
}

export interface Arena3DInput {
  up: boolean; down: boolean; left: boolean; right: boolean
  rotY: number
  shooting: boolean
  reloading: boolean
  _mouseX?: number; _mouseY?: number
}

export interface StatePacket3D {
  x: number; z: number; rotY: number
  kills: number; alive: boolean
  ammo: number; reloadTimer: number
  bullets: { id: number; x: number; z: number; vx: number; vz: number }[]
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }

function circleBox(px: number, pz: number, r: number, b: Box): boolean {
  const nx = clamp(px, b.cx - b.hw, b.cx + b.hw)
  const nz = clamp(pz, b.cz - b.hd, b.cz + b.hd)
  const dx = px - nx, dz = pz - nz
  return dx * dx + dz * dz < r * r
}

function circlesOverlap(ax: number, az: number, bx: number, bz: number, r: number): boolean {
  const dx = ax - bx, dz = az - bz
  return dx * dx + dz * dz < r * r
}

function resolvePlayer(x: number, z: number): { x: number; z: number } {
  const HW = ARENA_W / 2 - PLAYER_RADIUS
  const HD = ARENA_D / 2 - PLAYER_RADIUS
  x = clamp(x, -HW, HW)
  z = clamp(z, -HD, HD)
  for (const obs of OBSTACLES) {
    if (!circleBox(x, z, PLAYER_RADIUS, obs)) continue
    const nx = clamp(x, obs.cx - obs.hw, obs.cx + obs.hw)
    const nz = clamp(z, obs.cz - obs.hd, obs.cz + obs.hd)
    const dx = x - nx, dz = z - nz
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001
    const push = PLAYER_RADIUS - dist
    x = clamp(x + (dx / dist) * push, -HW, HW)
    z = clamp(z + (dz / dist) * push, -HD, HD)
  }
  return { x, z }
}

function bulletValid(x: number, z: number): boolean {
  if (Math.abs(x) > ARENA_W / 2 || Math.abs(z) > ARENA_D / 2) return false
  return !OBSTACLES.some(obs => circleBox(x, z, BULLET_RADIUS + 0.1, obs))
}

function randomSpawn(killerX: number, killerZ: number): { x: number; z: number } {
  const far = SPAWN_POINTS.filter(p => Math.hypot(p.x - killerX, p.z - killerZ) >= 12)
  const pool = far.length > 0 ? far : SPAWN_POINTS
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── Init ──────────────────────────────────────────────────────────────────────

let _bid = 0

function makePlayer(slot: 1 | 2): Player3D {
  const pos = slot === 1 ? SPAWN_P1 : SPAWN_P2
  return {
    x: pos.x, z: pos.z,
    rotY: slot === 1 ? Math.PI / 2 : -Math.PI / 2, // face toward opponent
    kills: 0, alive: true, shootCooldown: 0, ammo: MAX_AMMO, reloadTimer: 0,
  }
}

export function initGame(mySlot: 1 | 2): Arena3DState {
  _bid = 0
  return {
    phase: 'ready',
    myPlayer: makePlayer(mySlot),
    oppPlayer: makePlayer(mySlot === 1 ? 2 : 1),
    myBullets: [], oppBullets: [],
    winner: null,
    readyTimer: 3000,
    message: 'READY!',
    mySlot,
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export function update(
  state: Arena3DState,
  dt: number,
  input: Arena3DInput,
  oppPacket: StatePacket3D | null,
): { next: Arena3DState; didWin: boolean } {
  let s: Arena3DState = {
    ...state,
    myPlayer: { ...state.myPlayer },
    oppPlayer: { ...state.oppPlayer },
    myBullets: [...state.myBullets],
    oppBullets: [...state.oppBullets],
  }
  let didWin = false

  if (s.phase === 'ready') {
    s.readyTimer -= dt
    if (oppPacket) s = applyOppPacket(s, oppPacket)
    if (s.readyTimer <= 0) s = { ...s, phase: 'playing', message: '' }
    return { next: s, didWin: false }
  }
  if (s.phase !== 'playing') return { next: s, didWin: false }

  const dtS = dt / 1000

  // Apply opponent packet
  const prevOppKills = s.oppPlayer.kills
  if (oppPacket) s = applyOppPacket(s, oppPacket)
  // Opponent reached kill limit — they win
  if (s.oppPlayer.kills >= KILL_LIMIT && s.phase === 'playing') {
    return { next: { ...s, phase: 'gameOver', winner: s.mySlot === 1 ? 2 : 1, message: 'GAME OVER' }, didWin: false }
  }
  // Opponent killed me — respawn far from killer
  if (s.oppPlayer.kills > prevOppKills) {
    const sp = randomSpawn(s.oppPlayer.x, s.oppPlayer.z)
    s.myPlayer = { ...s.myPlayer, x: sp.x, z: sp.z, alive: true, shootCooldown: 400, ammo: MAX_AMMO, reloadTimer: 0 }
    s.myBullets = []
  }

  // Animate opponent bullets locally between packets
  s.oppBullets = s.oppBullets
    .map(b => ({ ...b, x: b.x + b.vx * dtS, z: b.z + b.vz * dtS, age: b.age + dt }))
    .filter(b => b.age < BULLET_MAX_AGE && bulletValid(b.x, b.z))

  // Shoot cooldown
  if (s.myPlayer.shootCooldown > 0)
    s.myPlayer = { ...s.myPlayer, shootCooldown: Math.max(0, s.myPlayer.shootCooldown - dt) }

  // Reload
  if (s.myPlayer.reloadTimer > 0) {
    const t = s.myPlayer.reloadTimer - dt
    s.myPlayer = t <= 0
      ? { ...s.myPlayer, reloadTimer: 0, ammo: MAX_AMMO }
      : { ...s.myPlayer, reloadTimer: t }
  } else if (input.reloading && s.myPlayer.ammo < MAX_AMMO) {
    s.myPlayer = { ...s.myPlayer, reloadTimer: RELOAD_TIME }
  }

  // Move
  if (s.myPlayer.alive) {
    const sp = PLAYER_SPEED * dtS
    let dx = 0, dz = 0
    if (input.up)    dz -= 1
    if (input.down)  dz += 1
    if (input.left)  dx -= 1
    if (input.right) dx += 1
    if (dx !== 0 && dz !== 0) { dx *= 0.7071; dz *= 0.7071 }
    const pos = resolvePlayer(s.myPlayer.x + dx * sp, s.myPlayer.z + dz * sp)
    s.myPlayer = { ...s.myPlayer, x: pos.x, z: pos.z, rotY: input.rotY }
  }

  // Shoot
  if (input.shooting && s.myPlayer.alive && s.myPlayer.shootCooldown <= 0 && s.myPlayer.ammo > 0 && s.myPlayer.reloadTimer <= 0) {
    const a = s.myPlayer.rotY
    s.myBullets = [...s.myBullets, {
      id: ++_bid,
      x: s.myPlayer.x + Math.sin(a) * (PLAYER_RADIUS + BULLET_RADIUS + 0.2),
      z: s.myPlayer.z + Math.cos(a) * (PLAYER_RADIUS + BULLET_RADIUS + 0.2),
      vx: Math.sin(a) * BULLET_SPEED,
      vz: Math.cos(a) * BULLET_SPEED,
      age: 0,
    }]
    s.myPlayer = { ...s.myPlayer, shootCooldown: SHOOT_COOLDOWN, ammo: s.myPlayer.ammo - 1 }
  }

  // Move my bullets
  s.myBullets = s.myBullets
    .map(b => ({ ...b, x: b.x + b.vx * dtS, z: b.z + b.vz * dtS, age: b.age + dt }))
    .filter(b => b.age < BULLET_MAX_AGE && bulletValid(b.x, b.z))

  // Hit detection — my bullets vs opponent
  if (s.oppPlayer.alive) {
    const hitId = s.myBullets.find(
      b => circlesOverlap(b.x, b.z, s.oppPlayer.x, s.oppPlayer.z, PLAYER_RADIUS + BULLET_RADIUS)
    )?.id
    if (hitId !== undefined) {
      s.myBullets = s.myBullets.filter(b => b.id !== hitId)
      const sp = randomSpawn(s.myPlayer.x, s.myPlayer.z)
      s.oppPlayer = { ...s.oppPlayer, x: sp.x, z: sp.z, alive: true, shootCooldown: 400, ammo: MAX_AMMO, reloadTimer: 0 }
      s.myPlayer = { ...s.myPlayer, kills: s.myPlayer.kills + 1 }
      if (s.myPlayer.kills >= KILL_LIMIT) {
        s = { ...s, phase: 'gameOver', winner: s.mySlot, message: 'YOU WIN!' }
        didWin = true
      }
    }
  }

  return { next: s, didWin }
}

function applyOppPacket(s: Arena3DState, pkt: StatePacket3D): Arena3DState {
  return {
    ...s,
    oppPlayer: {
      ...s.oppPlayer,
      x: pkt.x, z: pkt.z, rotY: pkt.rotY,
      kills: pkt.kills, alive: pkt.alive,
      ammo: pkt.ammo, reloadTimer: pkt.reloadTimer,
    },
    oppBullets: pkt.bullets.map(b => ({ ...b, age: 0 })),
  }
}

export function serializeState(s: Arena3DState): StatePacket3D {
  return {
    x: s.myPlayer.x, z: s.myPlayer.z, rotY: s.myPlayer.rotY,
    kills: s.myPlayer.kills, alive: s.myPlayer.alive,
    ammo: s.myPlayer.ammo, reloadTimer: s.myPlayer.reloadTimer,
    bullets: s.myBullets.map(b => ({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz })),
  }
}

export function createInputHandler() {
  const state: Arena3DInput = {
    up: false, down: false, left: false, right: false,
    rotY: Math.PI / 2, shooting: false, reloading: false,
  }

  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.repeat) return
    switch (ke.code) {
      case 'KeyW': case 'ArrowUp':    state.up       = true; break
      case 'KeyS': case 'ArrowDown':  state.down     = true; break
      case 'KeyA': case 'ArrowLeft':  state.left     = true; break
      case 'KeyD': case 'ArrowRight': state.right    = true; break
      case 'Space': state.shooting  = true; ke.preventDefault(); break
      case 'KeyR':  state.reloading = true; break
    }
  }
  const onKeyUp = (e: Event) => {
    const ke = e as KeyboardEvent
    switch (ke.code) {
      case 'KeyW': case 'ArrowUp':    state.up       = false; break
      case 'KeyS': case 'ArrowDown':  state.down     = false; break
      case 'KeyA': case 'ArrowLeft':  state.left     = false; break
      case 'KeyD': case 'ArrowRight': state.right    = false; break
      case 'Space': state.shooting  = false; break
      case 'KeyR':  state.reloading = false; break
    }
  }

  const attach = (el: HTMLElement | Window, canvas: HTMLElement) => {
    const onMouseMove = (e: MouseEvent) => {
      state._mouseX = e.clientX
      state._mouseY = e.clientY
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) state.shooting  = true
      if (e.button === 2) state.reloading = true
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) state.shooting  = false
      if (e.button === 2) state.reloading = false
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('keydown',  onKeyDown)
    el.addEventListener('keyup',    onKeyUp)
    canvas.addEventListener('mousemove',   onMouseMove   as EventListener)
    canvas.addEventListener('mousedown',   onMouseDown   as EventListener)
    canvas.addEventListener('contextmenu', onContextMenu as EventListener)
    window.addEventListener('mouseup',     onMouseUp)
    return () => {
      el.removeEventListener('keydown',  onKeyDown)
      el.removeEventListener('keyup',    onKeyUp)
      canvas.removeEventListener('mousemove',   onMouseMove   as EventListener)
      canvas.removeEventListener('mousedown',   onMouseDown   as EventListener)
      canvas.removeEventListener('contextmenu', onContextMenu as EventListener)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }

  return { state, attach }
}
