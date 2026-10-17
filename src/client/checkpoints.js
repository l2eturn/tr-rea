// Turns authoritative sector changes into checkpoint events the timing system
// can consume. Reads server state only — it never decides anything itself.
var R = window.R = window.R || {};

R.Checkpoints = function (track) {
  var lastSector = 0;

  return {
    reset: function () { lastSector = 0; },

    // Returns the list of sector indices crossed since the last call.
    poll: function (sector) {
      var events = [];
      while (lastSector < sector) {
        lastSector++;
        events.push(lastSector);
      }
      return events;
    },

    total: function () { return track.checkpoints.length; },
    current: function () { return lastSector; }
  };
};
