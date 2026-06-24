// ── Server-side game plugin registry ─────────────────────────────────────────
// To add a new server-authoritative game: create a file under
// server/src/games/<slug>/<Slug>ServerGame.ts, implement GamePlugin,
// call registerGame('<slug>', factory) at module level, then import
// the file as a side-effect in server/src/ws/index.ts.
// match.ts never needs to change for game content.

export interface GamePlugin {
  start(): void
  stop(): void
  handleInput(slot: 1 | 2, input: number): void
}

export type PluginFactory = (
  matchId: string,
  p1: string,
  p2: string,
  onOver: (winner: string) => void,
) => GamePlugin

const registry = new Map<string, PluginFactory>()
export const registerGame = (slug: string, factory: PluginFactory) => registry.set(slug, factory)
export const getGame = (slug: string) => registry.get(slug)
