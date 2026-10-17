# Unreal Engine 5 project

`unreal/OfflineRacer/` is a C++-only UE5 project for the same game, with the
same architecture as the JavaScript prototype.

> **Status: not yet compiled.** This was written without UE5 installed, so it
> has never been through a compiler. Treat the first build as a bring-up pass —
> expect a handful of small fixes (a missing include, an API renamed between
> engine versions). The design and the structure are the deliverable; the first
> successful compile is yours. Nothing here depends on `.uasset` content, which
> is exactly why it can be reviewed and fixed as plain text.

Targets UE **5.4**. For another version, change `EngineAssociation` in
`OfflineRacer.uproject` and `IncludeOrderVersion` in the two `Target.cs` files.

## First build

### macOS

```bash
# 1. Install UE 5.4 via the Epic Games Launcher, and Xcode from the App Store
xcode-select --install

# 2. Generate the Xcode project
/Users/Shared/Epic\ Games/UE_5.4/Engine/Build/BatchFiles/Mac/GenerateProjectFiles.sh \
  -project="$PWD/unreal/OfflineRacer/OfflineRacer.uproject" -game

# 3. Build and open
open unreal/OfflineRacer/OfflineRacer.xcworkspace
# or from the terminal:
/Users/Shared/Epic\ Games/UE_5.4/Engine/Build/BatchFiles/Mac/Build.sh \
  OfflineRacerEditor Mac Development \
  -project="$PWD/unreal/OfflineRacer/OfflineRacer.uproject"
```

Then double-click `OfflineRacer.uproject`. On Apple Silicon both arm64 and
Rosetta work; arm64 native is the default.

### Windows

Right-click `OfflineRacer.uproject` → *Generate Visual Studio project files*,
open the `.sln`, build the **Development Editor** configuration, then launch.

### Package a shippable build

```bash
# macOS .app
/Users/Shared/Epic\ Games/UE_5.4/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun \
  -project="$PWD/unreal/OfflineRacer/OfflineRacer.uproject" \
  -noP4 -platform=Mac -clientconfig=Shipping -cook -build -stage -pak -archive \
  -archivedirectory="$PWD/Build"
```

Swap `-platform=Win64` for a Windows build. This is a normal cross-platform UE
project: there is no platform-specific code in it.

## Setting up a playable level

The code carries no content, so build a test track once in the editor:

1. **New Level** → Basic. Save as `Content/Maps/SunsetRidge`.
2. Lay out the track along **world +X**. The character is plane-constrained to
   the XZ plane, so it is a true side-scroller — Y is depth only.
3. Drop a few **`ORCheckpoint`** actors along the way:
   - set `CheckpointIndex` to `0, 1, 2, …` in track order, no gaps
   - on the last one tick **`bIsFinishLine`**
   - move its `RespawnPoint` child to where a fallen racer should reappear
4. Drop **`ORHazard`** actors for spikes, and **`ORBoostPad`** actors for pads
   (leave `bConsumeOnTouch` off) and pickups (turn it on).
5. Build a low tunnel out of static meshes, with about 100 uu of clearance, to
   force a slide. The engine will not let a racer stand up inside it.
6. Place **4 `PlayerStart`** actors: the first is the human, the rest are bots.
7. **World Settings → GameMode Override → `ORGameMode`**.
8. Project Settings → Maps & Modes → set this as the default map.

Press Play. You get a 3 second countdown, three bots, checkpoint splits and a
finish time.

## How it maps to the prototype

Most of the hand-written netcode in the JS version is engine-provided here:

| JavaScript prototype | Unreal equivalent |
|---|---|
| `netClient.js` prediction + reconcile | `UCharacterMovementComponent` (built in) |
| `loopback.js` | standalone / listen server — no transport to write |
| `raceSession.js` | `AORGameMode` |
| `raceState.js` | `AORGameState` (replicated) |
| per-racer sector/splits | `AORPlayerState` (replicated) |
| `physics.js` slide + ceiling check | `UORCharacterMovementComponent` + crouch |
| `validation.js` | `AORGameMode::TryRegister*` + progress rate clamp |
| `aiRacers.js` | `AORBotController` (line-trace lookahead) |
| `ghost.js` + `save.js` | `UORGhostRecorder` + `UORSaveGame` |
| input bitfield + compressed flags | `FSavedMove_OR::GetCompressedFlags` |

### Why the slide uses crouch

`UORCharacterMovementComponent` implements the slide on top of the engine's
crouch system instead of a `MOVE_Custom` mode. Crouch is already predicted,
already resizes the capsule, and already **refuses to stand you up when there
is a ceiling overhead**.

That last one matters: in the JS prototype the same situation was a real bug the
test suite caught — jumping inside a slide tunnel cancelled the slide, the
standing body intersected the ceiling, and collision resolution flung the racer
205 px to the far edge of the platform, after which validation refused every
later move and froze it permanently. Here `UnCrouch()` simply declines.

What still needs hand-written prediction is our own state — "wants to slide"
and "boost remaining" — which is what `FSavedMove_OR` carries.

## Why it is server-authoritative offline

`AORGameMode` runs identically in standalone, listen server and dedicated
server. Checkpoints must be crossed in order, a finish with missing checkpoints
is refused, and progress gains faster than `MaxProgressPerSecond` are clamped
and logged rather than accepted.

So practising alone exercises the same rules an online match would, and when you
do add real multiplayer there is no authority model to retrofit — only a
transport.

## Known gaps

- Never compiled (see the note at the top).
- No content: no meshes, animations, materials, HUD widgets or levels. Movement
  works with the default capsule; add a skeletal mesh and an anim blueprint for
  visuals.
- Input uses the legacy axis/action mappings in `Config/DefaultInput.ini`
  because Enhanced Input needs `.uasset` files. To migrate: create
  `InputAction`/`InputMappingContext` assets, add the `EnhancedInput` module to
  `OfflineRacer.Build.cs`, and swap `BindAxis`/`BindAction` in
  `ORPlayerController.cpp` for `UEnhancedInputComponent::BindAction`.
- Falling off the track does not yet respawn you; `ORCheckpoint` already
  exposes `GetRespawnTransform()`, so wire a kill-Z volume to it.
- `UORGhostRecorder` is written but not yet attached to the character or driven
  by the race phase. Add it as a component on your `ORCharacter` Blueprint and
  call `BeginRecording()` when the phase becomes `Running`, then `CommitRun()`
  on finish.
- Bots use line traces rather than a nav mesh, which suits a side-scroller but
  will not handle branching routes. Add a spline per route if you want that.
