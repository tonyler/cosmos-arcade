# Map Legend — Retro FPS Map Generator

Maps are written as plain ASCII strings and converted to game format by `map-generator.js`.

## How it works

```js
var MY_MAP = generateMap(label, asciiString, meta);
```

- The outer border of the grid is always a solid wall — no need to use `#` there, but you can.
- Every interior cell defaults to walkable floor.
- Special symbols place game objects (mods) at that position.
- The `meta` object sets visual properties (skybox, lighting, tint) and an optional `_extraMods` array for pickups that share a cell.

---

## Symbol Reference

### Structure

| Symbol | Meaning |
|--------|---------|
| `#`    | Solid wall |
| `\|`   | Thin wall — vertical (passable, just visual cover) |
| `-`    | Thin wall — horizontal |
| `D`    | Door (opens on approach) |
| `.`    | Empty floor (explicit — same as a space) |

### Spawnpoints

| Symbol | Meaning |
|--------|---------|
| `0`    | Spawnpoint — Player 0 (faces center-right) |
| `1`    | Spawnpoint — Player 1 (faces center-left) |
| `2`    | Spawnpoint — Player 2 (faces center-up) |
| `3`    | Spawnpoint — Player 3 (faces center-down) |

### Game Objectives

| Symbol | Meaning |
|--------|---------|
| `H`    | Hotspot (King of the Hill capture point) |
| `?`    | Teleport pad |

### Weapon Pickups

| Symbol | Meaning |
|--------|---------|
| `p`    | Pistol |
| `m`    | Machinegun |
| `s`    | Shotgun |
| `n`    | Sniper rifle |
| `r`    | Rocket launcher |
| `g`    | Grenade launcher |
| `k`    | Knife |

### Floor Modifiers

| Symbol | Meaning |
|--------|---------|
| `J`    | Jump pad |
| `~`    | Water (slows movement) |
| `*`    | Lava (damages) |
| `F`    | Flames (damages) |
| `^`    | Elevated floor (step up) |
| `_`    | Lowered floor (step down) |
| `i`    | Ice (slippery) |

### Obstacles & Decorations

| Symbol | Meaning |
|--------|---------|
| `C`    | Column (large, blocks bullets) |
| `T`    | Pole / post (thin) |
| `B`    | Bush |
| `S`    | Stalagmite |
| `f`    | Leaf decoration |

---

## Meta options

```js
{
  description: 'Map description shown in the lobby',
  skybox: 'mountains',   // mountains | city | earth | moon | mars | jungle | space
  skyboxTint: 0.9,
  skyboxLight: 1.8,
  ceilingLight: 1.0,
  ceilingTint: 1.0,
  wallLight: 1.0,
  wallTint: 1.0,
  spritesTint: 1.2,
  shadowLight: 0.4,
  shadowTint: 0.85,
  tintColor: 'BROWN',    // Any PALETTE key: BROWN, BLUE, RED, GREEN, YELLOW, CYAN, PURPLE…
  _extraMods: [          // Extra mods that share a cell with another symbol
    { x: 4, y: 4, type: 'pickablePistol' }
  ]
}
```

---

## Example

```js
var MAP_EXAMPLE = generateMap(
  'My Map',
  [
    '##########',
    '#0......1#',
    '#...##...#',
    '#..#H#...#',
    '#...##...#',
    '#2......3#',
    '##########',
  ].join('\n'),
  { skybox: 'city', tintColor: 'BLUE', description: 'A tiny test arena.' }
);
```

---

## Adding a new map

1. Create `js/maps/my-map.js`
2. Call `generateMap(...)` — use the ASCII grid + meta
3. Add `MAP_MY_MAP` to `js/maps/index.js`
4. Add `<script src="js/maps/my-map.js"></script>` in `arcade.html` before `index.js`
5. Run `npm run build` in the `frontend/` directory

---

## Planned symbols (future assets)

| Symbol | Planned meaning |
|--------|----------------|
| `=`    | Stairs / ramp up |
| `%`    | Crate (destructible cover) |
| `@`    | Flag (Capture the Flag) |
| `X`    | Kill zone (instant death) |
| `+`    | Medkit / health pickup |
