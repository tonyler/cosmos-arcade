import { useEffect, useState } from 'react'
import { useLobbyStore, type OpenMatch } from '../../store/lobbyStore'
import { useMatchStore } from '../../store/matchStore'
import { useRouterStore } from '../../store/routerStore'
import { useWalletStore } from '../../store/walletStore'
import { toDisplay, DENOM_LABEL } from '../../lib/format'
import { GAMES } from '../../lib/games'
import type { Denom } from '../../lib/escrow'

export default function PublicMatchList() {
  const { openMatches, loading, fetchMatches, cancelNotice, clearCancelNotice } = useLobbyStore()
  const { setJoinTarget } = useMatchStore()
  const navigate = useRouterStore((s) => s.navigate)
  const { address, guestId, ensureWsConnected } = useWalletStore()
  const playerId = address ?? guestId
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    fetchMatches()
    const poll = setInterval(fetchMatches, 15_000)
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [])

  // Auto-dismiss penalty notice after 5 seconds
  useEffect(() => {
    if (!cancelNotice) return
    const t = setTimeout(clearCancelNotice, 5000)
    return () => clearTimeout(t)
  }, [cancelNotice])

  const join = (m: OpenMatch) => {
    if (!m.isCasual && !address) return  // competitive requires wallet — button is disabled anyway
    ensureWsConnected()
    setJoinTarget({
      matchId: m.matchId,
      gameSlug: m.gameSlug,
      isCasual: m.isCasual,
      amount: m.amount ?? '1000000',
      denom: (m.denom ?? 'uatom') as Denom,
    })
    navigate(m.gameSlug)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-10 text-slate-600">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
        <span className="font-mono text-xs tracking-widest">LOADING...</span>
      </div>
    )
  }

  if (openMatches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="font-px text-[32px] opacity-10">🎮</span>
        <span className="font-mono text-xs text-slate-600 tracking-widest">NO OPEN MATCHES</span>
        <span className="font-mono text-[10px] text-slate-700">Start a public match from any game to appear here.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {cancelNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-900/20 border border-amber-700/50">
          <span className="font-mono text-[10px] text-amber-400">{cancelNotice}</span>
          <button onClick={clearCancelNotice} className="text-amber-600 hover:text-amber-400 text-sm leading-none">×</button>
        </div>
      )}
      {openMatches.map((m) => {
        const game = GAMES.find((g) => g.slug === m.gameSlug)
        const isOwnMatch = m.creator === playerId
        const needsWallet = !m.isCasual && !address

        return (
          <div key={m.matchId}
            className="flex items-center gap-4 px-4 py-3 bg-c-surface border border-c-border">

            {/* Game + mode */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-px text-[8px] text-slate-200 tracking-widest truncate">
                {game?.title ?? m.gameSlug.toUpperCase()}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {m.isCasual ? (
                  <span className="font-mono text-[9px] text-emerald-400 border border-emerald-800/50 bg-emerald-900/20 px-1.5 py-px">
                    CASUAL
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-amber-400 border border-amber-800/50 bg-amber-900/20 px-1.5 py-px">
                    {m.amount && m.denom
                      ? `${toDisplay(m.amount)} ${DENOM_LABEL[m.denom] ?? m.denom}`
                      : 'COMPETITIVE'}
                  </span>
                )}
                <span className="font-mono text-[9px] text-slate-600">
                  {m.creator.startsWith('guest-') ? 'GUEST' : `${m.creator.slice(0, 8)}…`}
                </span>
              </div>
            </div>

            {/* Age */}
            <span className="font-mono text-[9px] text-slate-700 shrink-0">
              {Math.floor((now - m.createdAt) / 60000)}m ago
            </span>

            {/* Join button */}
            {isOwnMatch ? (
              <span className="font-mono text-[9px] text-slate-600 shrink-0">YOUR MATCH</span>
            ) : needsWallet ? (
              <span className="font-mono text-[9px] text-slate-600 shrink-0 border border-slate-700 px-3 py-1.5">
                WALLET REQ.
              </span>
            ) : (
              <button
                onClick={() => join(m)}
                className="shrink-0 font-mono text-[10px] font-bold text-white
                  bg-violet-700 hover:bg-violet-600 border border-violet-600
                  px-4 py-1.5 shadow-[0_2px_0_#3b0f8a]
                  active:translate-y-[2px] active:shadow-none transition-all duration-75">
                JOIN
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
