// Headless smoke test: runs the local server + net client with no DOM.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.argv[2] || path.join(__dirname, '..');
const files = [
  'src/shared/constants.js',
  'src/shared/track.js',
  'src/shared/physics.js',
  'src/shared/protocol.js',
  'src/server/loopback.js',
  'src/server/validation.js',
  'src/server/raceState.js',
  'src/server/aiRacers.js',
  'src/server/raceSession.js',
  'src/server/room.js',
  'src/server/lobby.js',
  'src/server/localServer.js',
  'src/client/netClient.js',
  'src/client/practice.js'
];

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);

for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const R = sandbox.R;
const track = R.Track;

function run(latency, label) {
  const server = R.LocalServer(track, { mode: 'time-trial', latencyTicks: latency });
  const net = R.NetClient(server.channel, track);
  let maxDrift = 0;
  let tick = 0;
  const LIMIT = 60 * 90; // 90 seconds of simulation

  for (; tick < LIMIT; tick++) {
    net.pumpDown(tick);
    // Drive the human slot with the strongest bot logic: this asks "is the
    // track completable by competent play?" through the real input path.
    const input = net.state.local
      ? R.AiRacers.inputFor(net.state.local, track, tick, 1)
      : 0;
    net.sendAndPredict(tick, input);
    server.tick(tick);

    // Measure drift right after reconcile, against the same tick the snapshot
    // describes, not against a position one tick newer.
    const auth = server.session.state.get(server.room.playerId);
    if (auth && net.state.local && net.state.serverTick === tick) {
      maxDrift = Math.max(maxDrift, Math.abs(auth.x - net.state.local.x));
    }
    if (server.session.state.phase === 'over') break;
  }

  const st = server.session.state;
  const you = st.get(server.room.playerId);
  const standings = st.standings();

  console.log(`\n=== ${label} (latency ${latency}) ===`);
  console.log('ticks simulated :', tick);
  console.log('phase           :', st.phase);
  console.log('player x        :', Math.round(you.x), '/ finish', track.finishX);
  console.log('player finished :', you.finishTick >= 0,
    you.finishTick >= 0 ? `(${((you.finishTick - st.startTick) / 60).toFixed(2)}s)` : '');
  console.log('respawns        :', you.respawns, ' sector:', you.sector);
  console.log('bots finished   :', st.racers.filter(r => r.kind === 'bot' && r.finishTick >= 0).length,
    '/', st.racers.filter(r => r.kind === 'bot').length);
  console.log('standings       :', standings.map(r => r.name).join(' > '));
  console.log('bot positions   :', st.racers.filter(r => r.kind === 'bot')
    .map(r => `${r.name}:${Math.round(r.x)}`).join(' '));
  console.log('max predict drift:', maxDrift.toFixed(3), 'px');
  console.log('validation      :', JSON.stringify(server.session.counters));
  console.log('reconciles      :', net.state.corrections);
  return {
    finished: you.finishTick >= 0,
    maxDrift,
    counters: server.session.counters,
    botsFinished: st.racers.filter(r => r.kind === 'bot' && r.finishTick >= 0).length,
    corrections: net.state.corrections
  };
}

const a = run(0, 'zero latency');
const b = run(10, 'simulated 10-tick latency');

// cheat demo: tamper with client state and confirm the server reverts it
console.log('\n=== tamper check ===');
const server = R.LocalServer(track, { latencyTicks: 0 });
const net = R.NetClient(server.channel, track);
for (let tick = 0; tick < 260; tick++) {
  net.pumpDown(tick);
  if (tick === 220) net.cheatTeleport(900);
  net.sendAndPredict(tick, R.IN.RIGHT);
  server.tick(tick);
}
const auth = server.session.state.get(server.room.playerId);
console.log('client believes x :', Math.round(net.state.local.x));
console.log('server says     x :', Math.round(auth.x));
console.log('claim rejections  :', server.session.counters.claimRejected);
console.log('snapped back      :', Math.abs(net.state.local.x - auth.x) < 2);

// ---------------------------------------------------------------------------
// Rewind determinism: replaying the same inputs after a rewind must land on
// byte-identical state. If it does not, practice is useless.
// ---------------------------------------------------------------------------
function stateFingerprint(session) {
  return JSON.stringify(session.state.racers.map(r => ({
    id: r.id,
    x: +r.x.toFixed(6), y: +r.y.toFixed(6),
    vx: +r.vx.toFixed(6), vy: +r.vy.toFixed(6),
    onGround: r.onGround, jumps: r.jumps, prevJump: r.prevJump,
    slideTicks: r.slideTicks, slideLock: r.slideLock,
    stun: r.stun, inv: r.inv, boost: +r.boost.toFixed(6),
    sector: r.sector, respawns: r.respawns, finishTick: r.finishTick,
    picked: Object.keys(r.picked).sort()
  }))) + '|' + JSON.stringify(session.counters);
}

