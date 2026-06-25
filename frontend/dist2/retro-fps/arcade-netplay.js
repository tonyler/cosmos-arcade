/**
 * arcade-netplay.js
 * Replaces pvp's PeerJS/Socket.io NETPLAY with a postMessage bridge
 * so the iframe can relay game events through Cosmos Arcade's WS relay.
 *
 * Protocol:
 *   Parent -> iframe: { type:'pvp:event', event:[...] }
 *   iframe -> Parent: { type:'pvp:send',  event:[...] }
 *   Parent -> iframe: { type:'pvp:init',  slot:1|2 }
 *   iframe -> Parent: { type:'pvp:ready' }
 *   iframe -> Parent: { type:'pvp:winner', slot:1|2 }
 *
 *   Position sync (per-frame, bypasses game event queue):
 *   iframe -> Parent: { type:'pvp:pos', pos:{id,x,y,angle,walking} }
 *   Parent -> iframe: { type:'pvp:pos', pos:{id,x,y,angle,walking} }
 */
(function () {
  var pendingEvents = [];
  // ponytail: keyed by player.id, overwritten each frame — no unbounded growth
  var remotePlayers = {};
  // Position throttle state
  var lastPosSendTime = 0;
  var lastSentPos = {}; // keyed by player.id

  // Receives game events and position updates from parent
  window.addEventListener('message', function (e) {
    if (!e.data || e.origin !== window.location.origin) return;
    if (e.data.type === 'pvp:event') {
      pendingEvents.push(e.data.event);
    }
    if (e.data.type === 'pvp:pos') {
      var p = e.data.pos;
      if (p && p.id !== undefined) remotePlayers[p.id] = p;
    }
  });

  // ponytail: NETPLAY is a global the pvp engine reads each frame
  window.NETPLAY = {
    isEnabled: true,
    isMaster: true,          // set by arcade.html after pvp:init
    predictorStrength: 0.3,  // gentle extrapolation so remote player isn't frozen between packets

    // Called once per frame before simulation.
    // Applies received remote-player positions so the raycaster sees them.
    startFrame: function (players, predictorPrepare, predictorApply, checkObstacles, checkWalls) {
      players.forEach(function (player) {
        if (player.isLocal || player.waitRespawn) return;
        var pos = remotePlayers[player.id];
        if (pos) {
          // Save old position into history before overwriting (mirrors netplay.js)
          predictorPrepare(true, player);
          if (!player.isDead) {
            player.sprite.x     = pos.x;
            player.sprite.y     = pos.y;
            player.sprite.angle = pos.angle;
            player.walking      = pos.walking;
          }
          predictorPrepare(false, player);
        } else {
          // No packet yet — let the predictor extrapolate (strength=0 → stays put)
          predictorApply(player, checkObstacles, checkWalls);
        }
      });
    },

    // Called once per frame after simulation; returns events from other player
    // and sends our own position to the parent for relay.
    // ponytail: throttled to ~60 Hz with delta check
    endFrame: function (players) {
      var now = Date.now();
      var sendPos = (now - lastPosSendTime) >= 16;
      players.forEach(function (player) {
        if (!player.isLocal || player.isDead) return;
        if (!sendPos) return;
        var pos = { id: player.id, x: player.sprite.x, y: player.sprite.y, angle: player.sprite.angle, walking: player.walking };
        var last = lastSentPos[player.id];
        if (last &&
            Math.abs(pos.x - last.x) < 0.01 &&
            Math.abs(pos.y - last.y) < 0.01 &&
            Math.abs(pos.angle - last.angle) < 0.01 &&
            pos.walking === last.walking) return;
        lastSentPos[player.id] = pos;
        window.parent.postMessage({ type: 'pvp:pos', pos: pos }, window.location.origin);
      });
      if (sendPos) lastPosSendTime = now;
      return pendingEvents;
    },

    // Called after endFrame; clears the queue
    flushFrame: function () {
      pendingEvents = [];
    },

    // Host broadcasts an authoritative game event to all remote players
    broadcastEvent: function (data) {
      window.parent.postMessage({ type: 'pvp:send', event: data }, window.location.origin);
    },

    // Host sends an event to a specific remote player (1v1: same as broadcast)
    sendEventTo: function (player, data) { this.broadcastEvent(data); },

    // Stubs for the Netplay lobby API (unused in arcade mode)
    initialize: function () {},
    show: function () {},
    quit: function () {},
    frame: function () { return 0; },
    render: function () {},
    onRoomPlayersUpdated: function () {},
    onSetupUpdated: function () {},
    onPlayerConfirm: function () {},
    onStartGame: function () {},
    onDisable: function () {},
    updateSetup: function () {},
    startGame: function () {}
  };
})();
