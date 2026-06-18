import { useState } from 'react'
import { useUsername } from '../../hooks/useUsername'

interface Props { onClose: () => void }

export default function UsernameModal({ onClose }: Props) {
  const { registerUsername } = useUsername()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await registerUsername(name.trim())
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-c-panel border border-c-borderhi p-8 flex flex-col gap-4 max-w-xs w-full">
        <p className="font-px text-[9px] text-violet-400 tracking-widest">SET USERNAME</p>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="arcade_name"
          maxLength={24}
          className="bg-c-surface border border-c-border text-white font-mono px-4 py-3 outline-none focus:border-violet-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-600 text-slate-400 font-mono text-sm hover:border-slate-400 transition-colors">
            CANCEL
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2 bg-violet-700 text-white font-mono text-sm hover:bg-violet-600 shadow-[0_3px_0_#3b0f8a] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-50">
            {loading ? '…' : 'CONFIRM'}
          </button>
        </div>
      </div>
    </div>
  )
}
