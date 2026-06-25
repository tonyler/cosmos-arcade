/**
 * map-generator.js
 *
 * Converts an ASCII map string into a retro-FPS map object.
 * See map-legend.md for the full symbol reference.
 *
 * Usage:
 *   var MAP_FOO = generateMap(label, ascii, meta);
 *   // then add MAP_FOO to js/maps/index.js
 */

// Symbols that become solid wall tiles (wall grid = 1)
var WALL_SYMBOLS = {
  '#': true,   // solid wall
  '|': true,   // visual thin-wall column (also adds a thinVertical mod)
  '-': true    // visual thin-wall row (also adds a thinHorizontal mod)
};

// Symbols that stay as open floor but emit one or more mods
// Each entry: { type, extra? }  (extra = extra props merged into the mod object)
var MOD_SYMBOLS = {
  // Spawnpoints
  '0': { type: 'spawnpoint0', properties: { angle: 3.927 } },
  '1': { type: 'spawnpoint1', properties: { angle: 5.498 } },
  '2': { type: 'spawnpoint2', properties: { angle: 2.356 } },
  '3': { type: 'spawnpoint3', properties: { angle: 0.785 } },

  // Game objectives
  'H': { type: 'hotspot' },
  '?': { type: 'teleport' },

  // Weapon pickups
  'p': { type: 'pickablePistol' },
  'm': { type: 'pickableMachinegun' },
  's': { type: 'pickableShotgun' },
  'n': { type: 'pickableSniper' },
  'r': { type: 'pickableRocketLauncher' },
  'g': { type: 'pickableGrenadeLauncher' },
  'k': { type: 'pickableKnife' },

  // Floor modifiers
  'J': { type: 'jump' },
  '~': { type: 'water' },
  '*': { type: 'lava' },
  'e': { type: 'step1' },   // slight elevation (elevationZ:-0.18)
  'E': { type: 'step2' },   // mid elevation  (elevationZ:-0.33)
  '^': { type: 'elevated' }, // full elevation (elevationZ:-0.45)
  '_': { type: 'lower' },
  'i': { type: 'ice' },

  // Doors
  'D': { type: 'door' },

  // Obstacles / decorations
  'C': { type: 'obstacleColumn' },
  'T': { type: 'obstaclePole' },
  'B': { type: 'obstacleBush' },
  'S': { type: 'obstacleStalagmite' },
  'f': { type: 'decorationLeaf' },
  'F': { type: 'flames' }
};

// Thin-wall modifiers placed on top of wall cells
var THIN_MOD_SYMBOLS = {
  '|': { type: 'thinVertical' },
  '-': { type: 'thinHorizontal' }
};

// Default visual settings — override via meta
var MAP_DEFAULTS = {
  skybox: 'mountains',
  skyboxTint: 0.9,
  skyboxLight: 1.8,
  ceilingLight: 1.0,
  ceilingTint: 1.0,
  wallLight: 1.0,
  wallTint: 1.0,
  spritesTint: 1.2,
  shadowLight: 0.4,
  shadowTint: 0.85,
  tintColor: 'BROWN'
};

function generateMap(label, ascii, meta) {
  // Split into rows, preserve exact characters
  var lines = ascii.replace(/\r/g, '').split('\n');

  // Strip leading/trailing blank lines
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  var height = lines.length;
  var width = 0;
  lines.forEach(function (l) { if (l.length > width) width = l.length; });

  // Pad all rows to equal width
  lines = lines.map(function (l) {
    while (l.length < width) l += ' ';
    return l;
  });

  var wallGrid    = [];
  var floorGrid   = [];
  var ceilingGrid = [];
  var mods        = [];

  for (var y = 0; y < height; y++) {
    var wallRow    = [];
    var floorRow   = [];
    var ceilingRow = [];
    var isBorderRow = (y === 0 || y === height - 1);

    for (var x = 0; x < width; x++) {
      var ch = lines[y][x];
      var isBorderCol = (x === 0 || x === width - 1);
      var isBorder = isBorderRow || isBorderCol;

      // Wall grid
      if (isBorder || WALL_SYMBOLS[ch]) {
        wallRow.push(1);
      } else {
        wallRow.push(0);
      }

      // Floor grid — border = 0, everything else = solid floor (2)
      floorRow.push(isBorder ? 0 : 2);

      // Ceiling grid — all open sky by default
      ceilingRow.push(0);

      // Mods
      if (!isBorder) {
        if (MOD_SYMBOLS[ch]) {
          var mod = { x: x, y: y, type: MOD_SYMBOLS[ch].type };
          if (MOD_SYMBOLS[ch].properties) mod.properties = MOD_SYMBOLS[ch].properties;
          mods.push(mod);
        }
        if (THIN_MOD_SYMBOLS[ch]) {
          mods.push({ x: x, y: y, type: THIN_MOD_SYMBOLS[ch].type });
        }
      }
    }

    wallGrid.push(wallRow);
    floorGrid.push(floorRow);
    ceilingGrid.push(ceilingRow);
  }

  // Merge defaults + meta (meta wins)
  var result = {};
  Object.keys(MAP_DEFAULTS).forEach(function (k) { result[k] = MAP_DEFAULTS[k]; });
  if (meta) Object.keys(meta).forEach(function (k) { result[k] = meta[k]; });

  result.label       = label;
  result.description = (meta && meta.description) || '';
  result.wall        = { grid: wallGrid };
  result.floor       = { grid: floorGrid };
  result.ceiling     = { grid: ceilingGrid };
  result.mods        = mods;

  return result;
}
