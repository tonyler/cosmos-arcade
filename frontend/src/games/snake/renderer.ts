// Snake Duel renderer — uses sprite sheet from snake-sprites.jpg (1152×768)
//
// Sheet layout (3×2 panels, each 384×384):
//   [0,0] Green snake sprites    [384,0] Purple snake sprites   [768,0] Arena tiles
//   [0,384] Atom food             [384,384] UI elements          [768,384] Map example
//
// Each snake panel: 4×4 tile grid, title 43px, tile stride 93×84, tile size 88×80
// Arena panel: 3×3 tile grid, title 43px, tile stride 124×113, tile size 118×108

import type { GameState, Dir } from './engine'
import { GRID, CELL } from './engine'

export const CANVAS_W = GRID * CELL  // 480
export const CANVAS_H = GRID * CELL  // 480

type Point = { x: number; y: number }
type Src = [number, number, number, number]  // sx, sy, sw, sh

// ── Sprite sheet singleton ────────────────────────────────────────────────────

let _img: HTMLImageElement | null = null
let _ready = false

function sheet(): HTMLImageElement | null {
  if (!_img) {
    _img = new Image()
    _img.onload = () => { _ready = true }
    _img.src = '/hackathon/assets/games/snake-sprites.jpg'
  }
  return _ready ? _img : null
}

// ── Source rects in sheet ─────────────────────────────────────────────────────

// Snake sprite panels — 4×4 grid, tile stride 93×84, tile draw size 88×80
// title height 43px, left padding 5px
const S_OX = 5, S_OY = 43, S_COL = 93, S_ROW = 84, S_W = 88, S_H = 80

function snakeTile(col: number, row: number, panelX: number): Src {
  return [panelX + S_OX + col * S_COL, S_OY + row * S_ROW, S_W, S_H]
}

// per-player sprite sources
function sprites(panelX: number) {
  return {
    head:     snakeTile(0, 0, panelX),  // head facing RIGHT
    corner:   snakeTile(1, 0, panelX),  // curve open LEFT + BOTTOM
    tail:     snakeTile(0, 3, panelX),  // tail neck on LEFT, tip on RIGHT
    straight: snakeTile(1, 3, panelX),  // straight horizontal body
  }
}

const GREEN_SPRITES  = sprites(0)
const PURPLE_SPRITES = sprites(384)

// Floor tile: arena panel top-left (row=0, col=0)
const FLOOR_TILE: Src = [773, 43, 118, 108]

// Big atom: atom panel (x=0, y=384), centered atom excluding small atoms at bottom
const ATOM: Src = [22, 430, 340, 220]

// ── Rotation maps ─────────────────────────────────────────────────────────────

// Head reference: facing RIGHT. Rotate CW to other dirs.
const HEAD_ROT: Record<Dir, number> = {
  right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2,
}

// Tail reference: neck on LEFT, tip on RIGHT. neckDir = direction toward body[n-2].
const TAIL_ROT: Record<Dir, number> = {
  left: 0, up: Math.PI / 2, right: Math.PI, down: -Math.PI / 2,
}

// Corner reference: open LEFT + BOTTOM.
// aDir/bDir = directions toward adjacent segments.
function cornerRot(aDir: Dir, bDir: Dir): number {
  const h = (d: Dir) => aDir === d || bDir === d
  if (h('left')  && h('down'))  return 0              // reference
  if (h('up')    && h('left'))  return Math.PI / 2    // 90° CW
  if (h('right') && h('up'))    return Math.PI         // 180°
  if (h('down')  && h('right')) return -Math.PI / 2   // 270° CW
  return 0
}

