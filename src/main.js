// Bootstrap: wires the client to the local virtual server and drives the
// fixed-timestep loop.
//
// Per tick, in order:
//   1. drain snapshots from the server    (reconcile)
//   2. sample input
//   3. send input + predict locally
//   4. tick the authoritative server
//   5. run the client-side race systems
var R = window.R = window.R || {};

(function () {
  var track = R.Track;
  var canvas = document.getElementById('game');
  var renderer = R.Renderer(canvas);

  var LATENCIES = [0, 4, 10];

  var g = {
    track: track,
    tick: 0,
    rank: 1,
    racerCount: 1,
    ghostOn: true,
    latencyIndex: 0,
    server: null,
    net: null,
    trial: R.TimeTrial(),
    ghost: R.Ghost(),
    checkpoints: R.Checkpoints(track),
    saved: R.Save.read(),
    finishHandled: false
  };

  function newRace() {
    g.tick = 0;
    g.finishHandled = false;
    g.server = R.LocalServer(track, {
      mode: 'time-trial',
      latencyTicks: LATENCIES[g.latencyIndex]
    });
    g.net = R.NetClient(g.server.channel, track);
    g.racerCount = g.server.room.slots.length;
    g.trial.reset(g.saved);
    g.ghost.reset(g.saved.ghost);
    g.checkpoints.reset();
  }

  function handleHotkeys() {
    if (R.Input.pressed('KeyR')) { newRace(); return; }
    if (R.Input.pressed('KeyG')) g.ghostOn = !g.ghostOn;
    if (R.Input.pressed('KeyL')) {
      g.latencyIndex = (g.latencyIndex + 1) % LATENCIES.length;
      newRace();
      return;
    }
    // Client-side tampering. The server owns the real position, so the next
    // snapshot pulls it straight back and the mismatch is counted.
    if (R.Input.pressed('KeyC')) g.net.cheatTeleport(420);
    if (R.Input.pressed('KeyV')) g.net.cheatSpeed(3.2);
  }

  function onFinish() {
    var isBest = g.trial.onFinish();
    if (!isBest) return;

    g.saved.bestTicks = g.trial.state.finishFrame;
    g.saved.bestSplits = g.trial.state.splits.slice();
    g.saved.ghost = g.ghost.take();
    g.saved.runs = (g.saved.runs || 0) + 1;
    R.Save.write(g.saved);
  }

  function step() {
    // 1. snapshots first, so prediction continues from authoritative state
    g.net.pumpDown(g.tick);

    handleHotkeys();

    // 2 + 3. input, then send and predict
    var input = R.Input.sample();
    g.net.sendAndPredict(g.tick, input);

    // 4. the authority decides
    g.server.tick(g.tick);

    // 5. client race systems read authoritative state only
    var s = g.net.state;
    var authoritative = s.racers[s.youId];

    if (s.phase !== 'countdown') {
      g.trial.tick(s.serverTick, s.startTick);
    }

    if (authoritative) {
      var events = g.checkpoints.poll(authoritative.sector);
      for (var i = 0; i < events.length; i++) g.trial.onCheckpoint(events[i]);

      if (g.trial.state.frame >= 0 && authoritative.finishTick < 0) {
        g.ghost.record(g.trial.state.frame, authoritative.x, authoritative.y);
      }

      if (authoritative.finishTick >= 0 && !g.finishHandled) {
        g.finishHandled = true;
        onFinish();
      }

      g.rank = g.server.session.state.rankOf(s.youId);
      g.racerCount = g.server.session.state.racers.length;
    }

    g.tick++;
  }

  function render(alpha) {
    renderer.draw(g, alpha);
  }

  R.Input.attach(window);
  newRace();
  R.GameLoop({ step: step, render: render }).start();

  // Expose for tinkering from the devtools console.
  window.game = g;
})();
