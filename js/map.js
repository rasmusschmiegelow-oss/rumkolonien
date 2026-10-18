'use strict';
// Isometrisk kort: kamera, tegning, dag/nat, effekter, robotter og input.

const TW = 96, TH = 48;          // feltets bredde og højde i verdenskoordinater
const SPRITE_K = TW / 80;        // bygningssprites har en fod på 80 x 40
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const cam = { x: 0, y: 0, z: 1 };
let viewW = 0, viewH = 0, dpr = 1;

const floaters = [], particles = [], rockets = [];
let editMode = false, editSel = -1; // redigeringstilstand: valgt felt
let hint = null;                    // rådgiverens pil: { idx, until }
let camGoal = null;                 // kameraet glider hen mod et felt
const agents = { hoster: null, pakker: null };

// ---------- Koordinater ----------
const tileCenter = (idx) => {
  const r = Math.floor(idx / COLS), c = idx % COLS;
  return [(c - r) * TW / 2, (c + r + 1) * TH / 2];
};
const toScreen = (wx, wy) => [(wx - cam.x) * cam.z + viewW / 2, (wy - cam.y) * cam.z + viewH / 2];
const toWorld = (sx, sy) => [(sx - viewW / 2) / cam.z + cam.x, (sy - viewH / 2) / cam.z + cam.y];

function tileAt(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const c = Math.floor(wx / TW + wy / TH), r = Math.floor(wy / TH - wx / TW);
  return c >= 0 && c < COLS && r >= 0 && r < ROWS ? idxOf(r, c) : -1;
}

function fitZoom() { return Math.min(viewW / ((COLS + ROWS) * TW / 2 + 40), viewH / ((COLS + ROWS) * TH / 2 + 80)); }
function clampCam() {
  const minZ = fitZoom() * 0.9;
  cam.z = Math.max(minZ, Math.min(1.8, cam.z));
  cam.x = Math.max(-ROWS * TW / 2, Math.min(COLS * TW / 2, cam.x));
  cam.y = Math.max(0, Math.min((COLS + ROWS) * TH / 2, cam.y));
}

function centerCamera() {
  const cleared = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].t !== 'locked');
  let sx = 0, sy = 0;
  for (const i of cleared) { const [x, y] = tileCenter(i); sx += x; sy += y; }
  cam.x = sx / cleared.length; cam.y = sy / cleared.length;
  cam.z = Math.max(fitZoom(), Math.min(1.2, 0.55 + viewW / 1800));
  clampCam();
}

function focusTile(idx) {
  const [x, y] = tileCenter(idx);
  camGoal = { x, y: y - 30 };
  hint = { idx, until: Date.now() + 6000 };
}

function resize() {
  const wrap = canvas.parentElement;
  dpr = window.devicePixelRatio || 1;
  viewW = wrap.clientWidth;
  viewH = wrap.clientHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  clampCam();
}

// ---------- Effekter (kaldes fra spillogikken) ----------
function floatItems(idx, list) {
  const [x, y] = tileCenter(idx);
  floaters.push({ x, y: y - 30, list, t0: performance.now() });
}

function burst(idx, color) {
  const [x, y] = tileCenter(idx);
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(40, 120);
    particles.push({ x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 60, life: 1, color, s: rand(3, 6) });
  }
}

function launchShip() {
  const pad = S.tiles.findIndex((t) => t.t === 'pad');
  if (pad < 0) return;
  const [x, y] = tileCenter(pad);
  rockets.push({ x, y, t0: performance.now() });
  for (let i = 0; i < 8; i++) {
    particles.push({ x, y: y - 20, vx: rand(-60, 60), vy: rand(-180, -80), life: 1.4, coin: true, s: 18 });
  }
}

// ---------- Dag og nat ----------
// 0 = solopgang. Mars har blå solnedgange, så skumringen får et blåt skær.
function dayPhase(now = Date.now()) { return (now % DAY_MS) / DAY_MS; }
function daylight(p) {
  if (p < 0.5) return 1;
  if (p < 0.6) return 1 - (p - 0.5) / 0.1 * 0.55;
  if (p < 0.9) return 0.45;
  return 0.45 + (p - 0.9) / 0.1 * 0.55;
}
function solClock(now = Date.now()) {
  const sol = Math.floor(now / DAY_MS) % 1000;
  const mins = Math.floor(((dayPhase(now) * 24 + 6) % 24) * 60);
  return { sol, time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, night: daylight(dayPhase(now)) < 0.6 };
}

// ---------- Tegning ----------
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function diamond(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y);
  ctx.closePath();
}

