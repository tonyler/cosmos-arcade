# Modularity Review

**Scope**: PacMan + Void Arena — matchmaking, settlement, winner announcement, overlays
**Date**: 2026-06-24
**Model**: [Balanced Coupling](https://coupling.dev) by Vlad Khononov

---

## Executive Summary

The frontend game plugin contract is well-designed: games receive `matchCtx` and emit `onWinner(address)` — a clean, stable boundary that makes adding a new client-side game additive. The problem is on the server side. `server/src/ws/handlers/match.ts` has grown into a 520-line file that simultaneously owns match lifecycle orchestration, game engine hosting, peer-relay forwarding, consensus logic, and on-chain settlement. Two of those responsibilities — engine hosting and peer-relay — change every time a game is added or modified, making the stable lifecycle code a casualty of game-level changes. The planned plugin architecture described in `docs/game-integration.md` (`BaseMatch`, `server/src/games/<slug>/`) was never built; instead, `PacManServerGame` was embedded inline. With all games moving to server-authoritative execution, this gap will compound with each new title.

The second problem is subtler: PacMan and Arena3D use two different server-side execution models (server-authoritative vs peer-relay) with no explicit marker in the shared protocol or registry. The client has no way to know which path will be taken for a given game without reading `match.ts`. This hidden coupling makes debugging settlement failures difficult — the event sequence differs silently based on `gameSlug`.

---

## Coupling Overview

| Integration | Strength | Distance | Volatility | Balanced? |
|---|---|---|---|---|
| `PacManServerGame` class inside `match.ts` | Intrusive | None (same file) | High | ❌ No |
| Game-slug branching in `match.ts` | Functional | None (same file) | High | ❌ No |
| Two settlement paths (server-auth vs peer-relay) | Implicit | Low (same WS) | High | ❌ No |
| Games → `matchStore` via `onWinner(addr)` | Contract | Low (same process) | Low | ✅ Yes |
| `matchStore` → `escrow.ts` (`lockFunds`, `acceptMatch`) | Functional | Low (same module) | Medium | ✅ Yes |
| `MatchGate` → `matchStore` (phase + 12 fields) | Model | Low (same module) | Medium | ✅ Yes |
| `MatchSettler` → `matchStore` (phase, winner, txHash) | Model | Low (same module) | Low | ✅ Yes |
| `match.ts` → `settlement.ts` (`settleMatch`, etc.) | Functional | Low (same service) | Low | ✅ Yes |

---

## Issue 1 — Server Game Engine Embedded in Lifecycle Orchestrator

**Integration**: `PacManServerGame` → `match.ts`
**Severity**: Critical

### Knowledge Leakage

`PacManServerGame` (84 lines — tick loop, input buffering, best-of-3 round logic, broadcast) is defined directly inside `match.ts`. The `Match` interface carries a `pacmanGame?: PacManServerGame` field. `match.ts` imports the game engine at the top level:

```typescript
import { initGame, update, nextRound, type Dir, type GameState } from '../../games/pacman/engine'
```

This means `match.ts` owns knowledge of two separate domains: **how a match lifecycle runs** (create → join → ready → countdown → begin → settle) and **how PacMan ticks** (fixed 20ms interval, ghost state, round wins, `p1Wins >= 3`). These have completely different rates of change.

`docs/game-integration.md` planned a clean separation — `server/src/games/<slug>/<Slug>Match.ts`, extending `BaseMatch` — but it was never built. `PacManServerGame` is the intended `PacManMatch` class, stranded in the wrong file.

### Cascading Changes

- **Add Arena3D server-authoritative** → must edit `match.ts` to embed `Arena3DServerGame` alongside `PacManServerGame`, extend the `Match` interface again (`arena3dGame?:`), add another `if (gameSlug === 'arena3d')` branch in `handlePlayerReady`
- **Change PacMan round format** (best-of-3 → best-of-5) → must navigate 520-line `match.ts` to find game logic
- **Fix a PacMan engine bug** → the fix lives in `games/pacman/engine.ts`, but the tick interval, broadcast logic, and win condition live in `match.ts` — two files for one game

### Recommended Fix

Extract `PacManServerGame` to `server/src/games/pacman/PacManServerGame.ts`. Define a `GamePlugin` interface in `server/src/games/registry.ts`:

```typescript
// server/src/games/registry.ts
export interface GamePlugin {
  start(): void
  stop(): void
  handleInput(slot: 1 | 2, input: unknown): void
}

export type PluginFactory = (
  matchId: string,
  p1: string,
  p2: string,
  onOver: (winner: string) => void
) => GamePlugin

const registry = new Map<string, PluginFactory>()
export const registerGame = (slug: string, factory: PluginFactory) => registry.set(slug, factory)
export const getGame = (slug: string) => registry.get(slug)
```

```typescript
// server/src/games/pacman/PacManServerGame.ts
import { registerGame } from '../registry'
// ... PacManServerGame class ...
registerGame('pacman', (matchId, p1, p2, onOver) => new PacManServerGame(matchId, p1, p2, onOver))
```

`match.ts` becomes:

```typescript
// In handlePlayerReady, instead of: if (activeBet.gameSlug === 'pacman') { new PacManServerGame(...) }
const factory = getGame(activeBet.gameSlug)
if (factory) {
  match.serverGame = factory(matchId, activeBet.creator, activeBet.opponent!, (winner) => match.terminate(winner))
  match.serverGame.start()
}
```

Adding a new game now means creating a file under `server/src/games/` and registering it. `match.ts` never needs to change for game content.

---

## Issue 2 — Game-Slug Branching Will Accumulate in match.ts

**Integration**: `match.ts` per-game `if` checks
**Severity**: Critical

### Knowledge Leakage

There are already three game-slug conditionals in `match.ts`:

```typescript
// line 271 — handlePlayerReady
if (activeBet.gameSlug === 'pacman') { ... }

// line 390 — handleGameState
if (match.gameSlug === 'shooter') { ... }  // kill tracking

// line 458 — handleGameOver
if (match?.pacmanGame) return   // blocks client reports for server-auth games
```

Each represents a point where game-specific knowledge leaked into the lifecycle module. As games are added, this list grows. The [functional coupling](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) between `match.ts` and specific game slugs is not volatile on its own — but given the stated plan to add more games, the accumulation rate makes this critical.

### Cascading Changes

- **Add a game with server-side kill tracking** → add `else if (match.gameSlug === 'arena3d') { ... }` in `handleGameState`
- **Add a server-authoritative game** → add `if (match?.arena3dGame) return` in `handleGameOver`
- **Change a game's slug** → find all three (or more) branch sites in `match.ts` and update them

### Recommended Fix

The registry pattern from Issue 1 dissolves all three branches:

```typescript
// handleGameState: kill tracking becomes a plugin concern
match.serverGame?.handleInput(actualSlot, stateData)  // plugin decides what to do with state

// handleGameOver: one check, no game knowledge
if (match.serverGame) return  // all server-auth games block client reports the same way

// handleGameState relay: only fires when no serverGame
if (!match.serverGame) send(other, 'game:state', stateData)
```

`match.ts` stops knowing game slugs entirely.

---

## Issue 3 — Two Settlement Paths with No Explicit Marker

**Integration**: PacMan server-auth path vs Arena3D peer-relay path
**Severity**: Significant

### Knowledge Leakage

PacMan and Arena3D reach settlement through completely different event sequences, but nothing in the protocol, the client registry, or the store makes this explicit.

**PacMan (server-authoritative):**
```
server PacManServerGame.onOver(winner)
  → match.terminate(winner)
  → onComplete(winner)
  → send both: match:settling
  → settleMatch() on-chain
  → send both: match:settled / match:complete
```
The client never sends `game:over`. `PacManGame.tsx` renames `onWinner` to `_onWinner` (unused).

**Arena3D (peer-relay):**
```
client engine: gameOver detected
  → onWinner(addr) → announceWinner()
  → ws.send('game:over', ...)
  → server consensus (both clients must report)
  → match.terminate(winner)
  → same settlement path
```

The `matchStore` handles both paths with the same `match:settling` / `match:settled` handlers, but `announceWinner` sets `phase: 'settling'` locally **before** the server responds — only for the peer-relay model. For PacMan, `phase` stays at `'playing'` until the server fires `match:settling`. This asymmetry is invisible in the code and has already caused bugs (the winner-stuck issue fixed in this session was rooted here).

When Arena3D moves to server-authoritative, the client-side `onWinner` call in `Arena3DGame.tsx` will need to be dropped (or ignored like PacMan's), but nothing currently signals that a game should suppress the client-side report.

### Recommended Fix

Add `serverAuthoritative: boolean` to the `Game` registry in `games.ts`:

```typescript
// frontend/src/lib/games.ts
export interface Game {
  slug: string
  // ...
  serverAuthoritative: boolean  // true = server drives settlement, client onWinner is a no-op
}
```

`GamePage` or `matchStore.announceWinner` can check this flag before sending `game:over`. When Arena3D becomes server-authoritative, flip the flag — no game component code changes needed. This makes the execution model explicit rather than implicit per component.

---

## Issue 4 — matchStore Event Handler Topology Is Opaque

**Integration**: 13 `ws.on()` registrations at store construction
**Severity**: Minor

### Knowledge Leakage

All 13 WS event handlers are registered in the `create()` callback body, before `return { ...base, ... }`. There is no structural grouping by concern. Finding which event causes a phase transition from `'playing'` to `'settling'` requires reading all 13 handlers sequentially. This is the direct cause of the debugging friction on the client side.

The handlers mix three concerns: **phase transitions** (`match:settling`, `match:settled`, `match:begin`), **timer management** (`clearWaitingTimer()` in `match:opponent_joined`, `clearCountdown()` in `match:cancelled`), and **re-entry protection** (`if (get().phase !== 'complete')` in `match:complete`).

### Recommended Fix

Group the handlers by concern with section comments — no structural refactor needed:

```typescript
// ── Phase transitions ──────────────────────────────────────────────────────
ws.on('match:countdown', ...)
ws.on('match:begin', ...)
ws.on('match:settling', ...)
ws.on('match:settled', ...)
ws.on('match:complete', ...)

// ── Error terminals ────────────────────────────────────────────────────────
ws.on('match:error', ...)
ws.on('match:disputed', ...)
ws.on('match:cancelled', ...)

// ── Opponent presence ──────────────────────────────────────────────────────
ws.on('match:opponent_joined', ...)
ws.on('match:opponent_left', ...)
ws.on('match:creator_left', ...)
ws.on('match:opponent_disconnected', ...)
ws.on('match:opponent_reconnected', ...)
ws.on('match:opponent_forfeited', ...)
```

This is the minimum effective change — no movement of code, just grouping that makes the phase machine scannable.

---

## What Is Working Well

The **frontend game plugin contract** is the right design and should be the model for the server side:

- `GameProps = { matchCtx?: MatchContext; onWinner?: (addr: string) => void }` — two fields, typed, stable
- Adding a game client-side means: create files under `frontend/src/games/<slug>/`, add one entry to `GAMES[]`
- `MatchGate` and `MatchSettler` are correctly separated: creation/join UI vs result UI, each reading only what they need from `matchStore`
- `server/settlement.ts` is a clean three-function module with no game knowledge — it should stay exactly as-is

The server plugin pattern just needs to catch up to what the frontend already achieved.

---

## Recommended Sequence

These are ordered by impact-to-effort ratio given the stated plan (all games → server-authoritative, next game coming soon):

1. **Create `server/src/games/registry.ts`** — define `GamePlugin` interface and registry (new file, ~20 lines)
2. **Move `PacManServerGame` to `server/src/games/pacman/PacManServerGame.ts`** — extract, register, remove from `match.ts`
3. **Remove game-slug branches from `match.ts`** — replace three `if (gameSlug === ...)` blocks with plugin dispatch
4. **Add `serverAuthoritative` flag to `games.ts`** — one field, explicit execution model per game
5. **Group `matchStore` WS handlers by concern** — comments only, zero runtime change

Steps 1–3 together reduce `match.ts` by ~100 lines and make adding the next server-authoritative game a matter of creating one new file with no edits to lifecycle code.

---

_This analysis was performed using the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com)._
