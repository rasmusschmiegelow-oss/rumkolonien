'use strict';

// ---------- Spildata ----------
const COLS = 8, ROWS = 7;
const SAVE_KEY = 'rumkolonien-save-v1';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const ITEMS = {
  kartoffel:  { name: 'Kartoffel',  icon: '🥔', value: 4 },
  alge:       { name: 'Alger',      icon: '🌿', value: 7 },
  hvede:      { name: 'Hvede',      icon: '🌾', value: 10 },
  tomat:      { name: 'Tomat',      icon: '🍅', value: 16 },
  vand:       { name: 'Vand',       icon: '💧', value: 3 },
  gryde:      { name: 'Rumgryde',   icon: '🍲', value: 18 },
  ilt:        { name: 'Ilt',        icon: '💨', value: 20 },
  braendstof: { name: 'Brændstof',  icon: '⛽', value: 34 },
  broed:      { name: 'Brød',       icon: '🍞', value: 34 },
  pizza:      { name: 'Marspizza',  icon: '🍕', value: 90 },
};

// Afgrøder i drivhuskuplerne. Høst giver 2 stk.
const CROPS = {
  kartoffel: { time: 20,  cost: 2,  level: 1, xp: 1 },
  alge:      { time: 45,  cost: 4,  level: 2, xp: 2 },
  hvede:     { time: 90,  cost: 6,  level: 3, xp: 3 },
  tomat:     { time: 150, cost: 10, level: 4, xp: 4 },
};
const HARVEST_YIELD = 2;

const RECIPES = {
  vand:       { in: {},                       time: 15,  xp: 1, level: 1 },
  gryde:      { in: { kartoffel: 2, vand: 1 }, time: 40,  xp: 3, level: 1 },
  ilt:        { in: { alge: 2 },               time: 30,  xp: 3, level: 2 },
  braendstof: { in: { alge: 3, vand: 1 },      time: 60,  xp: 5, level: 2 },
  broed:      { in: { hvede: 2, vand: 1 },     time: 60,  xp: 5, level: 3 },
  pizza:      { in: { broed: 1, tomat: 2 },    time: 120, xp: 9, level: 4 },
};

const BUILDINGS = {
  isbor:      { name: 'Isbor',       icon: '🧊', level: 1, cost: 40,  recipes: ['vand'] },
  madprinter: { name: 'Madprinter',  icon: '🖨️', level: 1, cost: 60,  recipes: ['gryde'] },
  bioreaktor: { name: 'Bioreaktor',  icon: '⚗️', level: 2, cost: 150, recipes: ['ilt', 'braendstof'] },
  bageri:     { name: 'Rumbageri',   icon: '🏭', level: 3, cost: 300, recipes: ['broed', 'pizza'] },
};
const QUEUE_MAX = 3;

const xpNeeded = (lvl) => 15 + (lvl - 1) * 20 + (lvl - 1) ** 2 * 5;
const orderSlots = (lvl) => Math.min(9, 3 + lvl);
const plotCost = (n) => 20 + n * 10;
const clearCost = (n) => 15 + n * 10;

// ---------- Tilstand ----------
let S;

function newState() {
  const tiles = Array.from({ length: COLS * ROWS }, () => ({ t: 'locked' }));
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 6; c++) tiles[r * COLS + c] = { t: 'empty' };
  tiles[1 * COLS + 1] = { t: 'pad' };
  tiles[1 * COLS + 2] = { t: 'b', id: 'isbor', queue: [] };
  tiles[1 * COLS + 3] = { t: 'b', id: 'madprinter', queue: [] };
  for (let c = 1; c <= 6; c++) tiles[2 * COLS + c] = { t: 'plot', crop: null, start: 0, end: 0 };
  const st = { credits: 50, xp: 0, level: 1, cleared: 0, inv: { kartoffel: 4, vand: 2 }, tiles, orders: [] };
  S = st;
  fillOrders();
  return st;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { S = JSON.parse(raw); fillOrders(); return; }
  } catch (e) { /* ignorer, start forfra */ }
  newState();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* privat vindue */ }
}

