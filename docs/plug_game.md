# Plugging a New Game into Cosmos Arcade

Everything you need to wire a game into matchmaking, onchain wagers, and settlement.
No changes to the platform are required — just follow the four steps below.

---

## 1. Create your game component

**Directory**: `frontend/src/games/<slug>/`

```
frontend/src/games/
  pacman/          ← reference implementation
    PacManGame.tsx
    engine.ts
    renderer.ts
  shooter/         ← reference implementation
    ShooterGame.tsx
    engine.ts
    renderer.ts
  mygame/          ← your game goes here
    MyGame.tsx     ← the React entry point
    engine.ts      ← optional: pure game logic
    renderer.ts    ← optional: canvas rendering
```

Your root component **must** accept this exact props interface:

```tsx
// frontend/src/types/match.ts
export interface MatchContext {
  matchId: string
  mySlot: 1 | 2          // 1 = match creator, 2 = joiner
  myAddress: string
  opponentAddress: string
  p1Address: string      // always the creator
  p2Address: string      // always the joiner
}

// Your component signature:
interface Props {
  matchCtx?: MatchContext   // undefined in solo/test mode
  onWinner?: (addr: string) => void
}

export default function MyGame({ matchCtx, onWinner }: Props) { ... }
```

### Rules

- **`matchCtx` is undefined** when the game is played without a match (test URL `?test=mygame`).
  Gate all WS sends behind `if (matchCtx)`.
- **Call `onWinner(address)`** exactly once when the game ends.
  Pass the winner's wallet address (not a slot number).
  The platform handles everything after that — settlement, UI, onchain payout.
- **Never import from matchStore or MatchGate.** The game is a pure renderer.
  It receives context in, fires one callback out.

### Minimal skeleton

```tsx
import { useEffect, useRef } from 'react'
import { ws } from '../../lib/ws'
import type { MatchContext } from '../../types/match'

interface Props {
  matchCtx?: MatchContext
  onWinner?: (addr: string) => void
}

export default function MyGame({ matchCtx, onWinner }: Props) {
  const winnerSentRef = useRef(false)

  useEffect(() => {
    // Subscribe to opponent state if in a match
    let off: (() => void) | undefined
    if (matchCtx) {
      off = ws.on('game:state', (data: any) => {
        if (data.matchId !== matchCtx.matchId) return
        // apply opponent state to your engine
      })
    }

    // Your game loop here...

    return () => { off?.() }
  }, [matchCtx?.matchId])

  function handleWinner(winnerAddr: string) {
    if (winnerSentRef.current) return
    winnerSentRef.current = true
    onWinner?.(winnerAddr)
  }

  return <canvas ... />
}
```

---

## 2. Register the game

**File**: `frontend/src/lib/games.ts`

Add one entry to the `GAMES` array:

```ts
import { lazy } from 'react'

export const GAMES: Game[] = [
  // ... existing games ...
  {
    slug: 'mygame',                          // URL slug — must be unique, lowercase, no spaces
    title: 'My Game',                        // Display name
    description: 'One sentence pitch.',      // Shown on game card
    category: 'Action',                      // 'Arcade' | 'Puzzle' | 'Action' | 'Strategy'
    players: '1v1',                          // Display string
    thumb: '/hackathon/assets/games/mygame.jpg',  // 1280×720 recommended, stored in public/assets/games/
    component: lazy(() => import('../games/mygame/MyGame')),
  },
]
```

That's the entire frontend registration. Routing, lobby listing, match creation, and game card rendering all happen automatically from this entry.

---

## 3. Use the WebSocket relay for multiplayer

The server is a relay — it forwards your state packets to the opponent untouched.
You own the protocol inside `game:state`. The server only validates:
- sender is a match participant
- payload ≤ 8 KB
- it injects `matchId` (server-side, spoofing-proof)

### Send your state (hot path, ~60 Hz)

```ts
import { ws } from '../../lib/ws'

// Inside your game loop, after computing new state:
if (matchCtx) {
  ws.send('game:state', {
    matchId: matchCtx.matchId,
    // anything your opponent needs to render:
    x: player.x,
    y: player.y,
    health: player.health,
    bullets: activeBullets,
    // ...
  })
}
```

### Receive opponent state

