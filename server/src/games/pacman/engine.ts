// Classic Pac-Man 2P engine — canvas-based, no deps
// Controls: P1 = Arrow keys, P2 = WASD
// Win condition: ghost eats you → other player wins
// 2P power pellet: if you have it and opponent doesn't → eat them

export const TILE = 16  // px per tile
export const COLS = 28
export const ROWS = 31  // playfield rows (excludes score area)

// ── Tile types ──────────────────────────────────────────────────────────────
export const T = {
  WALL: 0,
  DOT: 1,
  PELLET: 2,   // power pellet
  EMPTY: 3,
  GHOST_DOOR: 4,
  OUTSIDE: 5,
} as const

// ── Classic Pac-Man maze (28×31) ──────────────────────────────────────────
const MAZE_STR = [
  '||||||||||||||||||||||||||||',
  '|............||............|',
  '|.||||.|||||.||.|||||.||||.|',
  '|o||||.|||||.||.|||||.||||o|',
  '|.||||.|||||.||.|||||.||||.|',
  '|..........................|',
  '|.||||.||.||||||||.||.||||.|',
  '|.||||.||.||||||||.||.||||.|',
  '|......||....||....||......|',
  '||||||.||||| || |||||.||||||',
  '     |.||||| || |||||.|     ',
  '     |.||          ||.|     ',
  '     |.|| |||--|||  ||.|     ',
  '||||||.||           ||.||||||',
  '      .    |    |    .      ',
  '||||||.||           ||.||||||',
  '     |.|| |||||||| ||.|     ',
  '     |.||          ||.|     ',
  '     |.|| |||||||| ||.|     ',
  '||||||.|| |||||||| ||.||||||',
  '|............||............|',
  '|.||||.|||||.||.|||||.||||.|',
  '|.||||.|||||.||.|||||.||||.|',
  '|o..||.......  .......||..o|',
  '|||.||.||.||||||||.||.||.|||',
  '|||.||.||.||||||||.||.||.|||',
  '|......||....||....||......|',
  '|.||||||||||.||.||||||||||.|',
  '|.||||||||||.||.||||||||||.|',
  '|..........................|',
  '||||||||||||||||||||||||||||',
]

// Build tile grid from string — length-mismatch rows are padded/truncated
export function buildMap(): number[][] {
  const grid: number[][] = []
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = []
    const src = MAZE_STR[r] ?? ''
    for (let c = 0; c < COLS; c++) {
      const ch = src[c] ?? ' '
      if (ch === '|') row.push(T.WALL)
      else if (ch === '.') row.push(T.DOT)
      else if (ch === 'o') row.push(T.PELLET)
      else if (ch === '-') row.push(T.GHOST_DOOR)
      else if (ch === ' ') row.push(T.EMPTY)
      else row.push(T.OUTSIDE)   // '_' and anything else
    }
    grid.push(row)
  }
  return grid
}

// Count dots + pellets in fresh map
export function countDots(grid: number[][]): number {
  return grid.flat().filter((t) => t === T.DOT || t === T.PELLET).length
}

// ── Direction helpers ────────────────────────────────────────────────────
export type Dir = 0 | 1 | 2 | 3  // UP RIGHT DOWN LEFT
export const DX = [0, 1, 0, -1]
export const DY = [-1, 0, 1, 0]
export const OPPOSITE: Dir[] = [2, 3, 0, 1]

export function canMove(grid: number[][], col: number, row: number, dir: Dir): boolean {
  const nc = col + DX[dir]
  const nr = row + DY[dir]
  if (nr < 0 || nr >= ROWS) return false
  // wrap tunnel cols 0 and 27
  const wc = (nc + COLS) % COLS
  const t = grid[nr]?.[wc]
  return t !== T.WALL && t !== T.OUTSIDE && t !== T.GHOST_DOOR
}

// ── Player ───────────────────────────────────────────────────────────────
export interface Player {
  id: 1 | 2
  col: number; row: number       // current tile (grid position)
  px: number;  py: number        // pixel position (for smooth movement)
  dir: Dir
  nextDir: Dir
  score: number
  powered: boolean
  powerTimer: number             // ms remaining
  alive: boolean
  mouthAngle: number             // for animation
  mouthDir: 1 | -1
}

