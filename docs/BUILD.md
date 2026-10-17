# Build & run

The game is plain HTML5 + Canvas with **no build step and no dependencies**.
The same files run on macOS, Windows and Linux — there is nothing to port.

## Run it

### Fastest — just open it

Double-click `index.html`, or:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Everything works from `file://` because the scripts are classic `<script>` tags,
not ES modules. Save data uses `localStorage`, which some browsers restrict on
`file://` — if your best time does not persist, use the local server below.

### Recommended — local server

```bash
node tools/serve.js          # http://localhost:8080
node tools/serve.js 3000     # custom port
```

Requires Node 14+ and no packages. `localStorage` always works over `http://`.

## Verify

```bash
npm test     # headless simulation: completability, prediction, validation
npm run check # parse every source file
```

`npm test` runs the whole race with no browser: it drives the human slot
through the real input path, checks the track is completable, that client
prediction matches the authoritative server exactly, that clean play raises
zero cheat flags, and that tampering with client state is both detected and
reverted.

---

## macOS

### Testing

| Browser | Status | Notes |
|---|---|---|
| Safari 16+ | works | `localStorage` blocked on `file://` in some settings — use `tools/serve.js` |
| Chrome / Edge | works | |
| Firefox | works | |

Apple Silicon and Intel are both fine; there is no native code.

Keyboard notes on macOS:

- The arrow keys and `Space` are captured by the page, so the window will not
  scroll while you play.
- If `Space` ever scrolls instead of jumping, click the canvas once to focus it.
- Use `fn` + arrows if your keyboard maps the arrow cluster differently.

### Package as a real .app (optional)

Only needed if you want a double-clickable app instead of a browser tab.

**Option A — Electron** (simplest, ~150 MB output)

```bash
npm install --save-dev electron @electron-forge/cli
npx electron-forge import
npm run make          # produces out/Offline Racer-darwin-arm64/
```

Add `main.js` for Electron in a separate file (do not overwrite
`src/main.js`):

```js
// electron-main.js
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1000, height: 700 });
  win.loadFile('index.html');
});
```

**Option B — Tauri** (much smaller, needs Rust)

```bash
brew install rust
npm create tauri-app@latest
# point the Tauri config's frontendDist at this folder
npm run tauri build   # produces a .app and .dmg
```

**Option C — web only**

Host the folder anywhere static (GitHub Pages, Netlify, Cloudflare Pages).
Push to a `gh-pages` branch and it is playable from a URL, including on iOS
Safari — though touch controls are not implemented yet.

---

## Where to extend it

The layout matches the architecture diagram in `docs/`.

| You want to change | File |
|---|---|
| Movement feel, jump height, slide | `src/shared/constants.js` |
| Track layout, hazards, pickups | `src/shared/track.js` |
| Character physics rules | `src/shared/physics.js` |
| Bot behaviour and difficulty | `src/server/aiRacers.js` |
| Anti-cheat thresholds and rules | `src/server/validation.js` |
| Authoritative race rules | `src/server/raceSession.js` |
| Lap timing and splits | `src/client/timeTrial.js` |
| Visuals | `src/client/renderer.js` |

### Art and audio

`assets/` is empty on purpose: the current visuals are drawn procedurally in
`renderer.js`, so the repo carries no binary art. To use your own sprites, load
them in `renderer.js` and draw with `ctx.drawImage`. Only ship art you made or
hold a licence for.

### Making it a real online game

The client already talks to the server through a transport interface, so the
server does not need rewriting:

1. Move `src/server/*` into a Node process.
2. Replace `src/server/loopback.js` with a WebSocket transport exposing the
   same four methods (`sendToServer`, `sendToClient`, `drainServer`,
   `drainClient`).
3. Give the server its own fixed-rate tick instead of being driven by the
   client loop.
4. Buffer inputs by their stamped tick and simulate a few ticks behind the
   clients, so late packets still land on the tick they were made for.

Prediction, reconcile and validation are already in place and already tested.
