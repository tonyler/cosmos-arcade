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

export type GameMode = 'casual' | 'competitive'

export interface JoinTarget {
  matchId: string
  gameSlug: string
  amount: string
  denom: Denom
  isCasual?: boolean
}

interface MatchState {
  phase: MatchPhase
  gameMode: GameMode | null
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
  startCasual: (address: string, gameSlug: string, isPublic: boolean, opponent: string | null) => void
  joinCasual: (address: string) => void
  markReady: () => void
  announceWinner: (winner: string) => void
  reset: () => void
}

const makeMatchId = (gameSlug: string) =>
  `${gameSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

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
    const mySlot: 1 | 2 = s.myAddress === data.p1 ? 1 : 2
    const opponentAddress = mySlot === 1 ? data.p2 : data.p1
    set({ phase: 'playing', countdown: 0, mySlot, p1Address: data.p1, p2Address: data.p2, opponentAddress })
  })
  ws.on('match:settling', () => set({ phase: 'settling' }))
  ws.on('match:settled', (data: any) => set({ phase: 'complete', winner: data.winner }))
  ws.on('match:complete', (data: any) => {
    const s = get()
    if (s.phase !== 'complete') set({ phase: 'complete', winner: data.winner })
  })
  ws.on('match:error', (data: any) => set({ phase: 'idle', error: data.message }))

  const base = {
    phase: 'idle' as MatchPhase,
    gameMode: null as GameMode | null,
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
      const matchId = makeMatchId(gameSlug)
      set({ phase: 'creating', gameMode: 'competitive', matchId, gameSlug, amount, denom, isPublic, myAddress: address, mySlot: 1, p1Address: address, error: null })
      try {
        await lockFunds(address, { matchId, opponent, amount, denom })
        const shareLink = isPublic ? null
          : `${window.location.origin}/?join=${matchId}&game=${gameSlug}&amount=${amount}&denom=${denom}`
        set({ phase: 'waiting', shareLink })
        ws.send('match:create', { matchId, gameSlug, amount, denom, isPublic, opponent, txHash: '' })
      } catch (e: any) {
        set({ phase: 'idle', gameMode: null, error: e.message ?? 'Transaction failed' })
      }
    },

    joinBet: async (address) => {
      const { joinTarget } = get()
      if (!joinTarget) return
      set({ phase: 'joining', gameMode: 'competitive', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, amount: joinTarget.amount, denom: joinTarget.denom, error: null })
      try {
        await acceptMatch(address, joinTarget.matchId, joinTarget.amount, joinTarget.denom)
        set({ phase: 'waiting' })
        ws.send('match:join', { matchId: joinTarget.matchId, txHash: '' })
      } catch (e: any) {
        set({ phase: 'idle', gameMode: null, error: e.message ?? 'Transaction failed' })
      }
    },

    startCasual: (address, gameSlug, isPublic, opponent) => {
      const matchId = makeMatchId(gameSlug)
      const shareLink = isPublic ? null
        : `${window.location.origin}/?join=${matchId}&game=${gameSlug}&casual=true`
      set({ phase: 'waiting', gameMode: 'casual', matchId, gameSlug, isPublic, myAddress: address, mySlot: 1, p1Address: address, shareLink, error: null })
      ws.send('match:casual_create', { matchId, gameSlug, isPublic, opponent: isPublic ? null : (opponent || null) })
    },

    joinCasual: (address) => {
      const { joinTarget } = get()
      if (!joinTarget) return
      set({ phase: 'waiting', gameMode: 'casual', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, error: null })
      ws.send('match:casual_join', { matchId: joinTarget.matchId })
    },

    markReady: () => {
      const { matchId, iAmReady } = get()
      if (!matchId || iAmReady) return
      set({ iAmReady: true })
      ws.send('match:ready', { matchId })
    },

    announceWinner: (winner) => {
      const { matchId, gameMode } = get()
      if (!matchId) return
      ws.send('game:over', { matchId, winner })
      if (gameMode === 'casual') {
        set({ phase: 'complete', winner })
      } else {
        set({ phase: 'settling' })
      }
    },

    reset: () => {
      clearCountdown()
      set({ ...base })
    },
  }
})