// ── Ghost ────────────────────────────────────────────────────────────────
export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten'

export interface Ghost {
  id: number
  col: number; row: number
  px: number;  py: number
  dir: Dir
  mode: GhostMode
  color: string
  scatterTarget: [number, number]
  modeTimer: number
}

// Ghost mode schedule (ms): scatter, chase, scatter, chase, ...
const MODE_SCHEDULE = [7000, 20000, 7000, 20000, 5000, 20000, 5000]

// ── Game state ───────────────────────────────────────────────────────────
export type GamePhase = 'ready' | 'playing' | 'levelComplete' | 'gameOver'

export interface GameState {
  grid: number[][]
  phase: GamePhase
  level: number
  dotsLeft: number
  p1: Player
  p2: Player
  ghosts: Ghost[]
  winner: 1 | 2 | null
  p1Wins: number
  p2Wins: number
  modeScheduleIdx: number
  modeTimer: number
  readyTimer: number
  message: string
}

const POWER_DURATION = 8000  // ms
const SPEED_PX_PER_MS = 0.009   // tiles/ms  (~9 tiles/sec at 60fps)
const GHOST_SPEED = 0.0075
const FRIGHTENED_SPEED = 0.005
const TILE_F = TILE  // alias

function makePlayer(id: 1 | 2, col: number, row: number): Player {
  return {
    id, col, row,
    px: col * TILE + TILE / 2,
    py: row * TILE + TILE / 2,
    dir: 3, nextDir: 3,  // LEFT
    score: 0,
    powered: false, powerTimer: 0,
    alive: true,
    mouthAngle: 0.25, mouthDir: 1,
  }
}

function makeGhost(id: number, col: number, row: number, color: string, scatterTarget: [number, number]): Ghost {
  return {
    id, col, row,
    px: col * TILE + TILE / 2,
    py: row * TILE + TILE / 2,
    dir: 0,
    mode: 'scatter',
    color,
    scatterTarget,
    modeTimer: MODE_SCHEDULE[0],
  }
}

export function initGame(): GameState {
  const grid = buildMap()
  return {
    grid,
    phase: 'ready',
    level: 1,
    dotsLeft: countDots(grid),
    p1: makePlayer(1, 9, 23),
    p2: makePlayer(2, 18, 23),
    ghosts: [
      makeGhost(0, 13, 11, '#ff0000', [27, 0]),   // Blinky — red
      makeGhost(1, 14, 14, '#ffb8ff', [0, 0]),    // Pinky — pink
      makeGhost(2, 13, 14, '#00ffff', [27, 30]),  // Inky — cyan
      makeGhost(3, 14, 11, '#ffb852', [0, 30]),   // Clyde — orange
    ],
    winner: null,
    p1Wins: 0,
    p2Wins: 0,
    modeScheduleIdx: 0,
    modeTimer: MODE_SCHEDULE[0],
    readyTimer: 3000,
    message: 'READY!',
  }
}

// ── Pathfinding util for ghosts (Manhattan distance) ──────────────────
function dist(c1: number, r1: number, c2: number, r2: number) {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2)
}

function ghostNextDir(ghost: Ghost, grid: number[][], targetC: number, targetR: number): Dir {
  const dirs: Dir[] = [0, 1, 2, 3]
  let best: Dir | null = null
  let bestDist = Infinity

  for (const d of dirs) {
    if (d === OPPOSITE[ghost.dir]) continue  // no reversing
    const nc = (ghost.col + DX[d] + COLS) % COLS
    const nr = ghost.row + DY[d]
    if (nr < 0 || nr >= ROWS) continue
    const t = grid[nr]?.[nc]
    if (t === T.WALL || t === T.OUTSIDE) continue
    if (ghost.mode !== 'eaten' && t === T.GHOST_DOOR) continue
    const d2 = dist(nc, nr, targetC, targetR)
    if (d2 < bestDist) { bestDist = d2; best = d }
  }
  // No valid forward/perpendicular direction — allow reversal rather than
  // returning ghost.dir which may be a wall at the new tile.
  return best ?? OPPOSITE[ghost.dir]
}

