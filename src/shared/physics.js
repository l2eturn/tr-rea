// Deterministic character controller.
// The client runs this to predict; the local server runs the very same code as
// the authority. Same inputs in, same state out — that is what makes the
// reconcile step meaningful.
var R = window.R = window.R || {};

R.Physics = (function () {
  var C = R.C, IN = R.IN;

  function create(id, kind, x) {
    return {
      id: id,
      kind: kind,                 // 'player' | 'bot'
      x: x == null ? C.SPAWN_X : x,
      y: R.Track.groundY,
      vx: 0,
      vy: 0,
      onGround: true,
      jumps: 0,
      prevJump: false,
      slideTicks: 0,
      slideLock: false,
      stun: 0,
      inv: 0,
      boost: 0,
      sector: 0,
      respawns: 0,
      picked: {},
      finishTick: -1,
      seed: (id * 2654435761) % 97
    };
  }

  function clone(ch) {
    var c = {};
    for (var k in ch) if (Object.prototype.hasOwnProperty.call(ch, k)) c[k] = ch[k];
    c.picked = {};
    for (var p in ch.picked) if (Object.prototype.hasOwnProperty.call(ch.picked, p)) c.picked[p] = 1;
    return c;
  }

  // Overwrite dst with src's simulation state, keeping dst's identity fields
  // (name, colour, skill) and its object identity, because the race state and
  // the renderer hold references to it.
  function copyInto(dst, src) {
    var FIELDS = ['x', 'y', 'vx', 'vy', 'onGround', 'jumps', 'prevJump',
      'slideTicks', 'slideLock', 'stun', 'inv', 'boost', 'sector', 'respawns',
      'finishTick'];
    for (var i = 0; i < FIELDS.length; i++) {
      dst[FIELDS[i]] = src[FIELDS[i]];
    }
    dst.picked = {};
    for (var k in src.picked) {
      if (Object.prototype.hasOwnProperty.call(src.picked, k)) dst.picked[k] = 1;
    }
    return dst;
  }

  function height(ch) {
    return ch.slideTicks > 0 ? C.SLIDE_H : C.BODY_H;
  }

  function box(ch) {
    var h = height(ch), hw = C.BODY_W / 2;
    return { l: ch.x - hw, r: ch.x + hw, t: ch.y - h, b: ch.y };
  }

  // Would the body at this height be inside solid geometry right now?
  function blockedAt(ch, h, track) {
    var hw = C.BODY_W / 2;
    var l = ch.x - hw, r = ch.x + hw, t = ch.y - h, b = ch.y;
    for (var i = 0; i < track.platforms.length; i++) {
      if (track.overlaps(l, t, r, b, track.platforms[i])) return true;
    }
    return false;
  }

  function respawn(ch, track) {
    var cpX = track.checkpointX(ch.sector);
    var g = track.groundBelow(cpX, 0, null);
    ch.x = cpX;
    ch.y = g === null ? track.groundY : g;
    ch.vx = 0;
    ch.vy = 0;
    ch.boost = 0;
    ch.slideTicks = 0;
    ch.onGround = true;
    ch.jumps = 0;
    ch.stun = C.RESPAWN_STUN_TICKS;
    ch.inv = C.RESPAWN_STUN_TICKS + C.SPIKE_INV_TICKS;
    ch.respawns++;
  }

  function resolveX(ch, track) {
    var b = box(ch), hw = C.BODY_W / 2;
    for (var i = 0; i < track.platforms.length; i++) {
      var p = track.platforms[i];
      if (!track.overlaps(b.l, b.t, b.r, b.b, p)) continue;
      // Push out of the nearest side. Always using the direction of travel
      // would fling a deeply embedded body to the far edge of a wide
      // platform, which is a huge, illegal-looking jump in one tick.
      var pushLeft = (p.x - hw) - ch.x;
      var pushRight = (p.x + p.w + hw) - ch.x;
      ch.x += Math.abs(pushLeft) <= Math.abs(pushRight) ? pushLeft : pushRight;
      ch.vx = 0;
      b = box(ch);
    }
  }

  function resolveY(ch, track) {
    ch.onGround = false;
    var b = box(ch);
    for (var i = 0; i < track.platforms.length; i++) {
      var p = track.platforms[i];
      if (!track.overlaps(b.l, b.t, b.r, b.b, p)) continue;
      if (ch.vy >= 0) {
        ch.y = p.y;
        ch.vy = 0;
        ch.onGround = true;
        ch.jumps = 0;
      } else {
        ch.y = p.y + p.h + height(ch);
        ch.vy = 0;
      }
      b = box(ch);
    }
  }

  function touchWorld(ch, track) {
    var b = box(ch), i;

    if (ch.inv > 0) ch.inv--;

    // A spike costs you a stun, then grants brief invulnerability — otherwise
    // standing in the hazard would re-stun every tick and trap you there.
    if (ch.inv === 0) {
      for (i = 0; i < track.spikes.length; i++) {
        if (track.overlaps(b.l, b.t, b.r, b.b, track.spikes[i])) {
          ch.stun = C.STUN_TICKS;
          ch.inv = C.STUN_TICKS + C.SPIKE_INV_TICKS;
          ch.vx = -C.SPIKE_KNOCKBACK;
          ch.boost = 0;
          break;
        }
      }
    }

    for (i = 0; i < track.boosts.length; i++) {
      if (track.overlaps(b.l, b.t, b.r, b.b, track.boosts[i])) {
        if (ch.vx < C.BOOST_PAD_VEL) ch.vx = C.BOOST_PAD_VEL;
        ch.boost = C.BOOST_PAD_CAP;
        break;
      }
    }

    for (i = 0; i < track.items.length; i++) {
      if (ch.picked[i]) continue;
      if (track.overlaps(b.l, b.t, b.r, b.b, track.items[i])) {
        ch.picked[i] = 1;
        if (ch.boost < C.ITEM_BOOST_CAP) ch.boost = C.ITEM_BOOST_CAP;
      }
    }
  }

  // Advance one fixed tick.
  function step(ch, input, track, tick) {
    if (ch.finishTick >= 0) input = 0;

    if (ch.stun > 0) { ch.stun--; input = 0; }

    var left = (input & IN.LEFT) !== 0;
    var right = (input & IN.RIGHT) !== 0;
    var jump = (input & IN.JUMP) !== 0;
    var slide = (input & IN.SLIDE) !== 0;

    // --- slide ----------------------------------------------------------
    if (!slide) ch.slideLock = false;
    if (slide && !ch.slideLock && ch.onGround && ch.stun === 0) {
      ch.slideLock = true;
      ch.slideTicks = C.SLIDE_MIN_TICKS;
      ch.vx += (ch.vx < 0 ? -1 : 1) * C.SLIDE_IMPULSE;
    }
    // Holding slide on the ground keeps you down, so a long tunnel is
    // passable instead of standing you up halfway through it.
    if (slide && ch.slideLock && ch.onGround && ch.stun === 0 && ch.slideTicks < 2) {
      ch.slideTicks = 2;
    }
    if (ch.slideTicks > 0) {
      ch.slideTicks--;
      if (!slide && ch.slideTicks > 0 && !ch.onGround) ch.slideTicks = 0;
    }
    // You cannot stand up with a ceiling right above you.
    if (ch.slideTicks === 0 && blockedAt(ch, C.BODY_H, track)) ch.slideTicks = 2;
    var sliding = ch.slideTicks > 0;

    // --- horizontal -----------------------------------------------------
    var accel = ch.onGround ? C.RUN_ACCEL : C.AIR_ACCEL;
    if (right && !left) ch.vx += accel * C.DT;
    else if (left && !right) ch.vx -= accel * C.DT;
    else if (ch.onGround) {
      var f = (sliding ? C.SLIDE_FRICTION : C.FRICTION) * C.DT;
      if (ch.vx > f) ch.vx -= f;
      else if (ch.vx < -f) ch.vx += f;
      else ch.vx = 0;
    }

    var cap = (sliding ? C.SLIDE_MAX : C.MAX_SPEED) + ch.boost;
    if (ch.vx > cap) ch.vx = cap;
    if (ch.vx < -cap) ch.vx = -cap;
    if (ch.boost > 0) {
      ch.boost -= C.BOOST_DECAY * C.DT;
      if (ch.boost < 0) ch.boost = 0;
    }

    // --- jump (edge triggered) ------------------------------------------
    var jumpEdge = jump && !ch.prevJump;
    ch.prevJump = jump;
    // Jumping out from under a ceiling is not possible: it would cancel the
    // slide and leave a standing body inside the tunnel.
    var ceilingOverhead = blockedAt(ch, C.BODY_H, track);
    if (jumpEdge && ch.stun === 0 && !(ch.onGround && ceilingOverhead)) {
      if (ch.onGround) {
        ch.vy = C.JUMP_VEL;
        ch.jumps = 1;
        ch.onGround = false;
        ch.slideTicks = 0;
      } else if (ch.jumps < C.MAX_JUMPS) {
        ch.vy = C.DOUBLE_JUMP_VEL;
        ch.jumps++;
      }
    }

    // --- gravity + integrate -------------------------------------------
    ch.vy += C.GRAVITY * C.DT;
    if (ch.vy > C.MAX_FALL) ch.vy = C.MAX_FALL;

    ch.x += ch.vx * C.DT;
    if (ch.x < C.BODY_W / 2) { ch.x = C.BODY_W / 2; ch.vx = 0; }
    resolveX(ch, track);

    ch.y += ch.vy * C.DT;
    resolveY(ch, track);

    touchWorld(ch, track);

    if (ch.y > C.KILL_Y) respawn(ch, track);

    // --- checkpoints + finish ------------------------------------------
    while (ch.sector < track.checkpoints.length && ch.x >= track.checkpoints[ch.sector]) {
      ch.sector++;
    }
    if (ch.finishTick < 0 && ch.x >= track.finishX) ch.finishTick = tick;

    return ch;
  }

  return {
    create: create,
    clone: clone,
    copyInto: copyInto,
    step: step,
    height: height,
    box: box
  };
})();
