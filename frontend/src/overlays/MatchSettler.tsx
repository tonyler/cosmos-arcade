import { useMatchStore } from '../store/matchStore'
import { truncate, toDisplay, DENOM_LABEL } from '../lib/format'

export default function MatchSettler() {
  const { phase, gameMode, winner, myAddress, iAmWinner, amount, denom, matchId, txHash, opponentDisconnected, reset } = useMatchStore()

  const isCasual = gameMode === 'casual'
  const iWon = iAmWinner ?? (winner === myAddress)
  const payout = amount ? toDisplay(String(Number(amount) * 2)) : '?'
  const symbol = denom ? (DENOM_LABEL[denom] ?? denom) : ''

  if (phase === 'playing' && opponentDisconnected) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3
        bg-amber-900/90 border border-amber-700 px-4 py-2 backdrop-blur-sm">
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shrink-0" />
        <span className="font-px text-[8px] text-amber-300 tracking-widest">OPPONENT DISCONNECTED — WAITING 10s...</span>
      </div>
    )
  }

  if (phase === 'disputed') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90">
        <div className="flex flex-col items-center gap-5 text-center px-8 max-w-sm">
          <div className="font-px text-[11px] text-amber-400 tracking-widest">MATCH DISPUTED</div>
          <p className="font-mono text-xs text-slate-400 leading-relaxed">
            Both players reported different winners. Your funds are held safely on-chain pending review.
            Contact support with your match ID.
          </p>
          {matchId && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Match ID</span>
              <span className="font-mono text-xs text-slate-300 select-all">{matchId}</span>
            </div>
          )}
          <button onClick={reset}
            className="font-px text-[8px] text-white bg-slate-700 hover:bg-slate-600
              px-8 py-3 border border-slate-600 tracking-widest transition-colors">
            BACK TO LOBBY
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'settlement_failed') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90">
        <div className="flex flex-col items-center gap-5 text-center px-8 max-w-sm">
          <div className="font-px text-[11px] text-red-400 tracking-widest">SETTLEMENT FAILED</div>
          <p className="font-mono text-xs text-slate-400 leading-relaxed">
            Your funds are safe on-chain. The transaction failed but the contract holds both deposits.
            Contact support with your match ID.
          </p>
          {matchId && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Match ID</span>
              <span className="font-mono text-xs text-slate-300 select-all">{matchId}</span>
            </div>
          )}
          <button onClick={reset}
            className="font-px text-[8px] text-white bg-slate-700 hover:bg-slate-600
              px-8 py-3 border border-slate-600 tracking-widest transition-colors">
            BACK TO LOBBY
          </button>
        </div>
      </div>
    )
  }

  if (phase !== 'settling' && phase !== 'complete') return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85">
      {phase === 'settling' && !isCasual && iWon ? (
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          <span className="font-px text-[9px] text-slate-400 tracking-widest">SETTLING ON-CHAIN...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center px-8">
          <div className="font-px text-[14px] tracking-widest" style={{ color: iWon ? '#ffe000' : '#ef4444' }}>
            {iWon ? 'YOU WIN!' : 'YOU LOSE'}
          </div>
          {iWon && !isCasual && amount && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">Payout</span>
              <span className="font-px text-[11px] text-violet-300">{payout} {symbol}</span>
            </div>
          )}
          {(isCasual || !iWon) && (
            <div className="font-mono text-xs text-slate-500 tracking-wider">GG!</div>
          )}
          {iWon && txHash && (
            <a
              href={`https://www.mintscan.io/cosmos/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
            >
              {txHash.slice(0, 16)}… ↗
            </a>
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
