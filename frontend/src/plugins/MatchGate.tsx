import { useState } from 'react'
import { useMatchStore } from '../store/matchStore'
import { useWalletStore } from '../store/walletStore'
import ConnectButton from '../components/wallet/ConnectButton'
import type { Denom } from '../lib/escrow'
import { toDisplay, toUbase } from '../lib/format'

interface Props {
  gameSlug: string
  onClose: () => void  // navigates back to lobby
}

export default function MatchGate({ gameSlug, onClose }: Props) {
  const { address, connected } = useWalletStore()
  const { phase, joinTarget, shareLink, iAmReady, opponentReady, countdown, error, createBet, joinBet, markReady } = useMatchStore()

  const [amount, setAmount] = useState('1')
  const [denom, setDenom] = useState<Denom>('uatom')
  const [isPublic, setIsPublic] = useState(true)
  const [opponent, setOpponent] = useState('')
  const [copied, setCopied] = useState(false)

  // Always blocks until the match is live
  if (phase === 'playing' || phase === 'settling' || phase === 'complete') return null

  const isJoinMode = !!joinTarget

  const copyLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">

      {/* Countdown */}
      {phase === 'countdown' && (
        <div className="flex flex-col items-center gap-4">
          <div className="font-px tracking-widest text-violet-400" style={{ fontSize: '80px', lineHeight: 1 }}>
            {countdown}
          </div>
          <div className="font-px text-[9px] text-slate-400 tracking-widest">GET READY!</div>
        </div>
      )}

      {/* Card for all non-countdown phases */}
      {phase !== 'countdown' && (
        <div className="w-full max-w-sm mx-4 bg-c-surface border border-c-border flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-c-border">
            <span className="font-px text-[9px] tracking-widest text-slate-200">
              {phase === 'ready' ? 'MATCH READY' : isJoinMode ? 'JOIN MATCH' : 'PLACE WAGER'}
            </span>
            <div className="flex items-center gap-3">
              {connected && address && (
                <span className="font-mono text-[10px] text-violet-400 bg-violet-900/30 border border-violet-800/40 px-2 py-0.5">
                  {address.slice(0, 8)}…{address.slice(-4)}
                </span>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
            </div>
          </div>

          <div className="px-5 py-5 flex flex-col gap-5">
            {error && (
              <div className="font-mono text-xs text-red-400 bg-red-900/20 border border-red-800/40 px-3 py-2">{error}</div>
            )}

            {/* idle: join mode */}
            {phase === 'idle' && isJoinMode && (
              <>
                <div className="flex flex-col gap-3">
                  <Row label="AMOUNT" value={`${toDisplay(joinTarget.amount)} ${joinTarget.denom === 'uatom' ? 'ATOM' : 'USDC'}`} />
                  <Row label="MATCH ID" value={joinTarget.matchId.slice(-12)} mono />
                </div>
                <p className="font-mono text-xs text-slate-500">Locking the same amount to join. Winner takes the pot.</p>
                {connected
                  ? <Cta onClick={() => address && joinBet(address)}>LOCK &amp; JOIN</Cta>
                  : <ConnectButton />
                }
              </>
            )}

            {/* idle: create mode */}
            {phase === 'idle' && !isJoinMode && (
              <>
                <Field label="TOKEN">
                  <div className="flex gap-2">
                    {(['uatom', 'uusdc'] as Denom[]).map((d) => (
                      <button key={d} onClick={() => setDenom(d)}
                        className={`flex-1 font-mono text-xs py-2 border transition-colors
                          ${denom === d ? 'bg-violet-700 border-violet-500 text-white' : 'bg-c-bg border-c-border text-slate-400 hover:border-violet-500/50'}`}>
                        {d === 'uatom' ? 'ATOM' : 'USDC'}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="AMOUNT">
                  <div className="flex items-center border border-c-border bg-c-bg focus-within:border-violet-500 transition-colors">
                    <input type="number" min="0.1" step="0.1" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent font-mono text-sm text-slate-200 px-3 py-2 outline-none" />
                    <span className="font-mono text-xs text-slate-500 pr-3">{denom === 'uatom' ? 'ATOM' : 'USDC'}</span>
                  </div>
                </Field>

                <Field label="VISIBILITY">
                  <div className="flex gap-2">
                    {([true, false] as const).map((pub) => (
                      <button key={String(pub)} onClick={() => setIsPublic(pub)}
                        className={`flex-1 font-mono text-xs py-2 border transition-colors
                          ${isPublic === pub ? 'bg-violet-700 border-violet-500 text-white' : 'bg-c-bg border-c-border text-slate-400 hover:border-violet-500/50'}`}>
                        {pub ? 'PUBLIC' : 'PRIVATE'}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-slate-600 mt-1">
                    {isPublic ? 'Listed in matchmaking — anyone can join' : 'Share a link to invite a specific player'}
                  </p>
                </Field>

                {!isPublic && (
                  <Field label="OPPONENT ADDRESS (optional)">
                    <input type="text" placeholder="cosmos1... or leave blank for link-only"
                      value={opponent} onChange={(e) => setOpponent(e.target.value)}
                      className="w-full bg-c-bg border border-c-border font-mono text-xs text-slate-300 px-3 py-2 outline-none focus:border-violet-500 transition-colors placeholder:text-slate-700" />
                  </Field>
                )}

                {connected
                  ? <Cta onClick={() => address && createBet(address, gameSlug, toUbase(amount), denom, isPublic, isPublic ? null : (opponent.trim() || null))}>LOCK FUNDS</Cta>
                  : <ConnectButton />
                }
              </>
            )}

            {/* creating / joining: TX in flight */}
            {(phase === 'creating' || phase === 'joining') && <Spinner label="LOCKING FUNDS ON-CHAIN..." />}

            {/* waiting: opponent hasn't joined yet */}
            {phase === 'waiting' && (
              <div className="flex flex-col gap-4">
                <Spinner label="WAITING FOR OPPONENT..." />
                {shareLink ? (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Invite link</span>
                    <div className="flex gap-2">
                      <input readOnly value={shareLink}
                        className="flex-1 bg-c-bg border border-c-border font-mono text-xs text-slate-400 px-3 py-2 outline-none truncate" />
                      <button onClick={copyLink}
                        className="font-mono text-xs px-3 py-2 bg-violet-700 hover:bg-violet-600 text-white border border-violet-600 transition-colors">
                        {copied ? '✓' : 'COPY'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-500">Match listed — waiting for someone to join from the lobby.</p>
                )}
              </div>
            )}

            {/* ready: both joined, each must click READY */}
            {phase === 'ready' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-500">YOU</span>
                    <span className={iAmReady ? 'text-green-400' : 'text-slate-400'}>{iAmReady ? 'READY ✓' : 'NOT READY'}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-500">OPPONENT</span>
                    <span className={opponentReady ? 'text-green-400' : 'text-slate-400'}>{opponentReady ? 'READY ✓' : 'WAITING...'}</span>
                  </div>
                </div>
                {!iAmReady
                  ? <Cta onClick={markReady}>I'M READY</Cta>
                  : <Spinner label="WAITING FOR OPPONENT TO READY UP..." />
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} text-sm text-slate-200`}>{value}</span>
    </div>
  )
}

function Cta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="w-full font-mono text-sm font-bold text-white bg-violet-700
        py-3 border border-violet-600 shadow-[0_4px_0_#3b0f8a]
        hover:bg-violet-600 active:translate-y-[4px] active:shadow-none transition-all duration-75">
      {children}
    </button>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-c-bg border border-c-border">
      <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
      <span className="font-mono text-sm text-slate-400">{label}</span>
    </div>
  )
}
