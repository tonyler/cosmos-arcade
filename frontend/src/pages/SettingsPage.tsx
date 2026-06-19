import { useState } from 'react'
import { useWalletStore } from '../store/walletStore'
import { useUsername } from '../hooks/useUsername'

export default function SettingsPage() {
  const { connected, address, username, balance } = useWalletStore()
  const { registerUsername } = useUsername()

  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setStatus('loading')
    setError(null)
    try {
      await registerUsername(trimmed)
      setStatus('success')
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">

      {/* Header */}
      <div>
        <p className="font-px text-[10px] text-violet-400 tracking-widest mb-1">PROFILE</p>
        <div className="h-px bg-c-border" />
      </div>

      {!connected ? (
        <p className="font-mono text-xs text-slate-500 text-center py-8">
          Connect your wallet to set up your profile.
        </p>
      ) : (
        <>
          {/* Identity block */}
          <div className="flex flex-col gap-4">
            <p className="font-px text-[8px] text-slate-500 tracking-widest">IDENTITY</p>

            {/* Nickname display */}
            <div className="flex items-center gap-3 p-4 bg-c-surface border border-c-border">
              <span className="font-px text-[10px] text-violet-400 w-20 shrink-0">NICKNAME</span>
              <span className="font-mono text-sm text-slate-200 truncate">
                {username ?? <span className="text-slate-600 italic">not set</span>}
              </span>
            </div>

            {/* Wallet address */}
            <div className="flex items-center gap-3 p-4 bg-c-surface border border-c-border">
              <span className="font-px text-[10px] text-violet-400 w-20 shrink-0">ADDRESS</span>
              <span className="font-mono text-xs text-slate-400 truncate flex-1">{address}</span>
              <button
                onClick={copyAddress}
                className="shrink-0 font-px text-[7px] tracking-widest border border-c-border px-2 py-1
                  text-slate-500 hover:text-slate-200 hover:border-violet-500/50 transition-colors"
              >
                {copied ? 'COPIED!' : 'COPY'}
              </button>
            </div>

            {/* Balance */}
            {balance && (
              <div className="flex items-center gap-3 p-4 bg-c-surface border border-c-border">
                <span className="font-px text-[10px] text-violet-400 w-20 shrink-0">BALANCE</span>
                <span className="font-mono text-sm text-slate-200">{balance}</span>
              </div>
            )}
          </div>

          {/* Set nickname */}
          <div className="flex flex-col gap-4">
            <p className="font-px text-[8px] text-slate-500 tracking-widest">
              {username ? 'CHANGE NICKNAME' : 'SET NICKNAME'}
            </p>
            <p className="font-mono text-[10px] text-slate-600 leading-relaxed">
              Your nickname appears in chat and games instead of your wallet address.
              Letters, numbers and underscores only — max 24 characters.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setStatus('idle'); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={username ?? 'arcade_name'}
                maxLength={24}
                className="flex-1 min-w-0 bg-c-bg border border-c-border
                  font-mono text-sm text-slate-200 placeholder:text-slate-700
                  px-3 py-2.5 outline-none focus:border-violet-600/70
                  transition-colors"
              />
              <button
                onClick={submit}
                disabled={status === 'loading' || !name.trim()}
                className="shrink-0 font-px text-[8px] text-white tracking-widest
                  bg-violet-700 hover:bg-violet-600 border border-violet-600
                  px-4 py-2 shadow-[0_2px_0_#3b0f8a]
                  active:translate-y-[2px] active:shadow-none transition-all duration-75
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
              >
                {status === 'loading' ? '…' : 'SAVE'}
              </button>
            </div>

            {status === 'success' && (
              <p className="font-mono text-[10px] text-emerald-400">Nickname saved! You'll appear as <strong>{useWalletStore.getState().username}</strong> in chat.</p>
            )}
            {error && (
              <p className="font-mono text-[10px] text-red-400">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
