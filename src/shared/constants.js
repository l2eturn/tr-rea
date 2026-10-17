// Shared tunables. Loaded by both the client and the local server so that
// prediction and the authoritative simulation agree bit for bit.
var R = window.R = window.R || {};

R.C = {
  TICK_HZ: 60,
  DT: 1 / 60,

  // Character body. x is the centre, y is the feet.
  BODY_W: 28,
  BODY_H: 52,
  SLIDE_H: 28,

  // Movement
  RUN_ACCEL: 2700,
  AIR_ACCEL: 1500,
  FRICTION: 2300,
  SLIDE_FRICTION: 520,
  MAX_SPEED: 430,
  GRAVITY: 2300,
  MAX_FALL: 1250,
  JUMP_VEL: -755,
  DOUBLE_JUMP_VEL: -690,
  MAX_JUMPS: 2,

  // Slide
  SLIDE_IMPULSE: 165,
  SLIDE_MAX: 620,
  SLIDE_MIN_TICKS: 20,

  // Pickups and hazards
  BOOST_PAD_VEL: 650,
  BOOST_PAD_CAP: 220,
  ITEM_BOOST_CAP: 170,
  BOOST_DECAY: 250,
  STUN_TICKS: 34,
  SPIKE_INV_TICKS: 90,
  SPIKE_KNOCKBACK: 190,

  // World
  KILL_Y: 920,
  RESPAWN_STUN_TICKS: 42,
  SPAWN_X: 90,

  // Race
  COUNTDOWN_TICKS: 180,

  // Loopback transport. Raise LATENCY_TICKS to exercise prediction/reconcile.
  LATENCY_TICKS: 0,
  SNAPSHOT_EVERY: 1,

  // Server-side validation thresholds
  MAX_STEP_DX: 22,
  MAX_STEP_DY: 44,
  SPEED_TOLERANCE: 1.3,
  CLAIM_TOLERANCE: 26
};

// Input is a bitfield so it is cheap to record, replay and send.
R.IN = { LEFT: 1, RIGHT: 2, JUMP: 4, SLIDE: 8, ALL: 15 };
