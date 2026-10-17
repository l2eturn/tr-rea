// Ghost replay. Records the authoritative position each running tick and plays
// back the best saved run alongside the current one.
var R = window.R = window.R || {};

R.Ghost = function () {
  var recording = [];
  var playback = null;

  return {
    reset: function (savedGhost) {
      recording = [];
      playback = savedGhost && savedGhost.length ? savedGhost : null;
    },

    // frame is the tick index since the race started.
    record: function (frame, x, y) {
      if (frame < 0) return;
      recording[frame] = [Math.round(x), Math.round(y)];
    },

    // Position of the saved ghost at this frame, or null when it has finished.
    at: function (frame) {
      if (!playback || frame < 0) return null;
      if (frame >= playback.length) {
        var last = playback[playback.length - 1];
        return last ? { x: last[0], y: last[1], done: true } : null;
      }
      var p = playback[frame];
      return p ? { x: p[0], y: p[1], done: false } : null;
    },

    hasPlayback: function () { return !!playback; },

    // Compacted copy for saving.
    take: function () {
      var out = [];
      for (var i = 0; i < recording.length; i++) {
        out.push(recording[i] || [0, 0]);
      }
      return out;
    }
  };
};
