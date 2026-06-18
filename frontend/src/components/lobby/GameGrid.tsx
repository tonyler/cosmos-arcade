import { GAMES } from '../../lib/games'
import GameCard from './GameCard'

export default function GameGrid() {
  return (
    <div className="px-7 py-7">
      {/* Section header */}
      <div className="flex items-baseline gap-4 mb-6">
        <h1 className="font-px text-[11px] text-slate-100 tracking-wide">All Games</h1>
      </div>

      {/* Grid */}
      <div className="grid gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {GAMES.map((game, i) => (
          <GameCard key={game.slug} game={game} index={i} />
        ))}
      </div>
    </div>
  )
}
