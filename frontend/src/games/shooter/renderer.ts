import type { ShooterState } from './engine'
import { ARENA_W, ARENA_H, PLAYER_RADIUS, BULLET_RADIUS, WALLS, RESPAWN_TIME } from './engine'

const P1_COLOR = '#00d4ff'   // cyan
const P2_COLOR = '#ff6b35'   // orange
const WALL_COLOR = '#1e2a3a'
const WALL_BORDER = '#2d4a6e'
const BG_COLOR = '#0a0e14'
const FLOOR_COLOR = '#0d1117'

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  color: string,
  alive: boolean,
  respawnTimer: number,
): void {
  if (!alive) {
    // Ghost/dead indicator
    ctx.save()
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(Date.now() / 200)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    // Respawn countdown ring
    const pct = 1 - respawnTimer / RESPAWN_TIME
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(x, y, PLAYER_RADIUS + 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    return
  }

  // Body glow
  const grd = ctx.createRadialGradient(x, y, 2, x, y, PLAYER_RADIUS + 8)
  grd.addColorStop(0, color + '40')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(x, y, PLAYER_RADIUS + 8, 0, Math.PI * 2)
  ctx.fill()

  // Body
  ctx.fillStyle = color + 'cc'
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Aim direction indicator (barrel)
  const barrelLen = PLAYER_RADIUS + 10
  const barrelEnd = {
    x: x + Math.cos(angle) * barrelLen,
    y: y + Math.sin(angle) * barrelLen,
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6)
  ctx.lineTo(barrelEnd.x, barrelEnd.y)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // Center dot
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  // Glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, BULLET_RADIUS * 3)
  grd.addColorStop(0, color + 'cc')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(x, y, BULLET_RADIUS * 3, 0, Math.PI * 2)
  ctx.fill()

  // Core
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, BULLET_RADIUS, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, BULLET_RADIUS - 1, 0, Math.PI * 2)
  ctx.fill()
}

export function render(ctx: CanvasRenderingContext2D, state: ShooterState, mySlot: 1 | 2): void {
  const { myPlayer, oppPlayer, myBullets, oppBullets, phase, winner, message, readyTimer } = state
  const myColor = mySlot === 1 ? P1_COLOR : P2_COLOR
  const oppColor = mySlot === 1 ? P2_COLOR : P1_COLOR

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)

  // Floor grid (subtle)
  ctx.strokeStyle = FLOOR_COLOR
  ctx.lineWidth = 1
  const gridSize = 40
  for (let x = 0; x < ARENA_W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke()
  }
  for (let y = 0; y < ARENA_H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke()
  }

  // Arena border glow
  ctx.strokeStyle = '#1a3050'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, ARENA_W - 4, ARENA_H - 4)

  // ── Walls ─────────────────────────────────────────────────────────────────
  for (const w of WALLS) {
    // Shadow
    ctx.fillStyle = '#000000aa'
    ctx.fillRect(w.x + 3, w.y + 3, w.w, w.h)
    // Body
    ctx.fillStyle = WALL_COLOR
    ctx.fillRect(w.x, w.y, w.w, w.h)
    // Border
    ctx.strokeStyle = WALL_BORDER
    ctx.lineWidth = 1.5
    ctx.strokeRect(w.x, w.y, w.w, w.h)
    // Top edge highlight
    ctx.strokeStyle = '#3a5a7a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w.x, w.y)
    ctx.lineTo(w.x + w.w, w.y)
    ctx.stroke()
  }

  // ── Spawn markers (faint) ─────────────────────────────────────────────────
  const drawSpawn = (x: number, y: number, color: string) => {
    ctx.strokeStyle = color + '30'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.arc(x, y, PLAYER_RADIUS + 4, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
  }
  drawSpawn(mySlot === 1 ? 72 : 568, 240, myColor)
  drawSpawn(mySlot === 1 ? 568 : 72, 240, oppColor)

  // ── Bullets ───────────────────────────────────────────────────────────────
  for (const b of oppBullets) drawBullet(ctx, b.x, b.y, oppColor)
  for (const b of myBullets) drawBullet(ctx, b.x, b.y, myColor)

  // ── Players ───────────────────────────────────────────────────────────────
  drawPlayer(ctx, oppPlayer.x, oppPlayer.y, oppPlayer.angle, oppColor, oppPlayer.alive, oppPlayer.respawnTimer)
  drawPlayer(ctx, myPlayer.x, myPlayer.y, myPlayer.angle, myColor, myPlayer.alive, myPlayer.respawnTimer)

  // ── Overlay messages ──────────────────────────────────────────────────────
  if (phase === 'ready' && message) {
    const pct = 1 - readyTimer / 3000
    ctx.fillStyle = `rgba(0,0,0,${0.5 * pct})`
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const countdownNum = Math.ceil(readyTimer / 1000)
    ctx.fillText(countdownNum > 0 ? String(countdownNum) : 'GO!', ARENA_W / 2, ARENA_H / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  if (phase === 'gameOver') {
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    const color = winner === mySlot ? myColor : oppColor
    ctx.fillStyle = color
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(message ?? 'GAME OVER', ARENA_W / 2, ARENA_H / 2 - 20)
    ctx.fillStyle = '#ffffff88'
    ctx.font = '16px monospace'
    ctx.fillText(`${myPlayer.kills} — ${oppPlayer.kills}`, ARENA_W / 2, ARENA_H / 2 + 20)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }
}