const GROUND = ['#C8623A', '#BF5A34', '#CC6A40', '#C35E37'];
const GROUND_PHOBOS = ['#8E8A86', '#86817C', '#959089', '#8A857F']; // Phobos er grå

function drawGround(idx) {
  const [x, y] = tileCenter(idx);
  const t = S.tiles[idx];
  diamond(x, y, TW + 1, TH + 1);
  const phobos = S.prestige > 0;
  const pal = phobos ? GROUND_PHOBOS : GROUND;
  ctx.fillStyle = t.t === 'locked' ? (phobos ? '#6E6A66' : '#9E4A2C') : pal[Math.floor(hash(idx) * pal.length)];
  ctx.fill();
  if (t.t !== 'locked') {
    ctx.strokeStyle = '#2A1A1418'; ctx.lineWidth = 1; ctx.stroke();
  }
  const sp = S.specials && S.specials[idx];
  if (sp && (t.t === 'locked' || t.t === 'empty')) {
    drawSprite(ctx, SPECIALS[sp].sprite, x, y, TW * 1.05, 70);
  } else if (hash(idx + 99) > 0.6 && t.t !== 'plot' && t.t !== 'b' && t.t !== 'pad' && t.t !== 'pen' && t.t !== 'deco') {
    ctx.fillStyle = '#00000022';
    ctx.beginPath(); ctx.ellipse(x + (hash(idx + 7) - 0.5) * 30, y + (hash(idx + 8) - 0.5) * 10, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Klippekant langs kortets nederste sider giver dybde.
  const r = Math.floor(idx / COLS), c = idx % COLS;
  ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 2;
  if (r === ROWS - 1) {
    ctx.fillStyle = S.prestige > 0 ? '#5A5652' : '#7A3820';
    ctx.beginPath(); ctx.moveTo(x - TW / 2, y); ctx.lineTo(x, y + TH / 2); ctx.lineTo(x, y + TH / 2 + 22); ctx.lineTo(x - TW / 2, y + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (c === COLS - 1) {
    ctx.fillStyle = S.prestige > 0 ? '#45423F' : '#5E2A18';
    ctx.beginPath(); ctx.moveTo(x, y + TH / 2); ctx.lineTo(x + TW / 2, y); ctx.lineTo(x + TW / 2, y + 22); ctx.lineTo(x, y + TH / 2 + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function progressBar(x, y, pct, color) {
  const w = 52, h = 7;
  ctx.fillStyle = '#2A1A14';
  roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = '#ffffff33';
  roundRect(x - w / 2, y, w, h, 3.5); ctx.fill();
  ctx.fillStyle = color;
  roundRect(x - w / 2, y, Math.max(h, w * pct), h, 3.5); ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function badge(x, y, text) {
  ctx.fillStyle = '#5EE59A'; ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0B3A1F'; ctx.font = 'bold 13px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

function drawTile(idx, now, t) {
  const tile = S.tiles[idx];
  const [x, y] = tileCenter(idx);
  const foot = 70; // y-koordinat for feltets midte i 96px-sprites

  if (tile.t === 'locked') {
    if (S.specials && S.specials[idx]) {
      // glimt, så man kan se, at der gemmer sig noget under klipperne
      if (Math.sin(now / 400 + idx) > 0.92) particles.push({ x: x + rand(-14, 14), y: y - 6, vx: 0, vy: -20, life: 0.6, color: '#FFFFFF', s: 2.5, puff: true });
    } else if (hash(idx + 3) > 0.55) drawSprite(ctx, 'rock', x + (hash(idx + 5) - 0.5) * 20, y + 4, 96 * SPRITE_K * (0.45 + hash(idx + 6) * 0.3), 74);
  } else if (tile.t === 'empty') {
    diamond(x, y, TW * 0.7, TH * 0.7);
    ctx.setLineDash([5, 5]); ctx.strokeStyle = '#FFE0C866'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  } else if (tile.t === 'pad') {
    drawSprite(ctx, 'pad', x, y, 96 * SPRITE_K, foot);
    if (!rockets.length) drawSprite(ctx, 'rocket', x, y - 4 + Math.sin(now / 600) * 1.5, 46, 60);
    const ready = S.orders.filter(canFulfil).length + (S.colonist && canFulfil(S.colonist) ? 1 : 0);
    if (ready) badge(x + 30, y - 60, String(ready));
    if (S.colonist) {
      drawSprite(ctx, 'col-' + S.colonist.id, x - 34, y + 6 + Math.sin(now / 300) * 2, 38, 60);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x - 34, y - 46, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FF7A1A'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', x - 34, y - 45);
    }
  } else if (tile.t === 'plot') {
    drawSprite(ctx, 'plot', x, y, 96 * SPRITE_K, foot);
    if (tile.crop) {
      const pct = Math.min(1, (t - tile.start) / (tile.end - tile.start));
      const ready = t >= tile.end;
      const spots = [[-20, -4], [0, 6], [20, -4], [0, -12]];
      const name = pct < 0.4 && !ready ? 'sprout' : tile.crop;
      const size = ready ? 30 : 16 + pct * 12;
      for (const [dx, dy] of spots) {
        const bob = ready ? Math.sin(now / 260 + idx + dx) * 2 : 0;
        drawSprite(ctx, name, x + dx, y + dy + bob, size, 58);
      }
      if (ready) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 46);
        g.addColorStop(0, '#5EE59A55'); g.addColorStop(1, '#5EE59A00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 10, 46, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        progressBar(x, y + 14, pct, S.event.type === 'storm' && !owns('skjold') ? '#E0A070' : '#5EE59A');
      }
    }
    // Kuplen tegnes lidt fladere end ikonet, så den ikke skjuler felterne bagved.
    const kp = SPRITES.kuppel;
    if (kp) { const w = 96 * SPRITE_K * 0.92, h = w * 0.68; ctx.drawImage(kp.img, x - w / 2, y + 22 - h, w, h); }
  } else if (tile.t === 'deco') {
    drawSprite(ctx, tile.id, x, y, 96 * SPRITE_K * 0.85, 72);
    if (tile.id === 'deco-springvand' && Math.random() < 0.3) {
      particles.push({ x: x + rand(-6, 6), y: y - 48, vx: rand(-25, 25), vy: rand(-90, -50), life: 0.7, color: '#BFE8FF', s: rand(2, 3.5) });
    }
  } else if (tile.t === 'pen') {
    const def = ANIMALS[tile.id];
    drawSprite(ctx, tile.id, x, y, 96 * SPRITE_K, foot);
    tile.animals.forEach((a, k) => {
      const hungry = !a.end, ready = a.end && a.end <= t;
      // dyrene går lidt rundt i indhegningen; sultne dyr står stille
      const sp = hungry ? 0 : 1;
      const ax = x + [-18, 4, 20][k] + Math.sin(now / 1400 + k * 2.1) * 8 * sp;
      const ay = y + [2, 12, -2][k] + Math.cos(now / 1700 + k * 1.3) * 4 * sp;
      const flip = Math.cos(now / 1400 + k * 2.1) * sp < 0;
      ctx.save();
      if (flip) { ctx.translate(ax * 2, 0); ctx.scale(-1, 1); }
      drawSprite(ctx, def.animal, ax, ay + (ready ? Math.sin(now / 200 + k) * 1.5 : 0), 30, 58);
      ctx.restore();
      if (ready) drawSprite(ctx, def.product, ax, ay - 30 + Math.sin(now / 300 + k) * 2, 20, 32);
      else if (hungry) {
        ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax + 8, ay - 30, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        drawSprite(ctx, 'foder', ax + 8, ay - 30, 15);
      }
    });
    const ready = penReady(tile, t);
    if (ready) badge(x + 30, y - 40, String(ready));
    const busy = tile.animals.filter((a) => a.end > t);
    if (busy.length && !ready) {
      const a = busy.reduce((p, q) => (q.end < p.end ? q : p));
      progressBar(x, y + 22, (t - a.start) / (a.end - a.start), '#F3E6CF');
    }
  } else if (tile.t === 'b' && BUILDINGS[tile.id].garage) {
    drawSprite(ctx, tile.id, x, y, 96 * SPRITE_K, foot);
    const ex = S.expedition;
    if (!ex) drawSprite(ctx, 'rover', x + 22, y + 10, 34, 58);
    else if (t < ex.end) progressBar(x, y + 16, (t - ex.start) / (ex.end - ex.start), '#8E4FC2');
    else {
      drawSprite(ctx, 'rover', x + 22, y + 10, 34, 58);
      drawSprite(ctx, 'krystal', x, y - 78 + Math.sin(now / 300) * 3, 30, 32);
      badge(x + 30, y - 66, '!');
    }
  } else if (tile.t === 'b') {
    drawSprite(ctx, tile.id, x, y, 96 * SPRITE_K, foot);
    for (let k = 1; k < (tile.lvl || 1); k++) drawSprite(ctx, 'xp', x - 46 + k * 14, y + 26, 16);
    const done = tile.queue.filter((q) => q.end <= t).length;
    const cur = tile.queue.find((q) => q.end > t && q.start <= t);
    if (cur) {
      progressBar(x, y + 16, (t - cur.start) / (cur.end - cur.start), '#FF7A1A');
      // lille røgsky, mens bygningen arbejder
      if (Math.random() < 0.04) particles.push({ x: x + rand(-10, 10), y: y - 60, vx: rand(-6, 6), vy: -18, life: 1.6, color: '#ffffff66', s: rand(5, 9), puff: true });
    }
    if (done) {
      drawSprite(ctx, tile.queue.find((q) => q.end <= t).r, x, y - 78 + Math.sin(now / 300) * 3, 30, 32);
      badge(x + 30, y - 66, String(done));
    }
  }

  const pk = S.pickups.find((p) => p.idx === idx && p.born <= Date.now());
  if (pk) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 34);
    g.addColorStop(0, '#FF7A1A88'); g.addColorStop(1, '#FF7A1A00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 8, 34, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    drawSprite(ctx, pk.item, x, y - 4 + Math.sin(now / 200 + idx) * 3, 34, 50);
  }
}

function drawSeasonGround() {
  const id = season().id;
  if (id === 'vinter') {
    ctx.fillStyle = 'rgba(235, 245, 255, 0.28)';
    for (let i = 0; i < S.tiles.length; i++) {
      const [x, y] = tileCenter(i);
      diamond(x, y, TW + 1, TH + 1); ctx.fill();
    }
  } else if (id === 'foraar') {
    ctx.fillStyle = '#7FD68F';
    for (let i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i].t !== 'locked' && S.tiles[i].t !== 'empty') continue;
      const [x, y] = tileCenter(i);
      for (let k = 0; k < 3; k++) {
        if (hash(i * 7 + k) < 0.5) continue;
        ctx.beginPath(); ctx.arc(x + (hash(i + k * 13) - 0.5) * 50, y + (hash(i + k * 29) - 0.5) * 20, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (id === 'efteraar') {
    ctx.fillStyle = 'rgba(224, 122, 46, 0.12)';
    for (let i = 0; i < S.tiles.length; i++) { const [x, y] = tileCenter(i); diamond(x, y, TW + 1, TH + 1); ctx.fill(); }
  }
}

function drawArrow(idx, now) {
  const [x, y] = tileCenter(idx);
  const ay = y - 96 + Math.sin(now / 200) * 8;
  ctx.fillStyle = '#FF7A1A'; ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, ay + 26); ctx.lineTo(x - 16, ay + 8); ctx.lineTo(x - 7, ay + 8); ctx.lineTo(x - 7, ay - 10);
  ctx.lineTo(x + 7, ay - 10); ctx.lineTo(x + 7, ay + 8); ctx.lineTo(x + 16, ay + 8); ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function tutorialTarget() {
  if (S.tut >= TUTORIAL.length) return -1;
  const tgt = TUTORIAL[S.tut].target;
  if (tgt === 'emptyPlot') return S.tiles.findIndex((t) => t.t === 'plot' && !t.crop);
  if (tgt === 'cropPlot') return S.tiles.findIndex((t) => t.t === 'plot' && t.crop);
  if (tgt === 'pad') return S.tiles.findIndex((t) => t.t === 'pad');
  if (tgt === 'rock') return S.tiles.findIndex((t, i) => t.t === 'locked' && neighbourCleared(i));
  if (tgt.startsWith('b:')) return S.tiles.findIndex((t) => t.t === 'b' && t.id === tgt.slice(2));
  return -1;
}

function drawSky(light, phase) {
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  const dusk = phase > 0.48 && phase < 0.64 ? 1 - Math.abs(phase - 0.56) / 0.08 : 0;
  if (light > 0.9) { g.addColorStop(0, '#E9B48A'); g.addColorStop(1, '#C98A64'); }
  else if (dusk > 0) { g.addColorStop(0, '#4A3A6A'); g.addColorStop(0.7, '#5E8FC8'); g.addColorStop(1, '#8EB8E0'); }
  else { g.addColorStop(0, '#120D1C'); g.addColorStop(1, '#2A1E3F'); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  if (light < 0.7) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = (0.7 - light) * 3 * (0.5 + hash(i) * 0.5);
      ctx.fillRect(hash(i + 1) * viewW, hash(i + 2) * viewH, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }
}

function drawNight(light, phase) {
  const dark = 1 - light;
  if (dark <= 0.01) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  const dusk = phase > 0.48 && phase < 0.64;
  ctx.fillStyle = dusk ? `rgba(70, 110, 210, ${dark * 0.9})` : `rgba(60, 60, 140, ${dark})`;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
  // lys fra kupler og bygninger
  if (dark > 0.2) {
    ctx.globalCompositeOperation = 'lighter';
    S.tiles.forEach((tile, idx) => {
      if (tile.t === 'deco' && tile.id === 'deco-lampe') {
        const [lx, ly] = tileCenter(idx);
        const g = ctx.createRadialGradient(lx + 10, ly - 48, 2, lx + 10, ly - 30, 70);
        g.addColorStop(0, `rgba(255,214,120,${dark * 1.2})`); g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx + 10, ly - 30, 70, 0, Math.PI * 2); ctx.fill();
        return;
      }
      if (tile.t !== 'plot' && tile.t !== 'b' && tile.t !== 'pad' && tile.t !== 'pen') return;
      const [x, y] = tileCenter(idx);
      const col = tile.t === 'plot' ? '127,214,143' : tile.t === 'pad' ? '255,122,26' : '255,200,120';
      const g = ctx.createRadialGradient(x, y - 24, 4, x, y - 24, 62);
      g.addColorStop(0, `rgba(${col},${dark * 0.7})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 24, 62, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }
}

const dust = Array.from({ length: 70 }, (_, i) => ({ x: hash(i) , y: hash(i + 50), s: 0.5 + hash(i + 9) }));
const flakes = Array.from({ length: 90 }, (_, i) => ({ x: hash(i + 300), y: hash(i + 400), s: 0.5 + hash(i + 500) }));
function drawSnow(now) {
  if (season().id !== 'vinter') return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const f of flakes) {
    const y = ((f.y + now / 9000 * f.s) % 1) * viewH;
    const x = ((f.x + Math.sin(now / 1500 + f.y * 10) * 0.01) % 1) * viewW;
    ctx.beginPath(); ctx.arc(x, y, 1.2 + f.s * 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawWeather(now) {
  drawSnow(now);
  const ev = S.event;
  if (!ev.type || now > ev.until) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ev.type === 'storm') {
    ctx.fillStyle = 'rgba(200, 98, 58, 0.28)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.strokeStyle = 'rgba(255, 210, 170, 0.55)'; ctx.lineWidth = 2;
    for (const d of dust) {
      const x = ((d.x + now / 2000 * d.s) % 1) * viewW, y = d.y * viewH;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 24 * d.s, y + 4); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const k = ((now / 900) + hash(i)) % 1;
      const x = (hash(i + 3) * 1.2 - 0.1) * viewW + k * 160, y = k * viewH * 0.8 - 40;
      ctx.strokeStyle = `rgba(255, 180, 90, ${1 - k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 50, y - 50); ctx.stroke();
      ctx.fillStyle = '#FFD7A0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// Besøg hos en nabo: kortet tegnes med naboens felter i stedet for dine egne.
let visiting = null;
function startVisit(v) {
  const st = defaults({ tiles: v.tiles, specials: v.specials || {}, level: v.level, tut: TUTORIAL.length, orders: [] });
  visiting = { ...v, state: st, cam: { ...cam } };
  const real = S; S = st; centerCamera(); S = real;
  editMode = false; hint = null;
}
function endVisit() {
  if (!visiting) return;
  Object.assign(cam, visiting.cam);
  visiting = null;
}

function draw(now) {
  if (!visiting) return drawScene(now);
  const real = S;
  S = visiting.state;
  try { drawScene(now); } finally { S = real; }
}

function drawScene(now) {
  const t = Date.now();
  const phase = dayPhase(t), light = daylight(phase);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(light, phase);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (viewW / 2 - cam.x * cam.z), dpr * (viewH / 2 - cam.y * cam.z));

  for (let i = 0; i < S.tiles.length; i++) drawGround(i);
  drawSeasonGround();
  if (camGoal) {
    cam.x += (camGoal.x - cam.x) * 0.12; cam.y += (camGoal.y - cam.y) * 0.12;
    if (Math.hypot(camGoal.x - cam.x, camGoal.y - cam.y) < 1) camGoal = null;
    clampCam();
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (viewW / 2 - cam.x * cam.z), dpr * (viewH / 2 - cam.y * cam.z));
  }
  if (editMode) {
    for (let i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i].t === 'locked') continue;
      const [x, y] = tileCenter(i);
      diamond(x, y, TW - 6, TH - 3);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = '#FFFFFFAA'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Tegn i dybderækkefølge, så ting længere fremme dækker ting bagved.
  const order = [];
  for (let i = 0; i < S.tiles.length; i++) order.push({ d: Math.floor(i / COLS) + (i % COLS), fn: () => drawTile(i, now, t) });
  if (!visiting) for (const a of Object.values(agents)) if (a) order.push({ d: a.depth + 0.5, fn: () => drawAgent(a, now) });
  if (!visiting && pet.ready && S.level >= PET_LEVEL) order.push({ d: pet.y / (TH / 2) + 2, fn: () => drawPet(now) });
  order.sort((a, b) => a.d - b.d);
  for (const o of order) o.fn();

  // Det valgte felt i redigeringstilstand markeres oven på alt andet.
  if (editMode && editSel >= 0) {
    const [x, y] = tileCenter(editSel);
    const pulse = 0.5 + Math.sin(now / 150) * 0.5;
    diamond(x, y, TW - 4, TH - 2);
    ctx.fillStyle = `rgba(255,122,26,${0.18 + pulse * 0.12})`; ctx.fill();
    ctx.strokeStyle = '#FF7A1A'; ctx.lineWidth = 4; ctx.stroke();
    drawSprite(ctx, 'flyt', x, y - 96 + pulse * 4, 34);
  }

  drawNight(light, phase);

  if (S.ship) {
    const pad = S.tiles.findIndex((tt) => tt.t === 'pad');
    if (pad >= 0) {
      const [px, py] = tileCenter(pad);
      const bob = Math.sin(now / 700) * 6;
      ctx.fillStyle = '#00000022';
      ctx.beginPath(); ctx.ellipse(px - 70, py - 20, 60, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, py - 150, 0, py - 20);
      g.addColorStop(0, 'rgba(91,184,240,0.35)'); g.addColorStop(1, 'rgba(91,184,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(px - 100, py - 150 + bob); ctx.lineTo(px - 40, py - 150 + bob); ctx.lineTo(px - 20, py - 20); ctx.lineTo(px - 120, py - 20); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      drawSprite(ctx, 'moderskib', px - 70, py - 170 + bob, 150, 32);
      const left = S.ship.crates.filter((c) => !c.done).length;
      badge(px - 10, py - 200 + bob, String(left));
    }
  }

  const tgt = hint && hint.until > Date.now() ? hint.idx : tutorialTarget();
  if (tgt >= 0) drawArrow(tgt, now);

  // raketter
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i], k = (now - r.t0) / 1600;
    if (k > 1) { rockets.splice(i, 1); continue; }
    const yy = r.y - 4 - k * k * 900;
    for (let j = 0; j < 2; j++) particles.push({ x: r.x + rand(-5, 5), y: yy + 20, vx: rand(-20, 20), vy: rand(30, 80), life: 0.6, color: j ? '#F5C243' : '#FF7A1A', s: rand(4, 8) });
    drawSprite(ctx, 'rocket', r.x, yy, 46, 60);
  }

  // partikler
  const dt = 1 / 60;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * (p.puff ? 0.5 : 1);
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!p.puff) p.vy += 220 * dt;
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.coin) drawSprite(ctx, 'coin', p.x, p.y, p.s);
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (p.puff ? 2 - p.life : 1), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // flydende +2-tekster
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], k = (now - f.t0) / 1200;
    if (k > 1) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - k * k;
    let x = f.x - (f.list.length * 52) / 2 + 26;
    const y = f.y - k * 40;
    for (const [id, n] of f.list) {
      ctx.font = 'bold 18px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#2A1A14'; ctx.strokeText('+' + n, x, y);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText('+' + n, x, y);
      drawSprite(ctx, id, x + 16, y, 26);
      x += 52;
    }
    ctx.globalAlpha = 1;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWeather(t);
}

// ---------- Robotter på kortet ----------
function homeOf() {
  const pad = S.tiles.findIndex((t) => t.t === 'pad');
  return tileCenter(pad >= 0 ? pad : 0);
}

// Bølle flyver rundt mellem felterne, der er ryddet.
const pet = { x: 0, y: 0, tx: 0, ty: 0, wait: 0, ready: false };
function updatePet(dt) {
  if (visiting || S.level < PET_LEVEL) return;
  if (!pet.ready) { const [x, y] = homeOf(); Object.assign(pet, { x: x + 60, y: y - 10, tx: x, ty: y, ready: true }); }
  if (S.pet.found) return; // venter stille med sin skat, så den er nem at trykke på
  pet.wait -= dt;
  const dx = pet.tx - pet.x, dy = pet.ty - pet.y, d = Math.hypot(dx, dy);
  if (d < 3 && pet.wait <= 0) {
    const open = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].t !== 'locked');
    const [tx, ty] = tileCenter(open[Math.floor(Math.random() * open.length)]);
    pet.tx = tx + rand(-20, 20); pet.ty = ty + rand(-8, 8);
    pet.wait = rand(1.5, 4);
  } else if (d >= 3) {
    const sp = 70;
    pet.x += (dx / d) * Math.min(d, sp * dt); pet.y += (dy / d) * Math.min(d, sp * dt);
  }
}
function drawPet(now) {
  const hover = 58 + (S.pet.found ? Math.abs(Math.sin(now / 180)) * 10 : Math.sin(now / 260) * 5);
  ctx.fillStyle = '#00000026';
  ctx.beginPath(); ctx.ellipse(pet.x, pet.y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  const tilt = Math.max(-0.3, Math.min(0.3, (pet.tx - pet.x) / 200));
  ctx.save(); ctx.translate(pet.x, pet.y - hover); ctx.rotate(tilt);
  drawSprite(ctx, 'boelle', 0, 0, 34);
  ctx.restore();
  if (S.pet.found) {
    const by = pet.y - hover - 34 + Math.sin(now / 200) * 3;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#2A1A14'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(pet.x, by, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawSprite(ctx, S.pet.found.item, pet.x, by, 22);
    if (Math.random() < 0.15) particles.push({ x: pet.x + rand(-14, 14), y: by + rand(-10, 10), vx: 0, vy: -15, life: 0.6, color: '#F5C243', s: 2.5 });
  }
}
// Rammer et tryk Bølle? (skærmkoordinater)
function petHit(sx, sy) {
  if (visiting || S.level < PET_LEVEL || !pet.ready) return false;
  const [px, py] = toScreen(pet.x, pet.y - 58);
  return Math.hypot(px - sx, py - sy) < 44 * Math.max(cam.z, 0.7);
}

function resetAgents() {
  for (const a of Object.values(agents)) if (a) { a.target = -1; a.wait = 0.5; }
}

function ensureAgents() {
  for (const id of ['hoster', 'pakker']) {
    if (S.robots[id] && !agents[id]) {
      const [x, y] = homeOf();
      agents[id] = { id, x: x + 40, y: y + 10, target: -1, depth: 0, fly: id === 'pakker', wait: 0 };
    }
  }
}

function findWork(a) {
  const t = Date.now();
  let best = -1, bestD = Infinity;
  S.tiles.forEach((tile, i) => {
    const ok = a.id === 'hoster'
      ? tile.t === 'plot' && tile.crop && t >= tile.end
      : (tile.t === 'b' && tile.queue && tile.queue.some((q) => q.end <= t)) || (tile.t === 'pen' && penReady(tile, t) > 0);
    if (!ok) return;
    const [x, y] = tileCenter(i);
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function updateAgents(dt) {
  if (visiting) return;
  updatePet(dt);
  ensureAgents();
  for (const a of Object.values(agents)) {
    if (!a) continue;
    if (a.wait > 0) { a.wait -= dt; continue; }
    if (a.target < 0) { a.target = findWork(a); if (a.target < 0) { a.wait = 1; } }
    let tx, ty;
    if (a.target >= 0) [tx, ty] = tileCenter(a.target);
    else { const [hx, hy] = homeOf(); tx = hx + (a.fly ? -30 : 40); ty = hy + 10; }
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    const speed = (a.fly ? 160 : 110) * (hasTech('robotai') ? 2 : 1);
    if (d < 4) {
      if (a.target >= 0) {
        const tt = S.tiles[a.target];
        const ok = a.id === 'hoster' ? robotHarvest(a.target) : tt.t === 'pen' ? collectPen(a.target, true) > 0 : collect(a.target, true) > 0;
        a.target = -1;
        a.wait = ok ? 0.4 : 3; // fuldt lager: vent lidt
      }
    } else {
      a.x += (dx / d) * Math.min(d, speed * dt);
      a.y += (dy / d) * Math.min(d, speed * dt);
    }
    a.depth = a.y / (TH / 2) - 1;
  }
}

function drawAgent(a, now) {
  const hover = a.fly ? 46 + Math.sin(now / 200) * 4 : Math.abs(Math.sin(now / 120)) * 2;
  ctx.fillStyle = '#00000033';
  ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
  drawSprite(ctx, a.id, a.x, a.y - hover, a.fly ? 40 : 38, 60);
}

// ---------- Input: tryk, træk, swipe-høst og zoom ----------
const pointers = new Map();
let drag = null;

function zoomAt(sx, sy, z) {
  const [wx, wy] = toWorld(sx, sy);
  cam.z = z;
  clampCam();
  const [nx, ny] = toWorld(sx, sy);
  cam.x += wx - nx; cam.y += wy - ny;
  clampCam();
}

function localPos(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = localPos(e);
  pointers.set(e.pointerId, { x, y });
  if (pointers.size === 1) {
    const idx = tileAt(x, y);
    drag = { sx: x, sy: y, mode: 'pending', start: idx, last: idx, cx: cam.x, cy: cam.y };
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    drag = { mode: 'pinch', dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), z: cam.z };
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !drag) return;
  const [x, y] = localPos(e);
  pointers.set(e.pointerId, { x, y });
  if (drag.mode === 'pinch' && pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, drag.z * d / drag.dist);
    return;
  }
  const dx = x - drag.sx, dy = y - drag.sy;
  if (drag.mode === 'pending' && Math.hypot(dx, dy) > 8) {
    const tile = S.tiles[drag.start];
    camGoal = null;
    if (editMode) {
      drag.mode = 'pan';
    } else if (tile && tile.t === 'plot' && tile.crop && Date.now() >= tile.end) {
      drag.mode = 'harvest'; harvest(drag.start);
    } else if (tile && tile.t === 'plot' && !tile.crop && S.lastCrop && plant(drag.start, S.lastCrop, true)) {
      drag.mode = 'plant';
      Sound.play('plant');
    } else {
      drag.mode = 'pan';
    }
  }
  if (drag.mode === 'pan') {
    cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam();
  } else if (drag.mode === 'harvest' || drag.mode === 'plant') {
    const idx = tileAt(x, y);
    if (idx >= 0 && idx !== drag.last) {
      drag.last = idx;
      if (drag.mode === 'harvest') harvest(idx, true);
      else if (plant(idx, S.lastCrop, true)) Sound.play('plant');
    }
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.mode === 'pending') {
    if (petHit(drag.sx, drag.sy)) onPet();
    else if (drag.start >= 0) onTile(drag.start);
  }
  if (pointers.size === 0) drag = null;
  else if (drag.mode === 'pinch') drag = { mode: 'done' };
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [x, y] = localPos(e);
  zoomAt(x, y, cam.z * Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

// ---------- Fotomodus ----------
// Tegner hele kolonien i høj opløsning og sætter en ramme med navn, niveau og årstid omkring.
function renderPhoto() {
  const W = 1200, H = 900;
  const saved = { cam: { ...cam }, viewW, viewH, dpr };
  viewW = W; viewH = H; dpr = 1;
  canvas.width = W; canvas.height = H;
  const cleared = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].t !== 'locked');
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const i of cleared) { const [x, y] = tileCenter(i); minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  cam.x = (minx + maxx) / 2; cam.y = (miny + maxy) / 2 - 30;
  cam.z = Math.min(1.6, Math.max(0.6, Math.min(W / (maxx - minx + TW * 3), H / (maxy - miny + TH * 6))));
  const prevHint = hint; hint = null;
  const ed = editMode; editMode = false;
  floaters.length = 0;
  draw(performance.now());
  hint = prevHint; editMode = ed;

  const out = document.createElement('canvas');
  out.width = W; out.height = H + 190;
  const g = out.getContext('2d');
  g.fillStyle = '#120D1C'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(canvas, 0, 110);
  g.fillStyle = '#FBF6F1'; g.fillRect(0, 0, W, 110); g.fillRect(0, H + 110, W, 80);
  g.fillStyle = '#2A1A14'; g.fillRect(0, 108, W, 4); g.fillRect(0, H + 108, W, 4);
  drawSprite(g, S.prestige > 0 ? 'phobos' : 'rocket', 62, 55, 70);
  g.fillStyle = '#2A1A14';
  g.font = '700 46px "Space Grotesk", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(S.playerName || 'Min koloni', 112, 44);
  g.font = '500 24px "Space Grotesk", sans-serif'; g.fillStyle = '#7A5A4A';
  const where = S.prestige > 0 ? `Phobos · ${S.prestige} ★` : 'Mars';
  g.fillText(`Niveau ${S.level} · ${where} · ${season().name} · lykke ${happiness()}`, 114, 84);
  g.textAlign = 'right'; g.fillStyle = '#FF7A1A'; g.font = '700 30px "Space Grotesk", sans-serif';
  g.fillText('Rumkolonien', W - 36, 55);
  g.textAlign = 'center'; g.fillStyle = '#2A1A14'; g.font = '500 24px "Space Grotesk", sans-serif';
  g.fillText('Byg din egen koloni på rasmusschmiegelow-oss.github.io/rumkolonien', W / 2, H + 152);

  Object.assign(cam, saved.cam);
  resize();
  return out;
}
