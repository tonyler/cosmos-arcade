# Architecture

Three layers: Chain → Game → Social (see project.md diagram).

## Key decisions
- **No Phaser for Pacman** — uses raw Canvas API. Phaser bootstrap lives in `games/_engine/` for future games that need scenes/physics.
- **Zustand not React context** — simpler, no Provider wrapping, works outside React trees (ws event handlers)
- **Server is the result authority** — game server signs and submits the outcome tx. Browser cannot self-report wins.
- **Escrow = zero house edge** — contract holds 2x wager, pays winner exactly 2x. No fee.
