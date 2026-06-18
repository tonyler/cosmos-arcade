# CosmosArcade — Tasks

## Done
- [x] Frontend shell (Vite + React + Tailwind)
- [x] Pacman 2P game (canvas-based, no Phaser dependency)
- [x] Zustand stores (wallet, chat, router)
- [x] Real Keplr wallet integration (lib/keplr.ts)
- [x] CosmJS balance fetching (lib/cosmjs.ts)
- [x] WebSocket client singleton (lib/ws.ts)
- [x] Node.js game server (Express + WS + Redis)
- [x] PacManMatch server-side logic
- [x] Escrow contract skeleton (CosmWasm)
- [x] Directory structure per project.md

## In Progress
- [ ] Deploy escrow contract to cosmoshub-4 testnet
- [ ] Wire up BetModal → lockFunds → escrow contract
- [ ] Connect chat to live WebSocket (currently local Zustand only)
- [ ] Username registration flow (UsernameModal → /api/username)

## Backlog
- [ ] Match history page
- [ ] Spectator mode (post-MVP)
- [ ] Tournament brackets