const have = (id) => S.inv[id] || 0;
const addItem = (id, n) => { S.inv[id] = have(id) + n; if (S.inv[id] <= 0) delete S.inv[id]; };
const countTiles = (t) => S.tiles.filter((x) => x.t === t).length;
const owns = (bid) => S.tiles.some((x) => x.t === 'b' && x.id === bid);

function addXP(n) {
  S.xp += n;
  while (S.xp >= xpNeeded(S.level)) {
    S.xp -= xpNeeded(S.level);
    S.level++;
    const unlocks = [
      ...Object.keys(CROPS).filter((k) => CROPS[k].level === S.level).map((k) => ITEMS[k].icon + ' ' + ITEMS[k].name),
      ...Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].level === S.level).map((k) => BUILDINGS[k].icon + ' ' + BUILDINGS[k].name),
      ...Object.keys(RECIPES).filter((k) => RECIPES[k].level === S.level && RECIPES[k].level > 1).map((k) => ITEMS[k].icon + ' ' + ITEMS[k].name),
    ];
    toast(`⭐ Niveau ${S.level}!` + (unlocks.length ? ` Nyt: ${[...new Set(unlocks)].join(', ')}` : ' Flere ordrepladser.'), 'good', 4500);
    fillOrders();
  }
}

// ---------- Ordrer ----------
function unlockedItems() {
  const crops = Object.keys(CROPS).filter((k) => CROPS[k].level <= S.level);
  const goods = Object.keys(RECIPES).filter((k) => {
    if (RECIPES[k].level > S.level) return false;
    const b = Object.keys(BUILDINGS).find((bid) => BUILDINGS[bid].recipes.includes(k));
    return owns(b);
  });
  return { crops, goods };
}

function genOrder() {
  const { crops, goods } = unlockedItems();
  const pool = [...crops, ...goods];
  const types = 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(S.level / 2)));
  const items = {};
  for (let i = 0; i < types; i++) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    const isCrop = id in CROPS;
    const q = isCrop ? 2 + Math.floor(Math.random() * (2 + S.level)) : 1 + Math.floor(Math.random() * (1 + S.level / 3));
    items[id] = (items[id] || 0) + q;
  }
  let worth = 0;
  for (const id in items) worth += ITEMS[id].value * items[id];
  return {
    items,
    credits: Math.round(worth * (1.15 + Math.random() * 0.3)),
    xp: Math.max(1, Math.round(worth / 4)),
    ship: ['🚀', '🛸', '🛰️'][Math.floor(Math.random() * 3)],
  };
}

function fillOrders() {
  while (S.orders.length < orderSlots(S.level)) S.orders.push(genOrder());
}

const canFulfil = (o) => Object.entries(o.items).every(([id, q]) => have(id) >= q);

function deliver(i) {
  const o = S.orders[i];
  if (!o || !canFulfil(o)) return;
  for (const [id, q] of Object.entries(o.items)) addItem(id, -q);
  S.credits += o.credits;
  S.orders[i] = genOrder();
  addXP(o.xp);
  launchShip(o);
  toast(`${o.ship} Ordre leveret: +${o.credits} 🪙 +${o.xp} ⭐`, 'good');
  save();
  openOrders();
}

function discard(i) {
  S.orders[i] = genOrder();
  save();
  openOrders();
}

// ---------- Handlinger på felter ----------
function plant(idx, crop) {
  const tile = S.tiles[idx], c = CROPS[crop];
  if (S.credits < c.cost) return toast('Ikke nok kreditter.', 'bad');
  S.credits -= c.cost;
  const now = Date.now();
  Object.assign(tile, { crop, start: now, end: now + c.time * 1000 });
  save();
  closeModal();
}

function harvest(idx) {
  const tile = S.tiles[idx];
  const crop = tile.crop;
  addItem(crop, HARVEST_YIELD);
  addXP(CROPS[crop].xp);
  floatText(idx, `+${HARVEST_YIELD} ${ITEMS[crop].icon}`);
  Object.assign(tile, { crop: null, start: 0, end: 0 });
  save();
}

