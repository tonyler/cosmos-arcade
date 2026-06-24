# Modularity Review — Cosmos Arcade
*Balanced Coupling analysis · June 2026*

---

## Component Map

| Component | Domain Classification | Responsibility |
|---|---|---|
| `contracts/escrow` (Rust/CosmWasm) | Supporting | On-chain fund locking, settlement, refunds. Immutable once deployed. |
| `server/ws/handlers/match.ts` | **Core** | Match orchestration, countdown, game relay, winner consensus |
| `server/chain/settlement.ts` | Supporting (glue) | Translates server intent into on-chain messages |
| `frontend/store/matchStore` | **Core** | Client-side match state machine, WS event subscribers |
| `frontend/plugins/MatchGate` | **Core** | Pre-game flow UI — mode selection, wager, ready handshake |
| `frontend/plugins/MatchSettler` | **Core** | Post-game overlay — settlement status, disputes |
| `frontend/lib/escrow.ts` | Supporting (glue) | Frontend CosmWasm client — players lock funds directly |
| `frontend/games/*/engine` | **Core** | Pure game logic (no external deps) |
| `frontend/games/*/ShooterGame`, `PacManGame` | Core | Game loop, canvas rendering, input handling |
| Chat, Lobby, Username | Generic | Standard social features |

---

## Critical Issues

### I2 — Three Parallel State Machines with No Shared Contract ⚠️ CRITICAL

**What is shared:** The semantics of the match lifecycle — what states exist, what transitions are valid, and what each state means to the business.

**How it is shared:** Implicitly. There is no single canonical type. Each layer defines its own enumeration independently:

```
Contract (Rust)     → Pending | Active | Complete | Refunded | Cancelled             (5 states)
Server Redis (TS)   → waiting | joined | active | settling | complete |              (9 states)
                       settlement_failed | disputed | abort_failed | cancelled
Frontend Zustand    → idle | creating | waiting | joining | ready | countdown |      (11 states)
                       playing | settling | complete | settlement_failed | disputed
```

**Why this is a problem:** The match lifecycle is the core subdomain of this application — the part with the highest volatility and the most direct business value. Yet the three components that implement it share no typed boundary. The coupling is implicit: each layer assumes the others agree on the meaning of each state, but nothing enforces that agreement.

The distance makes this worse. The contract and server communicate across a system boundary (blockchain ↔ Node.js). The server and frontend communicate across a process boundary (WebSocket). At each boundary, the implicit contract is "we both know what `settling` means." When you add a new phase — say, `rematch_pending` or `tournament_queued` — you add it to all three independently, with no compiler telling you when you've missed one.

You named adding match modes as your primary pain point. This integration is the structural reason why.

**Balance assessment:** High implicit strength × high distance × high volatility = unbalanced and volatile. The most critical issue in the codebase.

**Recommended direction:** Define a single canonical match status type in one place and derive the others from it. The most practical starting point is a shared TypeScript constants file (a `shared/` package or a checked-in `match-protocol.ts`) that both server and frontend import. The contract is a harder problem (Rust ↔ TS cross-system), but the server ↔ frontend gap is addressable now with zero infrastructure:

```typescript
// shared/match-protocol.ts (one source of truth)
export const MATCH_STATUS = {
  WAITING: 'waiting',
  JOINED: 'joined',
  ACTIVE: 'active',
  // ...
} as const
export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS]
```

Frontend `matchStore` and server `Bet` both import from this. The contract's status strings are then validated at the server's CosmWasm response boundary — one explicit assertion point, not three silent assumptions.

---

### I1 — WebSocket Event Protocol as an Implicit 30-Event Schema ⚠️ HIGH

**What is shared:** The entire operational protocol between server and frontend — 30+ event type strings, each with its own payload shape, each encoding assumptions about what data will be present and what business state it represents.

**How it is shared:** By convention. The server emits:
```typescript
send(creator, 'match:begin', { matchId, p1: activeBet.creator, p2: activeBet.opponent })
```
The frontend receives:
```typescript
ws.on('match:begin', (raw) => {
  const data = raw as { p1: string; p2: string }
  // ...
})
```

There is no schema, no contract file, no generated types. The `as { p1: string; p2: string }` cast is a runtime assumption, not a compile-time check.

**Why this is a problem:** The WS protocol is the functional seam of the system. Adding a new event, renaming a field, or changing what data is included in `match:opponent_joined` requires grep-and-pray across two codebases. When you add a new match mode or competitive feature, you will add new WS events. Right now, the cost of adding one event is: write it on the server, remember to handle it on the frontend, and discover mismatches at runtime.

This is also where game plugging becomes painful: if a new game type needs a custom WS event for coordination (e.g., a turn-based game needs `game:turn_change`), there is no typed place to register that contract.

**Balance assessment:** Functional coupling at moderate distance (different processes) with high volatility = unbalanced. The protocol grows with every new feature and has no enforced shape.

**Recommended direction:** A single shared protocol definition file, co-located with the server, that both sides import:

```typescript
// server/src/ws/protocol.ts (or a shared workspace package)
export interface WsEvents {
  'match:begin':           { matchId: string; p1: string; p2: string }
  'match:opponent_joined': { matchId: string; opponent: string }
  'match:countdown':       { matchId: string; seconds: number }
  // ...
}
```

