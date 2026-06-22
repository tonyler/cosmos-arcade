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
  component: ComponentType<GameProps>
}

export const GAMES: Game[] = [
  {
    slug: 'snake',
    title: 'Snake Duel',
    description: 'Eat atoms to grow. Outlast your opponent. First to crash loses the wager.',
    category: 'Arcade',
    players: '1v1',
    thumb: '/hackathon/assets/games/snake.jpg',
    comingSoon: true,
    component: lazy(() => import('../games/snake/SnakeGame')),
  },
  {
    slug: 'retro-fps',
    title: 'Retro FPS',
    description: 'Classic raycasting deathmatch. First to 10 frags wins. WASD + mouse look.',
    category: 'Action',
    players: '1v1',
    thumb: '/hackathon/assets/games/retro-fps.svg',
    comingSoon: true,
    component: lazy(() => import('../games/retro-fps/RetroFPSGame')),
  },
  {
    slug: 'arena3d',
    title: 'Void Arena',
    description: 'First to 5 kills in a 3D neon arena. WASD + mouse aim. Wager your ATOM.',
    category: 'Action',
    players: '1v1',
    thumb: '/hackathon/assets/games/arena3d.jpg',
    component: lazy(() => import('../games/arena3d/Arena3DGame')),
  },
  {
    slug: 'pacman',
    title: 'Pac-Man',
    description: 'Most dots eaten in 90 seconds takes the wager. Ghosts are not your friends.',
    category: 'Arcade',
    players: '1–2P',
    thumb: '/hackathon/assets/games/pacman.jpg',
    component: lazy(() => import('../games/pacman/PacManGame')),
  },
]
