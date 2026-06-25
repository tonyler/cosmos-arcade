/**
 * Canonical WS event protocol for Cosmos Arcade.
 * Source of truth for all server→client event shapes and shared status types.
 * Frontend mirrors ServerToClient in frontend/src/lib/ws-protocol.ts — keep in sync.
 */

/** All events the server sends to connected clients (server→client) */
export interface ServerToClient {
  // Match lifecycle
  'match:waiting':               { matchId: string; sharePath: string | null }
  'match:opponent_joined':       { matchId: string; opponent: string }
  'match:opponent_ready':        { matchId: string }
  'match:countdown':             { matchId: string; seconds: number }
  'match:begin':                 { matchId: string; p1: string; p2: string }
  'match:settling':              { matchId: string; winner: string }
  'match:settled':               { matchId: string; winner: string; txHash: string }
  'match:complete':              { matchId: string; winner: string }
  'match:error':                 { message: string }
  'match:disputed':              { matchId: string }
  'match:cancelled':             { matchId: string; isCasual: boolean; txHash?: string }
  // Disconnect / forfeit
  'match:opponent_left':         { matchId: string }
  'match:creator_left':          { matchId: string }
  'match:opponent_disconnected': { matchId: string; gracePeriodMs: number }
  'match:opponent_forfeited':    { matchId: string }
  // Real-time game relay
  'game:state':                  Record<string, unknown> & { matchId: string }
  'game:input':                  { matchId: string; slot: 1 | 2; dir: number }
  'game:relay_dropped':          { matchId: string; reason: 'payload_too_large' | 'rate_limited'; limit?: number }
  // Lobby presence
  'lobby:open_match':            { matchId: string; gameSlug: string; creator: string; isCasual: boolean; amount: string | null; denom: string | null }
  'lobby:match_taken':           { matchId: string }
  'lobby:match_cancelled':       { matchId: string }
  'lobby:players':               { players: string[] }
  'lobby:player_joined':         { address: string }
  'lobby:player_left':           { address: string }
  // Chat
  'chat:message':                { id: string; user: string; address: string; text: string; time: string }
  'chat:history':                { messages: Array<{ id: string; user: string; address: string; text: string; time: string }> }
  'chat:dm':                     { id: string; from: string; to: string; fromDisplay: string; text: string; time: string; self: boolean }
  'chat:ratelimit':              { cooldown: number; scope: 'general' | 'dm'; to?: string }
}

/** Status values stored in Redis for a match Bet — shared source of truth */
export type BetStatus =
  | 'waiting'
  | 'joined'
  | 'active'
  | 'settling'
  | 'complete'
  | 'settlement_failed'
  | 'disputed'
  | 'abort_failed'
  | 'cancelled'
