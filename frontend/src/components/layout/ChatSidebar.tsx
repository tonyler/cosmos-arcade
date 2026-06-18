import { useRef, useEffect, useState } from 'react'
import { useChatStore, userColor, COOLDOWN } from '../../store/chatStore'
import { useWalletStore } from '../../store/walletStore'
import { truncate } from '../../lib/format'

export default function ChatSidebar() {
  const {
    open, activeTab, messages, onlineUsers, dmThreads, unreadDms, activeDm,
    lastSent, dmLastSent,
    toggleOpen, setTab, sendChatMessage, sendDm, openDm, closeDm,
  } = useChatStore()
  const { connected, address, username } = useWalletStore()

  const inputRef    = useRef<HTMLInputElement>(null)
  const dmInputRef  = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLDivElement>(null)
  const dmListRef   = useRef<HTMLDivElement>(null)

  // 1s ticker for cooldown display
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])
  useEffect(() => {
    if (dmListRef.current) dmListRef.current.scrollTop = dmListRef.current.scrollHeight
  }, [activeDm, dmThreads])

  const generalCooldown = Math.max(0, Math.ceil((lastSent + COOLDOWN - now) / 1000))
  const dmCooldown = activeDm
    ? Math.max(0, Math.ceil(((dmLastSent[activeDm] ?? 0) + COOLDOWN - now) / 1000))
    : 0

  const sendGeneral = () => {
    const text = inputRef.current?.value.trim()
    if (!text || !connected) return
    if (sendChatMessage(text, username ?? undefined) && inputRef.current)
      inputRef.current.value = ''
  }

  const sendDmMsg = () => {
    if (!activeDm) return
    const text = dmInputRef.current?.value.trim()
    if (!text) return
    if (sendDm(activeDm, text, username ?? undefined) && dmInputRef.current)
      dmInputRef.current.value = ''
  }

  const peers = onlineUsers.filter((a) => a !== address)

  const openDmFromChat = (addr: string) => {
    if (!addr || addr === address) return
    setTab('dms')
    openDm(addr)
  }

  return (
    <aside
      className="relative flex flex-col h-full bg-c-panel border-l border-c-border z-20 overflow-hidden transition-all duration-300 ease-out"
      style={{ width: open ? '300px' : '0px', minWidth: open ? '300px' : '0px', borderColor: open ? undefined : 'transparent' }}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleOpen}
        className="absolute -left-[17px] top-1/2 -translate-y-1/2 z-30
          w-[17px] h-14 bg-c-surface border border-r-0 border-c-borderhi
          flex items-center justify-center text-[9px] text-slate-600
          hover:text-slate-300 hover:bg-violet-900/20 hover:border-violet-500/50
          transition-colors duration-100"
        title={open ? 'Close chat' : 'Open chat'}
      >
        <span className="inline-block transition-transform duration-300"
          style={{ transform: open ? '' : 'rotate(180deg)' }}>◀</span>
      </button>

      <div
        className="flex flex-col h-full transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      >
        {!connected ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="font-mono text-[10px] text-slate-600 text-center leading-relaxed">
              Connect your wallet<br />to join the chat
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-c-border flex-shrink-0">
              {(['general', 'dms'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTab(tab)}
                  className={`flex-1 py-3 font-mono text-xs font-bold uppercase tracking-widest
                    transition-colors duration-100 relative
                    ${activeTab === tab
                      ? 'text-slate-100 bg-violet-900/10'
                      : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.02]'}`}
                >
                  {tab === 'general' ? 'General' : (
                    <span className="flex items-center justify-center gap-1.5">
                      DMs
                      {unreadDms.length > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 bg-red-600 text-[8px] font-bold text-white">
                          {unreadDms.length}
                        </span>
                      )}
                    </span>
                  )}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
                  )}
                </button>
              ))}
            </div>

            {/* ── GENERAL ── */}
            {activeTab === 'general' && (
              <>
                <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
                  {messages.length === 0 && (
                    <p className="font-mono text-[10px] text-slate-700 text-center py-6">No messages yet</p>
                  )}
                  {messages.map((msg) =>
                    msg.isSystem ? (
                      <p key={msg.id} className="font-mono text-[10px] text-slate-700 italic py-0.5 border-l-2 border-slate-800 pl-3">
                        {msg.text}
                      </p>
                    ) : (
                      <div key={msg.id}>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className={`font-mono text-xs font-bold ${msg.address && msg.address !== address ? 'cursor-pointer hover:underline' : ''}`}
                            style={{ color: msg.address ? userColor(msg.address) : '#a78bfa' }}
                            onClick={() => msg.address && openDmFromChat(msg.address)}
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
                    placeholder={generalCooldown ? `Wait ${generalCooldown}s...` : 'Message #general…'}
                    disabled={generalCooldown > 0}
                    className="flex-1 min-w-0 bg-c-surface border border-c-border
                      text-sm text-slate-200 placeholder:text-slate-600
                      px-3 py-2.5 outline-none focus:border-violet-600/70
                      transition-colors duration-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    onKeyDown={(e) => e.key === 'Enter' && sendGeneral()}
                  />
                  <SendBtn onClick={sendGeneral} disabled={generalCooldown > 0} />
                </div>
              </>
            )}

            {/* ── DMS: user list ── */}
            {activeTab === 'dms' && !activeDm && (
              <div className="flex-1 overflow-y-auto py-2 min-h-0">
                {peers.length === 0 ? (
                  <p className="text-center font-mono text-[10px] text-slate-700 py-8">No other players online</p>
                ) : (
                  peers.map((addr) => (
                    <button
                      key={addr}
                      onClick={() => openDm(addr)}
                      className="w-full flex items-center gap-3 px-4 py-3
                        hover:bg-violet-900/10 transition-colors duration-100 text-left"
                    >
                      <Avatar addr={addr} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-200">{truncate(addr)}</p>
                        {dmThreads[addr]?.length > 0 && (
                          <p className="text-xs text-slate-500 truncate">{dmThreads[addr][dmThreads[addr].length - 1]?.text}</p>
                        )}
                      </div>
                      {unreadDms.includes(addr) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── DMS: conversation thread ── */}
            {activeTab === 'dms' && activeDm && (
              <>
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-c-border flex-shrink-0">
                  <button
                    onClick={closeDm}
                    className="font-mono text-xs text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    ←
                  </button>
                  <Avatar addr={activeDm} size="sm" />
                  <span className="font-mono text-xs text-slate-300 truncate">{truncate(activeDm)}</span>
                </div>
                <div ref={dmListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                  {(dmThreads[activeDm] ?? []).length === 0 ? (
                    <p className="text-center font-mono text-[10px] text-slate-700 py-6">Start the conversation</p>
                  ) : (
                    (dmThreads[activeDm] ?? []).map((msg) => (
                      <div key={msg.id} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 ${
                          msg.self
                            ? 'bg-violet-800/60 border border-violet-700/50'
                            : 'bg-c-surface border border-c-border'
                        }`}>
                          {!msg.self && (
                            <p className="font-mono text-[10px] text-slate-500 mb-1">{msg.fromDisplay}</p>
                          )}
                          <p className="text-sm text-slate-200 leading-snug">{msg.text}</p>
                          <p className="font-mono text-[9px] text-slate-600 mt-1 text-right">{msg.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 p-3 border-t border-c-border flex-shrink-0">
                  <input
                    ref={dmInputRef}
                    type="text"
                    placeholder={dmCooldown > 0 ? `Wait ${dmCooldown}s...` : 'Send a message…'}
                    disabled={dmCooldown > 0}
                    className="flex-1 min-w-0 bg-c-surface border border-c-border
                      text-sm text-slate-200 placeholder:text-slate-600
                      px-3 py-2.5 outline-none focus:border-violet-600/70
                      transition-colors duration-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    onKeyDown={(e) => e.key === 'Enter' && sendDmMsg()}
                  />
                  <SendBtn onClick={sendDmMsg} disabled={dmCooldown > 0} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function Avatar({ addr, size = 'md' }: { addr: string; size?: 'sm' | 'md' }) {
  const color = userColor(addr)
  const dim = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${dim} flex items-center justify-center font-mono font-bold flex-shrink-0`}
      style={{ background: `${color}18`, color }}>
      {addr.slice(7, 8).toUpperCase()}
    </div>
  )
}

function SendBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-10 h-10 bg-violet-700 text-white flex items-center justify-center
        text-base flex-shrink-0 shadow-[0_2px_0_#3b0f8a]
        hover:bg-violet-600
        active:translate-y-[2px] active:shadow-none transition-all duration-75
        disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
    >
      ↑
    </button>
  )
}
