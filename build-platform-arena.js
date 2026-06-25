#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SRC = '/home/cosmos-arcade/frontend/public/retro-fps/js/maps.js';
const DIST = '/home/cosmos-arcade/frontend/dist/retro-fps/js/maps.js';

// ─── 1. Load existing MAPS ───────────────────────────────────────────────────
const src = fs.readFileSync(SRC, 'utf8');
// Strip `var MAPS=` prefix and trailing `;`
const jsonStr = src.replace(/^\s*var\s+MAPS\s*=\s*/, '').replace(/;\s*$/, '');
const MAPS = JSON.parse(jsonStr);
console.log(`Loaded ${MAPS.length} maps. Replacing MAPS[0] ("${MAPS[0].label || '?'}").`);

// ─── 2. Build wallGrid ───────────────────────────────────────────────────────
const wallGrid = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // 0
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // 1
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // 2
  [1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1], // 3
  [1,0,0,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,0,0,1], // 4
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 5
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 6
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 7
  [1,0,0,1,0,1,1,1,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,1,1,0,1,0,0,1], // 8
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // 9
  [1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1], // 10
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // 11
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // 12
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // 13
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // 14
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1], // 15
  [1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1], // 16
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // 17
  [1,0,0,1,0,1,1,1,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,1,1,0,1,0,0,1], // 18
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 19
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 20
  [1,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,1], // 21
  [1,0,0,1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,1,0,0,1], // 22
  [1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1], // 23
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // 24
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1], // 25
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], // 26
];

// ─── 3. Validate wallGrid ────────────────────────────────────────────────────
let valid = true;
if (wallGrid.length !== 27) {
  console.error(`ERROR: wallGrid has ${wallGrid.length} rows, expected 27`);
  valid = false;
}
wallGrid.forEach((row, i) => {
  if (row.length !== 31) {
    console.error(`ERROR: row ${i} has ${row.length} elements, expected 31`);
    valid = false;
  }
});
if (valid) console.log('VALIDATED: 27 rows × 31 cols ✓');

// ─── 4. Build floor and ceiling grids ────────────────────────────────────────
const floorGrid = wallGrid.map(row => row.map(cell => cell === 1 ? 0 : 3));
const ceilingGrid = wallGrid.map(row => row.map(() => 0));

// Spot check ceiling
const ceilingSample = ceilingGrid.slice(0, 3).map(r => r.slice(0, 5));
console.log('Ceiling grid sample (rows 0-2, cols 0-4):', JSON.stringify(ceilingSample), '← all 0s');