function ghostFrightenedDir(ghost: Ghost, grid: number[][]): Dir {
  const dirs: Dir[] = [0, 1, 2, 3]
  const valid = dirs.filter((d) => {
    if (d === OPPOSITE[ghost.dir]) return false
    const nc = (ghost.col + DX[d] + COLS) % COLS
    const nr = ghost.row + DY[d]
    if (nr < 0 || nr >= ROWS) return false
    const t = grid[nr]?.[nc]
    return t !== T.WALL && t !== T.OUTSIDE && t !== T.GHOST_DOOR
  })
  if (valid.length === 0) return OPPOSITE[ghost.dir]
  // ponytail: deterministic seed from position+id — eliminates Math.random() desync
  return valid[(ghost.col * 31 + ghost.row * 997 + ghost.id * 7) % valid.length]
}

// ── Main update ──────────────────────────────────────────────────────────
export function update(state: GameState, dt: number, inputs: InputState): GameState {
  // clone top-level refs we'll mutate
  let s = { ...state }
  s.p1 = { ...s.p1 }
  s.p2 = { ...s.p2 }
  s.ghosts = s.ghosts.map((g) => ({ ...g }))

  if (s.phase === 'ready') {
    s.readyTimer -= dt
    if (s.readyTimer <= 0) { s.phase = 'playing'; s.message = '' }
    return s
  }
  if (s.phase !== 'playing') return s

  // ── Apply input ───────────────────────────────────────────────────────
  if (inputs.p1Dir !== null) s.p1.nextDir = inputs.p1Dir
  if (inputs.p2Dir !== null) s.p2.nextDir = inputs.p2Dir

  // ── Move players ─────────────────────────────────────────────────────
  s.p1 = movePlayer(s.p1, s.grid, dt, s.p2)
  s.p2 = movePlayer(s.p2, s.grid, dt, s.p1)

  // ── Animate mouths ───────────────────────────────────────────────────
  s.p1 = animateMouth(s.p1, dt)
  s.p2 = animateMouth(s.p2, dt)

  // ── Power pellet timers ───────────────────────────────────────────────
  if (s.p1.powered) {
    s.p1.powerTimer -= dt
    if (s.p1.powerTimer <= 0) s.p1 = { ...s.p1, powered: false, powerTimer: 0 }
  }
  if (s.p2.powered) {
    s.p2.powerTimer -= dt
    if (s.p2.powerTimer <= 0) s.p2 = { ...s.p2, powered: false, powerTimer: 0 }
  }

  // ── Collect dots ─────────────────────────────────────────────────────
  const { state: afterDots, pelletEaten } = collectDots(s)
  s = afterDots

  // ── Ghost mode schedule ───────────────────────────────────────────────
  if (s.modeScheduleIdx < MODE_SCHEDULE.length - 1) {
    s.modeTimer -= dt
    if (s.modeTimer <= 0) {
      s.modeScheduleIdx++
      s.modeTimer = MODE_SCHEDULE[s.modeScheduleIdx]
      const nextMode: GhostMode = s.modeScheduleIdx % 2 === 0 ? 'scatter' : 'chase'
      s.ghosts = s.ghosts.map((g) =>
        g.mode === 'frightened' || g.mode === 'eaten' ? g : { ...g, mode: nextMode }
      )
    }
  }

  // ── Move ghosts ───────────────────────────────────────────────────────
  s.ghosts = s.ghosts.map((g) => moveGhost(g, s.grid, s.p1, s.p2, dt))

  // ── Frightened ghost timers ───────────────────────────────────────────
  s.ghosts = s.ghosts.map((g) => {
    if (g.mode !== 'frightened') return g
    const timer = g.modeTimer - dt
    if (timer <= 0) {
      const base: GhostMode = s.modeScheduleIdx % 2 === 0 ? 'scatter' : 'chase'
      return { ...g, mode: base, modeTimer: 0 }
    }
    return { ...g, modeTimer: timer }
  })

  // ── Collisions ────────────────────────────────────────────────────────
  s = checkCollisions(s)

  // ── Frighten ghosts only on the frame a pellet is collected ──────────
  if (pelletEaten) {
    s.ghosts = s.ghosts.map((g) =>
      g.mode === 'eaten' ? g : { ...g, mode: 'frightened', modeTimer: POWER_DURATION }
    )
  }

  // ── Level complete ────────────────────────────────────────────────────
  if (s.phase === 'playing' && s.dotsLeft <= 0) {
    s = nextLevel(s)
  }

  return s
}

