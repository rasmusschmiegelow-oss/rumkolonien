'use strict';
// Spiltilstand og regler. Tegning og menuer ligger i map.js og ui.js.

let S;

const idxOf = (r, c) => r * COLS + c;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function newState() {
  const tiles = Array.from({ length: COLS * ROWS }, () => ({ t: 'locked' }));
  for (let r = 3; r <= 5; r++) for (let c = 2; c <= 7; c++) tiles[idxOf(r, c)] = { t: 'empty' };
  tiles[idxOf(3, 2)] = { t: 'pad' };
  tiles[idxOf(3, 3)] = { t: 'b', id: 'isbor', queue: [] };
  tiles[idxOf(3, 4)] = { t: 'b', id: 'madprinter', queue: [] };
  for (let c = 2; c <= 7; c++) tiles[idxOf(4, c)] = { t: 'plot', crop: null, start: 0, end: 0 };
  S = defaults({ credits: 50, inv: { kartoffel: 4, vand: 2 }, tiles });
  fillOrders();
  return S;
}

// Udfylder felter, der mangler i gamle eller nye gemte spil.
function defaults(st) {
  return Object.assign({
    v: 2, credits: 50, xp: 0, level: 1, cleared: 0, silo: 1, inv: {}, orders: [], lastCrop: null,
    stats: { harvest: 0, produce: 0, deliver: 0, earn: 0 },
    tut: 0, robots: { hoster: false, pakker: false },
    colonist: null, colonistNextAt: 0, story: { ida: 0, bo: 0, kim: 0, dina: 0 },
    daily: { last: '', streak: 0 }, weekly: { id: '', tasks: [] },
    event: { type: null, until: 0, nextAt: 0 }, pickups: [], mayor: false,
  }, st);
}

// Gemte spil fra version 1 havde et kort på 8x7. Det flyttes ind på det nye kort.
function migrate(old) {
  if (old.v === 2) return defaults(old);
  const tiles = Array.from({ length: COLS * ROWS }, () => ({ t: 'locked' }));
  old.tiles.forEach((t, i) => {
    const r = Math.floor(i / 8), c = i % 8;
    if (r + 1 < ROWS && c + 1 < COLS) tiles[idxOf(r + 1, c + 1)] = t;
  });
  return defaults({ ...old, v: 2, tiles, tut: old.level > 1 ? TUTORIAL.length : 0 });
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { S = migrate(JSON.parse(raw)); fillOrders(); return; }
  } catch (e) { /* ødelagt eller utilgængelig lagring: start forfra */ }
  newState();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* privat vindue */ }
}

// ---------- Lager ----------
const have = (id) => S.inv[id] || 0;
const invTotal = () => Object.values(S.inv).reduce((a, b) => a + b, 0);
const cap = () => siloCap(S.silo);
const spaceFor = (n) => invTotal() + n <= cap();
function addItem(id, n) {
  S.inv[id] = have(id) + n;
  if (S.inv[id] <= 0) delete S.inv[id];
}
const countTiles = (t) => S.tiles.filter((x) => x.t === t).length;
const owns = (bid) => S.tiles.some((x) => x.t === 'b' && x.id === bid);

function upgradeSilo() {
  const cost = siloCost(S.silo);
  if (S.credits < cost) return fail('Ikke nok kreditter.');
  S.credits -= cost;
  S.silo++;
  Sound.play('build');
  toast(`${icon('box')} Lageret kan nu rumme ${cap()} varer.`, 'good');
  save();
  return true;
}

function fail(msg) {
  Sound.play('error');
  toast(msg, 'bad');
  return false;
}

function earn(credits) {
  S.credits += credits;
  track('earn', credits);
}

// ---------- Erfaring og niveauer ----------
function unlocksAt(lvl) {
  const out = [];
  for (const [k, c] of Object.entries(CROPS)) if (c.level === lvl) out.push(icon(k) + ITEMS[k].name);
  for (const [k, b] of Object.entries(BUILDINGS)) if (b.level === lvl) out.push(icon(k) + b.name);
  for (const [k, r] of Object.entries(RECIPES)) if (r.level === lvl && lvl > 1 && !(k in CROPS)) out.push(icon(k) + ITEMS[k].name);
  for (const [k, r] of Object.entries(ROBOTS)) if (r.level === lvl) out.push(icon(k) + r.name);
  for (const [k, c] of Object.entries(COLONISTS)) if (c.level === lvl && lvl > 1) out.push(icon('col-' + k) + c.name);
  if (PERKS[lvl]) out.push(PERKS[lvl]);
  return out;
}

