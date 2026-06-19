import { create } from 'zustand'
import { ws } from '../lib/ws'

export interface OpenMatch {
  matchId: string
  gameSlug: string
  isCasual: boolean
  amount: string | null
  denom: string | null
  creator: string
  createdAt: number
}

interface LobbyState {
  openMatches: OpenMatch[]
  loading: boolean
  fetchMatches: () => Promise<void>
}

export const useLobbyStore = create<LobbyState>((set) => {
  ws.on('lobby:open_match', (data: any) => {
    const match: OpenMatch = {
      matchId: data.matchId,
      gameSlug: data.gameSlug,
      isCasual: !!data.isCasual,
      amount: data.amount ?? null,
      denom: data.denom ?? null,
      creator: data.creator ?? '?',
      createdAt: Date.now(),
    }
    set((s) => ({ openMatches: [match, ...s.openMatches].slice(0, 50) }))
  })

  ws.on('lobby:match_taken', (data: any) => {
    set((s) => ({ openMatches: s.openMatches.filter((m) => m.matchId !== data.matchId) }))
  })

  return {
    openMatches: [],
    loading: false,
    fetchMatches: async () => {
      set({ loading: true })
      try {
        const res = await fetch('/api/lobby')
        const { matches } = await res.json()
        set({ openMatches: matches ?? [], loading: false })
      } catch {
        set({ loading: false })
      }
    },
  }
})