The server's `send()` function and the frontend's `ws.on()` can both be typed against this. You get autocomplete on event names and payload shapes, and a compiler error when they diverge. This is a low-effort change — no new infrastructure, just a type definition that formalises what already implicitly exists.

---

## Moderate Issues

### I6 — Winner Consensus Logic Inside the Transport Handler

**What the code does:** `handleGameOver` / `doSettle` / `markDisputed` in `ws/handlers/match.ts` (lines 302–369) implement the core competitive rule: both players must report the same winner within 10 seconds, or the match is disputed. This is a meaningful business rule — the timeout duration, the NX gate, and the dispute condition are design choices that will change as the platform evolves.

**The problem:** These 70 lines live inside the WebSocket handler, directly interleaved with Redis calls, message routing (`send()`), and telemetry. The consensus logic cannot be invoked or tested without a live WS connection and a Redis instance. If you want to change the resolution strategy — for example, adding a trusted arbiter for tournament disputes, or changing the timeout based on game type — you modify a function that is simultaneously responsible for transport, state mutation, and business logic.

**Balance assessment:** Intrusive coupling at low distance (same file) with high volatility. The low distance keeps this from being a critical issue — it is co-located and co-evolves. But it is the structural bottleneck for everything you described as wanting to add to competitive mode.

**Recommended direction:** Extract the consensus rules into a pure function that takes state and returns a decision:

```typescript
// ws/handlers/consensus.ts
export function evaluateGameOver(
  from: string, winner: string, otherReport: string | null, bet: Bet
): { action: 'settle' | 'dispute' | 'wait'; winner?: string }
```

The handler calls this and acts on the decision. The consensus logic becomes testable and changeable without touching the transport layer. This is a 30-line extraction, not a refactor.

---

## Notable (Low Volatility Saves It)

### I3 — Dual Contract Clients Without Shared Types

`frontend/lib/escrow.ts` and `server/chain/settlement.ts` both independently encode the CosmWasm `ExecuteMsg` interface as plain JavaScript objects with snake_case keys:

- Frontend: `{ create_match: { match_id, opponent } }`
- Server: `{ settle_match: { match_id, winner } }`, `{ cancel_match: { match_id } }`, `{ abort_match: { match_id } }`

These are model-level couplings at cross-system distance. If the contract changes — a new field, a renamed variant, an added parameter — both clients must be updated manually. The contract's Rust `ExecuteMsg` enum is the source of truth that neither TypeScript file references.

**Why this is tolerable now:** The escrow contract is a supporting subdomain. Once deployed, CosmWasm contracts are effectively immutable without migration. The message shapes are small and stable. The risk is low unless a migration is planned.

**When this becomes a problem:** Contract migration, adding a new execute variant (e.g., `ExtendMatch`, `DisputeResolve`), or introducing a second contract. At that point, the absence of shared types will cause missed updates.

**Recommended direction:** Nothing urgent. When the next contract change is needed, co-locate a `contract-interface.ts` file that both clients import. Many CosmWasm projects generate these from the schema JSON — worth exploring at migration time.

---

## Healthy Patterns

### GameProps: A Textbook Minimal Contract

```typescript
interface GameProps {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}
```

This two-field interface is the entire coupling surface between the match system and any game. Game engines are pure functions with zero external imports. `PacManGame` and `ShooterGame` do not know what a `matchStore` is. Adding a new game requires implementing the engine, registering it in `games.ts`, and nothing else. This is contract coupling at low distance — exactly right for a moderately volatile integration point.

The `onWinner` callback is particularly clean: the game reports a fact ("player at this address won"), and the match system decides what to do about it. The game has no knowledge of wallets, WS, or settlement.

### Server's In-Memory Match Map for Hot-Path Relay

During an active game, state packets and input events are relayed through an in-memory `Map<matchId, Match>` with no Redis hop. Only the match lifecycle (create, join, settle) touches Redis. This is the right partition: volatile, high-frequency game data stays local; durable match state is persisted. The design will not need to change when throughput grows.

### Atomic Redis Gates for Countdown and Settlement

The `NX` (set-if-not-exists) pattern used in `handlePlayerReady` and `doSettle` correctly prevents the double-countdown and double-settlement races that would otherwise occur when both players send ready/game-over simultaneously. This is correct distributed systems design for a single-node Redis.

---

## Summary

| Issue | Severity | Effort to fix |
|---|---|---|
| Three parallel state machines, no shared contract (I2) | **Critical** | Medium — shared constants file, derive from one source |
| WS protocol as implicit 30-event schema (I1) | **High** | Low — one typed protocol definition file |
| Consensus logic inside transport handler (I6) | Moderate | Low — 30-line extraction to pure function |
| Dual contract clients without shared types (I3) | Low | Low — defer to next contract migration |

The two critical issues share a root cause: the match lifecycle domain has no explicit, enforced representation that all components agree on. The WS protocol is one expression of that domain; the state machines are another. Fixing I2 first (canonical status types) will naturally reduce the scope of I1 (fewer implicit event-to-status assumptions). Neither fix requires architectural change — both are additive type definitions that make existing implicit contracts explicit.
