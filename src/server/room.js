// Room: who is in the race, which slot is the human, ready state.
// Offline this fills itself with bots, but the shape is the one an online
// room would have, so it ports to a real server without reshaping the client.
var R = window.R = window.R || {};

R.Room = function (opts) {
  var botCount = opts && opts.botCount != null ? opts.botCount : 3;
  var slots = [];
  var nextId = 1;

  var playerId = nextId++;
  slots.push({
    id: playerId,
    kind: 'player',
    name: (opts && opts.playerName) || 'You',
    color: '#38bdf8',
    skill: 1,
    ready: false
  });

  for (var i = 0; i < botCount; i++) {
    var p = R.AiRacers.PROFILES[i % R.AiRacers.PROFILES.length];
    slots.push({
      id: nextId++,
      kind: 'bot',
      name: p.name,
      color: p.color,
      skill: p.skill,
      ready: true
    });
  }

  return {
    slots: slots,
    playerId: playerId,
    map: (opts && opts.map) || 'sunset-ridge',
    mode: (opts && opts.mode) || 'time-trial',

    setReady: function (id, ready) {
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === id) slots[i].ready = !!ready;
      }
    },

    allReady: function () {
      for (var i = 0; i < slots.length; i++) if (!slots[i].ready) return false;
      return true;
    }
  };
};
