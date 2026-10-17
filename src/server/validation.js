// Server-side validation.
// The client is never trusted: it may only assert which buttons it held.
// Everything else is recomputed here, and the client's own idea of where it is
// gets compared against the authoritative result.
var R = window.R = window.R || {};

R.Validation = (function () {
  var C = R.C;

  function checkInput(msg, lastTick) {
    if (typeof msg.tick !== 'number' || (msg.tick | 0) !== msg.tick) {
      return { ok: false, reason: 'tick-not-integer' };
    }
    if (msg.tick <= lastTick) {
      return { ok: false, reason: 'tick-replay-or-out-of-order' };
    }
    if (typeof msg.input !== 'number' || (msg.input | 0) !== msg.input) {
      return { ok: false, reason: 'input-not-integer' };
    }
    if (msg.input < 0 || msg.input > R.IN.ALL) {
      return { ok: false, reason: 'input-bits-out-of-range' };
    }
    return { ok: true };
  }

  // Sanity-check the authoritative step itself. Catches a tampered input
  // stream or a physics bug before it reaches the race result.
  function checkStep(prev, next) {
    // A respawn legitimately teleports the racer back to their checkpoint, so
    // the per-tick movement limits do not apply on that step.
    if (next.respawns !== prev.respawns) return { ok: true };

    var dx = Math.abs(next.x - prev.x);
    var dy = Math.abs(next.y - prev.y);
    if (dx > C.MAX_STEP_DX) return { ok: false, reason: 'position-step-too-large-x' };
    if (dy > C.MAX_STEP_DY) return { ok: false, reason: 'position-step-too-large-y' };
    var cap = (C.SLIDE_MAX + C.BOOST_PAD_CAP) * C.SPEED_TOLERANCE;
    if (Math.abs(next.vx) > cap) return { ok: false, reason: 'speed-over-cap' };
    return { ok: true };
  }

  // Compare what the client claims about itself to the authority.
  function checkClaim(msg, authoritative) {
    if (typeof msg.claimX !== 'number' || typeof msg.claimY !== 'number') {
      return { ok: true };
    }
    var dx = Math.abs(msg.claimX - authoritative.x);
    var dy = Math.abs(msg.claimY - authoritative.y);
    if (dx > C.CLAIM_TOLERANCE || dy > C.CLAIM_TOLERANCE) {
      return {
        ok: false,
        reason: 'client-position-mismatch',
        dx: Math.round(dx),
        dy: Math.round(dy)
      };
    }
    return { ok: true };
  }

  return {
    checkInput: checkInput,
    checkStep: checkStep,
    checkClaim: checkClaim
  };
})();