// ── Player movement ──────────────────────────────────────────────────────
function movePlayer(p: Player, grid: number[][], dt: number, other: Player): Player {
  const pixels = SPEED_PX_PER_MS * dt * TILE_F
  let { px, py, col, row, dir, nextDir } = p

  const centerX = col * TILE_F + TILE_F / 2
  const centerY = row * TILE_F + TILE_F / 2

  // Try to turn — only when the sprite is close enough to the tile center on
  // the cross-axis, then snap that axis so the sprite is never displaced into
  // an adjacent wall after the direction change.
  if (nextDir !== dir && canMove(grid, col, row, nextDir)) {
    const toVert = DY[nextDir] !== 0
    const aligned = toVert
      ? Math.abs(px - centerX) <= pixels + 1   // turning to vertical: check H offset
      : Math.abs(py - centerY) <= pixels + 1   // turning to horizontal: check V offset
    if (aligned) {
      if (toVert) px = centerX   // lock horizontal axis before moving vertically
      else        py = centerY   // lock vertical axis before moving horizontally
      dir = nextDir
    }
  }

  // Treat other player as a wall — check before any pixel movement to avoid jitter
  const targetCol = (col + DX[dir] + COLS) % COLS
  const targetRow = row + DY[dir]
  // A powered player can enter an unpowered opponent's tile (eating handled in checkCollisions)
  const blockedByOther = tileOccupied(other, targetCol, targetRow) && !(p.powered && !other.powered)
  if (canMove(grid, col, row, dir) && !blockedByOther) {
    px += DX[dir] * pixels
    py += DY[dir] * pixels

    // Tunnel wrap
    if (px < 0) px += COLS * TILE_F
    if (px >= COLS * TILE_F) px -= COLS * TILE_F

    const tcx = targetCol * TILE_F + TILE_F / 2
    const tcy = targetRow * TILE_F + TILE_F / 2

    const crossedX = DX[dir] !== 0 && (
      (DX[dir] > 0 && px >= tcx) || (DX[dir] < 0 && px <= tcx)
    )
    const crossedY = DY[dir] !== 0 && (
      (DY[dir] > 0 && py >= tcy) || (DY[dir] < 0 && py <= tcy)
    )

    if (crossedX || crossedY) {
      col = targetCol
      row = targetRow
      px = tcx
      py = tcy
    }
  } else {
    // Wall ahead — clamp to tile center so the sprite never overlaps a wall
    px = centerX
    py = centerY
  }

  return { ...p, px, py, col, row, dir }
}

function tileOccupied(other: Player, col: number, row: number): boolean {
  return other.alive && other.col === col && other.row === row
}

function animateMouth(p: Player, dt: number): Player {
  let { mouthAngle, mouthDir } = p
  mouthAngle += mouthDir * 0.007 * dt
  if (mouthAngle >= 0.4) mouthDir = -1
  if (mouthAngle <= 0.02) mouthDir = 1
  return { ...p, mouthAngle, mouthDir }
}

