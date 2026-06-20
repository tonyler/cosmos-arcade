import { lazy, type ComponentType } from 'react'
import type { MatchContext } from '../plugins/types'

// ── Shared props contract every game component must satisfy ──────────────────
export interface GameProps {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

// ── Game registry ─────────────────────────────────────────────────────────────
// To add a new game: add one entry here. Nothing else needs to change.

export interface Game {
  slug: string
  title: string
  description: string
  category: 'Arcade' | 'Puzzle' | 'Action' | 'Strategy'
  players: string
  thumb?: string
  component: ComponentType<GameProps>
}

export const GAMES: Game[] = [
  {
    slug: 'pacman',
    title: 'Pac-Man',
    description: 'Most dots eaten in 90 seconds takes the wager. Ghosts are not your friends.',
    category: 'Arcade',
    players: '1–2P',
    thumb: '/hackathon/assets/games/pacman.jpeg',
    component: lazy(() => import('../games/pacman/PacManGame')),
  },
  {
    slug: 'shooter',
    title: 'Dead Zone',
    description: 'First to 10 kills takes the wager. WASD + mouse aim. No mercy.',
    category: 'Action',
    players: '1v1',
    thumb: '/hackathon/assets/games/shooter.jpeg',
    component: lazy(() => import('../games/shooter/ShooterGame')),
  },
]