function enqueue(idx, rid) {
  const tile = S.tiles[idx], r = RECIPES[rid];
  if (tile.queue.length >= QUEUE_MAX) return toast('Køen er fuld.', 'bad');
  for (const [id, q] of Object.entries(r.in)) if (have(id) < q) return toast(`Mangler ${ITEMS[id].name}.`, 'bad');
  for (const [id, q] of Object.entries(r.in)) addItem(id, -q);
  const now = Date.now();
  const last = tile.queue[tile.queue.length - 1];
  const start = Math.max(now, last ? last.end : 0);
  tile.queue.push({ r: rid, start, end: start + r.time * 1000 });
  save();
  openBuilding(idx);
}

function collect(idx) {
  const tile = S.tiles[idx];
  const now = Date.now();
  const done = tile.queue.filter((q) => q.end <= now);
  if (!done.length) return 0;
  tile.queue = tile.queue.filter((q) => q.end > now);
  let xp = 0;
  const got = {};
  for (const q of done) { addItem(q.r, 1); got[q.r] = (got[q.r] || 0) + 1; xp += RECIPES[q.r].xp; }
  addXP(xp);
  floatText(idx, Object.entries(got).map(([id, n]) => `+${n} ${ITEMS[id].icon}`).join(' '));
  save();
  return done.length;
}

function buildOn(idx, what) {
  if (what === 'plot') {
    const cost = plotCost(countTiles('plot'));
    if (S.credits < cost) return toast('Ikke nok kreditter.', 'bad');
    S.credits -= cost;
    S.tiles[idx] = { t: 'plot', crop: null, start: 0, end: 0 };
    toast('🫙 Ny drivhuskuppel bygget!', 'good');
  } else {
    const b = BUILDINGS[what];
    if (S.credits < b.cost) return toast('Ikke nok kreditter.', 'bad');
    S.credits -= b.cost;
    S.tiles[idx] = { t: 'b', id: what, queue: [] };
    toast(`${b.icon} ${b.name} bygget!`, 'good');
  }
  save();
  closeModal();
}

function neighbourCleared(idx) {
  const r = Math.floor(idx / COLS), c = idx % COLS;
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) =>
    rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && S.tiles[rr * COLS + cc].t !== 'locked');
}

function clearTile(idx) {
  const cost = clearCost(S.cleared);
  if (S.credits < cost) return toast('Ikke nok kreditter.', 'bad');
  S.credits -= cost;
  S.cleared++;
  S.tiles[idx] = { t: 'empty' };
  addXP(2);
  save();
  closeModal();
}

function sell(id) {
  if (have(id) < 1) return;
  const price = Math.max(1, Math.ceil(ITEMS[id].value / 2));
  addItem(id, -1);
  S.credits += price;
  save();
  openInventory();
}

function onTile(idx) {
  const tile = S.tiles[idx];
  const now = Date.now();
  switch (tile.t) {
    case 'plot':
      if (!tile.crop) return openPlant(idx);
      if (now >= tile.end) return harvest(idx);
      return toast(`${ITEMS[tile.crop].icon} ${ITEMS[tile.crop].name} er klar om ${fmtTime((tile.end - now) / 1000)}`);
    case 'b':
      collect(idx);
      return openBuilding(idx);
    case 'pad': return openOrders();
    case 'empty': return openBuild(idx);
    case 'locked':
      if (!neighbourCleared(idx)) return toast('Ryd et felt ved siden af først.');
      return openClear(idx);
  }
}

// ---------- Modaler ----------
const $ = (id) => document.getElementById(id);
const modal = $('modal');
let modalView = null; // funktion der gentegner den åbne modal

function showModal(title, html, view) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  modal.hidden = false;
  modalView = view || null;
}
function closeModal() { modal.hidden = true; modalView = null; }

const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
};
const needList = (inp) => Object.entries(inp).map(([id, q]) =>
  `<span class="${have(id) >= q ? 'ok' : 'no'}">${ITEMS[id].icon} ${have(id)}/${q}</span>`).join(' ') || '<span class="ok">Intet input</span>';

