// Snake Duel — 2P competitive snake engine
// P1 = green (left side), P2 = purple (right side)
// Win: opponent hits wall, body, or your body

export type Dir = 'up' | 'down' | 'left' | 'right'

export const GRID = 20
export const CELL = 24       // px per grid cell
export const TICK_MS = 130   // ms between snake moves

type Point = { x: number; y: number }

interface Snake {
  body: Point[]
  dir: Dir
  nextDir: Dir
  alive: boolean
  score: number
}

export interface InputState {
  p1Dir: Dir | null
  p2Dir: Dir | null
}

export interface GameState {
  phase: 'ready' | 'playing' | 'gameOver'
  snakes: [Snake, Snake]
  food: Point[]
  winner: 1 | 2 | null
  tickAccum: number
  readyTimer: number
  rng: number  // deterministic PRNG state — synced via matchId seed
}

// ── Seeded LCG — both clients share matchId seed for identical food spawns ────
function lcg(s: number): number {
  return ((s * 1664525 + 1013904223) >>> 0)
}

function seedFrom(str: string): number {
  return [...str].reduce((a, c) => lcg(a ^ c.charCodeAt(0)), 12345) >>> 0
}

function spawnFood(snakes: [Snake, Snake], rng: number): { food: Point; rng: number } {
  const taken = new Set([...snakes[0].body, ...snakes[1].body].map(p => `${p.x},${p.y}`))
  let p: Point
  do {
    rng = lcg(rng)
    const x = rng % GRID
    rng = lcg(rng)
    const y = rng % GRID
    p = { x, y }
  } while (taken.has(`${p.x},${p.y}`))
  return { food: p, rng }
}

export function initGame(matchId?: string): GameState {
  let rng = matchId ? seedFrom(matchId) : (Date.now() | 0) >>> 0

  const s1: Snake = {
    body: [{ x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 }],
    dir: 'right', nextDir: 'right', alive: true, score: 0,
  }
  const s2: Snake = {
    body: [{ x: 15, y: 10 }, { x: 16, y: 10 }, { x: 17, y: 10 }],
    dir: 'left', nextDir: 'left', alive: true, score: 0,
  }
  const snakes: [Snake, Snake] = [s1, s2]

  const f1 = spawnFood(snakes, rng)
  const f2 = spawnFood(snakes, f1.rng)

  return {
    phase: 'ready',
    snakes,
    food: [f1.food, f2.food],
    winner: null,
    tickAccum: 0,
    readyTimer: 3000,
    rng: f2.rng,
  }
}

function oppose(dir: Dir): Dir {
  return { up: 'down', down: 'up', left: 'right', right: 'left' }[dir] as Dir
}

function stepDir(p: Point, dir: Dir): Point {
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
  return { x: p.x + d[0], y: p.y + d[1] }
}

function doTick(state: GameState): GameState {
  const [s1, s2] = state.snakes
  const h1 = stepDir(s1.body[0], s1.nextDir)
  const h2 = stepDir(s2.body[0], s2.nextDir)

  const ate1 = state.food.some(f => f.x === h1.x && f.y === h1.y)
  const ate2 = state.food.some(f => f.x === h2.x && f.y === h2.y)

  const body1 = [h1, ...s1.body.slice(0, ate1 ? undefined : -1)]
  const body2 = [h2, ...s2.body.slice(0, ate2 ? undefined : -1)]

  const self1 = new Set(body1.slice(1).map(p => `${p.x},${p.y}`))
  const self2 = new Set(body2.slice(1).map(p => `${p.x},${p.y}`))
  const full1 = new Set(body1.map(p => `${p.x},${p.y}`))
  const full2 = new Set(body2.map(p => `${p.x},${p.y}`))

  const headOn = h1.x === h2.x && h1.y === h2.y
  const oob1 = h1.x < 0 || h1.x >= GRID || h1.y < 0 || h1.y >= GRID
  const oob2 = h2.x < 0 || h2.x >= GRID || h2.y < 0 || h2.y >= GRID

  const dead1 = headOn || oob1 || self1.has(`${h1.x},${h1.y}`) || (!headOn && full2.has(`${h1.x},${h1.y}`))
  const dead2 = headOn || oob2 || self2.has(`${h2.x},${h2.y}`) || (!headOn && full1.has(`${h2.x},${h2.y}`))

  const ns1: Snake = { ...s1, body: body1, dir: s1.nextDir, alive: !dead1, score: s1.score + (ate1 ? 1 : 0) }
  const ns2: Snake = { ...s2, body: body2, dir: s2.nextDir, alive: !dead2, score: s2.score + (ate2 ? 1 : 0) }
  const snakes: [Snake, Snake] = [ns1, ns2]

  let food = state.food.filter(f =>
    !(ate1 && f.x === h1.x && f.y === h1.y) &&
    !(ate2 && f.x === h2.x && f.y === h2.y)
  )
  let { rng } = state
  if (ate1 || ate2) {
    const result = spawnFood(snakes, rng)
    food = [...food, result.food]
    rng = result.rng
  }

  let { phase, winner } = state
  if (!ns1.alive || !ns2.alive) {
    phase = 'gameOver'
    if (!ns1.alive && !ns2.alive) winner = ns1.score >= ns2.score ? 1 : 2
    else winner = ns1.alive ? 1 : 2
  }

  return { ...state, snakes, food, phase, winner, rng }
}

export function update(state: GameState, dt: number, input: InputState): GameState {
  if (state.phase === 'ready') {
    const t = state.readyTimer - dt
    return t <= 0 ? { ...state, phase: 'playing', readyTimer: 0 } : { ...state, readyTimer: t }
  }
  if (state.phase === 'gameOver') return state

  let [s1, s2] = state.snakes
  if (input.p1Dir && oppose(input.p1Dir) !== s1.dir) s1 = { ...s1, nextDir: input.p1Dir }
  if (input.p2Dir && oppose(input.p2Dir) !== s2.dir) s2 = { ...s2, nextDir: input.p2Dir }

  const tickAccum = state.tickAccum + dt
  if (tickAccum < TICK_MS) return { ...state, snakes: [s1, s2], tickAccum }

  return doTick({ ...state, snakes: [s1, s2], tickAccum: tickAccum - TICK_MS })
}

export function createInputHandler(slot?: 1 | 2) {
  const state: InputState = { p1Dir: null, p2Dir: null }

  const ARROW: Record<string, Dir> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  }
  const WASD: Record<string, Dir> = {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  }

  const onKey = (e: KeyboardEvent) => {
    const isArrow = !!ARROW[e.code]
    const dir = ARROW[e.code] ?? WASD[e.code]
    if (!dir) return
    e.preventDefault()
    // Match mode: all keys → local player's slot
    // Solo mode: arrows → P1, WASD → P2
    if (slot === 2) state.p2Dir = dir
    else if (slot === 1) state.p1Dir = dir
    else if (isArrow) state.p1Dir = dir
    else state.p2Dir = dir
  }

  const attach = (el: Window) => {
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }

  return { state, attach }
}
