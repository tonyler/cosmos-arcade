import { Suspense } from 'react'
import { GAMES } from '../lib/games'
import { useRouterStore } from '../store/routerStore'
import { useMatchStore } from '../store/matchStore'
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

  const GameComponent = game?.component

  return (
    <div className="relative flex flex-col items-center justify-center h-full font-ui text-slate-200 overflow-hidden">

      {/* Background — same as landing page */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
        }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 55% at 18% 0%, rgba(109,40,217,0.18) 0%, transparent 65%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 65% 50% at 82% 105%, rgba(29,78,216,0.14) 0%, transparent 60%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(30,27,75,0.4) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.045) 3px, rgba(0,0,0,0.045) 4px)' }} />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5) 50%, transparent)' }} />
      </div>

      {/* Header — only visible once playing */}
      {phase === 'playing' && (
        <div className="w-full max-w-5xl px-4 md:px-6 pt-4 md:pt-5 pb-2 flex items-center gap-3">
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
      <div className="relative w-full flex justify-center px-2 md:px-6 overflow-hidden">
        <Suspense fallback={<GameLoader />}>
          {GameComponent
            ? <GameComponent matchCtx={ctx ?? undefined} onWinner={announceWinner} />
            : <ComingSoon game={game} />
          }
        </Suspense>
        <MatchSettler />
      </div>

      <MatchGate gameSlug={slug} onClose={goBack} />
    </div>
  )
}

function GameLoader() {
  return (
    <div className="flex items-center gap-2 py-32 text-slate-600">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
      <span className="font-mono text-xs tracking-widest">LOADING...</span>
    </div>
  )
}

function ComingSoon({ game }: { game: ReturnType<typeof GAMES.find> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 md:py-32">
      <div className="text-6xl opacity-20">🕹</div>
      <div className="font-px text-[10px] text-slate-400 tracking-widest">COMING SOON</div>
      {game && <p className="text-sm text-slate-500 text-center max-w-xs px-4">{game.description}</p>}
    </div>
  )
}