function openPlant(idx) {
  const rows = Object.entries(CROPS).map(([id, c]) => {
    const locked = c.level > S.level;
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${ITEMS[id].icon}</div>
      <div class="info"><b>${ITEMS[id].name}</b><small>${locked ? `Låses op på niveau ${c.level}` : `${fmtTime(c.time)} · giver ${HARVEST_YIELD} stk · +${c.xp} ⭐`}</small></div>
      <button class="primary" data-act="plant" data-idx="${idx}" data-arg="${id}" ${locked || S.credits < c.cost ? 'disabled' : ''}>Plant · ${c.cost} 🪙</button>
    </div>`;
  }).join('');
  showModal('🫙 Drivhuskuppel', `<div class="list">${rows}</div>`);
}

function queueSlots(tile, now) {
  const slots = [];
  for (let i = 0; i < QUEUE_MAX; i++) {
    const q = tile.queue[i];
    if (!q) { slots.push('<div class="slot"></div>'); continue; }
    const done = q.end <= now;
    const total = RECIPES[q.r].time * 1000;
    const pct = done ? 100 : Math.max(0, Math.min(100, ((now - q.start) / total) * 100));
    slots.push(`<div class="slot ${done ? 'done' : ''}">${ITEMS[q.r].icon}
      <small>${done ? 'Klar' : q.start > now ? 'Venter' : fmtTime((q.end - now) / 1000)}</small>
      <div class="bar" style="width:${pct}%"></div></div>`);
  }
  return slots.join('');
}

// Opdaterer kun køen, så knapperne ikke bliver udskiftet midt i et klik.
function refreshBuilding(idx) {
  const tile = S.tiles[idx];
  const el = $('bslots');
  if (!el || tile.t !== 'b') return;
  const now = Date.now();
  el.innerHTML = queueSlots(tile, now);
  $('bcount').textContent = `Kø (${tile.queue.length}/${QUEUE_MAX})`;
  $('bcollect').hidden = !tile.queue.some((q) => q.end <= now);
}

function openBuilding(idx) {
  const tile = S.tiles[idx];
  const b = BUILDINGS[tile.id];
  const rows = b.recipes.map((rid) => {
    const r = RECIPES[rid];
    const locked = r.level > S.level;
    const ok = !locked && Object.entries(r.in).every(([id, q]) => have(id) >= q) && tile.queue.length < QUEUE_MAX;
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${ITEMS[rid].icon}</div>
      <div class="info"><b>${ITEMS[rid].name}</b><small>${locked ? `Låses op på niveau ${r.level}` : `${fmtTime(r.time)} · ${needList(r.in)}`}</small></div>
      <button class="primary" data-act="make" data-idx="${idx}" data-arg="${rid}" ${ok ? '' : 'disabled'}>Producér</button>
    </div>`;
  }).join('');
  showModal(`${b.icon} ${b.name}`,
    `<div class="section-title" id="bcount"></div>
     <div class="queue" id="bslots"></div>
     <p id="bcollect" hidden><button class="primary" data-act="collect" data-idx="${idx}">Saml færdige varer</button></p>
     <div class="section-title">Opskrifter</div><div class="list">${rows}</div>`,
    () => refreshBuilding(idx));
  refreshBuilding(idx);
}

function openOrders() {
  const cards = S.orders.map((o, i) => {
    const ok = canFulfil(o);
    return `<div class="order ${ok ? 'ready' : ''}">
      <div class="ship">${o.ship}</div>
      <div class="need">${needList(o.items)}</div>
      <div class="reward">+${o.credits} 🪙 · +${o.xp} ⭐</div>
      <div class="btns">
        <button class="primary" data-act="deliver" data-arg="${i}" ${ok ? '' : 'disabled'}>Lever</button>
        <button data-act="discard" data-arg="${i}" title="Kassér ordre" aria-label="Kassér ordre">🗑️</button>
      </div>
    </div>`;
  }).join('');
  showModal('🚀 Fragtskibe', `<p class="muted">Lever varer til skibene i kredsløb. Kassér en ordre for at få en ny.</p><div class="orders">${cards}</div>`);
}

