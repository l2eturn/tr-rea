// The local virtual server.
// Lobby -> Room -> RaceSession, reachable only through the loopback channel.
// Swap R.Loopback for a real socket transport and this whole module can move
// to a host process without the client changing.
var R = window.R = window.R || {};

R.LocalServer = function (track, opts) {
  var channel = R.Loopback(opts && opts.latencyTicks);
  var room = R.Lobby.createRoom(
    opts && opts.mode,
    opts && opts.map,
    opts && opts.playerName
  );
  var session = R.RaceSession(track, channel, room);

  room.setReady(room.playerId, true);
  session.welcome(0);

  return {
    channel: channel,
    room: room,
    session: session,
    tick: function (tick) { session.tick(tick); },
    reset: function () {
      return R.LocalServer(track, opts);
    }
  };
};
