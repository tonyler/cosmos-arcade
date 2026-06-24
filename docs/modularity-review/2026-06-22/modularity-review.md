# Modularity Review

**Scope**: Retro FPS game — configurability for new maps, weapons, and content
**Date**: 2026-06-22

## Executive Summary

The Retro FPS is the open-source "Player Versus Player" engine by KesieV, embedded in a React iframe. The outer boundary — `RetroFPSGame.tsx` communicating with the game via a typed postMessage [contract](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) — is clean and well-designed. Inside the iframe, however, the game uses a global-variable architecture where all content lives in a small set of large files. The [modularity](https://coupling.dev/posts/core-concepts/modularity/) of this inner layer has three significant problems from the perspective of adding new content: weapon registration is an implicit multi-file contract with no enforcement; all map data lives in a single monolithic file; and the asset manifest (sounds, images) is hardcoded directly in `arcade.html`. As the game grows with new maps, weapons, and modes, these problems will compound: changes are frequent, but each change requires coordinating 2–4 files with no mechanical check that they are consistent.

## Coupling Overview Table

| Integration | [Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | [Distance](https://coupling.dev/posts/dimensions-of-coupling/distance/) | [Volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) | [Balanced?](https://coupling.dev/posts/core-concepts/balance/) |
|---|---|---|---|---|
| `RetroFPSGame.tsx` → `arcade-netplay.js` | [Contract](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | High (iframe boundary) | Low | ✅ Yes |
| `weapons.js` → `maploader.js` (pickable tiles) | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (implicit string) | Low (same scope) | High | ❌ No |
| `weapons.js` → `arcade.html` (sound IDs) | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (implicit string) | Low (same load) | High | ❌ No |
| `maps.js` (monolith) → `maploader.js` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low (same scope) | High | ❌ No |
| `maploader.js` TILETYPES → map authors | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low (same scope) | Medium | ⚠️ Marginal |
| `maps.js` / `weapons.js` → `gamemodes.js` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low (same scope) | Low | ✅ Yes |

---

## Issue: Weapon Registration Is an Implicit Four-File Contract

**Integration**: `weapons.js` → `maploader.js` → `arcade.html`
**Severity**: Critical

### Knowledge Leakage

Adding a new weapon requires knowing — and correctly executing — four separate steps across four different files, with no code to remind you if you miss one:

1. **`weapons.js`**: define the weapon object, including `sound: "plasma"` (a string ID) and `spriteY: 7` (a raw pixel-grid coordinate into `weapons.png`)
2. **`maploader.js`**: add a `pickablePlasma` entry to `TILETYPES` with `pickable: true, weapon: "plasma"` (the string must match exactly)
3. **`arcade.html`**: add `{ id: 'plasma', file: 'sounds/plasma' }` to the `AUDIO` array
4. **`arcade.html`**: add `{ id: 'speak_plasma', sam: { text: 'plasma!' } }` to the `AUDIO` array for the voice announcer

The [integration strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) between these components is functional: they share business-logic knowledge (what a weapon is, how it sounds, how it is picked up) but express that knowledge as matching strings distributed across files. The string `"plasma"` is an invisible shared contract with no type system, no schema, and no validation.

### Complexity Impact

This is a [complexity](https://coupling.dev/posts/core-concepts/complexity/) problem: the outcome of a change is unpredictable because the mental model required to add one weapon spans four files with no single source of truth. A developer who correctly adds the weapon to `weapons.js` and `maploader.js` but forgets the sound entries in `arcade.html` gets a weapon that silently plays nothing — no error, no crash, just broken behaviour. The `spriteY` coordinate is even more opaque: it is a magic number referencing a row in a PNG spritesheet, and there is no code that validates whether the row exists.

The 4+/-1 unit cognitive limit is breached: holding the weapon definition, the tile type, the sound ID, the voice ID, and the sprite coordinate in working memory simultaneously while editing four unrelated files is error-prone by design.

### Cascading Changes

- **Add a weapon** → must update `weapons.js`, `maploader.js`, `arcade.html` (twice), and the graphics PNG
- **Rename a weapon ID** → `weapons.js`, `maploader.js` (`weapon:` field), any map data referencing the tile name, `arcade.html` (sound IDs), announcer references in `gamemodes.js`
- **Add a weapon sound variant** → `arcade.html` plus any code reading the sound ID
- **Reorder the weapons spritesheet** → every `spriteY` / `pickTextureX` / `pickTextureY` value in `weapons.js` must be updated by hand

### Recommended Improvement

Introduce a **weapon manifest** — a single object (or file) that co-locates all the information needed to register a weapon: its gameplay stats, its sound IDs, its sprite coordinates, and its pickable tile name. The `arcade.html` asset loader and `maploader.js` TILETYPES should be generated from this manifest, not maintained by hand.

Minimum viable step (no new infrastructure): move the sound and sprite fields into `weapons.js` entries and write a small `registerWeapons()` function called at startup that populates `TILETYPES` pickable entries from `WEAPONS` automatically — eliminating the manual `pickablePlasma` step. This reduces four-file coordination to two (weapon data + graphics asset).

The trade-off: this requires a small refactor of the startup sequence in `arcade.html`, but the payoff — adding a weapon in one place — is directly proportional to how often new weapons are added.

---

## Issue: All Maps Live in a Single Monolithic File

**Integration**: `maps.js` → `maploader.js`, `gamemodes.js`, `scoreattack.js`
**Severity**: Significant

### Knowledge Leakage

`maps.js` is a single JavaScript file containing every map definition as entries in one `MAPS[]` array. At over 3,500 lines, every map's full grid data (wall, floor, ceiling layers as numeric arrays) and modifier list coexists in the same file. The [model coupling](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) between the file and its consumers (`maploader.js`, `gamemodes.js`) is appropriate — they only read `MAPS[id].wall.grid`, `MAPS[id].mods`, and `MAPS[id].label` — but the physical co-location of all maps in one file makes the [volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) of each individual map expensive to manage.

### Complexity Impact

When every map lives in one file, adding or editing any map requires opening, navigating, and correctly modifying a 3,500-line file. This creates practical friction: map data is dense (numeric arrays), maps are hard to diff in version control, and working on two maps simultaneously causes merge conflicts in the same file. There is also no obvious place to add per-map documentation or metadata without it getting lost in the monolith.

### Cascading Changes

- **Add a map** → append to `maps.js`; the rest of the system (UI, random selection, score tracking) picks it up automatically via `MAPS.length` and `MAPS.forEach` — so only one file needs changing
- **Edit an existing map** → must navigate a 3,500-line file; any concurrent map edit causes a merge conflict
- **Add a map-specific game mode override** → there is nowhere clean to express this; it would go into the same blob

### Recommended Improvement

Split `maps.js` into individual map files: `maps/the-pit.js`, `maps/forest.js`, etc. Create a thin `maps/index.js` that imports all of them and assembles `MAPS = [ThePit, Forest, ...]`. Each file is ~50–150 lines, self-contained, and independently diffable.

`arcade.html` adds one `<script>` tag per map file (or they concatenate at build time). The consumers (`maploader.js`, `gamemodes.js`) require no changes — they still read the same `MAPS` global.

Trade-off: more files, one extra `<script>` tag per map. The payoff: each map is an independently editable, reviewable, and merge-safe unit. This is the right structure when maps are the primary content creation surface.

---

## Issue: Asset Manifest Is Hardcoded in arcade.html

**Integration**: Content files (maps, weapons, sounds) → `arcade.html` AUDIO/IMAGES arrays
**Severity**: Significant

### Knowledge Leakage

`arcade.html` contains two hardcoded arrays — `IMAGES` and `AUDIO` — that list every asset the game will load. These arrays are the sole registration mechanism for sounds, music, and graphics. Adding any content that requires a new asset requires editing the HTML file directly. This is [functional coupling](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) at the wrong level: the HTML entry point owns business-domain knowledge (which weapons have sounds, which skyboxes exist) that should live closer to the content definitions.

### Complexity Impact

`arcade.html` becomes a required stop on every content-addition workflow, even when the change is entirely about a new weapon or a new map skybox. A developer adding a weapon must remember that `arcade.html` is the sound registry — this is non-obvious, especially since `weapons.js` is where weapon behaviour is defined. The failure mode is silent: a missing sound entry causes the weapon to play nothing, with no console error from the game engine.

### Cascading Changes

- **Add a weapon** → edit `arcade.html` (sound + voice entries) in addition to `weapons.js` and `maploader.js`
- **Add a new skybox for a map** → edit `arcade.html` (IMAGES entry) plus whatever map references it
- **Add background music** → edit `arcade.html` AUDIO with `isSong: true`, plus reference by ID from game code
- **Remove a weapon** → must remember to clean up its entries from `arcade.html` or the file stays loaded forever

### Recommended Improvement

Move asset registration to the data files that own the content. Weapon sounds belong next to weapon definitions; skybox images belong next to the map definitions that use them. At startup, a small asset collector function can walk `WEAPONS` and `MAPS` to assemble the dynamic load list, removing the need to maintain `arcade.html` manually.

For the short term, a lower-cost improvement is to add a comment block in `arcade.html` that explicitly marks which AUDIO entries correspond to which weapon, making the implicit contract visible without changing any code.

---

## Issue: Map Authoring Vocabulary (TILETYPES) Is Buried in the Loader

**Integration**: Map authors → `maploader.js` TILETYPES
**Severity**: Minor

### Knowledge Leakage

The complete vocabulary of tile type names available when authoring a map — `door`, `flames`, `lava`, `pickableShotgun`, `spawnpoint0`, `hotspot`, `teleport`, etc. — is defined inside the `MapLoader` function in `maploader.js`, not alongside the map data. A developer creating a new map must read the loader implementation to discover what tile type names are available. This is an [integration strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) problem: the map data and the tile vocabulary are conceptually the same domain (map authoring), but physically separated.

### Complexity Impact

The cognitive cost is modest — once you know that TILETYPES is in `maploader.js`, you can find it. But it creates a discovery barrier for new contributors and makes it easy to typo a tile name (e.g., `pickableRocket` instead of `pickableRocketLauncher`) with no error until runtime.

### Cascading Changes

- **Add a new tile type** → edit `maploader.js`; maps can immediately reference it
- **Remove a tile type** → maps silently stop using it (unknown tile names are ignored); no warning
- **Discover what tile types exist** → must read `maploader.js` implementation code

### Recommended Improvement

Extract `TILETYPES` from inside the `MapLoader` function into a top-level constant in `data.js` (where other game constants live) or into its own `tiletypes.js` file. This makes the vocabulary self-documenting and adjacent to the map data it governs. `maploader.js` simply imports and uses it. No behaviour changes, minimal diff.

---

_This analysis was performed using the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com)._
