// Canvas renderer. Draws from the predicted local character and the
// interpolated server views; it never mutates game state.
var R = window.R = window.R || {};

R.Renderer = function (canvas) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cam = { x: 0, y: 120 };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function sky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1e1b4b');
    g.addColorStop(0.45, '#4c1d95');
    g.addColorStop(0.75, '#b45309');
    g.addColorStop(1, '#f59e0b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun
    ctx.fillStyle = 'rgba(254,240,138,0.85)';
    ctx.beginPath();
    ctx.arc(W * 0.74, H * 0.42 - cam.y * 0.04, 46, 0, Math.PI * 2);
    ctx.fill();
  }

  function hills(parallax, color, baseY, amp, step) {
    var off = cam.x * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var sx = 0; sx <= W + step; sx += step) {
      var wx = sx + off;
      var y = baseY - cam.y * parallax
        + Math.sin(wx * 0.0016) * amp
        + Math.sin(wx * 0.0043) * amp * 0.45;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function worldX(x) { return x - cam.x; }
  function worldY(y) { return y - cam.y; }

  function drawPlatforms(track) {
    for (var i = 0; i < track.platforms.length; i++) {
      var p = track.platforms[i];
      var sx = worldX(p.x), sy = worldY(p.y);
      if (sx > W + 60 || sx + p.w < -60) continue;

      var isGround = p.h > 100;
      ctx.fillStyle = isGround ? '#1f2937' : '#334155';
      ctx.fillRect(sx, sy, p.w, p.h);

      // grass / lip
      ctx.fillStyle = isGround ? '#15803d' : '#64748b';
      ctx.fillRect(sx, sy, p.w, isGround ? 10 : 5);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sx, sy, p.w, 2);
    }

    // mark the slide sections
    for (var j = 0; j < track.overhangs.length; j++) {
      var o = track.overhangs[j];
      var ox = worldX(o.x), oy = worldY(o.y);
      if (ox > W + 60 || ox + o.w < -60) continue;
      ctx.fillStyle = 'rgba(248,113,113,0.22)';
      ctx.fillRect(ox, oy + o.h, o.w, 32);
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SLIDE', ox + o.w / 2, oy + o.h + 22);
    }
  }

  function drawSpikes(track) {
    for (var i = 0; i < track.spikes.length; i++) {
      var s = track.spikes[i];
      var sx = worldX(s.x), sy = worldY(s.y);
      if (sx > W + 40 || sx + s.w < -40) continue;
      ctx.fillStyle = '#e11d48';
      var teeth = Math.max(3, Math.round(s.w / 16));
      var tw = s.w / teeth;
      for (var t = 0; t < teeth; t++) {
        ctx.beginPath();
        ctx.moveTo(sx + t * tw, sy + s.h);
        ctx.lineTo(sx + t * tw + tw / 2, sy);
        ctx.lineTo(sx + (t + 1) * tw, sy + s.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawBoosts(track, tick) {
    for (var i = 0; i < track.boosts.length; i++) {
      var b = track.boosts[i];
      var sx = worldX(b.x), sy = worldY(b.y);
      if (sx > W + 40 || sx + b.w < -40) continue;
      ctx.fillStyle = 'rgba(34,211,238,0.25)';
      ctx.fillRect(sx, sy, b.w, b.h);
      ctx.fillStyle = '#22d3ee';
      for (var a = 0; a < 3; a++) {
        var shift = ((tick * 3 + a * 22) % b.w);
        ctx.beginPath();
        ctx.moveTo(sx + shift, sy + 2);
        ctx.lineTo(sx + shift + 12, sy + b.h / 2);
        ctx.lineTo(sx + shift, sy + b.h - 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawItems(track, picked, tick) {
    for (var i = 0; i < track.items.length; i++) {
      if (picked && picked[i]) continue;
      var it = track.items[i];
      var sx = worldX(it.x) + it.w / 2;
      var sy = worldY(it.y) + it.h / 2 + Math.sin((tick + i * 17) * 0.06) * 5;
      if (sx > W + 40 || sx < -40) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((tick + i * 13) * 0.045);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  function drawCheckpoints(track, sector) {
    for (var i = 0; i < track.checkpoints.length; i++) {
      var cx = worldX(track.checkpoints[i]);
      if (cx > W + 40 || cx < -40) continue;
      var passed = sector > i;
      ctx.strokeStyle = passed ? 'rgba(74,222,128,0.6)' : 'rgba(226,232,240,0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(cx, worldY(200));
      ctx.lineTo(cx, worldY(760));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = passed ? '#4ade80' : '#e2e8f0';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CP' + (i + 1), cx, worldY(190));
    }
  }

  function drawFinish(track, tick) {
    var fx = worldX(track.finishX);
    if (fx > W + 80 || fx < -80) return;
    var top = worldY(250), bottom = worldY(520);
    var cell = 16;
    for (var y = top, row = 0; y < bottom; y += cell, row++) {
      for (var c = 0; c < 2; c++) {
        ctx.fillStyle = ((row + c) % 2 === 0) ? '#f8fafc' : '#0f172a';
        ctx.fillRect(fx + c * cell, y, cell, cell);
      }
    }
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', fx + cell, top - 10 + Math.sin(tick * 0.08) * 3);
  }

  function drawRacer(x, y, h, color, opts) {
    opts = opts || {};
    var sx = worldX(x), sy = worldY(y);
    if (sx > W + 80 || sx < -80) return;

    var w = R.C.BODY_W;
    ctx.save();
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;

    // boost trail
    if (opts.boost > 20) {
      ctx.fillStyle = 'rgba(34,211,238,0.35)';
      for (var t = 1; t <= 3; t++) {
        ctx.fillRect(sx - w / 2 - t * 9, sy - h * 0.7, 6, h * 0.55);
      }
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, w * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = opts.stun > 0 && (opts.tick % 8 < 4) ? '#fda4af' : color;
    roundRect(sx - w / 2, sy - h, w, h, Math.min(9, h / 2));
    ctx.fill();

    // visor
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    var vy = sy - h + (h > 36 ? 12 : 8);
    ctx.fillRect(sx - 7, vy, 13, 7);

    // legs
    if (!opts.ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      var swing = Math.sin((opts.tick || 0) * 0.45) * Math.min(1, Math.abs(opts.vx || 0) / 260) * 7;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy - 2); ctx.lineTo(sx - 5 - swing, sy + 6);
      ctx.moveTo(sx + 5, sy - 2); ctx.lineTo(sx + 5 + swing, sy + 6);
      ctx.stroke();
    }

    // name
    if (opts.name) {
      ctx.fillStyle = 'rgba(226,232,240,0.9)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.name, sx, sy - h - 8);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD ---

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(2,6,23,0.62)';
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawProgressBar(g) {
    var x = 250, y = 16, w = W - 500, h = 10;
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    roundRect(x, y, w, h, 5);
    ctx.fill();

    var ids = Object.keys(g.net.state.racers);
    for (var i = 0; i < ids.length; i++) {
      var id = Number(ids[i]);
      var v = g.net.state.racers[id];
      var meta = g.net.state.meta[id] || {};
      var p = clamp(v.x / g.track.finishX, 0, 1);
      ctx.fillStyle = meta.color || '#94a3b8';
      ctx.beginPath();
      ctx.arc(x + p * w, y + h / 2, id === g.net.state.youId ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Frame-accurate input record. This is the thing that actually makes you
  // faster: it shows how many frames early or late each press landed.
  function drawInputDisplay(g) {
    var hist = g.practice.getInputs();
    if (hist.length === 0) return;

    var ROWS = [
      { bit: R.IN.LEFT, label: '\u2190', color: '#94a3b8' },
      { bit: R.IN.RIGHT, label: '\u2192', color: '#38bdf8' },
      { bit: R.IN.JUMP, label: 'JMP', color: '#4ade80' },
      { bit: R.IN.SLIDE, label: 'SLD', color: '#fbbf24' }
    ];

    var cell = 3, gap = 1, rowH = 11;
    var shown = Math.min(hist.length, 90);
    var w = shown * (cell + gap) + 54;
    var h = ROWS.length * rowH + 30;
    var x = (W - w) / 2, y = H - h - 16;

    panel(x, y, w, h);

    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.fillText('INPUT  (' + shown + ' frames)', x + 10, y + 12);

    for (var r = 0; r < ROWS.length; r++) {
      var row = ROWS[r];
      var ry = y + 20 + r * rowH;

      ctx.fillStyle = '#475569';
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillText(row.label, x + 10, ry + 7);

      for (var i = 0; i < shown; i++) {
        var entry = hist[hist.length - shown + i];
        var on = (entry.input & row.bit) !== 0;
        ctx.fillStyle = on ? row.color : 'rgba(148,163,184,0.14)';
        ctx.fillRect(x + 42 + i * (cell + gap), ry + 1, cell, 7);
      }

      // Held duration in frames, which is what you compare between attempts.
      var held = g.practice.heldTicks(row.bit);
      if (held > 0) {
        ctx.fillStyle = row.color;
        ctx.textAlign = 'right';
        ctx.fillText(String(held), x + w - 8, ry + 7);
        ctx.textAlign = 'left';
      }
    }
  }

  function drawPracticeHud(g) {
    var seg = g.practice.getSegment();
    var rewinds = g.practice.getRewinds();
    if (seg === 0 && rewinds === 0 && !g.rewindDirty) return;

    var x = W / 2 - 110, y = 36, w = 220, h = 30;
    panel(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';

    var label = seg > 0 ? ('SEGMENT ' + seg + ' \u2014 PRACTICE') : 'PRACTICE RUN';
    ctx.fillText(label, W / 2, y + 13);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('rewinds: ' + rewinds + '  \u00b7  no record set', W / 2, y + 25);
    ctx.textAlign = 'left';
  }

  function drawHud(g) {
    var s = g.net.state;
    var trial = g.trial.state;
    var local = s.local;

    // --- timing ---------------------------------------------------------
    panel(16, 16, 212, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('TIME', 30, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px ui-monospace, monospace';
    ctx.fillText(g.trial.fmt(trial.frame < 0 ? 0 : trial.frame), 28, 66);

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BEST ' + g.trial.fmt(trial.best), 30, 86);

    if (trial.delta != null) {
      ctx.fillStyle = trial.delta <= 0 ? '#4ade80' : '#fb7185';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(g.trial.fmtDelta(trial.delta), 150, 86);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('CP ' + g.checkpoints.current() + '/' + g.checkpoints.total(), 30, 102);

    // --- speed / rank ---------------------------------------------------
    panel(W - 228, 16, 212, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('SPEED', W - 214, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.fillText(Math.round(Math.abs(local ? local.vx : 0)) + '', W - 214, 60);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('px/s', W - 160, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('RANK', W - 108, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.fillText(g.rank + '/' + g.racerCount, W - 108, 60);

    // boost bar
    var bw = 184, bx = W - 214, by = 76;
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    roundRect(bx, by, bw, 8, 4); ctx.fill();
    var bf = clamp((local ? local.boost : 0) / R.C.BOOST_PAD_CAP, 0, 1);
    if (bf > 0) {
      ctx.fillStyle = '#22d3ee';
      roundRect(bx, by, bw * bf, 8, 4); ctx.fill();
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText('BOOST', bx, by + 20);

    // --- server validation panel ---------------------------------------
    var c = g.server.session.counters;
    var px = W - 228, py = H - 104;
    panel(px, py, 212, 88);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('LOCAL SERVER — VALIDATION', px + 14, py + 20);
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('claim mismatch   ' + c.claimRejected, px + 14, py + 38);
    ctx.fillText('bad input        ' + c.inputRejected, px + 14, py + 52);
    ctx.fillText('step refused     ' + c.stepRejected, px + 14, py + 66);
    ctx.fillStyle = '#64748b';
    ctx.fillText('reconciles ' + s.corrections, px + 14, py + 80);

    // --- controls -------------------------------------------------------
    panel(16, H - 104, 310, 88);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('← → run    SPACE jump (x2)    ↓ / SHIFT slide', 30, H - 82);
    ctx.fillText('R restart   G ghost   T inputs   Q rewind 2s', 30, H - 66);
    ctx.fillText('1 full run    2 3 4 practice from a checkpoint', 30, H - 52);
    ctx.fillStyle = '#f87171';
    ctx.fillText('C teleport-hack    V speed-hack  — server reverts both', 30, H - 48);
    ctx.fillStyle = '#64748b';
    ctx.fillText('ghost: ' + (g.ghostOn && g.ghost.hasPlayback() ? 'on' : 'off') +
      '    latency: ' + g.server.channel.latency + ' ticks', 30, H - 30);

    // --- countdown / finish --------------------------------------------
    ctx.textAlign = 'center';
    if (s.phase === 'countdown') {
      var left = Math.max(0, s.startTick - s.serverTick);
      var secs = Math.ceil(left / R.C.TICK_HZ);
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(0, H / 2 - 70, W, 140);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 86px system-ui, sans-serif';
      ctx.fillText(secs > 0 ? String(secs) : 'GO!', W / 2, H / 2 + 24);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Sunset Ridge  ·  reach the finish line', W / 2, H / 2 + 54);
    } else if (local && local.finishTick >= 0) {
      ctx.fillStyle = 'rgba(2,6,23,0.72)';
      ctx.fillRect(0, H / 2 - 86, W, 172);
      ctx.fillStyle = trial.isNewBest ? '#4ade80' : '#f8fafc';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillText(trial.isNewBest ? 'NEW BEST!' : 'FINISHED', W / 2, H / 2 - 30);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 34px ui-monospace, monospace';
      ctx.fillText(g.trial.fmt(trial.finishFrame), W / 2, H / 2 + 12);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('rank ' + g.rank + ' of ' + g.racerCount +
        '   ·   respawns ' + (local.respawns || 0), W / 2, H / 2 + 42);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('press R to race again', W / 2, H / 2 + 68);
    }
    ctx.textAlign = 'left';
  }

  // ------------------------------------------------------------- public ---

  return {
    draw: function (g, alpha) {
      var s = g.net.state;
      var local = s.local;
      var px = local ? local.x : R.C.SPAWN_X;
      var py = local ? local.y : g.track.groundY;

      cam.x = clamp(px - 330, 0, Math.max(0, g.track.length - W));
      cam.y = clamp(py - 400, -140, 210);

      sky();
      hills(0.18, 'rgba(49,46,129,0.85)', 420, 54, 24);
      hills(0.42, 'rgba(30,27,75,0.9)', 470, 38, 18);

      drawPlatforms(g.track);
      drawCheckpoints(g.track, local ? local.sector : 0);
      drawBoosts(g.track, g.tick);
      drawSpikes(g.track);
      drawItems(g.track, local ? local.picked : null, g.tick);
      drawFinish(g.track, g.tick);

      // ghost of the saved best run
      if (g.ghostOn) {
        var gp = g.ghost.at(g.trial.state.frame);
        if (gp) {
          drawRacer(gp.x, gp.y, R.C.BODY_H, '#e2e8f0',
            { alpha: 0.28, ghost: true, name: 'ghost', tick: g.tick });
        }
      }

      // other racers
      var ids = Object.keys(s.racers);
      for (var i = 0; i < ids.length; i++) {
        var id = Number(ids[i]);
        if (id === s.youId) continue;
        var v = g.net.viewAt(id, alpha);
        if (!v) continue;
        drawRacer(v.x, v.y, v.slideTicks > 0 ? R.C.SLIDE_H : R.C.BODY_H,
          v.meta.color, {
            name: v.meta.name, vx: v.vx, tick: g.tick,
            stun: v.stun, boost: v.boost, alpha: 0.95
          });
      }

      // you
      if (local) {
        drawRacer(local.x, local.y, R.Physics.height(local), local.color || '#38bdf8', {
          name: 'YOU', vx: local.vx, tick: g.tick,
          stun: local.stun, boost: local.boost
        });
      }

      drawProgressBar(g);
      drawHud(g);
      drawPracticeHud(g);
      if (g.showInputs) drawInputDisplay(g);
    }
  };
};