```ts
ws.on('game:state', (data: any) => {
  if (data.matchId !== matchCtx.matchId) return
  // data contains exactly what the opponent sent, plus matchId
  applyOpponentState(data)
})
```

### Optional: low-latency input relay

For input that needs to arrive faster than your state tick (e.g. direction changes):

```ts
// Send:
ws.send('game:input', {
  matchId: matchCtx.matchId,
  slot: matchCtx.mySlot,
  dir: directionCode,    // any integer
})

// Receive:
ws.on('game:input', (data: any) => {
  if (data.matchId !== matchCtx.matchId) return
  applyOpponentInput(data.slot, data.dir)
})
```

### Who is P1 vs P2?

```ts
// matchCtx.mySlot === 1  → you are the match creator (spawns left by convention)
// matchCtx.mySlot === 2  → you are the joiner (spawns right by convention)

const iAmCreator = matchCtx.mySlot === 1
```

---

## 4. Declare a winner

When your game logic determines the game is over:

```ts
// winnerAddr must be matchCtx.p1Address or matchCtx.p2Address
// myAddress wins:
onWinner?.(matchCtx.myAddress)

// opponent wins:
onWinner?.(matchCtx.opponentAddress)
```

**What happens next (automatic):**

```
onWinner(addr)
  └─ matchStore.announceWinner(addr)
       └─ ws.send('game:over', { matchId, winner: addr })
            └─ Server consensus protocol:
                 ├─ Both players agree on winner → settle on-chain
                 │    └─ Escrow contract: settle_match(matchId, winner)
                 │         → 2× wager sent to winner
                 │         → 'match:settled' sent to both clients
                 │
                 ├─ Players disagree → 'match:disputed' (funds frozen, admin reviews)
                 │
                 └─ One player only (other disconnected) → settle after 10s timeout
```

You never call the escrow contract directly. Never send `game:over` yourself.
Just call `onWinner` and the MatchSettler overlay takes over.

---

## Match context reference

```ts
matchCtx.matchId         // e.g. "mygame-1687450123456-a1b2"
matchCtx.mySlot          // 1 or 2
matchCtx.myAddress       // "cosmos1abc..."  (your address)
matchCtx.opponentAddress // "cosmos1xyz..."  (opponent)
matchCtx.p1Address       // always creator
matchCtx.p2Address       // always joiner
```

---

## Wager flow (for reference — fully automatic)

You don't implement any of this. It's here so you understand what surrounds your game.

```
Player creates match
  → Frontend calls escrow contract: create_match(matchId, opponent?)
    → Funds locked on-chain (Pending state)
  → Server stores match in Redis, broadcasts to lobby

Opponent joins
  → Frontend calls escrow contract: accept_match(matchId)
    → Funds locked on-chain (Active state)
  → Server: both see match:opponent_joined

Both click "I'M READY"
  → Server atomic gate: only one handler fires countdown
  → match:countdown (3s) → match:begin
  → Your game component mounts with matchCtx

Game plays, your engine runs...

onWinner(addr) called
  → Server consensus → settle_match on-chain
  → Winner receives 2× wager
  → match:settled sent to both clients
  → MatchSettler overlay shows result
```

---

## Checklist

- [ ] Component in `frontend/src/games/<slug>/`
- [ ] Accepts `{ matchCtx?, onWinner? }` props
- [ ] Calls `onWinner(address)` exactly once when game ends
- [ ] All WS sends gated behind `if (matchCtx)`
- [ ] State packets ≤ 8 KB
- [ ] Works without `matchCtx` (solo/test mode at `?test=<slug>`)
- [ ] Entry added to `GAMES` in `frontend/src/lib/games.ts`
- [ ] Thumbnail at `frontend/public/assets/games/<slug>.jpg` (1280×720)
- [ ] `npm run build` passes

---

## Testing your game

**Solo mode** (no server, no wallet needed):
```
http://localhost:5173/?test=mygame
```

**Two-browser match test** (casual, no wallet):
1. Open two browser windows
2. In window 1: create a casual match for `mygame`
3. In window 2: join from the public lobby
4. Both ready up → game starts with `matchCtx` populated

**Competitive match test** (requires Keplr + testnet tokens):
- Same flow as casual but select "Competitive" and enter a wager amount
