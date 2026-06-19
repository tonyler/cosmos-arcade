// Canvas renderer for 2P Pac-Man
import { TILE, COLS, ROWS, T, type GameState, type Player, type Ghost } from './engine'

const WALL_COLOR = '#1a1aff'
const DOT_COLOR  = '#ffb8ae'
const BG         = '#000000'

// ── Sprite sheet ─────────────────────────────────────────────────────────────
// Sheet: 1000×750 RGBA — Pac-Man + ghosts sprite sheet
// Grid: 16×16 sprites with 1px magenta borders (17px step)
//
// Column palette starts (x): 1, 201, 401, 601, 801  (separated by 4px borders at 197,397,597,797)
// Row sections (large 16px sprites):
//   Section 1 large:  y = 83  (4 directions × 2 frames = 8 ghost sprites per palette)
//   Section 2 large:  y = 269 (ghosts + Pac-Man movement rows)
//     row 0 = y=269, row 1 = y=286, row 2 = y=303, row 3 = y=320, row 4 = y=337, row 5 = y=354
//
// Ghost colors (palette col × row 0 of section 1, y=83):
//   Blinky (red)  palette 0 x=1
//   Pinky  (pink) palette 1 x=201
//   Inky   (cyan) palette 2 x=401
//   Clyde  (orng) palette 3 x=601
//   Layout: [right_f0][right_f1][left_f0][left_f1][up_f0][up_f1][down_f0][down_f1]
//
// Pac-Man (section 2 for P1, section 3 for P2):
//   P1 yellow: palette 2 x=401  — cols 6,7 → x=503,520
//   P2 orange: palette 4 x=801  — cols 6,7 → x=903,920  (section 3: y+456)
//   col 6 = facing RIGHT,  col 7 = facing DOWN (arch opens downward!)
//   LEFT = flip RIGHT horizontally, UP = flip DOWN vertically
//   P1: row3(y=320)=open, row4(y=337)=half, row5col6(y=354)=closed
//   P2: row3(y=506)=open, row4(y=523)=half, row5col6(y=540)=closed
//
// Frightened ghost: palette 3 section 2 row 0 (y=269, x=601) — blue ghost
// Flashing frightened: palette 4 section 2 row 0 (y=269, x=801) — lavender ghost
// Eaten (eyes only):  palette 1 section 2 row 0 (y=269, x=201)

let _sheet: HTMLImageElement | null = null
let _sheetReady = false

function getSheet(): HTMLImageElement | null {
  if (_sheetReady) return _sheet
  _sheetReady = true
  const img = new Image()
  img.src = import.meta.env.BASE_URL + 'pacman-sprites.png'
  img.onload = () => { _sheet = img }
  img.onerror = () => { _sheet = null }
  return null
}

// Pre-load as soon as the module is imported
getSheet()

// ── Sprite drawing helpers ───────────────────────────────────────────────────

function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number, sy: number,
  dx: number, dy: number,
  flipX = false, flipY = false,
) {
  if (!flipX && !flipY) {
    ctx.drawImage(img, sx, sy, 16, 16, dx, dy, TILE, TILE)
    return
  }
  ctx.save()
  ctx.translate(dx + (flipX ? TILE : 0), dy + (flipY ? TILE : 0))
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.drawImage(img, sx, sy, 16, 16, 0, 0, TILE, TILE)
  ctx.restore()
}

// Ghost sprite x-start per color
const GHOST_PAL: Record<string, number> = {
  '#ff0000': 1,    // Blinky — red   — palette 0
  '#ffb8ff': 201,  // Pinky  — pink  — palette 1
  '#00ffff': 401,  // Inky   — cyan  — palette 2
  '#ffb852': 601,  // Clyde  — orng  — palette 3
}