// Straight reference: horizontal. Rotate 90° for vertical.
function straightRot(aDir: Dir): number {
  return aDir === 'up' || aDir === 'down' ? Math.PI / 2 : 0
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: Src,
  dx: number, dy: number, dw: number, dh: number,
  angle = 0,
): void {
  if (angle === 0) {
    ctx.drawImage(img, ...src, dx, dy, dw, dh)
    return
  }
  ctx.save()
  ctx.translate(dx + dw / 2, dy + dh / 2)
  ctx.rotate(angle)
  ctx.drawImage(img, ...src, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

function dirBetween(a: Point, b: Point): Dir {
  if (b.x > a.x) return 'right'
  if (b.x < a.x) return 'left'
  return b.y > a.y ? 'down' : 'up'
}

// ── Snake renderer ────────────────────────────────────────────────────────────

function drawSnake(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  snake: { body: Point[]; dir: Dir; alive: boolean },
  sp: ReturnType<typeof sprites>,
): void {
  const { body, dir, alive } = snake
  if (!body.length) return
  ctx.globalAlpha = alive ? 1 : 0.35

  for (let i = 0; i < body.length; i++) {
    const { x, y } = body[i]
    const dx = x * CELL, dy = y * CELL

    if (i === 0) {
      // HEAD — direction from neck toward head
      const headDir = body.length > 1 ? dirBetween(body[1], body[0]) : dir
      blit(ctx, img, sp.head, dx, dy, CELL, CELL, HEAD_ROT[headDir])

    } else if (i === body.length - 1) {
      // TAIL — neck direction toward body
      const neckDir = dirBetween(body[i], body[i - 1])
      blit(ctx, img, sp.tail, dx, dy, CELL, CELL, TAIL_ROT[neckDir])

    } else {
      // BODY — determine segment shape from neighbors
      const toHead = dirBetween(body[i], body[i - 1])
      const toTail = dirBetween(body[i], body[i + 1])
      const isH = (d: Dir) => d === 'left' || d === 'right'

      if (isH(toHead) === isH(toTail)) {
        // Straight segment
        blit(ctx, img, sp.straight, dx, dy, CELL, CELL, straightRot(toHead))
      } else {
        // Corner segment
        blit(ctx, img, sp.corner, dx, dy, CELL, CELL, cornerRot(toHead, toTail))
      }
    }
  }

  ctx.globalAlpha = 1
}

// ── Overlay helpers ───────────────────────────────────────────────────────────

function overlay(ctx: CanvasRenderingContext2D, text: string, size: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.font = `bold ${size}px monospace`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ── Main render ───────────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { snakes, food, phase, winner, readyTimer } = state
  const img = sheet()

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'

  // Background: tiled arena floor
  if (img) {
    const [sx, sy, sw, sh] = FLOOR_TILE
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        ctx.drawImage(img, sx, sy, sw, sh, c * CELL, r * CELL, CELL, CELL)
      }
    }
  } else {
    ctx.fillStyle = '#0a1628'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }

  // Scores (drawn early so snakes render on top)
  ctx.font = 'bold 12px monospace'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#5bc235'
  ctx.textAlign = 'left'
  ctx.fillText(`${snakes[0].score}`, 6, 5)
  ctx.fillStyle = '#9b35e8'
  ctx.textAlign = 'right'
  ctx.fillText(`${snakes[1].score}`, CANVAS_W - 6, 5)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // Food (atom sprites)
  for (const f of food) {
    if (img) {
      // Draw atom slightly larger than cell, centered
      const size = CELL * 1.6
      const off = (CELL - size) / 2
      blit(ctx, img, ATOM, f.x * CELL + off, f.y * CELL + off, size, size * (220 / 340))
    } else {
      ctx.fillStyle = '#00d4ff'
      ctx.beginPath()
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Snakes
  if (img) {
    drawSnake(ctx, img, snakes[0], GREEN_SPRITES)
    drawSnake(ctx, img, snakes[1], PURPLE_SPRITES)
  } else {
    // Fallback: solid colored blocks
    for (const [snake, color] of [[snakes[0], '#5bc235'], [snakes[1], '#9b35e8']] as const) {
      ctx.fillStyle = color
      ctx.globalAlpha = snake.alive ? 1 : 0.35
      for (const p of snake.body) ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2)
      ctx.globalAlpha = 1
    }
  }

  // Outer border glow
  ctx.strokeStyle = '#1e3050'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2)

  // Phase overlays
  if (phase === 'ready') {
    const secs = Math.ceil(readyTimer / 1000)
    overlay(ctx, secs > 0 ? String(secs) : 'GO!', 60, '#ffffff')
  } else if (phase === 'gameOver') {
    const label = winner === 1 ? 'P1 WINS!' : winner === 2 ? 'P2 WINS!' : 'DRAW'
    const color = winner === 1 ? '#5bc235' : winner === 2 ? '#9b35e8' : '#aaa'
    overlay(ctx, label, 40, color)
  }
}
