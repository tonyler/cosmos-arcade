# CosmosArcade

Arcade gaming platform on Cosmos Hub. Connect Keplr, wager ATOM, play PvP.

## Stack
- Frontend: Vite + React + TypeScript + Tailwind
- Server: Node.js + Express + WebSockets + Redis
- Chain: Cosmos Hub (CosmWasm escrow contract)

## Quick start

### Prerequisites
- Node.js 20+
- Redis (or Docker)
- Keplr browser extension

### Frontend
```bash
cd frontend && npm install && npm run dev
```

### Server
```bash
cd server && npm install && npm run dev
```

### With Docker (Redis + server)
```bash
cp .env.example .env  # fill in values
docker-compose up
```

## Adding a game
See `docs/game-integration.md`.