// Ghost direction → col offset in sprite row (each col is 17px wide)
// Layout verified pixel-by-pixel from eye pupil positions:
//   cols 0-1 = RIGHT, cols 2-3 = DOWN, cols 4-5 = LEFT, cols 6-7 = UP
const GHOST_DIR_COL: Record<number, number> = {
  1: 0,   // RIGHT → cols 0-1
  2: 2,   // DOWN  → cols 2-3
  3: 4,   // LEFT  → cols 4-5
  0: 6,   // UP    → cols 6-7
}

// ── Public render function ───────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState) {
  const { grid, p1, p2, ghosts, phase, winner, message, readyTimer } = state

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE)

  drawMaze(ctx, grid)
  drawDots(ctx, grid)

  if (phase !== 'ready' || readyTimer < 2500) {
    ghosts.forEach((g) => drawGhost(ctx, g, state))
  }

  if (p1.alive) drawPlayer(ctx, p1, 1)
  if (p2.alive) drawPlayer(ctx, p2, 2)

  if (message) drawCenteredText(ctx, message, 18, '#ffffff')
  if (phase === 'gameOver' && winner) {
    const color = winner === 1 ? '#ffe000' : '#ff8c00'
    drawCenteredText(ctx, `PLAYER ${winner} WINS!`, 20, color, ROWS * TILE / 2 + 24)
  }
}

// ── Maze walls ────────────────────────────────────────────────────────────────

function drawMaze(ctx: CanvasRenderingContext2D, grid: number[][]) {
  ctx.fillStyle = WALL_COLOR
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === T.WALL) ctx.fillRect(c * TILE, r * TILE, TILE, TILE)
    }
  }
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

