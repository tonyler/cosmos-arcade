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
  cancelNotice: string | null
  cancelledIds: Set<string>   // tombstone prevents poll from restoring WS-cancelled matches
  fetchMatches: () => Promise<void>
  removeMatch: (matchId: string) => void
  clearCancelNotice: () => void
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

  ws.on('lobby:match_cancelled', (data: any) => {
    set((s) => {
      const arr = [...s.cancelledIds, data.matchId]
      return {
        openMatches: s.openMatches.filter((m) => m.matchId !== data.matchId),
        cancelledIds: new Set(arr.length > 500 ? arr.slice(-500) : arr),
      }
    })
  })

  return {
    openMatches: [],
    loading: false,
    cancelNotice: null,
    cancelledIds: new Set<string>(),

    fetchMatches: async () => {
      set({ loading: true })
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'api/lobby')
        const { matches } = await res.json()
        set((s) => ({
          openMatches: (matches ?? [])
            .filter((m: OpenMatch) => !s.cancelledIds.has(m.matchId))
            .map((m: any) => ({ ...m, createdAt: m.createdAt ?? Date.now() })),
          loading: false,
        }))
      } catch {
        set({ loading: false })
      }
    },

    removeMatch: (matchId) => {
      set((s) => {
        const arr = [...s.cancelledIds, matchId]
        return {
          openMatches: s.openMatches.filter((m) => m.matchId !== matchId),
          cancelledIds: new Set(arr.length > 500 ? arr.slice(-500) : arr),
        }
      })
    },

    clearCancelNotice: () => set({ cancelNotice: null }),
  }
})