function rewindCheck() {
  const RUN_TO = 420;
  const server = R.LocalServer(track, { latencyTicks: 0 });
  const net = R.NetClient(server.channel, track);
  const practice = R.Practice();
  const inputs = [];

  for (let tick = 0; tick < RUN_TO; tick++) {
    net.pumpDown(tick);
    const input = net.state.local
      ? R.AiRacers.inputFor(net.state.local, track, tick, 1)
      : 0;
    inputs[tick] = input;
    net.sendAndPredict(tick, input);
    server.tick(tick);
    practice.record(tick, server.session, input);
  }

  const original = stateFingerprint(server.session);

  const snap = practice.rewind(2, server.session);
  if (!snap) return { ok: false, reason: 'no snapshot available' };

  const you = server.session.state.get(server.room.playerId);
  net.adoptAuthoritative(you);

  const rewoundTo = snap.tick;

  // Replay the exact same inputs over the rewound stretch.
  for (let tick = rewoundTo + 1; tick < RUN_TO; tick++) {
    net.pumpDown(tick);
    net.sendAndPredict(tick, inputs[tick]);
    server.tick(tick);
    practice.record(tick, server.session, inputs[tick]);
  }

  const replayed = stateFingerprint(server.session);

  return {
    ok: original === replayed,
    rewoundTo,
    ticksReplayed: RUN_TO - 1 - rewoundTo,
    original,
    replayed
  };
}

function segmentCheck() {
  const server = R.LocalServer(track, { latencyTicks: 0 });
  const net = R.NetClient(server.channel, track);
  net.pumpDown(0);
  server.startAtCheckpoint(2);

  const you = server.session.state.get(server.room.playerId);
  net.adoptAuthoritative(you);
  const expectedX = track.checkpointX(2);

  // Simulate a short stretch to be sure it runs from there.
  for (let tick = 0; tick < 120; tick++) {
    net.pumpDown(tick);
    const input = net.state.local
      ? R.AiRacers.inputFor(net.state.local, track, tick, 1)
      : 0;
    net.sendAndPredict(tick, input);
    server.tick(tick);
  }

  return {
    ok: you.sector === 2
      && Math.abs(expectedX - track.checkpointX(2)) < 1
      && you.x > expectedX
      && server.session.counters.stepRejected === 0
      && server.session.counters.claimRejected === 0,
    sector: you.sector,
    startedAt: Math.round(expectedX),
    nowAt: Math.round(you.x),
    counters: server.session.counters
  };
}

const rew = rewindCheck();
console.log('\n=== rewind determinism ===');
console.log('rewound to tick :', rew.rewoundTo, '(replayed', rew.ticksReplayed, 'ticks)');
console.log('identical state :', rew.ok);
if (!rew.ok && rew.original) {
  console.log(' original:', String(rew.original).slice(0, 260));
  console.log(' replayed:', String(rew.replayed).slice(0, 260));
}

const seg = segmentCheck();
console.log('\n=== segment practice ===');
console.log('started at CP2 x:', seg.startedAt, '-> now x:', seg.nowAt, 'sector:', seg.sector);
console.log('validation      :', JSON.stringify(seg.counters));

const checks = [
  ['player finishes at latency 0', a.finished],
  ['player finishes at latency 10', b.finished],
  ['prediction matches authority exactly', a.maxDrift < 0.001],
  ['no false cheat flags in clean play (lat 0)', a.counters.claimRejected === 0],
  ['no false cheat flags in clean play (lat 10)', b.counters.claimRejected === 0],
  ['no bogus step refusals (lat 0)', a.counters.stepRejected === 0],
  ['prediction never corrected (lat 0)', a.corrections === 0],
  ['prediction never corrected (lat 10)', b.corrections === 0],
  ['no bogus step refusals (lat 10)', b.counters.stepRejected === 0],
  ['bots can complete the track', a.botsFinished === 3],
  ['tampering is detected', server.session.counters.claimRejected > 0],
  ['tampering is reverted', Math.abs(net.state.local.x - auth.x) < 2],
  ['rewind replays deterministically', rew.ok],
  ['segment practice starts at the checkpoint', seg.ok]
];

console.log('');
let ok = true;
for (const [name, pass] of checks) {
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name);
  if (!pass) ok = false;
}
console.log('\nRESULT:', ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
