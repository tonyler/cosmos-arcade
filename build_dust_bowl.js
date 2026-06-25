#!/usr/bin/env node
'use strict';

const fs = require('fs');

// ---------------------------------------------------------------------------
// Wall layout (# = 1, . = 0)  — 27 rows × 31 cols
// ---------------------------------------------------------------------------
const wallLayout = [
  '# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #', // 0
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 1
  '# . . . . . # . . . . . . . . . . . . . . . . # . . . . . . #', // 2
  '# . . . . . # . . . . . . . . . . . . . . . . # . . . . . . #', // 3
  '# . . . . . . . . # . . . . . . . . . . # . . . . . . . . . #', // 4
  '# . . . . . . . . # . . . . . . . . . . # . . . . . . . . . #', // 5
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 6
  '# . . # . . . . . . . . . . . . . . . . . . . . . # . . . . #', // 7
  '# . . # . . . . . . . . . . . . . . . . . . . . . # . . . . #', // 8
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 9
  '# . . . . . . . . . . . # . . . . # . . . . . . . . . . . . #', // 10
  '# . . . . . . . . . . . # . . . . # . . . . . . . . . . . . #', // 11
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 12
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 13
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 14
  '# . . . . . . . . . . . # . . . . # . . . . . . . . . . . . #', // 15
  '# . . . . . . . . . . . # . . . . # . . . . . . . . . . . . #', // 16
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 17
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 18
  '# . . # . . . . . . . . . . . . . . . . . . . . . # . . . . #', // 19
  '# . . # . . . . . . . . . . . . . . . . . . . . . # . . . . #', // 20
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 21
  '# . . . . . . . . # . . . . . . . . . . # . . . . . . . . . #', // 22
  '# . . . . . . . . # . . . . . . . . . . # . . . . . . . . . #', // 23
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 24
  '# . . . . . . . . . . . . . . . . . . . . . . . . . . . . . #', // 25
  '# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #', // 26
];

// Parse into integer arrays
const wallGrid = wallLayout.map((row, rowIdx) => {
  const cells = row.split(' ').map(c => c === '#' ? 1 : 0);
  if (cells.length !== 31) {
    throw new Error(`Row ${rowIdx} has ${cells.length} cols, expected 31`);
  }
  return cells;
});

if (wallGrid.length !== 27) {
  throw new Error(`Wall grid has ${wallGrid.length} rows, expected 27`);
}

// Floor grid: 3 where wall=0, 0 where wall=1
const floorGrid = wallGrid.map(row => row.map(cell => cell === 0 ? 3 : 0));

// Ceiling grid: ALL 0 (open sky everywhere)
const ceilingGrid = Array.from({ length: 27 }, () => Array(31).fill(0));

// Verify ceiling[5][5] = 0
console.assert(ceilingGrid[5][5] === 0, 'ceiling[5][5] should be 0');

// ---------------------------------------------------------------------------
// Mods
// ---------------------------------------------------------------------------
const mods = [
  // Spawnpoints
  { x: 2,  y: 2,  type: 'spawnpoint0', properties: { angle: 0 } },
  { x: 28, y: 24, type: 'spawnpoint1', properties: { angle: 3.14 } },
  { x: 2,  y: 24, type: 'spawnpoint2', properties: { angle: 0 } },
  { x: 28, y: 2,  type: 'spawnpoint3', properties: { angle: 3.14 } },

  // Low-wall cover (lower mod on wall=1 cells)
  { x: 6,  y: 2,  type: 'lower' },
  { x: 6,  y: 3,  type: 'lower' },
  { x: 23, y: 2,  type: 'lower' },
  { x: 23, y: 3,  type: 'lower' },
  { x: 9,  y: 4,  type: 'lower' },
  { x: 9,  y: 5,  type: 'lower' },
  { x: 20, y: 4,  type: 'lower' },
  { x: 20, y: 5,  type: 'lower' },
  { x: 3,  y: 7,  type: 'lower' },
  { x: 3,  y: 8,  type: 'lower' },
  { x: 25, y: 7,  type: 'lower' },
  { x: 25, y: 8,  type: 'lower' },
  { x: 12, y: 10, type: 'lower' },
  { x: 12, y: 11, type: 'lower' },
  { x: 17, y: 10, type: 'lower' },
  { x: 17, y: 11, type: 'lower' },
  { x: 12, y: 15, type: 'lower' },
  { x: 12, y: 16, type: 'lower' },
  { x: 17, y: 15, type: 'lower' },
  { x: 17, y: 16, type: 'lower' },
  { x: 3,  y: 19, type: 'lower' },
  { x: 3,  y: 20, type: 'lower' },
  { x: 25, y: 19, type: 'lower' },
  { x: 25, y: 20, type: 'lower' },
  { x: 9,  y: 22, type: 'lower' },
  { x: 9,  y: 23, type: 'lower' },
  { x: 20, y: 22, type: 'lower' },
  { x: 20, y: 23, type: 'lower' },

  // Jump pads
  { x: 15, y: 5,  type: 'jump' },
  { x: 15, y: 21, type: 'jump' },
  { x: 5,  y: 13, type: 'jump' },
  { x: 25, y: 13, type: 'jump' },
  { x: 15, y: 13, type: 'jump' },

  // Lava hazard
  { x: 13, y: 12, width: 3, height: 3, type: 'lava' },

  // Weapons
  { x: 2,  y: 2,  type: 'pickablePistol' },
  { x: 28, y: 24, type: 'pickablePistol' },
  { x: 2,  y: 24, type: 'pickablePistol' },
  { x: 28, y: 2,  type: 'pickablePistol' },
  { x: 8,  y: 8,  type: 'pickableMachinegun' },
  { x: 22, y: 18, type: 'pickableMachinegun' },
  { x: 8,  y: 18, type: 'pickableShotgun' },
  { x: 22, y: 8,  type: 'pickableShotgun' },
  { x: 15, y: 8,  type: 'pickableSniper' },
  { x: 15, y: 18, type: 'pickableRocketLauncher' },
  { x: 5,  y: 13, type: 'pickableGrenadeLauncher' },

  // Hotspot
  { x: 14, y: 12, width: 3, height: 3, type: 'hotspot' },
];

