# CosmosArcade — Full Project Prompt

## What We're Building
A browser-based arcade gaming platform on Cosmos Hub. Think Friv meets onchain competitive
wagering. Players connect their Keplr wallet, browse arcade games, challenge others to PvP
matches, and bet ATOM or USDC on the outcome. The platform holds zero funds — escrow lives
entirely in smart contracts, winners receive funds directly. No house edge, no platform cut.

## Core Principles
- **No accounts.** Wallet = identity. Always.
- **Modular everything.** Games, contracts, and social layers are fully independent.
- **Vibe-code friendly.** Prefer explicit, flat, readable code over clever abstractions.
- **Prod-ready minded from day one.** Folder structure, separation of concerns, and naming
  should scale without rewrites.
- **Onchain only for money.** Game logic is offchain. Escrow and settlement is onchain.

---

## Tech Stack

### Frontend
- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **Phaser.js** for all game rendering (isolated per game)
- **Zustand** for global state (wallet, user, chat, lobby)
- **Keplr wallet** via `@keplr-wallet/types` + CosmJS

### Backend / Game Server
- **Node.js + TypeScript**
- **WebSockets** (`ws` library) for real-time: lobby, matchmaking, chat, game state sync
- **Express** for REST endpoints (username registration, match history)
- **Redis** for ephemeral state: lobbies, active matches, chat rooms

### Blockchain
- **Cosmos Hub** (CosmWasm smart contracts in Rust)
- **Contracts:** escrow/settlement only — no game logic onchain
- **Tokens:** ATOM and USDC (Noble)

---

## Three-Layer Architecture
┌─────────────────────────────────────────────┐

│              CHAIN LAYER                     │

│  CosmWasm escrow contract                   │

│  - Lock funds for a match                   │

│  - Accept signed result from game server    │

│  - Release to winner / refund on timeout    │

└─────────────────────────────────────────────┘

▲

│ signed result

┌─────────────────────────────────────────────┐

│              GAME LAYER                      │

│  Phaser.js games in browser (offchain)      │

│  Node.js game server (result authority)     │

│  - Runs match logic / tick validation       │

│  - Signs and submits result to contract     │

│  - Handles disconnect / timeout logic       │

└─────────────────────────────────────────────┘

                 ▲

          │ WebSocket

┌─────────────────────────────────────────────┐

│              SOCIAL LAYER                    │

│  Lobbies, matchmaking, chat, usernames      │

│  - Fully offchain, Redis-backed             │

│  - Always visible, togglable chat sidebar   │

│  - DMs + general chat                       │

│  - Username set via wallet message signing  │

└─────────────────────────────────────────────┘
---

## Directory Structure
cosmos-arcade/

│

├── frontend/                        # Vite + React app

│   ├── public/

│   ├── src/

│   │   ├── assets/                  # Fonts, icons, sprites

│   │   ├── components/

│   │   │   ├── layout/

│   │   │   │   ├── Navbar.tsx       # Wallet connect, username, top bar

│   │   │   │   ├── ChatSidebar.tsx  # Always-visible, togglable

│   │   │   │   └── AppShell.tsx     # Root layout wrapper

│   │   │   ├── lobby/

│   │   │   │   ├── GameGrid.tsx     # Friv-style game browser

│   │   │   │   ├── GameCard.tsx

│   │   │   │   ├── MatchLobby.tsx   # Challenge / join match

│   │   │   │   └── PlayerList.tsx   # Online players

│   │   │   ├── match/

│   │   │   │   ├── BetModal.tsx     # Choose ATOM/USDC, amount

│   │   │   │   ├── EscrowStatus.tsx # Onchain tx status

│   │   │   │   └── MatchResult.tsx  # Win/lose screen

│   │   │   ├── chat/

│   │   │   │   ├── GeneralChat.tsx

│   │   │   │   ├── DMThread.tsx

│   │   │   │   └── ChatMessage.tsx

│   │   │   └── wallet/

│   │   │       ├── ConnectButton.tsx

│   │   │       ├── UsernameModal.tsx

│   │   │       └── WalletProvider.tsx

│   │   ├── games/                   # One folder per game

│   │   │   ├── _engine/             # Shared Phaser bootstrap

│   │   │   │   ├── PhaserGame.tsx   # React wrapper for Phaser canvas

│   │   │   │   └── GameBridge.ts    # Phaser <-> React event bus

│   │   │   ├── snake/

│   │   │   │   ├── SnakeGame.tsx

│   │   │   │   └── scenes/

│   │   │   │       ├── SnakeScene.ts

│   │   │   │       └── SnakeHUD.ts

│   │   │   ├── tetris/

│   │   │   │   └── ...

│   │   │   └── bounce/

│   │   │       └── ...

│   │   ├── hooks/

│   │   │   ├── useWallet.ts

│   │   │   ├── useMatch.ts

│   │   │   ├── useChat.ts

│   │   │   └── useUsername.ts

│   │   ├── store/                   # Zustand stores

│   │   │   ├── walletStore.ts

│   │   │   ├── matchStore.ts

│   │   │   └── chatStore.ts

│   │   ├── lib/

│   │   │   ├── cosmjs.ts            # CosmJS client setup

