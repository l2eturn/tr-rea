// Level / track definition and collision queries.
// Pure data plus lookups, so the client and the server build the same world.
var R = window.R = window.R || {};

R.Track = (function () {
  var platforms = [];
  var overhangs = [];
  var spikes = [];
  var boosts = [];
  var items = [];

  function plat(x, y, w, h) { platforms.push({ x: x, y: y, w: w, h: h }); }

  // Low ceiling you have to slide under. Solid, plus listed for AI and drawing.
  function overhang(x, w) {
    var y = 458, h = 30;
    plat(x, y, w, h);
    overhangs.push({ x: x, y: y, w: w, h: h });
  }

  var GROUND_Y = 520;
  var FINISH_X = 6200;

  // --- ground runs, with pits between them -------------------------------
  plat(0, GROUND_Y, 1400, 240);
  plat(1520, GROUND_Y, 900, 240);
  plat(2560, GROUND_Y, 1100, 240);
  plat(3820, GROUND_Y, 1200, 240);
  plat(5020, GROUND_Y, 1420, 240);

  // --- stepping stones over the pits -------------------------------------
  plat(1418, 404, 110, 20);
  plat(2436, 386, 110, 20);
  plat(3676, 420, 80, 20);
  plat(3788, 348, 80, 20);

  // --- high route platforms ---------------------------------------------
  plat(880, 382, 180, 20);
  plat(1140, 300, 160, 20);
  plat(2700, 400, 150, 20);
  plat(2952, 330, 150, 20);
  plat(3204, 382, 150, 20);
  plat(4300, 400, 160, 20);
  plat(4562, 320, 160, 20);
  plat(5320, 380, 170, 20);

  // --- slide sections ---------------------------------------------------
  overhang(2100, 190);
  overhang(4400, 210);

  // --- hazards ----------------------------------------------------------
  spikes.push({ x: 1740, y: 496, w: 96, h: 24 });
  spikes.push({ x: 3086, y: 496, w: 96, h: 24 });
  spikes.push({ x: 4820, y: 496, w: 110, h: 24 });
  spikes.push({ x: 5700, y: 496, w: 96, h: 24 });

  // --- boost pads -------------------------------------------------------
  boosts.push({ x: 640, y: 506, w: 130, h: 14 });
  boosts.push({ x: 2860, y: 506, w: 130, h: 14 });
  boosts.push({ x: 4120, y: 506, w: 130, h: 14 });
  boosts.push({ x: 5460, y: 506, w: 130, h: 14 });

  // --- collectible boost items ------------------------------------------
  [[950, 340], [1200, 258], [1470, 362], [2490, 344],
   [3010, 288], [3250, 340], [3830, 306], [4620, 278],
   [5370, 338], [5900, 470]].forEach(function (p) {
    items.push({ x: p[0], y: p[1], w: 22, h: 22 });
  });

  var checkpoints = [1600, 3200, 4800];

  function overlaps(l, t, r, b, q) {
    return l < q.x + q.w && r > q.x && t < q.y + q.h && b > q.y;
  }

  // Topmost platform surface at x that is at or below feetY (within reach).
  function groundBelow(x, feetY, maxDrop) {
    var best = null;
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (x < p.x || x > p.x + p.w) continue;
      if (p.y < feetY - 8) continue;
      if (maxDrop != null && p.y > feetY + maxDrop) continue;
      if (best === null || p.y < best) best = p.y;
    }
    return best;
  }

  function groundAhead(x, feetY) {
    return groundBelow(x, feetY, 150) !== null;
  }

  function spikeAhead(x, dist) {
    for (var i = 0; i < spikes.length; i++) {
      var s = spikes[i];
      if (s.x > x && s.x < x + dist) return true;
    }
    return false;
  }

  function overhangAhead(x, dist) {
    for (var i = 0; i < overhangs.length; i++) {
      var o = overhangs[i];
      if (o.x + o.w > x && o.x < x + dist) return true;
    }
    return false;
  }

  function checkpointX(sector) {
    return sector > 0 ? checkpoints[sector - 1] : R.C.SPAWN_X;
  }

  return {
    platforms: platforms,
    overhangs: overhangs,
    spikes: spikes,
    boosts: boosts,
    items: items,
    checkpoints: checkpoints,
    groundY: GROUND_Y,
    finishX: FINISH_X,
    length: FINISH_X + 240,
    overlaps: overlaps,
    groundBelow: groundBelow,
    groundAhead: groundAhead,
    spikeAhead: spikeAhead,
    overhangAhead: overhangAhead,
    checkpointX: checkpointX
  };
})();
