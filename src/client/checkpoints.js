// Turns authoritative sector changes into checkpoint events the timing system
// can consume. Reads server state only — it never decides anything itself.
var R = window.R = window.R || {};

R.Checkpoints = function (track) {
  var lastSector = 0;

  return {
    reset: function () { lastSector = 0; },

    // After a rewind or a segment start, the authoritative sector is the
    // truth and this must follow it rather than re-firing old crossings.
    setSector: function (sector) { lastSector = sector; },

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
