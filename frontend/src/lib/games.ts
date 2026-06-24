import { lazy, type ComponentType } from 'react'
import type { MatchContext } from '../types/match'

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
  comingSoon?: boolean
  serverAuthoritative: boolean  // true = server drives settlement; client onWinner is a no-op
  component: ComponentType<GameProps>
}

export const GAMES: Game[] = [
  {
    slug: 'arena3d',
    title: 'Void Arena',
    description: 'First to 5 kills in a 3D neon arena. WASD + mouse aim. Wager your ATOM.',
    category: 'Action',
    players: '1v1',
    thumb: '/hackathon/assets/games/arena3d.svg',
    serverAuthoritative: false,
    component: lazy(() => import('../games/arena3d/Arena3DGame')),
  },
  {
    slug: 'pacman',
    title: 'Pac-Man',
    description: 'Most dots eaten in 90 seconds takes the wager. Ghosts are not your friends.',
    category: 'Arcade',
    players: '1–2P',
    thumb: '/hackathon/assets/games/pacman.jpg',
    serverAuthoritative: true,
    component: lazy(() => import('../games/pacman/PacManGame')),
  },
]
