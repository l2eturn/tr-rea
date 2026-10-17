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
    finishHandled: false,
    practice: R.Practice(),
    showInputs: true,
    rewindDirty: false     // true once a rewind has tainted this run
  };

  function newRace(segmentSector) {
    var sector = segmentSector || 0;

    g.tick = 0;
    g.finishHandled = false;
    g.rewindDirty = false;
    g.server = R.LocalServer(track, {
      mode: 'time-trial',
      latencyTicks: LATENCIES[g.latencyIndex]
    });
    g.net = R.NetClient(g.server.channel, track);
    g.racerCount = g.server.room.slots.length;

    g.practice.reset();
    g.practice.setSegment(sector);

    g.trial.reset(g.saved, sector > 0);
    g.ghost.reset(sector > 0 ? null : g.saved.ghost);
    g.checkpoints.reset();
    g.checkpoints.setSector(sector);
  }

  // Segment practice: skip the countdown and drop everyone at a checkpoint.
  function beginSegment(sector) {
    newRace(sector);
    g.net.pumpDown(g.tick);           // take the welcome so we have a local racer
    g.server.startAtCheckpoint(sector);

    // The teleport is authoritative; adopting it keeps the client from
    // claiming the spawn position it still believes in.
    g.net.adoptAuthoritative(g.server.session.state.get(g.net.state.youId));
  }

  function doRewind(seconds) {
    if (!g.server || !g.net.state.local) return;

    var snap = g.practice.rewind(seconds, g.server.session);
    if (!snap) return;

    // The server moved back, so the client must drop every pending input and
    // adopt the restored authoritative state outright.
    var you = g.server.session.state.get(g.net.state.youId);
    g.net.adoptAuthoritative(you);

    g.tick = snap.tick + 1;
    g.finishHandled = false;
    g.rewindDirty = true;

    var frame = snap.startTick >= 0 ? snap.tick - snap.startTick : -1;
    g.checkpoints.setSector(you ? you.sector : 0);
    g.trial.truncateTo(you ? you.sector : 0);
    g.ghost.truncate(frame);
  }

  function handleHotkeys() {
    if (R.Input.pressed('KeyR')) { newRace(g.practice.getSegment()); return; }
    if (R.Input.pressed('KeyG')) g.ghostOn = !g.ghostOn;
    if (R.Input.pressed('KeyT')) g.showInputs = !g.showInputs;
    if (R.Input.pressed('KeyL')) {
      g.latencyIndex = (g.latencyIndex + 1) % LATENCIES.length;
      newRace(g.practice.getSegment());
      return;
    }

    // Rewind a couple of seconds and retry the bit you just fluffed.
    if (R.Input.pressed('KeyQ')) { doRewind(2); return; }

    // Digit keys pick the segment: 1 = full run, 2..4 = from a checkpoint.
    var SEGMENT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    for (var si = 0; si < SEGMENT_KEYS.length; si++) {
      if (R.Input.pressed(SEGMENT_KEYS[si])) {
        if (si === 0) newRace(0);
        else beginSegment(si);
        return;
      }
    }
    // Client-side tampering. The server owns the real position, so the next
    // snapshot pulls it straight back and the mismatch is counted.
    if (R.Input.pressed('KeyC')) g.net.cheatTeleport(420);
    if (R.Input.pressed('KeyV')) g.net.cheatSpeed(3.2);
  }

  function onFinish() {
    var isBest = g.trial.onFinish();
    // A rewound run is practice, not a clean lap, so it never sets a record.
    if (!isBest || g.rewindDirty) return;

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

    // 5. snapshot the authority so a rewind has somewhere to go back to
    g.practice.record(g.tick, g.server.session, input);

    // 6. client race systems read authoritative state only
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