function addXP(n) {
  S.xp += n;
  while (S.xp >= xpNeeded(S.level)) {
    S.xp -= xpNeeded(S.level);
    S.level++;
    const bonus = 20 * S.level + (S.level === 15 ? 1000 : 0);
    earn(bonus);
    if (S.level === 15) S.mayor = true;
    if (S.level === 4 && !S.event.nextAt) S.event.nextAt = Date.now() + 3 * 60 * 1000;
    Sound.play('level');
    showLevelUp(S.level, bonus, unlocksAt(S.level));
    fillOrders();
  }
}

// ---------- Ordrer ----------
function unlockedPool() {
  const crops = Object.keys(CROPS).filter((k) => CROPS[k].level <= S.level);
  const goods = Object.keys(RECIPES).filter((k) => {
    if (RECIPES[k].level > S.level) return false;
    const b = Object.keys(BUILDINGS).find((bid) => BUILDINGS[bid].recipes.includes(k));
    return owns(b);
  });
  return [...crops, ...goods];
}

function genItems(maxTypes, crowd = 1) {
  const pool = unlockedPool();
  const types = 1 + Math.floor(Math.random() * maxTypes);
  const items = {};
  for (let i = 0; i < types; i++) {
    const id = pick(pool);
    const isCrop = id in CROPS;
    const q = isCrop ? 2 + Math.floor(Math.random() * (2 + Math.min(S.level, 6)))
                     : 1 + Math.floor(Math.random() * (1 + S.level / 4));
    items[id] = (items[id] || 0) + Math.ceil(q * crowd);
  }
  let worth = 0;
  for (const id in items) worth += ITEMS[id].value * items[id];
  return { items, worth };
}

function genOrder() {
  const { items, worth } = genItems(Math.min(3, 1 + Math.floor(S.level / 2)));
  const o = {
    items,
    credits: Math.round(worth * (1.15 + Math.random() * 0.3)),
    xp: Math.max(1, Math.round(worth / 4)),
    ship: 'rocket',
  };
  if (S.level >= 3 && Math.random() < 0.2) {
    o.express = true;
    o.until = Date.now() + 8 * 60 * 1000;
    o.credits *= 2;
    o.xp = Math.round(o.xp * 1.5);
  }
  return o;
}

function fillOrders() {
  while (S.orders.length < orderSlots(S.level)) S.orders.push(genOrder());
}

const canFulfil = (o) => Object.entries(o.items).every(([id, q]) => have(id) >= q);

function deliver(i) {
  const o = S.orders[i];
  if (!o || !canFulfil(o)) return false;
  for (const [id, q] of Object.entries(o.items)) addItem(id, -q);
  earn(o.credits);
  S.orders[i] = genOrder();
  S.stats.deliver++;
  track('deliver', 1);
  addXP(o.xp);
  launchShip();
  Sound.play('whoosh');
  Sound.play('coin');
  Sound.buzz(20);
  toast(`Ordre leveret: +${o.credits} ${icon('coin')} +${o.xp} ${icon('xp')}`, 'good');
  save();
  return true;
}

function discard(i) {
  S.orders[i] = genOrder();
  Sound.play('click');
  save();
}

function expireOrders(now) {
  S.orders.forEach((o, i) => {
    if (o.express && o.until <= now) {
      S.orders[i] = genOrder();
      toast(`${icon('rocket')} Ekspresskibet fløj videre.`);
    }
  });
}

// ---------- Kupler ----------
function plant(idx, crop, quiet) {
  const tile = S.tiles[idx], c = CROPS[crop];
  if (!tile || tile.t !== 'plot' || tile.crop) return false;
  if (c.level > S.level) return false;
  if (S.credits < c.cost) return quiet ? false : fail('Ikke nok kreditter.');
  S.credits -= c.cost;
  const now = Date.now();
  Object.assign(tile, { crop, start: now, end: now + c.time * 1000, last: crop });
  S.lastCrop = crop;
  Sound.play('plant');
  save();
  return true;
}