function openInventory() {
  const ids = Object.keys(ITEMS).filter((id) => have(id) > 0);
  const rows = ids.map((id) => `<div class="row">
      <div class="ico">${ITEMS[id].icon}</div>
      <div class="info"><b>${have(id)}× ${ITEMS[id].name}</b><small>Sælg for ${Math.max(1, Math.ceil(ITEMS[id].value / 2))} 🪙</small></div>
      <button data-act="sell" data-arg="${id}">Sælg 1</button>
    </div>`).join('');
  showModal('📦 Lager', `<div class="inv">${rows || '<p class="muted">Lageret er tomt. Plant noget i kuplerne!</p>'}</div>
    <div class="section-title">Spillet</div>
    <button data-act="reset">Start en ny koloni</button>`);
}

function openBuild(idx) {
  const pc = plotCost(countTiles('plot'));
  let rows = `<div class="row">
      <div class="ico">🫙</div>
      <div class="info"><b>Drivhuskuppel</b><small>Her dyrker du afgrøder</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="plot" ${S.credits < pc ? 'disabled' : ''}>${pc} 🪙</button>
    </div>`;
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const built = owns(id), locked = b.level > S.level;
    rows += `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${b.icon}</div>
      <div class="info"><b>${b.name}</b><small>${built ? 'Allerede bygget' : locked ? `Låses op på niveau ${b.level}` : 'Laver ' + b.recipes.map((r) => ITEMS[r].icon + ' ' + ITEMS[r].name).join(', ')}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}" ${built || locked || S.credits < b.cost ? 'disabled' : ''}>${b.cost} 🪙</button>
    </div>`;
  }
  showModal('🏗️ Byg her', `<div class="list">${rows}</div>`);
}

function openClear(idx) {
  const cost = clearCost(S.cleared);
  showModal('🪨 Regolit', `<p>Ryd klipperne og gør plads til flere kupler og bygninger.</p>
    <button class="primary" data-act="clear" data-idx="${idx}" ${S.credits < cost ? 'disabled' : ''}>Ryd feltet · ${cost} 🪙</button>`);
}

