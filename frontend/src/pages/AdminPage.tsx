import { useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000/ws'

interface LogEntry {
  type: string
  ts: number
  [key: string]: unknown
}

const TYPE_META: Record<string, { color: string; icon: string }> = {
  'wallet:connect':    { color: 'text-emerald-400', icon: '⬤  ' },
  'wallet:disconnect': { color: 'text-slate-500',   icon: '○  ' },
  'match:create':      { color: 'text-blue-400',    icon: '♦  ' },
  'match:join':        { color: 'text-cyan-400',    icon: '♦♦ ' },
  'match:ready':       { color: 'text-yellow-400',  icon: '▶  ' },
  'match:countdown':   { color: 'text-yellow-300',  icon: '◌  ' },
  'match:begin':       { color: 'text-green-400',   icon: '▶▶ ' },
  'game:over':         { color: 'text-orange-400',  icon: '■  ' },
  'match:settling':    { color: 'text-orange-300',  icon: '↑  ' },
  'match:settled':     { color: 'text-violet-400',  icon: '★  ' },
  'match:error':       { color: 'text-red-400',     icon: '✕  ' },
}

function ts(epoch: number) {
  return new Date(epoch).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function short(addr: string) {
  if (!addr || addr.length < 12) return addr
  return addr.slice(0, 10) + '…' + addr.slice(-6)
}

function atom(uatom: string) {
  return (Number(uatom) / 1_000_000).toFixed(2)
}

function formatLine(e: LogEntry): string {
  const d = e as Record<string, string>
  switch (e.type) {
    case 'wallet:connect':    return `wallet connected  ${short(d.address)}`
    case 'wallet:disconnect': return `wallet disconnected  ${short(d.address)}`
    case 'match:create':
      return `match created  ${short(d.creator)}  ${d.gameSlug}  ${atom(d.amount)} ${d.denom === 'uatom' ? 'ATOM' : 'USDC'}  ${d.isPublic ? 'PUBLIC' : 'PRIVATE'}  [${d.matchId?.slice(-8)}]`
    case 'match:join':
      return `player joined  ${short(d.joiner)} → ${short(d.creator)}  ${atom(d.amount)} ${d.denom === 'uatom' ? 'ATOM' : 'USDC'}  [${d.matchId?.slice(-8)}]`
    case 'match:ready':
      return `player ready  ${short(d.address)}  [${d.matchId?.slice(-8)}]`
    case 'match:countdown':
      return `countdown started  ${d.seconds}s  p1=${short(d.p1)}  p2=${short(d.p2)}  [${d.matchId?.slice(-8)}]`
    case 'match:begin':
      return `game started  ${d.gameSlug}  p1=${short(d.p1)}  p2=${short(d.p2)}  pot=${atom(String(Number(d.amount)*2))} ${d.denom === 'uatom' ? 'ATOM' : 'USDC'}  [${d.matchId?.slice(-8)}]`
    case 'game:over':
      return `game over  winner=${short(d.winner)}  reported by ${short(d.reportedBy)}  [${d.matchId?.slice(-8)}]`
    case 'match:settling':
      return `settling on-chain  winner=${short(d.winner)}  [${d.matchId?.slice(-8)}]`
    case 'match:settled':
      return `payout sent  winner=${short(d.winner)}  ${atom(d.payout)} ${d.denom === 'uatom' ? 'ATOM' : 'USDC'}  tx=${d.txHash?.slice(0, 16)}…  [${d.matchId?.slice(-8)}]`
    case 'match:error':
      return `error  ${d.message}  [${d.matchId?.slice(-8)}]`
    default:
      return JSON.stringify(e)
  }
}

export default function AdminPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    const sock = new WebSocket(`${WS_URL}?address=__admin__`)
    sock.onopen = () => {
      setConnected(true)
      sock.send(JSON.stringify({ type: 'admin:subscribe', data: {} }))
    }
    sock.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data as string)
        if (type === 'telem') setLogs((prev) => [...prev.slice(-2000), data])
      } catch {}
    }
    sock.onclose = () => setConnected(false)
    return () => sock.close()
  }, [])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, paused])

  const FILTER_GROUPS: Record<string, string[]> = {
    WALLETS: ['wallet:connect', 'wallet:disconnect'],
    MATCHES: ['match:create', 'match:join', 'match:ready', 'match:countdown', 'match:begin'],
    GAME:    ['game:over'],
    PAYOUTS: ['match:settling', 'match:settled'],
    ERRORS:  ['match:error'],
  }

  const visible = filter
    ? logs.filter((e) => FILTER_GROUPS[filter]?.includes(e.type) ?? true)
    : logs

  return (
    <div className="min-h-screen bg-black text-slate-200 font-mono flex flex-col select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-4">
          <span className="text-violet-400 text-sm font-bold tracking-widest">COSMOS ARCADE · TELEMETRY</span>
          <span className={`text-xs px-2 py-0.5 border ${connected ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40' : 'text-red-400 border-red-800 bg-red-950/40'}`}>
            {connected ? '● LIVE' : '○ DISCONNECTED'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(FILTER_GROUPS).map((g) => (
            <button key={g}
              onClick={() => setFilter(filter === g ? '' : g)}
              className={`text-[10px] px-2 py-1 border tracking-widest transition-colors
                ${filter === g ? 'bg-violet-800 border-violet-600 text-white' : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}>
              {g}
            </button>
          ))}
          <button
            onClick={() => setPaused((p) => !p)}
            className={`text-[10px] px-2 py-1 border tracking-widest ml-2 transition-colors
              ${paused ? 'bg-yellow-900/40 border-yellow-700 text-yellow-400' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] px-2 py-1 border border-slate-700 text-slate-500 hover:border-red-700 hover:text-red-400 tracking-widest transition-colors">
            CLEAR
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 px-6 py-2 border-b border-slate-900 bg-[#080808] text-[10px] text-slate-600 tracking-widest">
        <span>EVENTS <span className="text-slate-400">{logs.length}</span></span>
        <span>MATCHES <span className="text-slate-400">{logs.filter(e => e.type === 'match:create').length}</span></span>
        <span>SETTLED <span className="text-violet-400">{logs.filter(e => e.type === 'match:settled').length}</span></span>
        <span>ERRORS <span className="text-red-400">{logs.filter(e => e.type === 'match:error').length}</span></span>
      </div>

      {/* Log */}
      <div className="flex-1 overflow-y-auto px-6 py-4 text-xs leading-6">
        {visible.length === 0 && (
          <div className="text-slate-700 text-center py-16 tracking-widest">
            {connected ? '— waiting for events —' : '— connecting to server —'}
          </div>
        )}
        {visible.map((e, i) => (
          <div key={i} className="flex items-baseline gap-3 hover:bg-white/[0.02] px-1 -mx-1">
            <span className="text-slate-700 shrink-0 tabular-nums">{ts(e.ts)}</span>
            <span className={`shrink-0 ${(TYPE_META[e.type]?.color ?? 'text-slate-400')}`}>
              {(TYPE_META[e.type]?.icon ?? '·  ')}{e.type}
            </span>
            <span className="text-slate-400">{formatLine(e)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {paused && (
        <div className="sticky bottom-0 text-center py-2 bg-yellow-900/20 border-t border-yellow-900/40 text-yellow-500 text-[10px] tracking-widest">
          SCROLL PAUSED — CLICK RESUME TO FOLLOW LIVE
        </div>
      )}
    </div>
  )
}
