import { useMatchStore } from '../store/matchStore'
import { truncate, toDisplay } from '../lib/format'

export default function MatchSettler() {
  const { phase, winner, myAddress, amount, denom, reset } = useMatchStore()

  if (phase !== 'settling' && phase !== 'complete') return null

  const iWon = winner === myAddress
  const payout = amount ? toDisplay(String(Number(amount) * 2)) : '?'
  const symbol = denom === 'uatom' ? 'ATOM' : 'USDC'

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85">
      {phase === 'settling' ? (
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          <span className="font-px text-[9px] text-slate-400 tracking-widest">SETTLING ON-CHAIN...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center px-8">
          <div className="font-px text-[14px] tracking-widest" style={{ color: iWon ? '#ffe000' : '#ef4444' }}>
            {iWon ? 'YOU WIN!' : 'YOU LOSE'}
          </div>
          {iWon && amount && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Payout</span>
              <span className="font-px text-[11px] text-violet-300">{payout} {symbol}</span>
            </div>
          )}
          {winner && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Winner</span>
              <span className="font-mono text-sm text-slate-300">{truncate(winner)}</span>
            </div>
          )}
          <button onClick={reset}
            className="font-px text-[8px] text-white bg-violet-700 hover:bg-violet-600
              px-8 py-3 border border-violet-600 shadow-[0_3px_0_#3b0f8a]
              active:translate-y-[3px] active:shadow-none transition-all duration-75 tracking-widest">
            BACK TO LOBBY
          </button>
        </div>
      )}
    </div>
  )
}