// ─── 5. Build mods ───────────────────────────────────────────────────────────
const mods = [
  // Spawns
  {x:2,y:2,type:"spawnpoint0",properties:{angle:0}},
  {x:28,y:2,type:"spawnpoint1",properties:{angle:3.14}},
  {x:2,y:24,type:"spawnpoint2",properties:{angle:0}},
  {x:28,y:24,type:"spawnpoint3",properties:{angle:3.14}},

  // Platform 1 enclosure walls → lower (top-left, rows 4-8 cols 5-11)
  // Top wall of platform 1: row 4, cols 5-11
  {x:5,y:4,type:"lower"},{x:6,y:4,type:"lower"},{x:7,y:4,type:"lower"},
  {x:8,y:4,type:"lower"},{x:9,y:4,type:"lower"},{x:10,y:4,type:"lower"},{x:11,y:4,type:"lower"},
  // Left wall: col 5, rows 5-7
  {x:5,y:5,type:"lower"},{x:5,y:6,type:"lower"},{x:5,y:7,type:"lower"},
  // Right wall: col 11, rows 5-7
  {x:11,y:5,type:"lower"},{x:11,y:6,type:"lower"},{x:11,y:7,type:"lower"},
  // Bottom wall: row 8, cols 5-6 and 10-11 (cols 7-8 are open entry gaps)
  {x:5,y:8,type:"lower"},{x:6,y:8,type:"lower"},{x:10,y:8,type:"lower"},{x:11,y:8,type:"lower"},

  // Platform 2 enclosure walls → lower (top-right, rows 4-8 cols 19-25)
  {x:19,y:4,type:"lower"},{x:20,y:4,type:"lower"},{x:21,y:4,type:"lower"},
  {x:22,y:4,type:"lower"},{x:23,y:4,type:"lower"},{x:24,y:4,type:"lower"},{x:25,y:4,type:"lower"},
  {x:19,y:5,type:"lower"},{x:19,y:6,type:"lower"},{x:19,y:7,type:"lower"},
  {x:25,y:5,type:"lower"},{x:25,y:6,type:"lower"},{x:25,y:7,type:"lower"},
  {x:19,y:8,type:"lower"},{x:20,y:8,type:"lower"},{x:24,y:8,type:"lower"},{x:25,y:8,type:"lower"},

  // Platform 3 enclosure walls → lower (bottom-left, rows 18-22 cols 5-11)
  {x:5,y:22,type:"lower"},{x:6,y:22,type:"lower"},{x:7,y:22,type:"lower"},
  {x:8,y:22,type:"lower"},{x:9,y:22,type:"lower"},{x:10,y:22,type:"lower"},{x:11,y:22,type:"lower"},
  {x:5,y:19,type:"lower"},{x:5,y:20,type:"lower"},{x:5,y:21,type:"lower"},
  {x:11,y:19,type:"lower"},{x:11,y:20,type:"lower"},{x:11,y:21,type:"lower"},
  {x:5,y:18,type:"lower"},{x:6,y:18,type:"lower"},{x:10,y:18,type:"lower"},{x:11,y:18,type:"lower"},

  // Platform 4 enclosure walls → lower (bottom-right, rows 18-22 cols 19-25)
  {x:19,y:22,type:"lower"},{x:20,y:22,type:"lower"},{x:21,y:22,type:"lower"},
  {x:22,y:22,type:"lower"},{x:23,y:22,type:"lower"},{x:24,y:22,type:"lower"},{x:25,y:22,type:"lower"},
  {x:19,y:19,type:"lower"},{x:19,y:20,type:"lower"},{x:19,y:21,type:"lower"},
  {x:25,y:19,type:"lower"},{x:25,y:20,type:"lower"},{x:25,y:21,type:"lower"},
  {x:19,y:18,type:"lower"},{x:20,y:18,type:"lower"},{x:24,y:18,type:"lower"},{x:25,y:18,type:"lower"},

  // Central lower-wall cover (rows 12-15)
  {x:4,y:12,type:"lower"},{x:4,y:13,type:"lower"},{x:4,y:14,type:"lower"},{x:4,y:15,type:"lower"},
  {x:10,y:12,type:"lower"},{x:10,y:13,type:"lower"},{x:10,y:14,type:"lower"},{x:10,y:15,type:"lower"},
  {x:20,y:12,type:"lower"},{x:20,y:13,type:"lower"},{x:20,y:14,type:"lower"},{x:20,y:15,type:"lower"},
  {x:26,y:12,type:"lower"},{x:26,y:13,type:"lower"},{x:26,y:14,type:"lower"},{x:26,y:15,type:"lower"},

  // Jump pads
  {x:8,y:9,type:"jump"},
  {x:22,y:9,type:"jump"},
  {x:8,y:17,type:"jump"},
  {x:22,y:17,type:"jump"},
  {x:15,y:13,type:"jump"},

  // Lava at chokepoint gaps
  {x:13,y:10,type:"lava"},{x:14,y:10,type:"lava"},{x:15,y:10,type:"lava"},{x:16,y:10,type:"lava"},{x:17,y:10,type:"lava"},
  {x:13,y:16,type:"lava"},{x:14,y:16,type:"lava"},{x:15,y:16,type:"lava"},{x:16,y:16,type:"lava"},{x:17,y:16,type:"lava"},

  // Weapons — ground level
  {x:2,y:2,type:"pickablePistol"},
  {x:28,y:24,type:"pickablePistol"},
  {x:2,y:24,type:"pickablePistol"},
  {x:28,y:2,type:"pickablePistol"},
  {x:5,y:11,type:"pickableMachinegun"},
  {x:25,y:11,type:"pickableShotgun"},
  {x:5,y:15,type:"pickableShotgun"},
  {x:25,y:15,type:"pickableMachinegun"},

  // Weapons — platform reward
  {x:8,y:6,type:"pickableSniper"},
  {x:22,y:6,type:"pickableSniper"},
  {x:8,y:20,type:"pickableRocketLauncher"},
  {x:22,y:20,type:"pickableRocketLauncher"},

  // Center grenade
  {x:15,y:11,type:"pickableGrenadeLauncher"},

  // Hotspot center
  {x:14,y:12,width:3,height:4,type:"hotspot"},
];

