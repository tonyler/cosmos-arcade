// Canvas renderer for 2P Pac-Man
import { TILE, COLS, ROWS, T, type GameState, type Player, type Ghost } from './engine'

const WALL_COLOR = '#1a1aff'
const DOT_COLOR = '#ffb8ae'
const BG = '#000000'

// Player colors
const P1_COLOR = '#ffe000'   // yellow
const P2_COLOR = '#00d4ff'   // cyan

export function render(ctx: CanvasRenderingContext2D, state: GameState) {
  const { grid, p1, p2, ghosts, phase, winner, message, readyTimer } = state

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE)

  drawMaze(ctx, grid)
  drawDots(ctx, grid)

  if (phase !== 'ready' || readyTimer < 2500) {
    ghosts.forEach((g) => drawGhost(ctx, g, state))
  }

  if (p1.alive) drawPlayer(ctx, p1, P1_COLOR)
  if (p2.alive) drawPlayer(ctx, p2, P2_COLOR)

  if (message) drawCenteredText(ctx, message, 18, '#ffffff')
  if (phase === 'gameOver' && winner) {
    const color = winner === 1 ? P1_COLOR : P2_COLOR
    const label = `PLAYER ${winner} WINS!`
    drawCenteredText(ctx, label, 20, color, ROWS * TILE / 2 + 24)
  }
}

// ── Maze walls ────────────────────────────────────────────────────────────
function drawMaze(ctx: CanvasRenderingContext2D, grid: number[][]) {
  ctx.fillStyle = WALL_COLOR
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c]
      if (t === T.WALL) {
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE)
      }
    }
  }
  // Ghost door
  ctx.strokeStyle = '#ffb8ff'
  ctx.lineWidth = 2
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === T.GHOST_DOOR) {
        ctx.strokeRect(c * TILE + 1, r * TILE + TILE / 2 - 1, TILE - 2, 2)
      }
    }
  }
}

// ── Dots and pellets ─────────────────────────────────────────────────────
function drawDots(ctx: CanvasRenderingContext2D, grid: number[][]) {
  const now = Date.now()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c]
      const cx = c * TILE + TILE / 2
      const cy = r * TILE + TILE / 2
      if (t === T.DOT) {
        ctx.fillStyle = DOT_COLOR
        ctx.beginPath()
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      } else if (t === T.PELLET) {
        // pulsing
        const alpha = 0.5 + 0.5 * Math.sin(now / 300)
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,184,174,${alpha})`
        ctx.fill()
      }
    }
  }
}

// ── Player (pac-man mouth) ────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, color: string) {
  const cx = p.px
  const cy = p.py
  const r = TILE / 2 - 1

  // Rotation based on direction: 0=UP,1=RIGHT,2=DOWN,3=LEFT
  const angles = [
    -Math.PI / 2,   // UP
    0,              // RIGHT
    Math.PI / 2,    // DOWN
    Math.PI,        // LEFT
  ]
  const angle = angles[p.dir] ?? 0
  const mouth = p.mouthAngle

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Powered glow
  if (p.powered) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Eye
  const eyeOffX = Math.cos(angle - Math.PI / 4) * r * 0.5
  const eyeOffY = Math.sin(angle - Math.PI / 4) * r * 0.5
  ctx.beginPath()
  ctx.arc(cx + eyeOffX, cy + eyeOffY, 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
}

// ── Ghost ────────────────────────────────────────────────────────────────
function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, _state: GameState) {
  const cx = g.px
  const cy = g.py
  const r = TILE / 2 - 1
  const now = Date.now()

  let color = g.color
  if (g.mode === 'frightened') {
    // Flash white when about to expire
    const nearEnd = g.modeTimer < 2000 && Math.floor(now / 250) % 2 === 0
    color = nearEnd ? '#ffffff' : '#0000ff'
  }
  if (g.mode === 'eaten') {
    // Just draw eyes
    drawGhostEyes(ctx, cx, cy)
    return
  }

  // Body
  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.15, r, 0, Math.PI, true)
  // Wavy bottom
  const segments = 3
  const segW = (r * 2) / segments
  for (let i = 0; i < segments; i++) {
    const x1 = cx - r + i * segW
    const x2 = x1 + segW / 2
    const x3 = x1 + segW
    const bottomY = cy + r * 0.85
    const midY = i % 2 === 0 ? bottomY - r * 0.3 : bottomY
    ctx.quadraticCurveTo(x2, midY, x3, bottomY)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  if (g.mode !== 'frightened') {
    drawGhostEyes(ctx, cx, cy - r * 0.1)
  } else {
    // Scared face
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - r * 0.35, cy - r * 0.1, 2, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.35, cy - r * 0.1, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGhostEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const eyeRadius = 3
  const pupilRadius = 1.5
  // White
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx - 3, cy - 2, eyeRadius, 0, Math.PI * 2)
  ctx.arc(cx + 3, cy - 2, eyeRadius, 0, Math.PI * 2)
  ctx.fill()
  // Pupil
  ctx.fillStyle = '#0000aa'
  ctx.beginPath()
  ctx.arc(cx - 3, cy - 1, pupilRadius, 0, Math.PI * 2)
  ctx.arc(cx + 3, cy - 1, pupilRadius, 0, Math.PI * 2)
  ctx.fill()
}

// ── Centered text ─────────────────────────────────────────────────────────
function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, size: number, color: string, y?: number) {
  const cy = y ?? ROWS * TILE / 2
  ctx.font = `bold ${size}px "Press Start 2P", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#000000'
  ctx.fillText(text, COLS * TILE / 2 + 2, cy + 2)
  ctx.fillStyle = color
  ctx.fillText(text, COLS * TILE / 2, cy)
}
