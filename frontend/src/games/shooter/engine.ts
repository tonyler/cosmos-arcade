// 2D top-down arena shooter engine — pure logic, no canvas deps
// P1 spawns left, P2 spawns right. WASD + mouse aim + click to shoot.
// First to KILL_LIMIT kills wins.

export const ARENA_W = 640
export const ARENA_H = 480
export const PLAYER_RADIUS = 16
export const BULLET_RADIUS = 5
export const BULLET_SPEED = 450     // px/s
export const BULLET_MAX_AGE = 1600  // ms
export const PLAYER_SPEED = 200     // px/s
export const SHOOT_COOLDOWN = 550   // ms between shots
export const RESPAWN_TIME = 2500    // ms
export const KILL_LIMIT = 10

// ── Arena walls (rectangles) ─────────────────────────────────────────────────
export interface WallRect { x: number; y: number; w: number; h: number }

export const WALLS: WallRect[] = [
  // Center horizontal pillars (symmetric)
  { x: 245, y: 192, w: 150, h: 18 },
  { x: 245, y: 270, w: 150, h: 18 },
  // Left side vertical covers
  { x: 140, y: 135, w: 18, h: 85 },
  { x: 140, y: 260, w: 18, h: 85 },
  // Right side vertical covers (mirror)
  { x: 482, y: 135, w: 18, h: 85 },
  { x: 482, y: 260, w: 18, h: 85 },
]

export const SPAWN_P1 = { x: 72, y: 240 }
export const SPAWN_P2 = { x: 568, y: 240 }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShooterPlayer {
  x: number
  y: number
  angle: number       // radians, direction facing
  kills: number
  alive: boolean
  respawnTimer: number   // ms remaining
  shootCooldown: number  // ms remaining
}

export interface Bullet {
  id: number
  x: number
  y: number
  vx: number  // px/s
  vy: number  // px/s
  age: number // ms
}

export type ShooterPhase = 'ready' | 'playing' | 'gameOver'

export interface ShooterState {
  phase: ShooterPhase
  myPlayer: ShooterPlayer
  oppPlayer: ShooterPlayer
  myBullets: Bullet[]
  oppBullets: Bullet[]  // received from opponent, animated locally
  winner: 1 | 2 | null
  readyTimer: number
  message: string
  mySlot: 1 | 2
}

export interface ShooterInput {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  angle: number      // mouse angle (radians) toward canvas cursor
  shooting: boolean  // mouse button held or space held
  _mouseX?: number
  _mouseY?: number
}

// ── Wire format for WS ────────────────────────────────────────────────────────

