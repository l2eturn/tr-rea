# Offline Racer

An original side-scrolling race platformer that runs **completely offline**, with
its own authoritative server running in-process behind a loopback channel.

Open `index.html` and play. No build, no dependencies, no network.

```bash
node tools/serve.js    # or just open index.html
npm test               # headless simulation checks
```

## Controls

| Key | Action |
|---|---|
| `←` `→` | run |
| `Space` / `↑` | jump (double jump in the air) |
| `↓` / `Shift` | slide — required to pass the low tunnels |
| `R` | restart the race |
| `G` | toggle the ghost of your best run |
| `L` | cycle simulated snapshot latency (0 / 4 / 10 ticks) |
| `C` / `V` | try to teleport or speed-hack — the server reverts both |

## What is in it

**Client**

- Fixed-timestep loop at 60 Hz, decoupled from render rate
- Deterministic character controller: run, double jump, slide, stun, knockback
- Track with pits, stepping stones, high routes, slide tunnels, spikes, boost
  pads and pickups
- Checkpoints with per-sector splits, respawn on falling
- Time trial with best time and ghost replay of your best run
- Save data in `localStorage`, guarded so the game still works without it
- Client-side prediction with reconciliation against the server

**Local virtual server** (`src/server/`, reached only through the loopback)

- Lobby → Room → Race Session
- Authoritative race state: positions, laps, finish order
- AI racers that produce ordinary inputs and go through identical physics
- Server-side validation: input sanity, per-tick movement limits, speed caps,
  and comparison of the client's claimed position against the authoritative one

## Why a server in a single-player game

The client is never the authority, even offline. It predicts locally so the
controls feel immediate, but the race result comes from the session, and every
snapshot overwrites the client's guess.

That is why `C` and `V` cannot help you: they change what the client believes,
the next snapshot pulls it straight back, and the mismatch is counted in the
validation panel. It is the correct shape for an online game, and it is already
tested — see `docs/BUILD.md` for turning the loopback into a real socket.

## Tests

`npm test` runs the full race headlessly and asserts:

- the track is completable, and all bots can finish it
- client prediction matches the authoritative server exactly (0.000 px drift)
- clean play produces zero false cheat flags, at 0 and at 10 ticks of latency
- no bogus step refusals
- tampering with client state is detected **and** reverted

## Layout

```
index.html
src/shared/     constants, track, physics, protocol   (identical on both sides)
src/server/     loopback, validation, race state, AI, session, room, lobby
src/client/     input, net client, save, ghost, checkpoints, timing, render, loop
src/main.js     wiring and the tick order
tools/          static server, syntax check
tests/          headless simulation test
docs/           build & macOS instructions, architecture diagram
```

`docs/architecture.html` is an interactive diagram of the whole system.

## Licence

MIT. All code and visuals here are original; the renderer draws everything
procedurally, so the repository contains no third-party art, audio or assets.