// ── Dot collection ────────────────────────────────────────────────────────
function collectDots(s: GameState): { state: GameState; pelletEaten: boolean } {
  const grid = s.grid.map((r) => [...r])
  let { p1, p2, dotsLeft } = s
  let pelletEaten = false

  const collect = (p: Player): [Player, number, boolean] => {
    const tile = grid[p.row]?.[p.col]
    if (tile === T.DOT) {
      grid[p.row][p.col] = T.EMPTY
      return [{ ...p, score: p.score + 10 }, 1, false]
    }
    if (tile === T.PELLET) {
      grid[p.row][p.col] = T.EMPTY
      return [{ ...p, score: p.score + 50, powered: true, powerTimer: POWER_DURATION }, 1, true]
    }
    return [p, 0, false]
  }

  const [np1, d1, pe1] = collect(p1)
  const [np2, d2, pe2] = collect(p2)
  pelletEaten = pe1 || pe2

  return { state: { ...s, grid, p1: np1, p2: np2, dotsLeft: dotsLeft - d1 - d2 }, pelletEaten }
}

// ── Ghost movement ────────────────────────────────────────────────────────
// Ghosts move in their committed `dir` and only pick a new direction when they
// reach the next tile centre. This prevents mid-tile direction changes that
// cause sprites to appear displaced into walls.
function moveGhost(g: Ghost, grid: number[][], p1: Player, p2: Player, dt: number): Ghost {
  const speed = g.mode === 'frightened' ? FRIGHTENED_SPEED : GHOST_SPEED
  // Cap to 90% of one tile to prevent skipping through thin walls on lag spikes
  const pixels = Math.min(speed * dt * TILE_F, TILE_F * 0.9)

  let { px, py, col, row, dir } = g

  // Resolve chase/scatter target (used when we pick a new dir at tile centre)
  let targetC: number, targetR: number
  if (g.mode === 'scatter') {
    ;[targetC, targetR] = g.scatterTarget
  } else if (g.mode === 'eaten') {
    ;[targetC, targetR] = [14, 11]
  } else {
    const d1 = p1.alive ? dist(g.col, g.row, p1.col, p1.row) : Infinity
    const d2 = p2.alive ? dist(g.col, g.row, p2.col, p2.row) : Infinity
    const target = d1 <= d2 ? p1 : p2
    targetC = target.col; targetR = target.row
  }

  // If the committed direction is blocked from the current tile (e.g. just
  // spawned facing a wall), pick immediately from the tile centre.
  if (!canMove(grid, col, row, dir) && g.mode !== 'eaten') {
    px = col * TILE_F + TILE_F / 2
    py = row * TILE_F + TILE_F / 2
    dir = g.mode === 'frightened'
      ? ghostFrightenedDir({ ...g, col, row, dir }, grid)
      : ghostNextDir({ ...g, col, row, dir }, grid, targetC, targetR)
  }

  // Move in committed direction
  px += DX[dir] * pixels
  py += DY[dir] * pixels

  // Tunnel wrap
  if (px < 0) px += COLS * TILE_F
  if (px >= COLS * TILE_F) px -= COLS * TILE_F

  const nextCol = (col + DX[dir] + COLS) % COLS
  const nextRow = Math.max(0, Math.min(ROWS - 1, row + DY[dir]))
  const tcx = nextCol * TILE_F + TILE_F / 2
  const tcy = nextRow * TILE_F + TILE_F / 2

  const crossedX = DX[dir] !== 0 && (
    (DX[dir] > 0 && px >= tcx) || (DX[dir] < 0 && px <= tcx)
  )
  const crossedY = DY[dir] !== 0 && (
    (DY[dir] > 0 && py >= tcy) || (DY[dir] < 0 && py <= tcy)
  )

  let mode = g.mode

  if (crossedX || crossedY) {
    // Snap to new tile centre
    col = nextCol
    row = nextRow
    px = col * TILE_F + TILE_F / 2
    py = row * TILE_F + TILE_F / 2

    // Check ghost-house arrival
    if (g.mode === 'eaten' && col === 14 && row === 11) {
      mode = 'scatter'
    }

    // Pick the next direction from the new tile centre
    dir = mode === 'frightened'
      ? ghostFrightenedDir({ ...g, col, row, dir, mode }, grid)
      : ghostNextDir({ ...g, col, row, dir, mode }, grid, targetC, targetR)

    // Safety: if chosen direction is still a wall (edge case after mode changes),
    // try the opposite, then any passable direction
    if (mode !== 'eaten' && !canMove(grid, col, row, dir)) {
      const rev = OPPOSITE[dir]
      if (canMove(grid, col, row, rev)) {
        dir = rev
      } else {
        const fallback = ([0, 1, 2, 3] as Dir[]).find((d) => canMove(grid, col, row, d))
        if (fallback !== undefined) dir = fallback
      }
    }
  }

  return { ...g, px, py, col, row, dir, mode }
}