export interface StatePacket {
  x: number
  y: number
  angle: number
  kills: number
  alive: boolean
  bullets: { id: number; x: number; y: number; vx: number; vy: number }[]
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function circleRect(cx: number, cy: number, r: number, w: WallRect): boolean {
  const nx = clamp(cx, w.x, w.x + w.w)
  const ny = clamp(cy, w.y, w.y + w.h)
  const dx = cx - nx, dy = cy - ny
  return dx * dx + dy * dy < r * r
}

function circlesOverlap(ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy < r * r
}

function inBounds(x: number, y: number, r: number): boolean {
  return x - r >= 0 && x + r <= ARENA_W && y - r >= 0 && y + r <= ARENA_H
}

function resolvePlayer(x: number, y: number): { x: number; y: number } {
  x = clamp(x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS)
  y = clamp(y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS)
  for (const w of WALLS) {
    if (!circleRect(x, y, PLAYER_RADIUS, w)) continue
    const nx = clamp(x, w.x, w.x + w.w)
    const ny = clamp(y, w.y, w.y + w.h)
    const dx = x - nx, dy = y - ny
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
    const push = PLAYER_RADIUS - dist
    x += (dx / dist) * push
    y += (dy / dist) * push
    x = clamp(x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS)
    y = clamp(y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS)
  }
  return { x, y }
}

// ── Init ──────────────────────────────────────────────────────────────────────

let _bulletId = 0
function nextId(): number { return ++_bulletId }

function makePlayer(slot: 1 | 2): ShooterPlayer {
  const pos = slot === 1 ? SPAWN_P1 : SPAWN_P2
  return {
    x: pos.x, y: pos.y,
    angle: slot === 1 ? 0 : Math.PI,
    kills: 0, alive: true,
    respawnTimer: 0, shootCooldown: 0,
  }
}

export function initGame(mySlot: 1 | 2): ShooterState {
  _bulletId = 0
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
  state: ShooterState,
  dt: number,
  input: ShooterInput,
  oppPacket: StatePacket | null,
): { next: ShooterState; didKill: boolean; didWin: boolean } {
  let s: ShooterState = {
    ...state,
    myPlayer: { ...state.myPlayer },
    oppPlayer: { ...state.oppPlayer },
    myBullets: [...state.myBullets],
    oppBullets: [...state.oppBullets],
  }
  let didKill = false
  let didWin = false

  // ── Ready countdown ───────────────────────────────────────────────────────
  if (s.phase === 'ready') {
    s.readyTimer -= dt
    if (oppPacket) s = applyOppPacket(s, oppPacket, false)
    if (s.readyTimer <= 0) { s = { ...s, phase: 'playing', message: '' } }
    return { next: s, didKill: false, didWin: false }
  }
  if (s.phase !== 'playing') return { next: s, didKill: false, didWin: false }

  // ── Apply opponent packet ─────────────────────────────────────────────────
  const prevOppKills = s.oppPlayer.kills
  if (oppPacket) s = applyOppPacket(s, oppPacket, true)

  // Opponent reached kill limit — they win
  if (s.oppPlayer.kills >= KILL_LIMIT && s.phase === 'playing') {
    return { next: { ...s, phase: 'gameOver', winner: s.mySlot === 1 ? 2 : 1, message: 'GAME OVER' }, didKill: false, didWin: false }
  }

  // Opponent killed me (their kills went up)
  if (s.oppPlayer.kills > prevOppKills && s.myPlayer.alive) {
    s.myPlayer = { ...s.myPlayer, alive: false, respawnTimer: RESPAWN_TIME }
    s.myBullets = []  // clear bullets on death
  }

  // ── Opponent bullet animation (local sim between packets) ─────────────────
  const dtS = dt / 1000
  s.oppBullets = s.oppBullets
    .map((b) => ({ ...b, x: b.x + b.vx * dtS, y: b.y + b.vy * dtS, age: b.age + dt }))
    .filter((b) => b.age < BULLET_MAX_AGE && inBounds(b.x, b.y, BULLET_RADIUS) &&
      !WALLS.some((w) => circleRect(b.x, b.y, BULLET_RADIUS, w)))

  // ── Respawn ───────────────────────────────────────────────────────────────
  if (!s.myPlayer.alive) {
    s.myPlayer = { ...s.myPlayer, respawnTimer: s.myPlayer.respawnTimer - dt }
    if (s.myPlayer.respawnTimer <= 0) {
      const sp = s.mySlot === 1 ? SPAWN_P1 : SPAWN_P2
      s.myPlayer = { ...s.myPlayer, x: sp.x, y: sp.y, alive: true, respawnTimer: 0, shootCooldown: 0 }
    }
  }

  // ── Shoot cooldown ────────────────────────────────────────────────────────
  if (s.myPlayer.shootCooldown > 0) {
    s.myPlayer = { ...s.myPlayer, shootCooldown: Math.max(0, s.myPlayer.shootCooldown - dt) }
  }

  // ── Move ──────────────────────────────────────────────────────────────────
  if (s.myPlayer.alive) {
    const sp = PLAYER_SPEED * dtS
    let dx = 0, dy = 0
    if (input.up) dy -= 1
    if (input.down) dy += 1
    if (input.left) dx -= 1
    if (input.right) dx += 1
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071 }
    const resolved = resolvePlayer(s.myPlayer.x + dx * sp, s.myPlayer.y + dy * sp)
    s.myPlayer = { ...s.myPlayer, x: resolved.x, y: resolved.y, angle: input.angle }
  }

  // ── Shoot ─────────────────────────────────────────────────────────────────
  if (input.shooting && s.myPlayer.alive && s.myPlayer.shootCooldown <= 0) {
    const a = s.myPlayer.angle
    const bx = s.myPlayer.x + Math.cos(a) * (PLAYER_RADIUS + BULLET_RADIUS + 2)
    const by = s.myPlayer.y + Math.sin(a) * (PLAYER_RADIUS + BULLET_RADIUS + 2)
    s.myBullets = [...s.myBullets, {
      id: nextId(), x: bx, y: by,
      vx: Math.cos(a) * BULLET_SPEED,
      vy: Math.sin(a) * BULLET_SPEED,
      age: 0,
    }]
    s.myPlayer = { ...s.myPlayer, shootCooldown: SHOOT_COOLDOWN }
  }

