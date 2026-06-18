import { GAMES } from '../lib/games'
import { useRouterStore } from '../store/routerStore'
import { useMatchStore } from '../store/matchStore'
import PacManGame from '../games/pacman/PacManGame'
import MatchGate from '../plugins/MatchGate'
import MatchSettler from '../plugins/MatchSettler'

interface Props { slug: string }

export default function GamePage({ slug }: Props) {
  const navigate = useRouterStore((s) => s.navigate)
  const game = GAMES.find((g) => g.slug === slug)
  const { phase, matchCtx, announceWinner } = useMatchStore()
  const ctx = matchCtx()

  const goBack = () => {
    useMatchStore.getState().reset()
    navigate(null)
  }

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-c-bg font-ui text-slate-200 overflow-y-auto">

      {/* Header — only visible once playing */}
      {phase === 'playing' && (
        <div className="w-full max-w-5xl px-6 pt-5 pb-2 flex items-center gap-3">
          <button onClick={goBack}
            className="font-px text-[8px] text-slate-400 hover:text-violet-400 tracking-widest transition-colors flex items-center gap-2">
            ← BACK
          </button>
          {game && (
            <>
              <span className="text-c-border">/</span>
              <span className="font-px text-[8px] text-slate-300 tracking-widest">{game.title.toUpperCase()}</span>
            </>
          )}
        </div>
      )}

      {/* Game area */}
      <div className="relative w-full max-w-5xl px-6 pb-10">
        {slug === 'pacman' ? (
          <PacManGame matchCtx={ctx ?? undefined} onWinner={announceWinner} />
        ) : (
          <ComingSoon game={game} />
        )}
        <MatchSettler />
      </div>

      <MatchGate gameSlug={slug} onClose={goBack} />
    </div>
  )
}

function ComingSoon({ game }: { game: ReturnType<typeof GAMES.find> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-32">
      <div className="text-6xl opacity-20">🕹</div>
      <div className="font-px text-[10px] text-slate-400 tracking-widest">COMING SOON</div>
      {game && <p className="text-sm text-slate-500 text-center max-w-xs">{game.description}</p>}
    </div>
  )
}
