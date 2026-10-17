// Authoritative race state: who is racing, where they are, who finished when.
// This is the only copy that decides the result.
var R = window.R = window.R || {};

R.RaceState = function (track) {
  var racers = [];
  var byId = {};

  return {
    tick: 0,
    phase: 'countdown',          // 'countdown' | 'running' | 'over'
    startTick: R.C.COUNTDOWN_TICKS,
    racers: racers,

    add: function (ch) {
      racers.push(ch);
      byId[ch.id] = ch;
      return ch;
    },

    get: function (id) { return byId[id]; },

    // Rank by finish time first, then by distance travelled.
    standings: function () {
      return racers.slice().sort(function (a, b) {
        var af = a.finishTick >= 0, bf = b.finishTick >= 0;
        if (af && bf) return a.finishTick - b.finishTick;
        if (af) return -1;
        if (bf) return 1;
        return b.x - a.x;
      });
    },

    rankOf: function (id) {
      var s = this.standings();
      for (var i = 0; i < s.length; i++) if (s[i].id === id) return i + 1;
      return s.length;
    },

    allFinished: function () {
      for (var i = 0; i < racers.length; i++) {
        if (racers[i].finishTick < 0) return false;
      }
      return true;
    }
  };
};
