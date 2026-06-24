import { send } from '../../ws/rooms'
import { initGame, update, nextRound, type Dir, type GameState } from './engine'
import { registerGame, type GamePlugin } from '../registry'

const TICK_MS = 20  // 50 fps

class PacManServerGame implements GamePlugin {
  private state: GameState
  private p1Queue: Dir[] = []
  private p2Queue: Dir[] = []
  private interval: ReturnType<typeof setInterval> | null = null
  private roundTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private matchId: string,
    private p1: string,
    private p2: string,
    private onOver: (winnerAddr: string) => void,
  ) {
    this.state = initGame()
  }

  handleInput(slot: 1 | 2, input: number) {
    if (slot === 1) this.p1Queue.push(input as Dir)
    else this.p2Queue.push(input as Dir)
  }

  start() {
    this.broadcast()
    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
    if (this.roundTimeout) { clearTimeout(this.roundTimeout); this.roundTimeout = null }
  }

  private tick() {
    const p1Dir = this.p1Queue.shift() ?? null
    const p2Dir = this.p2Queue.shift() ?? null
    this.state = update(this.state, TICK_MS, { p1Dir, p2Dir })
    this.broadcast()

    if (this.state.phase !== 'gameOver' || !this.state.winner) return
    if (this.interval) { clearInterval(this.interval); this.interval = null }

    const p1Wins = this.state.p1Wins + (this.state.winner === 1 ? 1 : 0)
    const p2Wins = this.state.p2Wins + (this.state.winner === 2 ? 1 : 0)
    this.state = { ...this.state, p1Wins, p2Wins }
    this.broadcast()

    if (p1Wins >= 3 || p2Wins >= 3) {
      const winnerAddr = this.state.winner === 1 ? this.p1 : this.p2
      this.onOver(winnerAddr)
    } else {
      this.roundTimeout = setTimeout(() => {
        this.state = nextRound(this.state)
        this.interval = setInterval(() => this.tick(), TICK_MS)
      }, 1500)
    }
  }

  private broadcast() {
    const data = { matchId: this.matchId, state: this.state }
    send(this.p1, 'game:state', data)
    send(this.p2, 'game:state', data)
  }
}

registerGame('pacman', (matchId, p1, p2, onOver) => new PacManServerGame(matchId, p1, p2, onOver))
