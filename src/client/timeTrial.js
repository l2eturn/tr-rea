// Time trial: elapsed time, sector splits, and the comparison against the
// saved best run. All timing is in ticks, so it is frame-rate independent.
var R = window.R = window.R || {};

R.TimeTrial = function () {
  var state = {
    frame: -1,            // ticks since the race started
    splits: [],           // ticks at each checkpoint
    finishFrame: null,
    best: null,
    bestSplits: [],
    isNewBest: false,
    delta: null           // vs best, in ticks, at the last checkpoint
  };

  function fmt(ticks) {
    if (ticks == null) return '--:--.--';
    var ms = (ticks / R.C.TICK_HZ) * 1000;
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var cs = Math.floor((ms % 1000) / 10);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  }

  function fmtDelta(ticks) {
    if (ticks == null) return '';
    var sign = ticks > 0 ? '+' : '-';
    var ms = (Math.abs(ticks) / R.C.TICK_HZ) * 1000;
    var s = Math.floor(ms / 1000);
    var cs = Math.floor((ms % 1000) / 10);
    return sign + s + '.' + (cs < 10 ? '0' : '') + cs;
  }

  return {
    state: state,
    fmt: fmt,
    fmtDelta: fmtDelta,

    reset: function (saved) {
      state.frame = -1;
      state.splits = [];
      state.finishFrame = null;
      state.isNewBest = false;
      state.delta = null;
      state.best = saved && typeof saved.bestTicks === 'number' ? saved.bestTicks : null;
      state.bestSplits = (saved && saved.bestSplits) || [];
    },

    // Called once per authoritative tick while the race is running.
    tick: function (serverTick, startTick) {
      state.frame = serverTick - startTick;
      if (state.frame < 0) state.frame = -1;
    },

    onCheckpoint: function (index) {
      state.splits[index - 1] = state.frame;
      var ref = state.bestSplits[index - 1];
      state.delta = typeof ref === 'number' ? state.frame - ref : null;
    },

    onFinish: function () {
      if (state.finishFrame != null) return false;
      state.finishFrame = state.frame;
      if (state.best == null || state.finishFrame < state.best) {
        state.isNewBest = true;
        state.delta = state.best == null ? null : state.finishFrame - state.best;
        return true;
      }
      state.delta = state.finishFrame - state.best;
      return false;
    }
  };
};