// ---------------------------------------------------------------------------
// Validate all lower mods point at wall=1 cells
// ---------------------------------------------------------------------------
mods.filter(m => m.type === 'lower').forEach(m => {
  const cell = wallGrid[m.y][m.x];
  if (cell !== 1) {
    console.warn(`WARNING: lower mod at x:${m.x} y:${m.y} points to wall cell ${cell} (expected 1)`);
  }
});

// ---------------------------------------------------------------------------
// Build MAPS[0]
// ---------------------------------------------------------------------------
const dustBowl = {
  label:        'Dust Bowl',
  skybox:       'mountains',
  skyboxTint:    0.8,
  skyboxLight:   2.0,
  ceilingLight:  1.0,
  ceilingTint:   1.0,
  wallLight:     1.0,
  wallTint:      1.2,
  spritesTint:   1.5,
  shadowLight:   0.4,
  shadowTint:    0.8,
  tintColor:    'YELLOW',
  description:  'An exposed hilltop battleground. No ceiling, no cover except scattered low walls. Jump to gain the high ground, or get picked off crossing open ground.',
  wall: {
    id:   'wall',
    grid: wallGrid,
  },
  floor: {
    id:   'floor',
    grid: floorGrid,
  },
  ceiling: {
    id:   'ceiling',
    grid: ceilingGrid,
  },
  mods,
};

// ---------------------------------------------------------------------------
// Load existing maps.js, parse MAPS, replace index 0, write back
// ---------------------------------------------------------------------------
const mapsPath = '/home/cosmos-arcade/frontend/public/retro-fps/js/maps.js';
const distPath = '/home/cosmos-arcade/frontend/dist/retro-fps/js/maps.js';

const src = fs.readFileSync(mapsPath, 'utf8');

// Extract the JSON array from `var MAPS=<array>;`
const match = src.match(/^var MAPS=(.+);?\s*$/s);
if (!match) {
  throw new Error('Could not parse MAPS from maps.js');
}

let MAPS;
try {
  MAPS = JSON.parse(match[1].replace(/;$/, ''));
} catch (e) {
  throw new Error('JSON.parse of MAPS failed: ' + e.message);
}

console.log(`Loaded ${MAPS.length} maps. Replacing MAPS[0] (was: "${MAPS[0].label}")`);

MAPS[0] = dustBowl;

const output = `var MAPS=${JSON.stringify(MAPS)};`;
fs.writeFileSync(mapsPath, output, 'utf8');
console.log(`Written to ${mapsPath}`);

// Copy to dist
const distDir = require('path').dirname(distPath);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
fs.copyFileSync(mapsPath, distPath);
console.log(`Copied to ${distPath}`);

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------
const verify = JSON.parse(fs.readFileSync(mapsPath, 'utf8').replace(/^var MAPS=/, '').replace(/;$/, ''));
console.log('');
console.log('=== Verification ===');
console.log('MAPS[0].label            :', verify[0].label);
console.log('MAPS[0].ceiling.grid[5][5]:', verify[0].ceiling.grid[5][5], '(should be 0)');
console.log('Wall grid rows            :', verify[0].wall.grid.length, '(should be 27)');
console.log('Wall grid cols (row 0)    :', verify[0].wall.grid[0].length, '(should be 31)');
console.log('Floor grid[1][1]          :', verify[0].floor.grid[1][1], '(should be 3, open cell)');
console.log('Floor grid[0][0]          :', verify[0].floor.grid[0][0], '(should be 0, wall cell)');
console.log('Mods count                :', verify[0].mods.length);
console.log('Lower mods                :', verify[0].mods.filter(m => m.type === 'lower').length);
console.log('Jump pads                 :', verify[0].mods.filter(m => m.type === 'jump').length);
console.log('');
console.log('Done.');
