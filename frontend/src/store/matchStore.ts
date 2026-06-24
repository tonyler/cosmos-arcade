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
  iAmWinner: boolean | null
  txHash: string | null
  error: string | null
  joinTarget: JoinTarget | null
  opponentDisconnected: boolean

  matchCtx: () => MatchContext | null
  setJoinTarget: (t: JoinTarget | null) => void
  create: (address: string, gameSlug: string, mode: GameMode, opts: { amount?: string; denom?: Denom; isPublic: boolean; opponent: string | null }) => Promise<void>
  join: (address: string, verifiedAmount?: string) => Promise<void>
  markReady: () => void
  announceWinner: (winner: string) => void
  reset: () => void
}

const makeMatchId = (gameSlug: string) =>
  `${gameSlug}-${crypto.randomUUID()}`

let countdownInterval: ReturnType<typeof setInterval> | null = null
let waitingTimer: ReturnType<typeof setTimeout> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const clearCountdown      = () => { clearInterval(countdownInterval ?? undefined); countdownInterval = null }
const clearWaitingTimer   = () => { clearTimeout(waitingTimer ?? undefined); waitingTimer = null }
const clearReconnectTimer = () => { clearTimeout(reconnectTimer ?? undefined); reconnectTimer = null }

export const useMatchStore = create<MatchState>((set, get) => {
  // ── Phase transitions ────────────────────────────────────────────────────────

  // Server confirmed match is live — update shareLink from server's path if provided
  ws.on('match:waiting', (data: unknown) => {
    const { sharePath } = data as { sharePath: string }
    if (sharePath) set({ shareLink: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + sharePath })
  })

  ws.on('match:countdown', (data: unknown) => {
    const { seconds } = data as { seconds: number }
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

  ws.on('match:begin', (data: unknown) => {
    const { p1, p2 } = data as { p1: string; p2: string }
    clearCountdown()
    const s = get()
    if (!p1 || !p2) return
    const mySlot: 1 | 2 = s.myAddress === p1 ? 1 : 2
    const opponentAddress = mySlot === 1 ? p2 : p1
    set({ phase: 'playing', countdown: 0, mySlot, p1Address: p1, p2Address: p2, opponentAddress })
  })

  ws.on('match:settling', (data: unknown) => {
    const { winner } = data as { winner: string }
    const { myAddress } = get()
    // Loser skips straight to complete — only winner waits on chain settlement
    // winner comes from server payload (not store) so this works for server-authoritative games too
    if (winner && winner !== myAddress) set({ phase: 'complete', winner, iAmWinner: false })
    else set({ phase: 'settling', winner: winner ?? null, iAmWinner: true })
  })

  ws.on('match:settled', (data: unknown) => {
    const { winner, txHash } = data as { winner: string; txHash: string }
    if (winner) set({ phase: 'complete', winner, txHash, iAmWinner: winner === get().myAddress })
  })

  ws.on('match:complete', (data: unknown) => {
    const { winner } = data as { winner: string }
    if (get().phase !== 'complete' && winner) set({ phase: 'complete', winner, iAmWinner: winner === get().myAddress })
  })

  // ── Error terminals ──────────────────────────────────────────────────────────

  ws.on('match:error', (data: unknown) => {
    const { message } = data as { message: string }
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

  // ── Opponent presence ────────────────────────────────────────────────────────

  ws.on('match:opponent_joined', (data: unknown) => {
    const { opponent } = data as { opponent: string }
    clearWaitingTimer()
    if (opponent) set({ opponentJoined: true, opponentAddress: opponent, phase: 'ready' })
  })

  ws.on('match:opponent_ready', () => {
    set({ opponentReady: true })
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
    countdown: 0, winner: null, iAmWinner: null, txHash: null, error: null, joinTarget: null, opponentDisconnected: false,
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

    join: async (address, verifiedAmount) => {
      const { joinTarget } = get()
      if (!joinTarget) return
      if (joinTarget.isCasual) {
        set({ phase: 'joining', gameMode: 'casual', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, error: null })
        ws.send('match:casual_join', { matchId: joinTarget.matchId })
        // Server responds with match:opponent_joined → phase:'ready'
      } else {
        const amount = verifiedAmount ?? joinTarget.amount
        set({ phase: 'joining', gameMode: 'competitive', myAddress: address, mySlot: 2, p2Address: address, matchId: joinTarget.matchId, gameSlug: joinTarget.gameSlug, amount, denom: joinTarget.denom, error: null })
        try {
          await acceptMatch(address, joinTarget.matchId, amount, joinTarget.denom)
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
      const iAmWinner = winner === get().myAddress
      if (gameMode === 'casual') {
        set({ phase: 'complete', winner, iAmWinner })
      } else {
        set({ phase: 'settling', winner, iAmWinner })
      }
    },

    reset: () => {
      const { phase, matchId, mySlot, opponentAddress } = get()
      clearCountdown()
      clearWaitingTimer()
      clearReconnectTimer()
      if (matchId) {
        if (phase === 'waiting' && mySlot === 1) {
          useLobbyStore.getState().removeMatch(matchId)
          ws.send('match:cancel', { matchId })
        } else if (phase === 'ready' || phase === 'countdown') {
          ws.send('match:abort', { matchId })
        } else if (phase === 'playing' && opponentAddress) {
          ws.send('game:over', { matchId, winner: opponentAddress })
        }
      }
      set({ ...base })
    },
  }
})
