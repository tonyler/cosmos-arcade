import pacmanThumb from '../assets/games/pacman.svg'

export interface Game {
  slug: string
  title: string
  description: string
  category: 'Arcade' | 'Puzzle' | 'Action' | 'Strategy'
  players: string
  thumb?: string
}

export const GAMES: Game[] = [
  {
    slug: 'pacman',
    title: 'Pac-Man',
    description: 'Most dots eaten in 90 seconds takes the wager. Ghosts are not your friends.',
    category: 'Arcade',
    players: '1–2P',
    thumb: pacmanThumb,
  },
]