// ── Dots and pellets ──────────────────────────────────────────────────────────

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
        const alpha = 0.5 + 0.5 * Math.sin(now / 300)
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,184,174,${alpha})`
        ctx.fill()
      }
    }
  }
}

// ── Player (Pac-Man) ──────────────────────────────────────────────────────────

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, playerNum: 1 | 2) {
  const img = _sheet
  const dx = p.px - TILE / 2
  const dy = p.py - TILE / 2

  if (img) {
    drawPlayerSprite(ctx, img, p, playerNum, dx, dy)
  } else {
    drawPlayerFallback(ctx, p, playerNum)
  }

  // Powered glow ring
  if (p.powered) {
    const color = playerNum === 1 ? '#ffe000' : '#ff8c00'
    ctx.beginPath()
    ctx.arc(p.px, p.py, TILE / 2 + 3, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

// Sprite layout per player
const PAC_CONFIG = {
  1: { palX: 401, openY: 320, halfY: 337, closedY: 354 },  // yellow — section 2
  2: { palX: 801, openY: 506, halfY: 523, closedY: 540 },  // orange — section 3
}

function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  p: Player,
  playerNum: 1 | 2,
  dx: number,
  dy: number,
) {
  const { palX, openY, halfY, closedY } = PAC_CONFIG[playerNum]

  // Pick source row based on mouth angle
  let srcY: number
  if (p.mouthAngle > 0.25) {
    srcY = openY
  } else if (p.mouthAngle > 0.08) {
    srcY = halfY
  } else {
    srcY = closedY
  }

  // When mouth is closed, use the full circle (col 6) — direction doesn't matter
  if (srcY === closedY) {
    drawSprite(ctx, img, palX + 102, closedY, dx, dy)
    return
  }

  // Open/half-open: dir: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
  // col 6 (palX+102) = facing RIGHT
  // col 7 (palX+119) = facing DOWN (arch opens downward)
  // LEFT = flip RIGHT horizontally, UP = flip DOWN vertically
  switch (p.dir) {
    case 1: // RIGHT
      drawSprite(ctx, img, palX + 102, srcY, dx, dy)
      break
    case 3: // LEFT — mirror RIGHT
      drawSprite(ctx, img, palX + 102, srcY, dx, dy, true, false)
      break
    case 2: // DOWN
      drawSprite(ctx, img, palX + 119, srcY, dx, dy)
      break
    case 0: // UP — mirror DOWN vertically
      drawSprite(ctx, img, palX + 119, srcY, dx, dy, false, true)
      break
    default:
      drawSprite(ctx, img, palX + 102, srcY, dx, dy)
  }
}

function drawPlayerFallback(ctx: CanvasRenderingContext2D, p: Player, playerNum: 1 | 2) {
  const color = playerNum === 1 ? '#ffe000' : '#00d4ff'
  const cx = p.px
  const cy = p.py
  const r = TILE / 2 - 1
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
  const angle = angles[p.dir] ?? 0
  const mouth = p.mouthAngle
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  const eyeOffX = Math.cos(angle - Math.PI / 4) * r * 0.5
  const eyeOffY = Math.sin(angle - Math.PI / 4) * r * 0.5
  ctx.beginPath()
  ctx.arc(cx + eyeOffX, cy + eyeOffY, 1.5, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
}

// ── Ghost ────────────────────────────────────────────────────────────────────

function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, _state: GameState) {
  const img = _sheet
  const dx = g.px - TILE / 2
  const dy = g.py - TILE / 2

  if (img) {
    drawGhostSprite(ctx, img, g, dx, dy)
  } else {
    drawGhostFallback(ctx, g)
  }
}

function drawGhostSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  g: Ghost,
  dx: number,
  dy: number,
) {
  const frame = Math.floor(Date.now() / 200) % 2  // 0 or 1, animates at 5fps
  const dirCol = GHOST_DIR_COL[g.dir] ?? 0

  if (g.mode === 'eaten') {
    // Eyes only: palette 1 section 2 row 0 (y=269, x=201)
    // Same direction layout as normal ghosts
    const sx = 201 + (dirCol + frame) * 17
    drawSprite(ctx, img, sx, 269, dx, dy)
    return
  }

  if (g.mode === 'frightened') {
    const now = Date.now()
    const nearEnd = g.modeTimer < 2000 && Math.floor(now / 250) % 2 === 0
    if (nearEnd) {
      // Flashing: palette 4 section 2 row 0 (y=269, x=801)
      const sx = 801 + frame * 17
      drawSprite(ctx, img, sx, 269, dx, dy)
    } else {
      // Frightened: palette 3 section 2 row 0 (y=269, x=601) — blue ghost
      const sx = 601 + frame * 17
      drawSprite(ctx, img, sx, 269, dx, dy)
    }
    return
  }

  // Normal ghost: section 1 large block y=83
  const palX = GHOST_PAL[g.color] ?? 1
  const sx = palX + (dirCol + frame) * 17
  drawSprite(ctx, img, sx, 83, dx, dy)
}

function drawGhostFallback(ctx: CanvasRenderingContext2D, g: Ghost) {
  const cx = g.px
  const cy = g.py
  const r = TILE / 2 - 1
  const now = Date.now()

  let color = g.color
  if (g.mode === 'frightened') {
    const nearEnd = g.modeTimer < 2000 && Math.floor(now / 250) % 2 === 0
    color = nearEnd ? '#ffffff' : '#0000ff'
  }
  if (g.mode === 'eaten') {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - 3, cy - 2, 3, 0, Math.PI * 2)
    ctx.arc(cx + 3, cy - 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0000aa'
    ctx.beginPath()
    ctx.arc(cx - 3, cy - 1, 1.5, 0, Math.PI * 2)
    ctx.arc(cx + 3, cy - 1, 1.5, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.15, r, 0, Math.PI, true)
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
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - 3, cy - r * 0.1 - 2, 3, 0, Math.PI * 2)
    ctx.arc(cx + 3, cy - r * 0.1 - 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0000aa'
    ctx.beginPath()
    ctx.arc(cx - 3, cy - r * 0.1 - 1, 1.5, 0, Math.PI * 2)
    ctx.arc(cx + 3, cy - r * 0.1 - 1, 1.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - r * 0.35, cy - r * 0.1, 2, 0, Math.PI * 2)
    ctx.arc(cx + r * 0.35, cy - r * 0.1, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Centered text ─────────────────────────────────────────────────────────────

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
