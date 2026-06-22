import { create } from 'zustand'
import { ws } from '../lib/ws'
import { lockFunds, acceptMatch, type Denom } from '../lib/escrow'
import { useLobbyStore } from './lobbyStore'
import type { MatchContext } from '../types/match'

export type MatchPhase =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'joining'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'settling'
  | 'complete'
  | 'settlement_failed'
  | 'disputed'

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
  p1Address: string | null
  p2Address: string | null
  opponentAddress: string | null
  shareLink: string | null
  opponentJoined: boolean
  iAmReady: boolean
  opponentReady: boolean
  countdown: number
  winner: string | null
  error: string | null
  joinTarget: JoinTarget | null
  opponentDisconnected: boolean

  matchCtx: () => MatchContext | null
  setJoinTarget: (t: JoinTarget | null) => void
  create: (address: string, gameSlug: string, mode: GameMode, opts: { amount?: string; denom?: Denom; isPublic: boolean; opponent: string | null }) => Promise<void>
  join: (address: string) => Promise<void>
  markReady: () => void
  announceWinner: (winner: string) => void
  reset: () => void
}

const makeMatchId = (gameSlug: string) =>
  `${gameSlug}-${crypto.randomUUID()}`

let countdownInterval: ReturnType<typeof setInterval> | null = null
function clearCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null }
}

// Auto-expire waiting phase after 1h (matches server Redis TTL)
let waitingTimer: ReturnType<typeof setTimeout> | null = null
function clearWaitingTimer() {
  if (waitingTimer) { clearTimeout(waitingTimer); waitingTimer = null }
}

// Auto-clear opponent-disconnected banner after server grace period
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
function clearReconnectTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

