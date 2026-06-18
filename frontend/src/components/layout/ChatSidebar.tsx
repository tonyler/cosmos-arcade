import { useRef, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useWalletStore } from '../../store/walletStore'

const DMS = [
  { name: 'BlockWizard',  preview: 'gg last game!',      color: '#38bdf8', unread: true  },
  { name: 'novaRunner',   preview: 'rematch? 5 ATOM',    color: '#fb923c', unread: true  },
  { name: 'stellarBytes', preview: 'nice moves in snake', color: '#a78bfa', unread: false },
]

export default function ChatSidebar() {
  const { open, activeTab, messages, toggleOpen, setTab, addMessage } = useChatStore()
  const { connected, address } = useWalletStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = () => {
    const text = inputRef.current?.value.trim()
    if (!text) return
    addMessage({
      user: connected && address
        ? address.slice(0, 9) + '…' + address.slice(-4)
        : 'Guest',
      text,
      color: connected ? '#a78bfa' : undefined,
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <aside
      className="relative flex flex-col bg-c-panel border-l border-c-border z-20 overflow-hidden transition-all duration-300 ease-out"
      style={{ width: open ? '300px' : '0px', minWidth: open ? '300px' : '0px', borderColor: open ? undefined : 'transparent' }}
    >
      {/* Collapse toggle — sits on the left edge */}
      <button
        onClick={toggleOpen}
        className="absolute -left-[17px] top-1/2 -translate-y-1/2 z-30
          w-[17px] h-14 bg-c-surface border border-r-0 border-c-borderhi
          flex items-center justify-center
          text-[9px] text-slate-600
          hover:text-slate-300 hover:bg-violet-900/20 hover:border-violet-500/50
          transition-colors duration-100"
        title={open ? 'Close chat' : 'Open chat'}
      >
        <span className="inline-block transition-transform duration-300"
          style={{ transform: open ? '' : 'rotate(180deg)' }}>
          ◀
        </span>
      </button>

      {/* Inner — fades on collapse */}
      <div
        className="flex flex-col h-full transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      >
        {/* Tabs */}
        <div className="flex border-b border-c-border flex-shrink-0">
          {(['general', 'dms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`
                flex-1 py-3 font-mono text-xs font-bold uppercase tracking-widest
                transition-colors duration-100 relative
                ${activeTab === tab
                  ? 'text-slate-100 bg-violet-900/10'
                  : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.02]'
                }
              `}
            >
              {tab === 'general' ? 'General' : (
                <>DMs <span className="inline-flex items-center justify-center
                  w-4 h-4 bg-red-600 text-[8px] font-bold text-white ml-1">2</span>
                </>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
          ))}
        </div>

        {/* GENERAL panel */}
        {activeTab === 'general' && (
          <>
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0"
            >
              {messages.map((msg) =>
                msg.isSystem ? (
                  <p key={msg.id} className="font-mono text-[10px] text-slate-700 italic py-0.5 border-l-2 border-slate-800 pl-3">
                    {msg.text}
                  </p>
                ) : (
                  <div key={msg.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: msg.color ?? '#a78bfa' }}
                      >
                        {msg.user}
                      </span>
                      <span className="font-mono text-[9px] text-slate-700">{msg.time}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-snug">{msg.text}</p>
                  </div>
                )
              )}
            </div>
            <div className="flex gap-2 p-3 border-t border-c-border flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                placeholder="Message #general…"
                className="flex-1 min-w-0 bg-c-surface border border-c-border
                  text-sm text-slate-200 placeholder:text-slate-700
                  px-3 py-2.5 outline-none
                  focus:border-violet-600/70 transition-colors duration-100"
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button
                onClick={send}
                className="w-10 h-10 bg-violet-700 text-white flex items-center justify-center
                  text-base flex-shrink-0
                  shadow-[0_2px_0_#3b0f8a]
                  hover:bg-violet-600
                  active:translate-y-[2px] active:shadow-none
                  transition-all duration-75"
              >
                ↑
              </button>
            </div>
          </>
        )}

        {/* DMS panel */}
        {activeTab === 'dms' && (
          <div className="flex-1 overflow-y-auto py-2 min-h-0">
            {DMS.map((dm) => (
              <div
                key={dm.name}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer
                  hover:bg-violet-900/10 transition-colors duration-100"
              >
                <div
                  className="w-9 h-9 flex items-center justify-center font-mono text-sm font-bold flex-shrink-0"
                  style={{ background: `${dm.color}18`, color: dm.color }}
                >
                  {dm.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-200">{dm.name}</p>
                  <p className="text-sm text-slate-500 truncate">{dm.preview}</p>
                </div>
                {dm.unread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