function harvest(idx, auto) {
  const tile = S.tiles[idx];
  if (!tile || tile.t !== 'plot' || !tile.crop || Date.now() < tile.end) return false;
  if (!spaceFor(HARVEST_YIELD)) return auto ? false : fail('Lageret er fuldt. Sælg varer, eller udvid lageret.');
  const crop = tile.crop;
  addItem(crop, HARVEST_YIELD);
  S.stats.harvest++;
  track('harvest', HARVEST_YIELD);
  addXP(CROPS[crop].xp);
  floatItems(idx, [[crop, HARVEST_YIELD]]);
  burst(idx, '#7FD68F');
  Object.assign(tile, { crop: null, start: 0, end: 0 });
  Sound.play('plop');
  Sound.buzz(8);
  save();
  return true;
}

// ---------- Bygninger ----------
function enqueue(idx, rid) {
  const tile = S.tiles[idx], r = RECIPES[rid];
  if (tile.queue.length >= QUEUE_MAX) return fail('Køen er fuld.');
  for (const [id, q] of Object.entries(r.in)) if (have(id) < q) return fail(`Mangler ${ITEMS[id].name}.`);
  for (const [id, q] of Object.entries(r.in)) addItem(id, -q);
  const now = Date.now();
  const last = tile.queue[tile.queue.length - 1];
  const start = Math.max(now, last ? last.end : 0);
  tile.queue.push({ r: rid, start, end: start + r.time * 1000 });
  Sound.play('queue');
  save();
  return true;
}

function collect(idx, auto) {
  const tile = S.tiles[idx];
  const now = Date.now();
  const done = tile.queue.filter((q) => q.end <= now);
  if (!done.length) return 0;
  const room = Math.max(0, cap() - invTotal());
  if (!room) { if (!auto) fail('Lageret er fuldt. Sælg varer, eller udvid lageret.'); return 0; }
  const take = done.slice(0, room);
  tile.queue = tile.queue.filter((q) => !take.includes(q));
  let xp = 0;
  const got = {};
  for (const q of take) { addItem(q.r, 1); got[q.r] = (got[q.r] || 0) + 1; xp += RECIPES[q.r].xp; }
  S.stats.produce += take.length;
  track('produce', take.length);
  addXP(xp);
  floatItems(idx, Object.entries(got));
  burst(idx, '#F5C243');
  Sound.play('pickup');
  save();
  return take.length;
}

function buildOn(idx, what) {
  if (what === 'plot') {
    const cost = plotCost(countTiles('plot'));
    if (S.credits < cost) return fail('Ikke nok kreditter.');
    S.credits -= cost;
    S.tiles[idx] = { t: 'plot', crop: null, start: 0, end: 0 };
    toast(`${icon('kuppel')} Ny drivhuskuppel bygget!`, 'good');
  } else {
    const b = BUILDINGS[what];
    if (S.credits < b.cost) return fail('Ikke nok kreditter.');
    S.credits -= b.cost;
    S.tiles[idx] = { t: 'b', id: what, queue: [] };
    toast(`${icon(what)} ${b.name} bygget!`, 'good');
  }
  burst(idx, '#FF7A1A');
  Sound.play('build');
  save();
  return true;
}

function neighbourCleared(idx) {
  const r = Math.floor(idx / COLS), c = idx % COLS;
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) =>
    rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && S.tiles[idxOf(rr, cc)].t !== 'locked');
}

function clearTile(idx) {
  const cost = clearCost(S.cleared);
  if (S.credits < cost) return fail('Ikke nok kreditter.');
  S.credits -= cost;
  S.cleared++;
  S.tiles[idx] = { t: 'empty' };
  addXP(2);
  if (spaceFor(1) && Math.random() < 0.6) { addItem('jern', 1); floatItems(idx, [['jern', 1]]); }
  burst(idx, '#B89A88');
  Sound.play('build');
  save();
  return true;
}

function sell(id) {
  if (have(id) < 1) return;
  const price = Math.max(1, Math.ceil(ITEMS[id].value / 2));
  addItem(id, -1);
  earn(price);
  Sound.play('coin');
  save();
}

