// In-process loopback transport.
// Stands in for a socket. Nothing here touches the outside world.
//
// Inputs travel upstream immediately — in-process, the server genuinely has
// them the moment they are produced. The latency knob delays snapshots coming
// back down, which is the half that prediction and reconcile exist for: you
// act now and learn the authoritative result late. Delaying inputs instead
// would just make the server simulate stale buttons.
var R = window.R = window.R || {};

R.Loopback = function (latencyTicks) {
  var latency = latencyTicks == null ? R.C.LATENCY_TICKS : latencyTicks;
  var toServer = [];
  var toClient = [];
  var stats = { sentUp: 0, sentDown: 0 };

  function drain(queue, tick) {
    var out = [];
    var keep = [];
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].at <= tick) out.push(queue[i].msg);
      else keep.push(queue[i]);
    }
    queue.length = 0;
    for (var j = 0; j < keep.length; j++) queue.push(keep[j]);
    return out;
  }

  return {
    latency: latency,
    stats: stats,
    sendToServer: function (msg, tick) {
      stats.sentUp++;
      toServer.push({ at: tick, msg: msg });
    },
    sendToClient: function (msg, tick) {
      stats.sentDown++;
      toClient.push({ at: tick + latency, msg: msg });
    },
    drainServer: function (tick) { return drain(toServer, tick); },
    drainClient: function (tick) { return drain(toClient, tick); }
  };
};