// ── Collision detection ───────────────────────────────────────────────────
function checkCollisions(s: GameState): GameState {
  let { p1, p2, ghosts, phase, winner } = s

  // Player vs Player eating
  if (p1.alive && p2.alive && p1.col === p2.col && p1.row === p2.row) {
    if (p1.powered && !p2.powered) {
      p2 = { ...p2, alive: false }
      p1 = { ...p1, score: p1.score + 200 }
      phase = 'gameOver'; winner = 1
    } else if (p2.powered && !p1.powered) {
      p1 = { ...p1, alive: false }
      p2 = { ...p2, score: p2.score + 200 }
      phase = 'gameOver'; winner = 2
    }
    // both powered or neither → no eating
  }

  // Player vs Ghost
  const checkPlayerGhost = (p: Player, _otherP: Player, pNum: 1 | 2): [Player, Ghost[], GamePhase, 1 | 2 | null] => {
    let ghs = [...ghosts]
    let ph = phase
    let w = winner

    for (let i = 0; i < ghs.length; i++) {
      const g = ghs[i]
      if (g.col !== p.col || g.row !== p.row) continue
      if (g.mode === 'eaten') continue

      if (g.mode === 'frightened') {
        // Eat the ghost
        ghs[i] = { ...g, mode: 'eaten' }
        p = { ...p, score: p.score + 200 }
      } else {
        // Ghost eats player
        p = { ...p, alive: false }
        ph = 'gameOver'
        w = pNum === 1 ? 2 : 1
      }
    }
    return [p, ghs, ph, w]
  }

  if (p1.alive) {
    const [np1, ghs, ph, w] = checkPlayerGhost(p1, p2, 1)
    p1 = np1; ghosts = ghs; phase = ph; winner = w
  }
  if (p2.alive) {
    const [np2, ghs, ph, w] = checkPlayerGhost(p2, p1, 2)
    p2 = np2; ghosts = ghs; phase = ph; winner = w
  }

  return { ...s, p1, p2, ghosts, phase, winner }
}

// ── Level progression ─────────────────────────────────────────────────────
function nextLevel(s: GameState): GameState {
  const grid = buildMap()
  const level = s.level + 1
  return {
    ...s,
    grid,
    level,
    dotsLeft: countDots(grid),
    phase: 'ready',
    readyTimer: 2000,
    message: `LEVEL ${level}`,
    // reset positions but keep scores
    p1: { ...makePlayer(1, 9, 23), score: s.p1.score },
    p2: { ...makePlayer(2, 18, 23), score: s.p2.score },
    ghosts: initGame().ghosts,
    modeScheduleIdx: 0,
    modeTimer: MODE_SCHEDULE[0],
  }
}

// ── Next round (board reset, wins preserved) ──────────────────────────────
export function nextRound(s: GameState): GameState {
  const grid = buildMap()
  return {
    grid,
    phase: 'ready',
    level: s.level,
    dotsLeft: countDots(grid),
    p1: { ...makePlayer(1, 9, 23), score: s.p1.score },
    p2: { ...makePlayer(2, 18, 23), score: s.p2.score },
    ghosts: initGame().ghosts,
    winner: null,
    p1Wins: s.p1Wins,
    p2Wins: s.p2Wins,
    modeScheduleIdx: 0,
    modeTimer: MODE_SCHEDULE[0],
    readyTimer: 2000,
    message: 'READY!',
  }
}

// ── Input (server-side: no DOM) ───────────────────────────────────────────
export interface InputState {
  p1Dir: Dir | null
  p2Dir: Dir | null
}