export const useMatchStore = create<MatchState>((set, get) => {
  // Server confirmed match is live — update shareLink from server's path if provided
  ws.on('match:waiting', ({ sharePath }) => {
    if (sharePath) set({ shareLink: window.location.origin + sharePath })
  })

  ws.on('match:opponent_joined', ({ opponent }) => {
    clearWaitingTimer()
    if (opponent) set({ opponentJoined: true, opponentAddress: opponent, phase: 'ready' })
  })

  ws.on('match:opponent_ready', () => {
    set({ opponentReady: true })
  })

  ws.on('match:countdown', ({ seconds }) => {
    clearCountdown()
    set({ phase: 'countdown', countdown: seconds })
    countdownInterval = setInterval(() => {
      set((s) => {
        const next = s.countdown - 1
        if (next <= 0) { clearCountdown(); return { countdown: 0 } }
        return { countdown: next }
      })
    }, 1000)
  })

  ws.on('match:begin', ({ p1, p2 }) => {
    clearCountdown()
    const s = get()
    if (!p1 || !p2) return
    const mySlot: 1 | 2 = s.myAddress === p1 ? 1 : 2
    const opponentAddress = mySlot === 1 ? p2 : p1
    set({ phase: 'playing', countdown: 0, mySlot, p1Address: p1, p2Address: p2, opponentAddress })
  })

  ws.on('match:settling', () => set({ phase: 'settling' }))

  ws.on('match:settled', ({ winner }) => {
    if (winner) set({ phase: 'complete', winner })
  })

  ws.on('match:complete', ({ winner }) => {
    if (get().phase !== 'complete' && winner) set({ phase: 'complete', winner })
  })

  ws.on('match:error', ({ message }) => {
    const { phase } = get()
    if (phase === 'settling') {
      set({ phase: 'settlement_failed', error: message ?? 'Settlement failed' })
    } else {
      set({ phase: 'idle', error: message ?? 'Unknown error' })
    }
  })

  ws.on('match:disputed', () => {
    set({ phase: 'disputed' })
  })

  ws.on('match:cancelled', () => {
    clearCountdown()
    clearWaitingTimer()
    set({ ...base })
  })

  ws.on('match:opponent_left', () => {
    const { matchId, gameSlug, myAddress, p1Address, gameMode, isPublic, amount, denom, shareLink } = get()
    set({ ...base, phase: 'waiting', matchId, gameSlug, myAddress, mySlot: 1, p1Address, gameMode, isPublic, amount, denom, shareLink })
    // Restart waiting timer — new opponent slot open
    clearWaitingTimer()
    waitingTimer = setTimeout(() => {
      if (get().phase === 'waiting') set({ phase: 'idle', error: 'Match expired — no opponent joined.' })
    }, 3_600_000)
  })

  ws.on('match:creator_left', () => {
    clearCountdown()
    clearWaitingTimer()
    set({ ...base, error: 'The match creator disconnected.' })
  })

  ws.on('match:opponent_disconnected', () => {
    clearReconnectTimer()
    set({ opponentDisconnected: true })
    // Auto-clear banner after server grace period if forfeit never arrives
    reconnectTimer = setTimeout(() => {
      if (get().phase === 'playing') set({ opponentDisconnected: false })
    }, 31_000)
  })

  ws.on('match:opponent_reconnected', () => {
    clearReconnectTimer()
    set({ opponentDisconnected: false })
  })

  ws.on('match:opponent_forfeited', () => {
    clearReconnectTimer()
    set({ opponentDisconnected: false })
    const myAddr = get().myAddress
    if (myAddr) get().announceWinner(myAddr)
  })

  const base = {
    phase: 'idle' as MatchPhase,
    gameMode: null as GameMode | null,
    matchId: null, gameSlug: null, amount: null, denom: null,
    isPublic: true, myAddress: null, mySlot: null,
    p1Address: null, p2Address: null, opponentAddress: null,
    shareLink: null, opponentJoined: false, iAmReady: false, opponentReady: false,
    countdown: 0, winner: null, error: null, joinTarget: null, opponentDisconnected: false,
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

    create: async (address, gameSlug, mode, { amount, denom, isPublic, opponent }) => {
      const matchId = makeMatchId(gameSlug)
      if (mode === 'competitive') {
        if (!amount || !denom) {
          set({ phase: 'idle', error: 'Amount and denomination are required for competitive matches' })
          return
        }
        set({ phase: 'creating', gameMode: 'competitive', matchId, gameSlug, amount, denom, isPublic, myAddress: address, mySlot: 1, p1Address: address, error: null })
        try {
          await lockFunds(address, { matchId, opponent, amount, denom })
          const shareLink = isPublic ? null
            : `${window.location.origin}${import.meta.env.BASE_URL}?join=${matchId}&game=${gameSlug}&amount=${amount}&denom=${denom}`
          set({ phase: 'waiting', shareLink })
          ws.send('match:create', { matchId, gameSlug, amount, denom, isPublic, opponent, txHash: '' })
        } catch (e: unknown) {
          set({ phase: 'idle', gameMode: null, error: e instanceof Error ? e.message : 'Transaction failed' })
          return
        }
      } else {
        const shareLink = isPublic ? null
          : `${window.location.origin}${import.meta.env.BASE_URL}?join=${matchId}&game=${gameSlug}&casual=true`
        set({ phase: 'waiting', gameMode: 'casual', matchId, gameSlug, isPublic, myAddress: address, mySlot: 1, p1Address: address, shareLink, error: null })
        ws.send('match:casual_create', { matchId, gameSlug, isPublic, opponent: isPublic ? null : (opponent || null) })
      }
      clearWaitingTimer()
      waitingTimer = setTimeout(() => {
        if (get().phase === 'waiting') set({ phase: 'idle', error: 'Match expired — no opponent joined.' })
      }, 3_600_000)
    },

    join: async (address) => {
      const { joinTarget } = get()
      if (!joinTarget) return
      if (joinTarget.isCasual) {
        set({ phase: 'joining', gameMode: 'casual', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, error: null })
        ws.send('match:casual_join', { matchId: joinTarget.matchId })
        // Server responds with match:opponent_joined → phase:'ready'
      } else {
        set({ phase: 'joining', gameMode: 'competitive', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, amount: joinTarget.amount, denom: joinTarget.denom, error: null })
        try {
          await acceptMatch(address, joinTarget.matchId, joinTarget.amount, joinTarget.denom)
          ws.send('match:join', { matchId: joinTarget.matchId, txHash: '' })
        } catch (e: unknown) {
          set({ phase: 'idle', gameMode: null, error: e instanceof Error ? e.message : 'Transaction failed' })
        }
      }
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
      const { phase, matchId, mySlot, opponentAddress, gameMode } = get()
      clearCountdown()
      clearWaitingTimer()
      clearReconnectTimer()
      if (matchId) {
        if (phase === 'waiting' && mySlot === 1) {
          useLobbyStore.getState().removeMatch(matchId)
          ws.send('match:cancel', { matchId })
        } else if (phase === 'ready' || phase === 'countdown') {
          ws.send('match:abort', { matchId })
        } else if (phase === 'playing' && gameMode === 'competitive' && opponentAddress) {
          // Self-forfeit: opponent wins the pot
          ws.send('game:over', { matchId, winner: opponentAddress })
        }
      }
      set({ ...base })
    },
  }
})
