import { create } from 'zustand'
import { ws } from '../lib/ws'

export interface ChatMessage {
  id: string
  user: string
  address?: string
  text: string
  time: string
  isSystem?: boolean
}

export interface DmMessage {
  id: string
  fromDisplay: string
  text: string
  time: string
  self: boolean
}

export const COOLDOWN = 60_000  // ms

const PALETTE = ['#38bdf8', '#a78bfa', '#fb923c', '#4ade80', '#f472b6', '#facc15']
export function userColor(addr: string): string {
  let h = 0
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function fmtTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 1 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`
}


interface ChatState {
  open: boolean
  activeTab: 'general' | 'dms'
  messages: ChatMessage[]
  onlineUsers: string[]
  dmThreads: Record<string, DmMessage[]>
  unreadDms: string[]
  activeDm: string | null
  lastSent: number
  dmLastSent: Record<string, number>

  toggleOpen: () => void
  setTab: (tab: 'general' | 'dms') => void
  sendChatMessage: (text: string, username?: string) => boolean
  sendDm: (to: string, text: string, username?: string) => boolean
  openDm: (addr: string) => void
  closeDm: () => void
}

export const useChatStore = create<ChatState>((set, get) => {
  ws.on('chat:message', (data: any) => {
    set((s) => ({
      messages: [...s.messages, {
        id: data.id ?? Date.now().toString(),
        user: data.user,
        address: data.address,
        text: data.text,
        time: fmtTime(data.time),
      }],
    }))
  })

  ws.on('chat:history', (data: any) => {
    set({
      messages: (data.messages as any[]).map((m) => ({
        id: m.id,
        user: m.user,
        address: m.address,
        text: m.text,
        time: fmtTime(m.time),
      })),
    })
  })

  ws.on('chat:dm', (data: any) => {
    const threadKey = data.self ? data.to : data.from
    set((s) => {
      const thread = s.dmThreads[threadKey] ?? []
      const msg: DmMessage = {
        id: data.id ?? Date.now().toString(),
        fromDisplay: data.fromDisplay,
        text: data.text,
        time: fmtTime(data.time),
        self: data.self ?? false,
      }
      const unreadDms = data.self || s.activeDm === threadKey
        ? s.unreadDms
        : [...s.unreadDms.filter((a) => a !== threadKey), threadKey]
      return {
        dmThreads: { ...s.dmThreads, [threadKey]: [...thread, msg] },
        unreadDms,
      }
    })
  })

  // Sync client cooldown if server rejects (e.g. after page refresh)
  ws.on('chat:ratelimit', (data: any) => {
    const resumeAt = Date.now() - COOLDOWN + data.cooldown * 1000
    if (data.scope === 'general') {
      set({ lastSent: resumeAt })
    } else if (data.scope === 'dm' && data.to) {
      set((s) => ({ dmLastSent: { ...s.dmLastSent, [data.to]: resumeAt } }))
    }
  })

  ws.on('lobby:players', (data: any) => {
    set({ onlineUsers: (data.players as string[]).filter((p) => p !== '__admin__') })
    ws.send('chat:history', {})
  })

  ws.on('lobby:player_joined', (data: any) => {
    set((s) => ({
      onlineUsers: s.onlineUsers.includes(data.address)
        ? s.onlineUsers
        : [...s.onlineUsers, data.address],
    }))
  })

  ws.on('lobby:player_left', (data: any) => {
    set((s) => ({ onlineUsers: s.onlineUsers.filter((a) => a !== data.address) }))
  })

  return {
    open: false,
    activeTab: 'general',
    messages: [],
    onlineUsers: [],
    dmThreads: {},
    unreadDms: [],
    activeDm: null,
    lastSent: 0,
    dmLastSent: {},

    toggleOpen: () => set((s) => ({ open: !s.open })),
    setTab: (tab) => set({ activeTab: tab }),

    sendChatMessage: (text, username) => {
      const { lastSent } = get()
      if (Date.now() - lastSent < COOLDOWN) return false
      set({ lastSent: Date.now() })
      ws.send('chat:message', { text, username })
      return true
    },

    sendDm: (to, text, username) => {
      const { dmLastSent } = get()
      const last = dmLastSent[to] ?? 0
      if (Date.now() - last < COOLDOWN) return false
      set({ dmLastSent: { ...dmLastSent, [to]: Date.now() } })
      ws.send('chat:dm', { to, text, username })
      return true
    },

    openDm: (addr) =>
      set((s) => ({ activeDm: addr, unreadDms: s.unreadDms.filter((a) => a !== addr) })),

    closeDm: () => set({ activeDm: null }),
  }
})
