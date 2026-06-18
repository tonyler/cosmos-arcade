# Adding a New Game

1. `frontend/src/games/<slug>/` — create Phaser scenes + React wrapper
2. Emit `gameBridge` events: `game:ready`, `game:score` (payload: `{score}`), `game:over` (payload: `{winner: 1|2}`)
3. Use `<PhaserGame config={...} onScore={...} onGameOver={...} />` as the React entry point
4. `server/src/games/<slug>/<Slug>Match.ts` — extend `BaseMatch`, implement `handleEvent`
5. Add to `frontend/src/lib/games.ts` (GAMES array)
6. Done — escrow, chat, lobby attach automatically
