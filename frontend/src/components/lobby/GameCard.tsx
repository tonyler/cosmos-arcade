import type { Game } from '../../lib/games'
import { useRouterStore } from '../../store/routerStore'

interface Props {
  game: Game
  index: number
}

const CATEGORY: Record<string, string> = {
  Arcade:   'text-amber-400   border-amber-500/30   bg-amber-500/10',
  Puzzle:   'text-cyan-400    border-cyan-500/30    bg-cyan-500/10',
  Action:   'text-red-400     border-red-500/30     bg-red-500/10',
  Strategy: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
}

export default function GameCard({ game, index }: Props) {
  const navigate = useRouterStore((s) => s.navigate)
  return (
    <div
      className="group bg-c-surface border border-c-border cursor-pointer
        hover:border-violet-600/70 hover:-translate-y-1
        transition-all duration-150 animate-fade-up"
      style={{ animationDelay: `${index * 0.055}s` }}
      onClick={() => navigate(game.slug)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-c-panel" style={{ aspectRatio: '16/9' }}>
        {game.thumb ? (
          <img
            src={game.thumb}
            alt={game.title}
            className="w-full h-full object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{
              backgroundColor: '#0c1422',
              backgroundImage: `
                linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          >
            <span className="text-4xl opacity-[0.18]">🕹</span>
            <span className="font-mono text-xs text-slate-700 tracking-wide">
              /assets/games/{game.slug}.jpg
            </span>
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center
          bg-violet-950/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <span className="font-px text-[9px] text-white tracking-[0.2em]">▶  PLAY</span>
        </div>

        {/* Category pill — top left */}
        <span className={`absolute top-2 left-2 font-mono text-[10px] font-bold
          px-2 py-0.5 border tracking-wider ${CATEGORY[game.category] ?? ''}`}>
          {game.category}
        </span>

        {/* Players — top right */}
        <span className="absolute top-2 right-2 font-mono text-[10px]
          text-slate-400 bg-c-panel/80 border border-c-border px-2 py-0.5">
          {game.players}
        </span>
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-4 border-t border-c-border">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-px text-[9px] text-slate-100 leading-relaxed tracking-wide">
            {game.title}
          </h3>
          <button
            className="flex-shrink-0 w-9 h-9 bg-violet-700 text-white
              flex items-center justify-center text-sm
              shadow-[0_3px_0_#3b0f8a]
              hover:bg-violet-600
              active:translate-y-[3px] active:shadow-none
              transition-all duration-75"
            onClick={(e) => { e.stopPropagation(); navigate(game.slug) }}
          >
            ▶
          </button>
        </div>
        <p className="text-sm text-slate-500 leading-snug">
          {game.description}
        </p>
      </div>
    </div>
  )
}