  // ── Move my bullets + wall/bounds culling ─────────────────────────────────
  s.myBullets = s.myBullets
    .map((b) => ({ ...b, x: b.x + b.vx * dtS, y: b.y + b.vy * dtS, age: b.age + dt }))
    .filter((b) => b.age < BULLET_MAX_AGE && inBounds(b.x, b.y, BULLET_RADIUS) &&
      !WALLS.some((w) => circleRect(b.x, b.y, BULLET_RADIUS, w)))

  // ── Hit detection — my bullets vs opponent ────────────────────────────────
  if (s.oppPlayer.alive) {
    const hitIds = new Set<number>()
    for (const b of s.myBullets) {
      if (circlesOverlap(b.x, b.y, s.oppPlayer.x, s.oppPlayer.y, PLAYER_RADIUS + BULLET_RADIUS)) {
        hitIds.add(b.id)
        break  // one bullet per frame can kill
      }
    }
    if (hitIds.size > 0) {
      s.myBullets = s.myBullets.filter((b) => !hitIds.has(b.id))
      s.oppPlayer = { ...s.oppPlayer, alive: false, respawnTimer: RESPAWN_TIME }
      s.myPlayer = { ...s.myPlayer, kills: s.myPlayer.kills + 1 }
      didKill = true
      if (s.myPlayer.kills >= KILL_LIMIT) {
        s = { ...s, phase: 'gameOver', winner: s.mySlot, message: 'YOU WIN!' }
        didWin = true
      }
    }
  }

  return { next: s, didKill, didWin }
}

function applyOppPacket(s: ShooterState, pkt: StatePacket, animate: boolean): ShooterState {
  return {
    ...s,
    oppPlayer: {
      ...s.oppPlayer,
      x: pkt.x, y: pkt.y,
      angle: pkt.angle,
      kills: pkt.kills,
      alive: pkt.alive,
    },
    // Replace opp bullets only when new packet arrives; keep local animation otherwise
    oppBullets: animate
      ? pkt.bullets.map((b) => ({ ...b, age: 0 }))
      : s.oppBullets,
  }
}

export function serializeState(s: ShooterState): StatePacket {
  return {
    x: s.myPlayer.x,
    y: s.myPlayer.y,
    angle: s.myPlayer.angle,
    kills: s.myPlayer.kills,
    alive: s.myPlayer.alive,
    bullets: s.myBullets.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
  }
}

export function createInputHandler() {
  const state: ShooterInput = {
    up: false, down: false, left: false, right: false,
    angle: 0, shooting: false,
  }

  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.repeat) return
    switch (ke.code) {
      case 'KeyW': case 'ArrowUp':    state.up = true; break
      case 'KeyS': case 'ArrowDown':  state.down = true; break
      case 'KeyA': case 'ArrowLeft':  state.left = true; break
      case 'KeyD': case 'ArrowRight': state.right = true; break
      case 'Space': state.shooting = true; ke.preventDefault(); break
    }
  }

  const onKeyUp = (e: Event) => {
    const ke = e as KeyboardEvent
    switch (ke.code) {
      case 'KeyW': case 'ArrowUp':    state.up = false; break
      case 'KeyS': case 'ArrowDown':  state.down = false; break
      case 'KeyA': case 'ArrowLeft':  state.left = false; break
      case 'KeyD': case 'ArrowRight': state.right = false; break
      case 'Space': state.shooting = false; break
    }
  }

  const attach = (el: HTMLElement | Window, canvas: HTMLCanvasElement) => {
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = ARENA_W / rect.width
      const sy = ARENA_H / rect.height
      // We need the player's current position — will be set externally
      state.angle = state.angle  // will be updated by ShooterGame component
      state._mouseX = (e.clientX - rect.left) * sx
      state._mouseY = (e.clientY - rect.top) * sy
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) state.shooting = true
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) state.shooting = false
    }
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }

  return { state, attach }
}