// ---------- Robotter ----------
function buyRobot(id) {
  const r = ROBOTS[id];
  if (S.robots[id] || r.level > S.level) return false;
  if (S.credits < r.cost) return fail('Ikke nok kreditter.');
  for (const [it, q] of Object.entries(r.items)) if (have(it) < q) return fail(`Mangler ${ITEMS[it].name}.`);
  for (const [it, q] of Object.entries(r.items)) addItem(it, -q);
  S.credits -= r.cost;
  S.robots[id] = true;
  Sound.play('build');
  toast(`${icon(id)} ${r.name} er klar til arbejde!`, 'good');
  save();
  return true;
}

// Høsterobotten planter den samme afgrøde igen, hvis der er råd.
function robotHarvest(idx) {
  const tile = S.tiles[idx];
  const crop = tile.crop;
  if (!harvest(idx, true)) return false;
  if (crop && S.credits >= CROPS[crop].cost) plant(idx, crop, true);
  return true;
}

// Indhent det, robotterne har nået, mens spillet var lukket.
function robotsCatchUp() {
  let n = 0;
  if (S.robots.hoster) S.tiles.forEach((t, i) => { if (t.t === 'plot' && t.crop && Date.now() >= t.end && robotHarvest(i)) n++; });
  if (S.robots.pakker) S.tiles.forEach((t, i) => { if (t.t === 'b' && collect(i, true)) n++; });
  if (n) toast(`${icon('hoster')} Robotterne har arbejdet, mens du var væk.`, 'good');
}

// ---------- Kolonister ----------
function colonistTick(now) {
  if (S.colonist || now < S.colonistNextAt || S.tut < TUTORIAL.length) return;
  const ids = Object.keys(COLONISTS).filter((k) => COLONISTS[k].level <= S.level);
  if (!ids.length) return;
  // Den der er nået kortest i sin historie, kommer oftest på besøg.
  ids.sort((a, b) => S.story[a] - S.story[b] + (Math.random() - 0.5));
  const id = ids[0];
  const { items, worth } = genItems(Math.min(2, 1 + Math.floor(S.level / 3)), 0.8);
  S.colonist = { id, items, credits: Math.round(worth * 1.6), xp: Math.max(2, Math.round(worth / 3)) };
  toast(`${icon('col-' + id)} ${COLONISTS[id].name} venter ved landingspladsen.`);
  save();
}

function colonistLine(id) {
  const c = COLONISTS[id], n = S.story[id];
  return n < c.lines.length ? c.lines[n] : 'Har du lidt mere til mig? Jeg betaler godt.';
}

function deliverColonist() {
  const c = S.colonist;
  if (!c || !canFulfil(c)) return false;
  for (const [id, q] of Object.entries(c.items)) addItem(id, -q);
  earn(c.credits);
  addXP(c.xp);
  const def = COLONISTS[c.id];
  const chapter = S.story[c.id] < def.lines.length ? ++S.story[c.id] : null;
  S.colonist = null;
  S.colonistNextAt = Date.now() + 90 * 1000;
  S.stats.deliver++;
  track('deliver', 1);
  Sound.play('coin');
  Sound.buzz(20);
  save();
  return { id: c.id, credits: c.credits, xp: c.xp, chapter };
}

// ---------- Daglig belønning og ugens mål ----------
const dayStr = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function checkDaily() {
  const now = new Date();
  const today = dayStr(now);
  if (S.daily.last === today) return null;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  S.daily.streak = S.daily.last === dayStr(y) ? S.daily.streak + 1 : 1;
  S.daily.last = today;
  const day = ((S.daily.streak - 1) % 7) + 1;
  const reward = { day, credits: 20 * day + (day === 7 ? 150 : 0), xp: 5 * day };
  earn(reward.credits);
  addXP(reward.xp);
  save();
  return reward;
}

