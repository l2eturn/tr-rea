// Fixed-timestep game loop.
// Simulation runs at exactly TICK_HZ; rendering happens once per animation
// frame with an interpolation alpha, so the physics stay deterministic no
// matter what refresh rate the display has.
var R = window.R = window.R || {};

R.GameLoop = function (opts) {
  var step = opts.step;
  var render = opts.render;
  var MAX_CATCHUP = 5;

  var acc = 0;
  var last = 0;
  var running = false;
  var raf = null;

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;

    // A long pause (tab in the background) must not fast-forward the race.
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    var steps = 0;
    while (acc >= R.C.DT && steps < MAX_CATCHUP) {
      step();
      acc -= R.C.DT;
      steps++;
    }
    if (steps === MAX_CATCHUP) acc = 0;

    render(acc / R.C.DT);
    raf = window.requestAnimationFrame(frame);
  }

  return {
    start: function () {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      raf = window.requestAnimationFrame(frame);
    },
    stop: function () {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
    }
  };
};