// ─── 6. Validate lower mods (must land on wall=1 cells) ──────────────────────
const lowerMods = mods.filter(m => m.type === 'lower');
let lowerWarnings = 0;
lowerMods.forEach(m => {
  const cell = wallGrid[m.y] && wallGrid[m.y][m.x];
  if (cell !== 1) {
    console.warn(`WARN [lower]: (${m.x},${m.y}) → wallGrid[${m.y}][${m.x}]=${cell} (expected 1, will be no-op)`);
    lowerWarnings++;
  }
});
if (lowerWarnings === 0) console.log(`Lower mods: ${lowerMods.length} — all on wall=1 cells ✓`);
else console.log(`Lower mods: ${lowerMods.length} — ${lowerWarnings} warnings`);

// ─── 7. Validate jump mods (must land on floor=0 / wall=0 cells) ─────────────
const jumpMods = mods.filter(m => m.type === 'jump');
let jumpWarnings = 0;
jumpMods.forEach(m => {
  const cell = wallGrid[m.y] && wallGrid[m.y][m.x];
  if (cell !== 0) {
    console.warn(`WARN [jump]: (${m.x},${m.y}) → wallGrid[${m.y}][${m.x}]=${cell} (expected 0, jump on wall)`);
    jumpWarnings++;
  }
});
if (jumpWarnings === 0) console.log(`Jump mods: ${jumpMods.length} — all on floor=0 cells ✓`);
else console.log(`Jump mods: ${jumpMods.length} — ${jumpWarnings} warnings`);

// ─── 8. Build the new map object ─────────────────────────────────────────────
const newMap = {
  label: "Platform Arena",
  skybox: "space",
  skyboxTint: 0.5,
  skyboxLight: 1.8,
  ceilingLight: 1.0,
  ceilingTint: 1.0,
  wallLight: 0.9,
  wallTint: 1.3,
  spritesTint: 1.6,
  shadowLight: 0.35,
  shadowTint: 0.7,
  tintColor: "PURPLE",
  description: "Four raised platform zones surround a lava-split central corridor. Jump to reach the high ground, aim down at enemies below, or dare the lava crossing for center control.",
  wall: {
    id: "wall",
    grid: wallGrid,
  },
  floor: {
    id: "floor",
    grid: floorGrid,
  },
  ceiling: {
    id: "ceiling",
    grid: ceilingGrid,
  },
  mods,
};

// ─── 9. Replace MAPS[0] and write back ───────────────────────────────────────
MAPS[0] = newMap;

const output = `var MAPS=${JSON.stringify(MAPS)};`;
fs.writeFileSync(SRC, output, 'utf8');
console.log(`Written: ${SRC} (${(output.length / 1024).toFixed(1)} KB)`);

// ─── 10. Copy to dist ────────────────────────────────────────────────────────
try {
  fs.mkdirSync('/home/cosmos-arcade/frontend/dist/retro-fps/js', { recursive: true });
  fs.writeFileSync(DIST, output, 'utf8');
  console.log(`Copied:  ${DIST}`);
} catch (e) {
  console.warn(`Could not copy to dist: ${e.message}`);
}

// ─── 11. Summary ─────────────────────────────────────────────────────────────
console.log('\n=== Summary ===');
console.log(`Map label:       ${newMap.label}`);
console.log(`Wall grid:       ${wallGrid.length} rows × ${wallGrid[0].length} cols`);
console.log(`Ceiling sample:  ${JSON.stringify(ceilingGrid[5].slice(0, 8))} (all 0)`);
console.log(`Lower mods:      ${lowerMods.length}`);
console.log(`Jump mods:       ${jumpMods.length}`);
console.log(`Total mods:      ${mods.length}`);