function weekId(d = new Date()) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`;
}

const WEEKLY_TYPES = {
  harvest: { label: 'Høst afgrøder', icon: 'sprout', target: (l) => 40 + 10 * l },
  produce: { label: 'Producér varer', icon: 'box', target: (l) => 15 + 3 * l },
  deliver: { label: 'Lever ordrer', icon: 'rocket', target: (l) => 10 + l },
  earn:    { label: 'Tjen kreditter', icon: 'coin', target: (l) => 800 + 250 * l },
};

function ensureWeekly() {
  const id = weekId();
  if (S.weekly.id === id) return;
  S.weekly = {
    id,
    tasks: Object.keys(WEEKLY_TYPES).map((type) => ({ type, target: WEEKLY_TYPES[type].target(S.level), progress: 0, claimed: false })),
  };
  save();
}

function track(type, n) {
  if (!S.weekly || !S.weekly.tasks) return;
  for (const t of S.weekly.tasks) if (t.type === type && !t.claimed) t.progress = Math.min(t.target, t.progress + n);
}

const weeklyReward = () => ({ credits: 100 + 30 * S.level, xp: 20 + 5 * S.level });
const claimableGoals = () => (S.weekly.tasks || []).filter((t) => !t.claimed && t.progress >= t.target).length;

function claimWeekly(i) {
  const t = S.weekly.tasks[i];
  if (!t || t.claimed || t.progress < t.target) return false;
  const r = weeklyReward();
  t.claimed = true;
  earn(r.credits);
  addXP(r.xp);
  Sound.play('coin');
  toast(`${icon('goal')} Mål klaret: +${r.credits} ${icon('coin')} +${r.xp} ${icon('xp')}`, 'good');
  save();
  return true;
}

// ---------- Begivenheder ----------
function eventTick(now) {
  if (S.level < 4) return;
  const ev = S.event;
  if (!ev.nextAt) ev.nextAt = now + rand(3, 6) * 60000;
  if (ev.type && now >= ev.until) {
    ev.type = null;
    ev.nextAt = now + rand(6, 12) * 60000;
    save();
  }
  if (!ev.type && now >= ev.nextAt) startEvent(Math.random() < 0.5 ? 'storm' : 'meteor', now);
  S.pickups = S.pickups.filter((p) => p.until > now);
}

function startEvent(type, now = Date.now()) {
  const ev = S.event;
  ev.type = type;
  if (type === 'storm') {
    ev.until = now + STORM_MS;
    if (owns('skjold')) {
      toast(`${icon('storm')} Støvstorm! Stormskjoldet beskytter kuplerne.`);
    } else {
      // Afgrøder, der gror, bliver 45 sekunder forsinket.
      S.tiles.forEach((t) => { if (t.t === 'plot' && t.crop && t.end > now) t.end += 45000; });
      toast(`${icon('storm')} Støvstorm! Afgrøderne gror langsommere. Et stormskjold kan beskytte dem.`, 'bad', 4500);
    }
    Sound.play('storm');
  } else {
    ev.until = now + METEOR_MS;
    const spots = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].t === 'empty' || S.tiles[i].t === 'locked');
    for (let k = 0; k < 5 && spots.length; k++) {
      const i = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      S.pickups.push({ idx: i, item: 'jern', n: 1 + Math.floor(Math.random() * 2), until: now + 120000, born: now + k * 1500 });
    }
    toast(`${icon('meteor')} Meteorregn! Tryk på nedslagene, og saml jernmalm op.`, 'good', 4500);
  }
  save();
}

function collectPickup(idx) {
  const now = Date.now();
  const i = S.pickups.findIndex((p) => p.idx === idx && p.born <= now);
  if (i < 0) return false;
  const p = S.pickups[i];
  if (!spaceFor(p.n)) return fail('Lageret er fuldt.');
  addItem(p.item, p.n);
  S.pickups.splice(i, 1);
  floatItems(idx, [[p.item, p.n]]);
  burst(idx, '#FF7A1A');
  Sound.play('pickup');
  save();
  return true;
}

// ---------- Tutorial ----------
const TUT_DONE = [
  () => S.tiles.some((t) => t.t === 'plot' && t.crop),
  () => S.stats.harvest >= 1,
  () => S.stats.produce >= 1 || S.tiles.some((t) => t.id === 'isbor' && t.queue.length),
  () => S.stats.produce >= 1,
  () => S.stats.deliver >= 1,
  () => S.cleared >= 1,
];

function tutorialTick() {
  if (S.tut >= TUTORIAL.length) return;
  if (TUT_DONE[S.tut]()) {
    S.tut++;
    earn(10);
    Sound.play('coin');
    if (S.tut >= TUTORIAL.length) toast(`${icon('xp')} Tutorial klaret! Kolonien er din.`, 'good', 4000);
    save();
  }
}
