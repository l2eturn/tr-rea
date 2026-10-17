// AI racers. Bots produce the same input bitfield a human would, then go
// through the identical physics step — so they are never "cheating", they are
// just another input source on the authoritative side.
var R = window.R = window.R || {};

R.AiRacers = (function () {
  var IN = R.IN;

  var PROFILES = [
    { name: 'Pip', skill: 0.92, color: '#f59e0b' },
    { name: 'Nok', skill: 0.80, color: '#22d3ee' },
    { name: 'Bua', skill: 0.68, color: '#f472b6' }
  ];

  function inputFor(ch, track, tick, skill) {
    if (ch.finishTick >= 0) return 0;
    if (ch.stun > 0) return 0;

    var input = IN.RIGHT;
    var look = 64 + Math.abs(ch.vx) * 0.24;

    // Slide under a low ceiling. Looking back by a body width keeps the slide
    // held until the whole body is clear of the tunnel, not just its centre.
    if (track.overhangAhead(ch.x - R.C.BODY_W, look + 26)) {
      return IN.RIGHT | IN.SLIDE;
    }

    var wantJump = false;

    if (track.spikeAhead(ch.x, look)) {
      wantJump = true;
    } else if (ch.onGround && !track.groundAhead(ch.x + look, ch.y)) {
      wantJump = true;
    } else if (!ch.onGround && ch.vy > 90 && ch.jumps < R.C.MAX_JUMPS &&
               track.groundBelow(ch.x, ch.y, 170) === null) {
      wantJump = true;
    }

    // Weaker bots miss some of their jumps and lose a little speed.
    if (wantJump) {
      var miss = (tick + ch.seed) % 101 < (1 - skill) * 22;
      if (!miss && (tick % 4) < 2) input |= IN.JUMP;
    }
    if ((tick + ch.seed) % 37 < (1 - skill) * 7) input &= ~IN.RIGHT;

    return input;
  }

  return { PROFILES: PROFILES, inputFor: inputFor };
})();
