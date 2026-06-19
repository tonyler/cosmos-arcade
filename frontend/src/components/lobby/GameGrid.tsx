import { useState } from 'react'
import { GAMES } from '../../lib/games'
import GameCard from './GameCard'
import PublicMatchList from './PublicMatchList'

type Tab = 'games' | 'public'

export default function GameGrid() {
  const [tab, setTab] = useState<Tab>('games')

  return (
    <div className="px-4 py-5 md:px-7 md:py-7">
      {/* Tabs */}
      <div className="flex items-center gap-0 mb-5 md:mb-6 border-b border-c-border">
        <TabBtn label="All Games" active={tab === 'games'} onClick={() => setTab('games')} />
        <TabBtn label="Public Games" active={tab === 'public'} onClick={() => setTab('public')} />
      </div>

      {tab === 'games' && (
        <div
          className="grid gap-4 md:gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}
        >
          {GAMES.map((game, i) => (
            <GameCard key={game.slug} game={game} index={i} />
          ))}
        </div>
      )}

      {tab === 'public' && <PublicMatchList />}
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-px text-[8px] md:text-[9px] tracking-widest px-4 py-3 border-b-2 transition-colors
        ${active
          ? 'border-violet-500 text-violet-300'
          : 'border-transparent text-slate-500 hover:text-slate-300'}`}
    >
      {label.toUpperCase()}
    </button>
  )
}
