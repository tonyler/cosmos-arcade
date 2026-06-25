import type { Game } from '../../lib/games'
import { useRouterStore } from '../../store/routerStore'

interface Props {
  game: Game
  index: number
}


export default function GameCard({ game, index }: Props) {
  const navigate = useRouterStore((s) => s.navigate)
  return (
    <div
      className="group bg-c-surface border border-c-border cursor-pointer
        hover:border-violet-600/70 transition-all duration-150 animate-fade-up
        flex flex-row md:flex-col md:hover:-translate-y-1"
      style={{ animationDelay: `${index * 0.055}s` }}
      onClick={() => navigate(game.slug)}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-c-panel flex-shrink-0
        w-32 self-stretch md:w-full md:aspect-video">
        {game.thumb ? (
          <img
            src={game.thumb}
            alt={game.title}
            className="absolute inset-0 w-full h-full object-cover"
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
            <span className="hidden md:block font-mono text-xs text-slate-700 tracking-wide">
              /assets/games/{game.slug}.jpg
            </span>
          </div>
        )}

        {/* Hover play overlay — desktop only */}
        <div className="absolute inset-0 hidden md:flex items-center justify-center
          bg-violet-950/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <span className="font-px text-[9px] text-white tracking-[0.2em]">▶  PLAY</span>
        </div>

        {/* Players badge — desktop only */}
        <span className="hidden md:block absolute top-2 right-2 font-mono text-[10px]
          text-slate-400 bg-c-panel/80 border border-c-border px-2 py-0.5">
          {game.players}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-3 md:px-4 md:pt-3 md:pb-4
        border-l border-c-border md:border-l-0 md:border-t
        flex flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-px text-[9px] text-slate-100 leading-relaxed tracking-wide">
              {game.title}
            </h3>
            <span className="md:hidden font-mono text-[9px] text-slate-500 tracking-wide">
              {game.players}
            </span>
          </div>
          <button
            className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 bg-violet-700 text-white
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
        <p className="text-xs md:text-sm text-slate-500 leading-snug line-clamp-2 md:line-clamp-none">
          {game.description}
        </p>
      </div>
    </div>
  )
}
