// Lobby: mode and map selection, then it creates the room the session runs on.
var R = window.R = window.R || {};

R.Lobby = (function () {
  var MODES = [
    { id: 'time-trial', label: 'Time Trial', bots: 3 },
    { id: 'solo', label: 'Solo Practice', bots: 0 }
  ];

  var MAPS = [
    { id: 'sunset-ridge', label: 'Sunset Ridge' }
  ];

  function createRoom(modeId, mapId, playerName) {
    var mode = MODES[0];
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === modeId) mode = MODES[i];

    return R.Room({
      mode: mode.id,
      map: mapId || MAPS[0].id,
      botCount: mode.bots,
      playerName: playerName || 'You'
    });
  }

  return { MODES: MODES, MAPS: MAPS, createRoom: createRoom };
})();