function openHelp() {
  showModal('❔ Sådan spiller du', `
    <p><b>Velkommen til Mars!</b> Din opgave er at få kolonien til at vokse.</p>
    <p>🫙 <b>Drivhuskupler:</b> Tryk for at plante. Når afgrøden er moden, trykker du igen for at høste 2 stk.</p>
    <p>🧊🖨️ <b>Bygninger:</b> De laver varer af dine råvarer. Hver bygning har en kø med plads til 3 ting. Tryk på bygningen for at samle det, der er færdigt.</p>
    <p>🚀 <b>Landingsplads:</b> Fragtskibe bestiller varer. Lever dem og få kreditter og erfaring.</p>
    <p>🪨 <b>Udvid:</b> Ryd klipper og byg nye kupler. Nye niveauer giver nye afgrøder, bygninger og flere ordrer.</p>
    <p class="muted">Spillet gemmes automatisk i din browser, og alt gror videre, mens du er væk.</p>`);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const idx = Number(btn.dataset.idx), arg = btn.dataset.arg;
  switch (btn.dataset.act) {
    case 'close': return closeModal();
    case 'orders': return openOrders();
    case 'inventory': return openInventory();
    case 'help': return openHelp();
    case 'plant': return plant(idx, arg);
    case 'make': return enqueue(idx, arg);
    case 'collect': collect(idx); return openBuilding(idx);
    case 'deliver': return deliver(Number(arg));
    case 'discard': return discard(Number(arg));
    case 'sell': return sell(arg);
    case 'build': return buildOn(idx, arg);
    case 'clear': return clearTile(idx);
    case 'reset':
      if (confirm('Vil du slette din koloni og starte forfra?')) { newState(); save(); closeModal(); }
      return;
  }
});
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function toast(msg, kind = '', ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Kortet ----------
const canvas = $('map');
const ctx = canvas.getContext('2d');
let tileSize = 80;
const floaters = [];
const rockets = [];

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function resize() {
  const w = canvas.parentElement.clientWidth;
  const dpr = window.devicePixelRatio || 1;
  tileSize = w / COLS;
  canvas.style.height = tileSize * ROWS + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(tileSize * ROWS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tileXY(idx) { return [(idx % COLS) * tileSize, Math.floor(idx / COLS) * tileSize]; }

function floatText(idx, text) {
  const [x, y] = tileXY(idx);
  floaters.push({ x: x + tileSize / 2, y: y + tileSize * 0.3, text, t0: performance.now() });
}

function launchShip(o) {
  const padIdx = S.tiles.findIndex((t) => t.t === 'pad');
  if (padIdx < 0) return;
  const [x, y] = tileXY(padIdx);
  rockets.push({ x: x + tileSize / 2, y: y + tileSize / 2, icon: o.ship, t0: performance.now() });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function emoji(ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; // emoji arver alfa fra fillStyle
  ctx.fillText(ch, x, y);
}

function progressBar(x, y, s, pct, color = '#ff8a4c') {
  const w = s * 0.7, h = Math.max(4, s * 0.07);
  const bx = x + (s - w) / 2, by = y + s * 0.84;
  ctx.fillStyle = '#0009';
  roundRect(bx, by, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color;
  roundRect(bx, by, Math.max(h, w * pct), h, h / 2); ctx.fill();
}

function badge(x, y, s, text, color = '#5ee59a') {
  const r = s * 0.14;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + s - r * 1.2, y + r * 1.2, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#062';
  ctx.font = `bold ${r * 1.3}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + s - r * 1.2, y + r * 1.25);
}

function drawGround(idx, x, y, s) {
  const shades = ['#b4532f', '#a94b2b', '#bd5c35', '#b0502e'];
  ctx.fillStyle = shades[Math.floor(hash(idx) * shades.length)];
  ctx.fillRect(x, y, s + 1, s + 1);
  if (hash(idx + 99) > 0.55) {
    const cx = x + s * (0.25 + hash(idx + 7) * 0.5), cy = y + s * (0.25 + hash(idx + 13) * 0.5);
    const r = s * (0.08 + hash(idx + 21) * 0.1);
    ctx.fillStyle = '#0000001f';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff1a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 1, r, r * 0.7, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  }
}

function draw(now) {
  const t = Date.now();
  const s = tileSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  S.tiles.forEach((tile, idx) => {
    const [x, y] = tileXY(idx);
    drawGround(idx, x, y, s);
    const pad = s * 0.08;

    if (tile.t === 'locked') {
      ctx.fillStyle = '#2a0d0566';
      ctx.fillRect(x, y, s + 1, s + 1);
      if (hash(idx + 3) > 0.25) emoji('🪨', x + s * (0.35 + hash(idx + 5) * 0.3), y + s * (0.4 + hash(idx + 6) * 0.2), s * 0.38);
      if (neighbourCleared(idx)) {
        ctx.strokeStyle = '#ffb26b55'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3, y + 3, s - 6, s - 6); ctx.setLineDash([]);
      }
    } else if (tile.t === 'empty') {
      ctx.fillStyle = '#d9784a55';
      roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.12); ctx.fill();
      ctx.fillStyle = '#ffffff55';
      ctx.font = `${s * 0.3}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', x + s / 2, y + s / 2);
    } else if (tile.t === 'plot') {
      ctx.fillStyle = '#4a2a1a';
      roundRect(x + pad, y + s * 0.3, s - pad * 2, s * 0.62, s * 0.1); ctx.fill();
      ctx.fillStyle = '#5e3722';
      for (let i = 0; i < 3; i++) { roundRect(x + pad * 2, y + s * (0.42 + i * 0.15), s - pad * 4, s * 0.05, 3); ctx.fill(); }
      if (tile.crop) {
        const total = tile.end - tile.start;
        const pct = Math.min(1, (t - tile.start) / total);
        const ready = t >= tile.end;
        if (ready) {
          ctx.fillStyle = '#5ee59a33';
          ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.6, s * 0.38, 0, Math.PI * 2); ctx.fill();
          const bob = Math.sin(now / 250 + idx) * s * 0.03;
          emoji(ITEMS[tile.crop].icon, x + s * 0.32, y + s * 0.6 + bob, s * 0.3);
          emoji(ITEMS[tile.crop].icon, x + s * 0.68, y + s * 0.6 - bob, s * 0.3);
        } else {
          const ch = pct < 0.5 ? '🌱' : ITEMS[tile.crop].icon;
          const sz = s * (0.18 + pct * 0.14);
          emoji(ch, x + s * 0.32, y + s * 0.6, sz);
          emoji(ch, x + s * 0.68, y + s * 0.6, sz);
          progressBar(x, y, s, pct, '#5ee59a');
        }
      }
      // glaskuppel
      ctx.fillStyle = '#bfe8ff22';
      ctx.strokeStyle = '#e6f7ffaa'; ctx.lineWidth = Math.max(1.5, s * 0.025);
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s * 0.88, s * 0.44, s * 0.74, 0, Math.PI, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.beginPath(); ctx.ellipse(x + s / 2, y + s * 0.88, s * 0.32, s * 0.62, 0, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
    } else if (tile.t === 'b') {
      const g = ctx.createLinearGradient(x, y, x, y + s);
      g.addColorStop(0, '#e9edf3'); g.addColorStop(1, '#9aa3b2');
      ctx.fillStyle = '#0004';
      roundRect(x + pad, y + pad * 1.6, s - pad * 2, s - pad * 2, s * 0.16); ctx.fill();
      ctx.fillStyle = g;
      roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.16); ctx.fill();
      ctx.fillStyle = '#ff8a4c';
      ctx.fillRect(x + pad, y + s * 0.2, s - pad * 2, s * 0.05);
      emoji(BUILDINGS[tile.id].icon, x + s / 2, y + s * 0.52, s * 0.42);
      const done = tile.queue.filter((q) => q.end <= t).length;
      const cur = tile.queue.find((q) => q.end > t && q.start <= t);
      if (cur) progressBar(x, y, s, (t - cur.start) / (cur.end - cur.start));
      if (done) badge(x, y, s, String(done));
    } else if (tile.t === 'pad') {
      ctx.fillStyle = '#3a3f4b';
      ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd75e';
      ctx.font = `bold ${s * 0.32}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', x + s / 2, y + s / 2 + 1);
      const ready = S.orders.filter(canFulfil).length;
      if (ready) badge(x, y, s, String(ready));
    }
  });

  // raketter der letter
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i], k = (now - r.t0) / 1400;
    if (k > 1) { rockets.splice(i, 1); continue; }
    const yy = r.y - k * k * (r.y + s);
    emoji('🔥', r.x, yy + s * 0.3, s * 0.25 * (1 - k * 0.5));
    emoji(r.icon, r.x, yy, s * 0.5);
  }
  // flydende tekst
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], k = (now - f.t0) / 1100;
    if (k > 1) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - k;
    ctx.font = `bold ${s * 0.24}px ${EMOJI_FONT.replace('sans-serif', 'system-ui')}, system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000a';
    ctx.strokeText(f.text, f.x, f.y - k * s * 0.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(f.text, f.x, f.y - k * s * 0.5);
    ctx.globalAlpha = 1;
  }
}

function updateHUD() {
  $('credits').textContent = S.credits;
  $('level').textContent = S.level;
  const need = xpNeeded(S.level);
  $('xpfill').style.width = (S.xp / need) * 100 + '%';
  $('xptext').textContent = `${S.xp}/${need}`;
  const ready = S.orders.filter(canFulfil).length;
  const b = $('orderBadge');
  b.hidden = !ready; b.textContent = ready;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / tileSize);
  const r = Math.floor((e.clientY - rect.top) / tileSize);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  onTile(r * COLS + c);
});

let lastModalTick = 0;
function loop(now) {
  draw(now);
  updateHUD();
  if (modalView && now - lastModalTick > 500) { lastModalTick = now; modalView(); }
  requestAnimationFrame(loop);
}

load();
resize();
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
setInterval(save, 5000);
requestAnimationFrame(loop);
try {
  if (!localStorage.getItem(SAVE_KEY + '-seen')) { localStorage.setItem(SAVE_KEY + '-seen', '1'); openHelp(); }
} catch (e) { openHelp(); }