│   │   │   ├── keplr.ts             # Keplr connect helpers

│   │   │   ├── escrow.ts            # Contract interaction helpers

│   │   │   └── ws.ts                # WebSocket client singleton

│   │   ├── pages/

│   │   │   ├── Home.tsx             # Game grid / main lobby

│   │   │   ├── GamePage.tsx         # Loads a game by slug

│   │   │   └── MatchPage.tsx        # Active match view

│   │   ├── types/

│   │   │   ├── match.ts

│   │   │   ├── wallet.ts

│   │   │   └── chat.ts

│   │   ├── App.tsx

│   │   └── main.tsx

│   ├── index.html

│   ├── vite.config.ts

│   └── tailwind.config.ts

│

├── server/                          # Node.js game + social server

│   ├── src/

│   │   ├── ws/

│   │   │   ├── index.ts             # WS server bootstrap

│   │   │   ├── handlers/

│   │   │   │   ├── lobby.ts         # Join/leave lobby events

│   │   │   │   ├── match.ts         # Challenge, accept, game events

│   │   │   │   └── chat.ts          # General chat + DM events

│   │   │   └── rooms.ts             # Room/channel management

│   │   ├── games/                   # Server-side match logic per game

│   │   │   ├── _base/

│   │   │   │   └── BaseMatch.ts     # Abstract match class

│   │   │   ├── snake/

│   │   │   │   └── SnakeMatch.ts

│   │   │   └── tetris/

│   │   │       └── TetrisMatch.ts

│   │   ├── chain/

│   │   │   ├── signer.ts            # Server wallet / result signing

│   │   │   └── settlement.ts        # Submit result tx to contract

│   │   ├── api/

│   │   │   ├── routes/

│   │   │   │   ├── username.ts      # GET/POST username by address

│   │   │   │   └── history.ts       # Match history

│   │   │   └── index.ts

│   │   ├── redis.ts                 # Redis client singleton

│   │   └── index.ts                 # Entry point

│   ├── package.json

│   └── tsconfig.json

│

├── contracts/                       # CosmWasm smart contracts (Rust)

│   ├── escrow/

│   │   ├── src/

│   │   │   ├── lib.rs

│   │   │   ├── contract.rs          # Execute, query, instantiate

│   │   │   ├── msg.rs               # Contract messages

│   │   │   ├── state.rs             # Match state stored onchain

│   │   │   └── error.rs

│   │   ├── Cargo.toml

│   │   └── schema/                  # Auto-generated JSON schema

│   └── Cargo.toml

│

├── tasks/                           # Claude task tracking

│   ├── todo.md

│   └── lessons.md

│

├── docs/

│   ├── architecture.md

│   ├── game-integration.md          # How to add a new game

│   └── contract-flow.md             # Escrow lifecycle diagram

│

├── CLAUDE.md                        # This file

├── docker-compose.yml               # Redis + server local dev

├── .env.example

└── README.md
---

## Frontend Design Direction

**Vibe:** Dark arcade cabinet meets clean web3. Not neon-overloaded, not sterile.

- **Background:** Very dark (near black, slight cool tint — `#0d0f14`)
- **Accent:** One strong color — electric violet or arcade green. Pick one, use it everywhere.
- **Game cards:** Slight glow on hover, pixel-art friendly aspect ratios, no rounded corners
  (sharp edges feel more arcade)
- **Typography:** One display font (pixel or retro-inspired) for game titles only.
  Everything else is a clean modern sans (Inter or Geist)
- **Chat sidebar:** Slim, collapsible, always on top. Think Discord sidebar but thinner.
  Slides in/out without disrupting game canvas.
- **Wallet button:** Top right always. Shows truncated address or username once connected.
  On click: dropdown with balance (ATOM + USDC), username edit, disconnect.
- **Match flow:** Modal-driven — never navigate away from the game grid to start a match.
  Bet → Escrow confirming → Game starts, all in layered modals.
- **In-game UI:** Absolutely minimal. Score top, opponent score top. Nothing else.
  Chat is togglable but collapsed by default inside a game.

---

## Escrow Contract Flow
Player A challenges Player B

│

▼

Player A locks ATOM/USDC → contract (match created onchain)

│

▼

Player B accepts → locks same amount → match is ACTIVE

│

▼

Game plays out (offchain, browser + game server)

│

▼

Game server signs result → submits to contract

│

▼

Contract releases 2x to winner (minus 0% — no fee)

│

▼ (timeout path)

If no result in N minutes → both players get refund
---

## How to Add a New Game (checklist)
1. Add folder under `frontend/src/games/<gamename>/`
2. Create Phaser scene(s) + React wrapper
3. Implement `GameBridge` events: `game:ready`, `game:score`, `game:over`
4. Add server-side `<Game>Match.ts` extending `BaseMatch`
5. Register game slug in game registry (`frontend/src/lib/games.ts`)
6. Add game card asset to `assets/`
7. Done — escrow, chat, and lobby work automatically

---

## What We Are NOT Building Yet
- Tournaments (next milestone)
- Mobile app
- Token rewards / points system
- Spectator mode
- Leaderboards (maybe soon, not now)

