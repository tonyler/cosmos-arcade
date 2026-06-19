import { GAMES } from '../../lib/games'
import GameCard from './GameCard'

export default function GameGrid() {
  return (
    <div className="px-4 py-5 md:px-7 md:py-7">
      <div
        className="grid gap-4 md:gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}
      >
        {GAMES.map((game, i) => (
          <GameCard key={game.slug} game={game} index={i} />
        ))}
      </div>
    </div>
  )
}
