// Practice tooling: the part a shipped game usually does not give you.
//
//   * rewind    — step the whole race back a couple of seconds and retry
//   * segments  — start from any checkpoint, to drill one hard stretch
//   * inputs    — a frame-accurate record of what you actually pressed
//
// Rewind works by snapshotting the authoritative server, not the client. The
// client is never the authority here, so rewinding only the client would just
// be corrected away on the next snapshot.
var R = window.R = window.R || {};

R.Practice = function () {
  var C = R.C;

  // One snapshot every SNAP_EVERY ticks keeps the buffer cheap; rewinding to
  // the nearest 0.1 s is precise enough to retry a jump.
  var SNAP_EVERY = 6;
  var HISTORY_SECONDS = 15;
  var MAX_SNAPS = Math.ceil((HISTORY_SECONDS * C.TICK_HZ) / SNAP_EVERY);
  var INPUT_HISTORY = 150;

  var snaps = [];
  var inputs = [];        // {tick, input} newest last
  var segmentSector = 0;  // 0 = full run
  var rewinds = 0;
  var enabled = true;

  function reset() {
    snaps = [];
    inputs = [];
    rewinds = 0;
  }

  return {
    SNAP_EVERY: SNAP_EVERY,

    reset: reset,

    setSegment: function (sector) { segmentSector = sector; },
    getSegment: function () { return segmentSector; },
    isSegmentRun: function () { return segmentSector > 0; },

    getRewinds: function () { return rewinds; },
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },

    /** Called once per tick, after the server has stepped. */
    record: function (tick, session, input) {
      inputs.push({ tick: tick, input: input });
      if (inputs.length > INPUT_HISTORY) inputs.shift();

      if (!enabled || tick % SNAP_EVERY !== 0) return;

      snaps.push(session.captureState());
      if (snaps.length > MAX_SNAPS) snaps.shift();
    },

    /**
     * Rewind the race by `seconds`. Returns the restored snapshot, or null
     * when there is not enough history yet.
     */
    rewind: function (seconds, session) {
      if (!enabled || snaps.length === 0) return null;

      var targetTick = session.state.tick - Math.round(seconds * C.TICK_HZ);

      // Newest snapshot at or before the target; otherwise the oldest we hold.
      var chosen = null;
      for (var i = snaps.length - 1; i >= 0; i--) {
        if (snaps[i].tick <= targetTick) { chosen = i; break; }
      }
      if (chosen === null) chosen = 0;

      var snap = snaps[chosen];
      session.restoreState(snap);

      // Everything after the restore point never happened.
      snaps.length = chosen + 1;
      inputs = inputs.filter(function (e) { return e.tick <= snap.tick; });
      rewinds++;

      return snap;
    },

    /** Frame-accurate input history, oldest first. */
    getInputs: function () { return inputs; },

    /** How many consecutive ticks a given bit has been held, right now. */
    heldTicks: function (bit) {
      var n = 0;
      for (var i = inputs.length - 1; i >= 0; i--) {
        if ((inputs[i].input & bit) === 0) break;
        n++;
      }
      return n;
    },

    /** Ticks since a bit was last pressed, or -1 if never in the window. */
    ticksSincePress: function (bit) {
      for (var i = inputs.length - 1; i > 0; i--) {
        var now = (inputs[i].input & bit) !== 0;
        var prev = (inputs[i - 1].input & bit) !== 0;
        if (now && !prev) {
          return inputs.length - 1 - i;
        }
      }
      return -1;
    }
  };
};
