// Message shapes carried over the loopback channel.
// Keeping this in one place makes it obvious what the client is allowed to
// assert (inputs, and an untrusted position claim) versus what the server
// decides (everything in a snapshot).
var R = window.R = window.R || {};

R.Proto = {
  // client -> server
  INPUT: 'input',
  READY: 'ready',

  // server -> client
  WELCOME: 'welcome',
  SNAPSHOT: 'snapshot',

  input: function (tick, input, claimX, claimY) {
    return { t: R.Proto.INPUT, tick: tick, input: input, claimX: claimX, claimY: claimY };
  },

  ready: function () {
    return { t: R.Proto.READY };
  },

  welcome: function (youId, startTick, racers) {
    return { t: R.Proto.WELCOME, youId: youId, startTick: startTick, racers: racers };
  },

  // Only the fields the client needs to draw and reconcile.
  // `picked` is copied, never shared, so the client can never mutate
  // authoritative server state through a snapshot reference.
  racerView: function (ch) {
    var picked = {};
    for (var k in ch.picked) {
      if (Object.prototype.hasOwnProperty.call(ch.picked, k)) picked[k] = 1;
    }
    return {
      id: ch.id,
      kind: ch.kind,
      x: ch.x,
      y: ch.y,
      vx: ch.vx,
      vy: ch.vy,
      onGround: ch.onGround,
      jumps: ch.jumps,
      prevJump: ch.prevJump,
      slideTicks: ch.slideTicks,
      slideLock: ch.slideLock,
      stun: ch.stun,
      inv: ch.inv,
      boost: ch.boost,
      sector: ch.sector,
      respawns: ch.respawns,
      finishTick: ch.finishTick,
      picked: picked
    };
  },

  snapshot: function (tick, phase, racers) {
    return { t: R.Proto.SNAPSHOT, tick: tick, phase: phase, racers: racers };
  }
};
