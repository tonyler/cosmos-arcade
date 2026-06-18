import { create } from 'zustand'

export interface ChatMessage {
  id: string
  user: string
  text: string
  time: string
  color?: string
  isSystem?: boolean
}

interface ChatState {
  open: boolean
  activeTab: 'general' | 'dms'
  messages: ChatMessage[]
  toggleOpen: () => void
  setTab: (tab: 'general' | 'dms') => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'time'>) => void
}

const SEED: ChatMessage[] = [
  { id: '1', user: 'BlockWizard',   color: '#38bdf8', time: '8m',  text: 'gg last match, that snake game was close' },
  { id: '2', user: 'stellarBytes',  color: '#a78bfa', time: '6m',  text: 'anyone want to run tetris? 5 ATOM wager' },
  { id: '3', user: 'novaRunner',    color: '#fb923c', time: '4m',  text: 'I\'m in — sending challenge now' },
  { id: 's', user: 'system',        time: '2m',  text: '⬡ novaRunner vs stellarBytes match started', isSystem: true },
  { id: '4', user: 'cosmosplayer',  color: '#4ade80', time: '2m',  text: 'who\'s next after them? I got 10 ATOM ready' },
  { id: '5', user: 'BlockWizard',   color: '#38bdf8', time: '1m',  text: 'I\'ll take that, cosmos1plyr…abc' },
  { id: '6', user: 'cosmosplayer',  color: '#4ade80', time: 'now', text: 'let\'s go 🎮' },
]

export const useChatStore = create<ChatState>((set) => ({
  open: true,
  activeTab: 'general',
  messages: SEED,
  toggleOpen: () => set((s) => ({ open: !s.open })),
  setTab: (tab) => set({ activeTab: tab }),
  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { ...msg, id: Date.now().toString(), time: 'now' }],
    })),
}))
