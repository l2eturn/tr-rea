// Race session: the authoritative simulation tick.
// Drains client input, validates it, steps every racer with the shared physics,
// then publishes a snapshot. Inputs are ignored until the countdown ends.
var R = window.R = window.R || {};

R.RaceSession = function (track, channel, room) {
  var state = R.RaceState(track);
  var lastInputTick = {};
  var pendingInput = {};
  var rejections = [];
  var counters = { inputRejected: 0, claimRejected: 0, stepRejected: 0 };

  // Authoritative position per tick for the human racer, plus the claims that
  // are still waiting to be checked against it. A claim for tick N can only be
  // judged once the server has itself stepped tick N, which is why it is
  // queued rather than checked on arrival — otherwise any transport latency
  // would look like cheating.
  var history = {};
  var claimQueue = [];
  var HISTORY_TICKS = 240;

  room.slots.forEach(function (slot) {
    var ch = R.Physics.create(slot.id, slot.kind, R.C.SPAWN_X);
    ch.name = slot.name;
    ch.color = slot.color;
    ch.skill = slot.skill;
    state.add(ch);
    lastInputTick[slot.id] = -1;
    pendingInput[slot.id] = 0;
  });

  function reject(id, reason, extra) {
    var entry = { tick: state.tick, id: id, reason: reason, extra: extra || null };
    rejections.push(entry);
    if (rejections.length > 40) rejections.shift();
    return entry;
  }

  function handle(msg) {
    if (msg.t !== R.Proto.INPUT) return;
    var id = room.playerId;
    var ch = state.get(id);
    if (!ch) return;

    var v = R.Validation.checkInput(msg, lastInputTick[id]);
    if (!v.ok) {
      counters.inputRejected++;
      reject(id, v.reason);
      return;
    }

    // The client's own idea of where it is carries no authority. Queue it and
    // compare it against this server's position at that same tick.
    if (typeof msg.claimX === 'number' && typeof msg.claimY === 'number') {
      claimQueue.push({ tick: msg.tick, claimX: msg.claimX, claimY: msg.claimY });
    }

    lastInputTick[id] = msg.tick;
    pendingInput[id] = msg.input;
  }

  function resolveClaims(tick) {
    var keep = [];
    for (var i = 0; i < claimQueue.length; i++) {
      var c = claimQueue[i];
      var truth = history[c.tick];
      if (!truth) {
        // Not stepped yet — check it on a later tick.
        if (c.tick > tick) keep.push(c);
        continue;
      }
      var v = R.Validation.checkClaim(c, truth);
      if (!v.ok) {
        counters.claimRejected++;
        reject(room.playerId, v.reason, 'tick=' + c.tick + ' dx=' + v.dx + ' dy=' + v.dy);
      }
    }
    claimQueue = keep;
  }

  function stepRacer(ch, input) {
    var before = R.Physics.clone(ch);
    R.Physics.step(ch, input, track, state.tick);
    var v = R.Validation.checkStep(before, ch);
    if (!v.ok) {
      counters.stepRejected++;
      reject(ch.id, v.reason);
      // Clamp the movement to what is physically allowed. Restoring the old
      // position instead would freeze the racer, because the next tick would
      // then fail the same check forever.
      var dx = ch.x - before.x;
      var dy = ch.y - before.y;
      if (Math.abs(dx) > R.C.MAX_STEP_DX) {
        ch.x = before.x + (dx < 0 ? -R.C.MAX_STEP_DX : R.C.MAX_STEP_DX);
      }
      if (Math.abs(dy) > R.C.MAX_STEP_DY) {
        ch.y = before.y + (dy < 0 ? -R.C.MAX_STEP_DY : R.C.MAX_STEP_DY);
      }
      var cap = R.C.SLIDE_MAX + R.C.BOOST_PAD_CAP;
      if (ch.vx > cap) ch.vx = cap;
      if (ch.vx < -cap) ch.vx = -cap;
    }
  }

  return {
    state: state,
    counters: counters,
    rejections: rejections,

    welcome: function (tick) {
      channel.sendToClient(R.Proto.welcome(room.playerId, state.startTick,
        state.racers.map(function (ch) {
          return { id: ch.id, kind: ch.kind, name: ch.name, color: ch.color };
        })), tick);
    },

    tick: function (tick) {
      state.tick = tick;

      var msgs = channel.drainServer(tick);
      for (var i = 0; i < msgs.length; i++) handle(msgs[i]);

      if (state.phase === 'countdown' && tick >= state.startTick) {
        state.phase = 'running';
      }

      var frozen = state.phase === 'countdown';

      for (var j = 0; j < state.racers.length; j++) {
        var ch = state.racers[j];
        var input = 0;
        if (!frozen) {
          input = ch.kind === 'bot'
            ? R.AiRacers.inputFor(ch, track, tick, ch.skill)
            : (pendingInput[ch.id] || 0);
        }
        stepRacer(ch, input);
      }

      // Record the authoritative truth for this tick, then judge the claims
      // the client made about it.
      var you = state.get(room.playerId);
      if (you) history[tick] = { x: you.x, y: you.y };
      delete history[tick - HISTORY_TICKS];
      resolveClaims(tick);

      if (state.phase === 'running' && state.allFinished()) state.phase = 'over';

      if (tick % R.C.SNAPSHOT_EVERY === 0) {
        channel.sendToClient(R.Proto.snapshot(tick, state.phase,
          state.racers.map(R.Proto.racerView)), tick);
      }
    }
  };
};
