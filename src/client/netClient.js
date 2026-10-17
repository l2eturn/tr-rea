// Loopback client: sends inputs, predicts locally, reconciles against the
// authoritative snapshot.
//
// Prediction keeps the controls responsive; reconcile means the server always
// wins. That is why the cheat keys cannot change the outcome — the client's
// tampered position is overwritten by the next snapshot.
var R = window.R = window.R || {};

R.NetClient = function (channel, track) {
  var PHYS_FIELDS = ['x', 'y', 'vx', 'vy', 'onGround', 'jumps', 'prevJump',
    'slideTicks', 'slideLock', 'stun', 'inv', 'boost', 'sector', 'respawns', 'finishTick'];

  var self = {
    youId: null,
    startTick: R.C.COUNTDOWN_TICKS,
    phase: 'countdown',
    serverTick: -1,
    local: null,              // predicted own character
    racers: {},               // id -> latest server view
    prevRacers: {},           // id -> previous server view (for interpolation)
    meta: {},                 // id -> {name, color, kind}
    pending: [],
    corrections: 0,
    lastCorrection: 0,
    tamperedSinceSnapshot: false
  };

  function applyView(ch, view) {
    for (var i = 0; i < PHYS_FIELDS.length; i++) {
      var f = PHYS_FIELDS[i];
      ch[f] = view[f];
    }
    ch.picked = {};
    for (var k in view.picked) {
      if (Object.prototype.hasOwnProperty.call(view.picked, k)) ch.picked[k] = 1;
    }
  }

  function onWelcome(msg) {
    self.youId = msg.youId;
    self.startTick = msg.startTick;
    msg.racers.forEach(function (r) {
      self.meta[r.id] = { name: r.name, color: r.color, kind: r.kind };
    });
    self.local = R.Physics.create(msg.youId, 'player', R.C.SPAWN_X);
    self.local.name = self.meta[msg.youId].name;
    self.local.color = self.meta[msg.youId].color;
  }

  function onSnapshot(msg) {
    self.serverTick = msg.tick;
    self.phase = msg.phase;
    if (typeof msg.startTick === 'number') {
      self.startTick = msg.startTick;
    }

    for (var i = 0; i < msg.racers.length; i++) {
      var view = msg.racers[i];
      if (self.racers[view.id]) self.prevRacers[view.id] = self.racers[view.id];
      self.racers[view.id] = view;

      if (view.id !== self.youId || !self.local) continue;

      // --- reconcile -----------------------------------------------------
      var predictedX = self.local.x;
      var predictedY = self.local.y;

      applyView(self.local, view);

      // Replay the inputs the server has not consumed yet.
      var keep = [];
      for (var j = 0; j < self.pending.length; j++) {
        if (self.pending[j].tick > msg.tick) keep.push(self.pending[j]);
      }
      self.pending = keep;
      for (var k = 0; k < self.pending.length; k++) {
        R.Physics.step(self.local, self.pending[k].input, track, self.pending[k].tick);
      }

      var drift = Math.abs(predictedX - self.local.x) + Math.abs(predictedY - self.local.y);
      if (drift > 1.5) {
        self.corrections++;
        self.lastCorrection = drift;
      }
      self.tamperedSinceSnapshot = false;
    }
  }

  return {
    state: self,

    pumpDown: function (tick) {
      var msgs = channel.drainClient(tick);
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        if (m.t === R.Proto.WELCOME) onWelcome(m);
        else if (m.t === R.Proto.SNAPSHOT) onSnapshot(m);
      }
    },

    sendAndPredict: function (tick, rawInput) {
      if (!self.local) return 0;

      // Movement is locked until the countdown ends; the server enforces the
      // same rule, so predicting anything else would only cause a correction.
      var input = tick < self.startTick ? 0 : rawInput;

      self.pending.push({ tick: tick, input: input });
      if (self.pending.length > 240) self.pending.shift();

      channel.sendToServer(
        R.Proto.input(tick, input, self.local.x, self.local.y),
        tick
      );

      R.Physics.step(self.local, input, track, tick);
      return input;
    },

    /**
     * Drop all prediction and adopt an authoritative state directly. Used
     * after a rewind, where every pending input belongs to a timeline that
     * no longer exists.
     */
    adoptAuthoritative: function (racerState) {
      self.pending = [];
      self.racers = {};
      self.prevRacers = {};
      if (self.local && racerState) {
        applyView(self.local, R.Proto.racerView(racerState));
      }
    },

    // --- tampering demo -------------------------------------------------
    cheatTeleport: function (dx) {
      if (!self.local) return;
      self.local.x += dx;
      self.tamperedSinceSnapshot = true;
    },

    cheatSpeed: function (mult) {
      if (!self.local) return;
      self.local.vx *= mult;
      self.tamperedSinceSnapshot = true;
    },

    // Interpolated view for drawing another racer.
    viewAt: function (id, alpha) {
      var cur = self.racers[id];
      if (!cur) return null;
      var prev = self.prevRacers[id] || cur;
      return {
        id: id,
        x: prev.x + (cur.x - prev.x) * alpha,
        y: prev.y + (cur.y - prev.y) * alpha,
        vx: cur.vx,
        slideTicks: cur.slideTicks,
        onGround: cur.onGround,
        stun: cur.stun,
        boost: cur.boost,
        sector: cur.sector,
        finishTick: cur.finishTick,
        meta: self.meta[id] || { name: '?', color: '#94a3b8', kind: 'bot' }
      };
    }
  };
};
