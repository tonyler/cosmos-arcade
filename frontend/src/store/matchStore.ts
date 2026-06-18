import { create } from 'zustand'
import { ws } from '../lib/ws'
import { lockFunds, acceptMatch, type Denom } from '../lib/escrow'
import type { MatchContext } from '../plugins/types'

export type MatchPhase =
  | 'idle'        // no active match
  | 'creating'    // lockFunds TX in flight
  | 'waiting'     // waiting for opponent to join
  | 'joining'     // acceptMatch TX in flight
  | 'ready'       // both joined, waiting for READY clicks
  | 'countdown'   // both ready, counting down
  | 'playing'     // game live
  | 'settling'    // on-chain settlement in progress
  | 'complete'    // match over

export interface JoinTarget {
  matchId: string
  gameSlug: string
  amount: string
  denom: Denom
}

interface MatchState {
  phase: MatchPhase
  matchId: string | null
  gameSlug: string | null
  amount: string | null
  denom: Denom | null
  isPublic: boolean
  myAddress: string | null
  mySlot: 1 | 2 | null
  p1Address: string | null   // creator
  p2Address: string | null   // joiner
  opponentAddress: string | null
  shareLink: string | null
  opponentJoined: boolean
  iAmReady: boolean
  opponentReady: boolean
  countdown: number
  winner: string | null
  error: string | null
  joinTarget: JoinTarget | null

  // Derived
  matchCtx: () => MatchContext | null

  // Actions
  setJoinTarget: (t: JoinTarget | null) => void
  createBet: (address: string, gameSlug: string, amount: string, denom: Denom, isPublic: boolean, opponent: string | null) => Promise<void>
  joinBet: (address: string) => Promise<void>
  markReady: () => void
  announceWinner: (winner: string) => void
  reset: () => void
}

let countdownInterval: ReturnType<typeof setInterval> | null = null
function clearCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null }
}

export const useMatchStore = create<MatchState>((set, get) => {
  ws.on('match:opponent_joined', (data: any) => {
    set({ opponentJoined: true, opponentAddress: data.opponent, phase: 'ready' })
  })
  ws.on('match:opponent_ready', () => {
    set({ opponentReady: true })
  })
  ws.on('match:countdown', (data: any) => {
    clearCountdown()
    set({ phase: 'countdown', countdown: data.seconds })
    countdownInterval = setInterval(() => {
      set((s) => {
        const next = s.countdown - 1
        if (next <= 0) { clearCountdown(); return { countdown: 0 } }
        return { countdown: next }
      })
    }, 1000)
  })
  ws.on('match:begin', (data: any) => {
    clearCountdown()
    const s = get()
    // Server tells us who is p1/p2 — resolve our slot
    const mySlot: 1 | 2 = s.myAddress === data.p1 ? 1 : 2
    const opponentAddress = mySlot === 1 ? data.p2 : data.p1
    set({ phase: 'playing', countdown: 0, mySlot, p1Address: data.p1, p2Address: data.p2, opponentAddress })
  })
  ws.on('match:settling', () => set({ phase: 'settling' }))
  ws.on('match:settled', (data: any) => set({ phase: 'complete', winner: data.winner }))
  ws.on('match:error', (data: any) => set({ phase: 'idle', error: data.message }))

  const base = {
    phase: 'idle' as MatchPhase,
    matchId: null, gameSlug: null, amount: null, denom: null,
    isPublic: true, myAddress: null, mySlot: null,
    p1Address: null, p2Address: null, opponentAddress: null,
    shareLink: null, opponentJoined: false, iAmReady: false, opponentReady: false,
    countdown: 0, winner: null, error: null, joinTarget: null,
  }

  return {
    ...base,

    matchCtx: () => {
      const s = get()
      if (!s.matchId || !s.mySlot || !s.myAddress || !s.p1Address || !s.p2Address) return null
      return {
        matchId: s.matchId,
        mySlot: s.mySlot,
        myAddress: s.myAddress,
        opponentAddress: s.opponentAddress ?? '',
        p1Address: s.p1Address,
        p2Address: s.p2Address,
      }
    },

    setJoinTarget: (t) => set({ joinTarget: t }),

    createBet: async (address, gameSlug, amount, denom, isPublic, opponent) => {
      const matchId = `${gameSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      set({ phase: 'creating', matchId, gameSlug, amount, denom, isPublic, myAddress: address, mySlot: 1, p1Address: address, error: null })
      try {
        await lockFunds(address, { matchId, opponent, amount, denom })
        const shareLink = isPublic ? null
          : `${window.location.origin}/?join=${matchId}&game=${gameSlug}&amount=${amount}&denom=${denom}`
        set({ phase: 'waiting', shareLink })
        ws.send('match:create', { matchId, gameSlug, amount, denom, isPublic, opponent, txHash: '' })
      } catch (e: any) {
        set({ phase: 'idle', error: e.message ?? 'Transaction failed' })
      }
    },

    joinBet: async (address) => {
      const { joinTarget } = get()
      if (!joinTarget) return
      set({ phase: 'joining', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, amount: joinTarget.amount, denom: joinTarget.denom, error: null })
      try {
        await acceptMatch(address, joinTarget.matchId, joinTarget.amount, joinTarget.denom)
        set({ phase: 'waiting' })
        ws.send('match:join', { matchId: joinTarget.matchId, txHash: '' })
        // phase → 'ready' when server sends match:opponent_joined
      } catch (e: any) {
        set({ phase: 'idle', error: e.message ?? 'Transaction failed' })
      }
    },

    markReady: () => {
      const { matchId, iAmReady } = get()
      if (!matchId || iAmReady) return
      set({ iAmReady: true })
      ws.send('match:ready', { matchId })
    },

    announceWinner: (winner) => {
      const { matchId } = get()
      if (!matchId) return
      set({ phase: 'settling' })
      ws.send('game:over', { matchId, winner })
    },

    reset: () => {
      clearCountdown()
      set({ ...base })
    },
  }
})
