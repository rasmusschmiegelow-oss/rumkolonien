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
  ensureSpecials();
  return S;
}

// Udfylder felter, der mangler i gamle eller nye gemte spil.
function defaults(st) {
  const stats = Object.assign({ harvest: 0, produce: 0, deliver: 0, earn: 0, expeditions: 0, artefakter: 0, ships: 0, sold: 0, helped: 0 }, st.stats);
  return Object.assign({
    v: 2, credits: 50, xp: 0, level: 1, cleared: 0, silo: 1, inv: {}, orders: [], lastCrop: null,
    stats: { harvest: 0, produce: 0, deliver: 0, earn: 0 },
    tut: 0, robots: { hoster: false, pakker: false },
    colonist: null, colonistNextAt: 0, story: { ida: 0, bo: 0, kim: 0, dina: 0 },
    daily: { last: '', streak: 0 }, weekly: { id: '', tasks: [] },
    event: { type: null, until: 0, nextAt: 0 }, pickups: [], mayor: false,
    medals: {}, expedition: null,
    research: { done: {}, active: null }, ship: null, shipNext: 0,
    tickets: 0, decorInv: {}, arcade: { day: '', plays: 0, best: 0 },
    playerName: '', savedAt: 0,
    specials: null, mission: 0, weekScore: { id: '', n: 0 }, weekPrize: {},
  }, st, { stats });
}

// Gemte spil fra version 1 havde et kort på 8x7. Det flyttes ind på det nye kort.
function migrate(old) {
  if (old.v === 2) return ensureSpecials(defaults(old));
  const tiles = Array.from({ length: COLS * ROWS }, () => ({ t: 'locked' }));
  old.tiles.forEach((t, i) => {
    const r = Math.floor(i / 8), c = i % 8;
    if (r + 1 < ROWS && c + 1 < COLS) tiles[idxOf(r + 1, c + 1)] = t;
  });
  return ensureSpecials(defaults({ ...old, v: 2, tiles, tut: old.level > 1 ? TUTORIAL.length : 0 }));
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { S = migrate(JSON.parse(raw)); fillOrders(); return; }
  } catch (e) { /* ødelagt eller utilgængelig lagring: start forfra */ }
  newState();
}

function save() {
  S.savedAt = Date.now(); // bruges til at afgøre, hvilken udgave i skyen der er nyest
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* privat vindue */ }
}

// ---------- Lager ----------
const have = (id) => S.inv[id] || 0;
const invTotal = () => Object.values(S.inv).reduce((a, b) => a + b, 0);
const cap = () => siloCap(S.silo) + (hasTech('lager') ? 60 : 0);
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
  for (const [k, a] of Object.entries(ANIMALS)) if (a.level === lvl) out.push(icon(k) + a.name);
  for (const [k, d] of Object.entries(DECOR)) if (d.level === lvl) out.push(icon(k) + d.name);
  for (const r of Object.values(RESEARCH)) if (r.level === lvl && lvl > 8) out.push(icon('lab') + r.name);
  for (const e of EXPEDITIONS) if (e.level === lvl) out.push(icon('rover') + e.name);
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
  const animal = Object.keys(ANIMALS).filter((k) => S.tiles.some((t) => t.t === 'pen' && t.id === k)).map((k) => ANIMALS[k].product);
  return [...crops, ...goods, ...animal].filter((id) => id !== 'krystal');
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
  const pay = orderPay(o.credits);
  earn(pay);
  S.orders[i] = genOrder();
  S.stats.deliver++;
  track('deliver', 1);
  giveTickets(1 + Math.min(2, Math.floor(o.credits / 150)));
  addWeek(1);
  addXP(o.xp);
  launchShip();
  Sound.play('whoosh');
  Sound.play('coin');
  Sound.buzz(20);
  toast(`Ordre leveret: +${pay} ${icon('coin')} +${o.xp} ${icon('xp')}`, 'good');
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
  Object.assign(tile, { crop, start: now, end: now + c.time * growthMult() * seasonCrop() * 1000, last: crop });
  S.lastCrop = crop;
  if (!quiet) Sound.play('plant');
  save();
  return true;
}

function harvest(idx, auto) {
  const tile = S.tiles[idx];
  if (!tile || tile.t !== 'plot' || !tile.crop || Date.now() < tile.end) return false;
  if (!spaceFor(HARVEST_YIELD)) return auto ? false : fail('Lageret er fuldt. Sælg varer, eller udvid lageret.');
  const crop = tile.crop;
  const extra = (hasTech('hoest') && Math.random() < 0.25) || (season().id === 'efteraar' && Math.random() < 0.2);
  const n = HARVEST_YIELD + (extra && spaceFor(HARVEST_YIELD + 1) ? 1 : 0);
  addItem(crop, n);
  S.stats.harvest++;
  track('harvest', n);
  addXP(CROPS[crop].xp);
  floatItems(idx, [[crop, n]]);
  burst(idx, '#7FD68F');
  Object.assign(tile, { crop: null, start: 0, end: 0 });
  if (!auto) { Sound.play('plop'); Sound.buzz(8); }
  save();
  return true;
}

// ---------- Bygninger ----------
function enqueue(idx, rid) {
  const tile = S.tiles[idx], r = RECIPES[rid];
  if (tile.queue.length >= queueMax(tile)) return fail('Køen er fuld.');
  for (const [id, q] of Object.entries(r.in)) if (have(id) < q) return fail(`Mangler ${ITEMS[id].name}.`);
  for (const [id, q] of Object.entries(r.in)) addItem(id, -q);
  const now = Date.now();
  const last = tile.queue[tile.queue.length - 1];
  const start = Math.max(now, last ? last.end : 0);
  tile.queue.push({ r: rid, start, end: start + r.time * buildTime(idx) * 1000 });
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
  if (!auto) Sound.play('pickup');
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
  } else if (DECOR[what]) {
    const d = DECOR[what];
    if (d.fest) {
      if (!S.decorInv[what]) return fail('Køb den i festivalbutikken først.');
      S.decorInv[what]--;
    } else {
      if (S.credits < d.cost) return fail('Ikke nok kreditter.');
      S.credits -= d.cost;
    }
    S.tiles[idx] = { t: 'deco', id: what };
    toast(`${icon(what)} ${d.name} sat op: +${d.happy} ${icon('lykke')}`, 'good');
  } else if (ANIMALS[what]) {
    const a = ANIMALS[what];
    if (S.credits < a.cost) return fail('Ikke nok kreditter.');
    S.credits -= a.cost;
    S.tiles[idx] = { t: 'pen', id: what, animals: Array.from({ length: PEN_SIZE }, () => ({ end: 0 })) };
    toast(`${icon(what)} ${a.name} bygget! Fodr ${a.animalName.toLowerCase()} med foder fra foderfabrikken.`, 'good', 4000);
  } else {
    const b = BUILDINGS[what];
    if (b.needs && S.specials[idx] !== b.needs) return fail(`${b.name} kan kun bygges på en ${SPECIALS[b.needs].name.toLowerCase()}.`);
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
  const cost = clearCost(S.cleared) * (S.specials[idx] ? 2 : 1);
  if (S.credits < cost) return fail('Ikke nok kreditter.');
  S.credits -= cost;
  S.cleared++;
  S.tiles[idx] = { t: 'empty' };
  addXP(2);
  const sp = S.specials[idx];
  if (sp === 'ruin') {
    delete S.specials[idx];
    addItem('artefakt', 1); addItem('krystal', 2);
    S.stats.artefakter++;
    floatItems(idx, [['artefakt', 1], ['krystal', 2]]);
    Sound.play('level');
    toast(`${icon('ruin')} Du fandt et artefakt og 2 krystaller i ruinen!`, 'good', 4000);
  } else if (sp) {
    toast(`${icon(SPECIALS[sp].sprite)} ${SPECIALS[sp].name}! ${SPECIALS[sp].desc}`, 'good', 4500);
  } else if (spaceFor(1) && Math.random() < 0.6) { addItem('jern', 1); floatItems(idx, [['jern', 1]]); }
  burst(idx, '#B89A88');
  Sound.play('build');
  save();
  return true;
}

function sell(id, n = 1) {
  n = Math.min(n, have(id));
  if (n < 1) return;
  const price = marketPrice(id).sell * n;
  addItem(id, -n);
  earn(price);
  S.stats.sold += n;
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
  if (S.robots.pakker) S.tiles.forEach((t, i) => { if ((t.t === 'b' && collect(i, true)) || (t.t === 'pen' && collectPen(i, true))) n++; });
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
  const pay = orderPay(c.credits);
  earn(pay);
  addXP(c.xp);
  const def = COLONISTS[c.id];
  const chapter = S.story[c.id] < def.lines.length ? ++S.story[c.id] : null;
  S.colonist = null;
  S.colonistNextAt = Date.now() + 90 * 1000;
  giveTickets(2);
  addWeek(1);
  S.stats.deliver++;
  track('deliver', 1);
  Sound.play('coin');
  Sound.buzz(20);
  save();
  return { id: c.id, credits: pay, xp: c.xp, chapter };
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

// ---------- Dyr ----------
const penReady = (tile, now = Date.now()) => tile.animals.filter((a) => a.end && a.end <= now).length;
const penHungry = (tile) => tile.animals.filter((a) => !a.end).length;

function collectPen(idx, auto) {
  const tile = S.tiles[idx], def = ANIMALS[tile.id];
  const now = Date.now();
  let n = 0;
  for (const a of tile.animals) {
    if (a.end && a.end <= now) {
      if (!spaceFor(1)) { if (!auto && !n) fail('Lageret er fuldt.'); break; }
      addItem(def.product, 1);
      a.end = 0;
      n++;
    }
  }
  if (n) {
    S.stats.produce += n;
    track('produce', n);
    addXP(def.xp * n);
    floatItems(idx, [[def.product, n]]);
    burst(idx, '#F3E6CF');
    if (!auto) Sound.play('pickup');
    save();
  }
  return n;
}

function feedPen(idx) {
  const tile = S.tiles[idx], def = ANIMALS[tile.id];
  const now = Date.now();
  let n = 0;
  for (const a of tile.animals) {
    if (!a.end && have('foder') > 0) {
      addItem('foder', -1);
      a.start = now;
      a.end = now + def.time * (hasTech('dyr') ? 0.7 : 1) * 1000;
      n++;
    }
  }
  if (n) { Sound.play('plant'); save(); }
  return n;
}

// Et tryk på indhegningen samler først ind og fodrer derefter.
function tapPen(idx) {
  const got = collectPen(idx);
  const fed = feedPen(idx);
  const tile = S.tiles[idx];
  if (!got && !fed) {
    if (penHungry(tile) && !have('foder')) return fail(`${ANIMALS[tile.id].animalName} er sultne. Lav foder i foderfabrikken.`);
    const next = Math.min(...tile.animals.filter((a) => a.end).map((a) => a.end));
    if (isFinite(next)) toast(`${icon(ANIMALS[tile.id].product)} Næste om ${fmtTime((next - Date.now()) / 1000)}`);
  } else if (fed) {
    toast(`${icon('foder')} ${fed} dyr fodret.`);
  }
}

// ---------- Bygningsopgraderinger ----------
function upgradeBuilding(idx) {
  const tile = S.tiles[idx], b = BUILDINGS[tile.id];
  const lvl = tile.lvl || 1;
  if (lvl >= UPGRADE_MAX || S.level < 6) return false;
  const c = upgradeCost(b, lvl);
  if (S.credits < c.credits) return fail('Ikke nok kreditter.');
  if (have('jern') < c.jern) return fail(`Mangler jernmalm (${have('jern')}/${c.jern}).`);
  S.credits -= c.credits;
  addItem('jern', -c.jern);
  tile.lvl = lvl + 1;
  burst(idx, '#F5C243');
  Sound.play('level');
  toast(`${icon(tile.id)} ${b.name} er nu niveau ${tile.lvl}: ${queueMax(tile)} pladser i køen og ${Math.round((1 - speedOf(tile)) * 100)} % hurtigere.`, 'good', 4000);
  save();
  return true;
}

// ---------- Ekspeditioner ----------
function startExpedition(id) {
  const e = EXPEDITIONS.find((x) => x.id === id);
  if (!e || S.expedition || e.level > S.level) return false;
  for (const [it, q] of Object.entries(e.cost)) if (have(it) < q) return fail(`Mangler ${ITEMS[it].name}.`);
  for (const [it, q] of Object.entries(e.cost)) addItem(it, -q);
  S.expedition = { id, start: Date.now(), end: Date.now() + e.time * (hasTech('rover') ? 0.6 : 1) * 1000 };
  Sound.play('whoosh');
  toast(`${icon('rover')} Roveren kører mod ${e.name}.`, 'good');
  save();
  return true;
}

function finishExpedition() {
  const x = S.expedition;
  if (!x || Date.now() < x.end) return null;
  const e = EXPEDITIONS.find((y) => y.id === x.id);
  const found = [];
  for (const [it, min, max, chance] of e.loot) {
    if (Math.random() > chance) continue;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    addItem(it, n); // fund lægges altid på lager, også hvis det er fuldt
    found.push([it, n]);
    if (it === 'artefakt') S.stats.artefakter += n;
  }
  S.expedition = null;
  S.stats.expeditions++;
  addXP(10 + Math.round(e.time / 60));
  Sound.play('coin');
  save();
  return { e, found };
}

// ---------- Medaljer ----------
function medalTick() {
  for (const m of MEDALS) {
    if (S.medals[m.id] || !m.test()) continue;
    S.medals[m.id] = Date.now();
    earn(m.reward);
    Sound.play('level');
    toast(`${icon('medalje')} Medalje: <b>${m.name}</b> · +${m.reward} ${icon('coin')}`, 'good', 4500);
    save();
  }
}

// ---------- Gemmekode ----------
function exportSave() {
  save();
  return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
}

function importSave(code) {
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!obj || !Array.isArray(obj.tiles) || typeof obj.credits !== 'number') throw new Error('ugyldig');
    S = migrate(obj);
    fillOrders();
    save();
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Version 4: hjælpere ----------
const hasTech = (id) => !!(S.research && S.research.done[id]);
const growthMult = () => 1 - (hasTech('vaekst1') ? 0.15 : 0) - (hasTech('vaekst2') ? 0.15 : 0);
const happiness = () => Math.min(HAPPY_MAX, S.tiles.reduce((a, t) => a + (t.t === 'deco' ? DECOR[t.id].happy : 0), 0));
const payMult = () => 1 + (hasTech('handel') ? 0.15 : 0) + happiness() / 100;
const orderPay = (credits) => Math.round(credits * payMult());

// ---------- Pynt ----------
function removeDecor(idx) {
  const t = S.tiles[idx];
  if (t.t !== 'deco') return;
  const d = DECOR[t.id];
  S.tiles[idx] = { t: 'empty' };
  Sound.play('build');
  if (d.fest) {
    S.decorInv[t.id] = (S.decorInv[t.id] || 0) + 1;
    toast(`${d.name} er pakket ned. Du kan sætte den op igen fra byggemenuen.`);
  } else {
    const refund = Math.round(d.cost / 2);
    earn(refund);
    toast(`Pynten er fjernet: +${refund} ${icon('coin')}`);
  }
  save();
}

// ---------- Rumbørsen ----------
const hourIndex = (now = Date.now()) => Math.floor(now / MARKET_HOUR);
function marketFactor(id, h = hourIndex()) {
  const k = Object.keys(ITEMS).indexOf(id);
  const x = Math.sin((k + 1) * 91.7 + h * 12.9898) * 43758.5453;
  return 0.7 + 0.6 * (x - Math.floor(x));
}
function demandToday() {
  const day = Math.floor(Date.now() / 86400000);
  const pool = unlockedPool().filter((id) => !(id in CROPS)).concat(unlockedPool().filter((id) => id in CROPS)).sort();
  const out = [];
  for (let i = 0; out.length < 3 && i < 40 && pool.length; i++) {
    const x = Math.sin(day * 7.13 + i * 3.7) * 43758.5453;
    const id = pool[Math.floor((x - Math.floor(x)) * pool.length)];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
function marketPrice(id) {
  const f = marketFactor(id), base = ITEMS[id].value;
  const hot = demandToday().includes(id);
  return {
    // Købsprisen ligger altid over den højeste salgspris, så man ikke kan tjene på at købe og sælge igen.
    sell: Math.max(1, Math.round(base * 0.5 * f * (hot ? 1.8 : 1))),
    buy: Math.max(2, Math.ceil(base * 1.8 * f)),
    trend: f - marketFactor(id, hourIndex() - 1),
    hot,
  };
}
function buyItem(id, n = 1) {
  const price = marketPrice(id).buy * n;
  if (S.credits < price) return fail('Ikke nok kreditter.');
  if (!spaceFor(n)) return fail('Lageret er fuldt.');
  S.credits -= price;
  addItem(id, n);
  Sound.play('coin');
  save();
  return true;
}

// ---------- Moderskibet ----------
function shipTick(now) {
  if (S.level < SHIP.level || S.tut < TUTORIAL.length) return;
  if (S.ship && now >= S.ship.until) {
    S.ship = null;
    S.shipNext = now + SHIP.gapMs;
    toast(`${icon('moderskib')} Moderskibet er fløjet videre.`);
    save();
  }
  if (!S.ship && now >= S.shipNext) {
    const crates = [];
    for (let i = 0, tries = 0; crates.length < SHIP.crates && tries < 60; i++, tries++) {
      const { items, worth } = genItems(1, 1.4);
      const [item, n] = Object.entries(items)[0];
      // hver container får sin egen vare, så længe der er nok forskellige at vælge imellem
      if (crates.some((c) => c.item === item) && tries < 40) continue;
      crates.push({ item, n, credits: Math.round(worth * 1.3), xp: Math.max(2, Math.round(worth / 4)), done: false });
    }
    const total = crates.reduce((a, c) => a + c.credits, 0);
    S.ship = { crates, until: now + SHIP.stayMs, bonus: Math.round(total * 0.6), krystal: 1 + (S.level >= 9 ? 1 : 0) };
    Sound.play('whoosh');
    toast(`${icon('moderskib')} Moderskibet er ankommet! Fyld containerne ved landingspladsen.`, 'good', 4500);
    save();
  }
}

function loadCrate(i) {
  const sh = S.ship, c = sh && sh.crates[i];
  if (!c || c.done) return false;
  if (have(c.item) < c.n) return fail(`Mangler ${ITEMS[c.item].name}.`);
  addItem(c.item, -c.n);
  c.done = true;
  giveTickets(2);
  addWeek(1);
  const pay = orderPay(c.credits);
  earn(pay);
  addXP(c.xp);
  Sound.play('coin');
  if (sh.crates.every((x) => x.done)) {
    earn(sh.bonus);
    addItem('krystal', sh.krystal);
    S.stats.ships++;
    S.ship = null;
    S.shipNext = Date.now() + SHIP.gapMs;
    launchShip();
    Sound.play('level');
    toast(`${icon('moderskib')} Alle containere er fyldt! Bonus: +${sh.bonus} ${icon('coin')} og ${sh.krystal} ${icon('krystal')}`, 'good', 5000);
  }
  save();
  return true;
}

// ---------- Forskning ----------
function researchState(id) {
  const r = RESEARCH[id];
  if (hasTech(id)) return 'done';
  if (S.research.active && S.research.active.id === id) return 'active';
  if (r.level > S.level || (r.needs && !hasTech(r.needs))) return 'locked';
  return 'open';
}

function startResearch(id) {
  const r = RESEARCH[id];
  if (S.research.active || researchState(id) !== 'open') return false;
  if (S.credits < r.credits) return fail('Ikke nok kreditter.');
  for (const [it, q] of Object.entries(r.cost)) if (have(it) < q) return fail(`Mangler ${ITEMS[it].name}.`);
  for (const [it, q] of Object.entries(r.cost)) addItem(it, -q);
  S.credits -= r.credits;
  S.research.active = { id, start: Date.now(), end: Date.now() + r.time * 1000 };
  Sound.play('build');
  save();
  return true;
}

function researchTick(now) {
  const a = S.research.active;
  if (!a || now < a.end) return;
  S.research.done[a.id] = true;
  S.research.active = null;
  Sound.play('level');
  toast(`${icon('lab')} Forskning færdig: <b>${RESEARCH[a.id].name}</b>. ${RESEARCH[a.id].desc}`, 'good', 5000);
  save();
}

// ---------- Version 5: festival ----------
const isFestival = () => S.level >= FESTIVAL.level && FESTIVAL.days.includes(new Date().getDay());
function festivalEnds() {
  const d = new Date();
  const left = d.getDay() === 0 ? 0 : 7 - d.getDay(); // søndag er sidste dag
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + left + 1);
  return end.getTime();
}
function festivalStarts() {
  const d = new Date();
  const days = (4 - d.getDay() + 7) % 7 || 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}
function giveTickets(n) {
  if (!isFestival() || n <= 0) return;
  S.tickets += n;
  toast(`+${n} ${icon('festbillet')} festbillet${n > 1 ? 'ter' : ''}`, 'good', 1800);
}
function buyFest(i) {
  const it = FEST_SHOP[i];
  if (!isFestival()) return fail('Festivalbutikken er lukket.');
  if (S.tickets < it.tickets) return fail('Ikke nok festbilletter.');
  if (it.kind === 'item' && !spaceFor(it.n)) return fail('Lageret er fuldt.');
  S.tickets -= it.tickets;
  if (it.kind === 'decor') {
    S.decorInv[it.id] = (S.decorInv[it.id] || 0) + 1;
    toast(`${icon(it.id)} ${DECOR[it.id].name} er købt. Tryk på et ryddet felt for at sætte den op.`, 'good', 4000);
  } else if (it.kind === 'item') addItem(it.id, it.n);
  else earn(it.n);
  Sound.play('coin');
  save();
  return true;
}

// ---------- Version 5: redigering ----------
// Byt indholdet af to felter. Afgrøder, køer og dyr flytter med.
function swapTiles(a, b) {
  if (a === b || S.tiles[a].t === 'locked' || S.tiles[b].t === 'locked') return false;
  const needs = (t, i) => t.t === 'b' && BUILDINGS[t.id].needs && S.specials[i] !== BUILDINGS[t.id].needs;
  if (needs(S.tiles[a], b) || needs(S.tiles[b], a)) return fail('Krystalboret skal stå på en krystalåre.');
  [S.tiles[a], S.tiles[b]] = [S.tiles[b], S.tiles[a]];
  S.pickups = S.pickups.filter((p) => p.idx !== a && p.idx !== b);
  save();
  return true;
}

// ---------- Version 5: minispil ----------
function arcadePlaysLeft() {
  const today = dayStr(new Date());
  if (S.arcade.day !== today) { S.arcade.day = today; S.arcade.plays = 0; }
  return Math.max(0, ARCADE.plays - S.arcade.plays);
}
function arcadeReward(score, golden) {
  const credits = Math.round(score * (6 + S.level * 2));
  const jern = Math.floor(score / 6);
  const krystal = Math.min(2, golden);
  S.arcade.plays++;
  S.arcade.best = Math.max(S.arcade.best, score);
  earn(credits);
  addItem('jern', jern);
  if (krystal) addItem('krystal', krystal);
  addXP(Math.round(score / 2));
  save();
  return { credits, jern, krystal };
}

// ---------- Version 5: rådgiver ----------
function adviceList() {
  const now = Date.now(), out = [];
  const find = (fn) => S.tiles.findIndex(fn);
  const mp = missionProgress();
  if (S.tut >= TUTORIAL.length && mp && mp.done) out.push({ icon: 'mission', text: 'En mission er klaret. Hent belønningen.', act: 'missions' });
  const readyPlots = S.tiles.filter((t) => t.t === 'plot' && t.crop && now >= t.end).length;
  if (readyPlots) out.push({ icon: 'sprout', text: `Høst ${readyPlots} ${readyPlots === 1 ? 'moden kuppel' : 'modne kupler'}. Træk fingeren hen over dem.`, idx: find((t) => t.t === 'plot' && t.crop && now >= t.end) });
  const doneB = find((t) => t.t === 'b' && t.queue && t.queue.some((q) => q.end <= now));
  if (doneB >= 0) out.push({ icon: S.tiles[doneB].id, text: `Saml de færdige varer i ${BUILDINGS[S.tiles[doneB].id].name.toLowerCase()}.`, idx: doneB });
  const pen = find((t) => t.t === 'pen' && (penReady(t, now) || (penHungry(t) && have('foder'))));
  if (pen >= 0) out.push({ icon: ANIMALS[S.tiles[pen].id].animal, text: `${ANIMALS[S.tiles[pen].id].animalName} venter på dig.`, idx: pen });
  if (S.expedition && now >= S.expedition.end) out.push({ icon: 'rover', text: 'Roveren er tilbage med fund.', idx: find((t) => t.t === 'b' && t.id === 'garage') });
  const padIdx = find((t) => t.t === 'pad');
  if (S.ship && S.ship.crates.some((c) => !c.done && have(c.item) >= c.n)) out.push({ icon: 'moderskib', text: 'Du kan fylde en container på moderskibet.', idx: padIdx });
  if (S.colonist && canFulfil(S.colonist)) out.push({ icon: 'col-' + S.colonist.id, text: `Du har det, ${COLONISTS[S.colonist.id].name} mangler.`, idx: padIdx });
  const ord = S.orders.filter(canFulfil).length;
  if (ord) out.push({ icon: 'rocket', text: `Du kan levere ${ord} ${ord === 1 ? 'ordre' : 'ordrer'}.`, idx: padIdx });
  if (owns('lab') && !S.research.active && Object.keys(RESEARCH).some((id) => researchState(id) === 'open' && S.credits >= RESEARCH[id].credits && Object.entries(RESEARCH[id].cost).every(([it, q]) => have(it) >= q))) {
    out.push({ icon: 'lab', text: 'Labbet står stille, og du har råd til ny forskning.', idx: find((t) => t.t === 'b' && t.id === 'lab') });
  }
  const idle = find((t) => t.t === 'b' && BUILDINGS[t.id].recipes.length && t.queue.length < queueMax(t)
    && BUILDINGS[t.id].recipes.some((r) => RECIPES[r].level <= S.level && Object.entries(RECIPES[r].in).every(([it, q]) => have(it) >= q)));
  if (idle >= 0) out.push({ icon: S.tiles[idle].id, text: `${BUILDINGS[S.tiles[idle].id].name} har plads i køen, og du har råvarerne.`, idx: idle });
  const emptyPlots = S.tiles.filter((t) => t.t === 'plot' && !t.crop).length;
  if (emptyPlots && S.credits >= CROPS.kartoffel.cost) out.push({ icon: 'kuppel', text: `${emptyPlots} ${emptyPlots === 1 ? 'kuppel står' : 'kupler står'} tomme. Plant noget.`, idx: find((t) => t.t === 'plot' && !t.crop) });
  if (invTotal() >= cap() * 0.9) out.push({ icon: 'box', text: 'Lageret er næsten fuldt. Sælg på Rumbørsen, eller udvid det.', act: 'inventory' });
  if (claimableGoals()) out.push({ icon: 'goal', text: 'Du har et ugemål, der er klar til at blive hentet.', act: 'colony' });
  if (isFestival() && FEST_SHOP.some((f) => f.tickets <= S.tickets)) out.push({ icon: 'festbillet', text: 'Du har billetter nok til noget i festivalbutikken.', act: 'festival' });
  if (S.tut >= TUTORIAL.length && S.stats.helped < 3) out.push({ icon: 'nabo', text: 'Besøg en nabo, og giv en hånd med. I får begge en belønning.', act: 'neighbors' });
  if (S.level >= ARCADE.level && arcadePlaysLeft()) out.push({ icon: 'joystick', text: `Du har ${arcadePlaysLeft()} runder asteroidejagt tilbage i dag.`, act: 'arcade' });
  if (!out.length) {
    const rock = S.tiles.findIndex((t, i) => t.t === 'locked' && neighbourCleared(i));
    if (rock >= 0 && S.credits >= clearCost(S.cleared)) out.push({ icon: 'rock', text: 'Ryd en klippe, og gør plads til mere.', idx: rock });
    else out.push({ icon: 'moon', text: 'Alt kører. Kom tilbage om lidt, når tingene er klar.' });
  }
  return out;
}

// Antal ting, der venter på spilleren (bruges til app-ikonet).
function readyCount() {
  const now = Date.now();
  let n = S.tiles.filter((t) => t.t === 'plot' && t.crop && now >= t.end).length;
  n += S.tiles.filter((t) => t.t === 'b' && t.queue && t.queue.some((q) => q.end <= now)).length;
  n += S.tiles.filter((t) => t.t === 'pen' && penReady(t, now)).length;
  if (S.expedition && now >= S.expedition.end) n++;
  n += S.orders.filter(canFulfil).length;
  return n;
}

// ---------- Version 6: årstider ----------
const seasonIndex = (now = Date.now()) => Math.floor(now / SEASON_MS) % SEASONS.length;
const season = (now) => SEASONS[seasonIndex(now)];
const seasonEnds = (now = Date.now()) => (Math.floor(now / SEASON_MS) + 1) * SEASON_MS;
const seasonCrop = () => ({ foraar: 0.85, vinter: 1.2 }[season().id] || 1);
// Produktionstid for en bygning: opgraderinger, sommer, og isbor om vinteren eller på et iskrater.
function buildTime(idx) {
  const t = S.tiles[idx];
  let k = speedOf(t);
  if (season().id === 'sommer') k *= 0.85;
  if (t.id === 'isbor') {
    if (S.specials[idx] === 'ice') k *= 0.5;
    if (season().id === 'vinter') k *= 0.5;
  }
  return k;
}

// ---------- Version 6: særlige felter ----------
// Placeres én gang pr. koloni under klipper, der ikke er ryddet endnu.
function ensureSpecials(st = S) {
  if (st.specials) return st;
  st.specials = {};
  const open = (i) => {
    const r = Math.floor(i / COLS), c = i % COLS;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && st.tiles[idxOf(rr, cc)].t !== 'locked');
  };
  const locked = st.tiles.map((t, i) => i).filter((i) => st.tiles[i].t === 'locked');
  const plan = ['ice', 'ice', 'ice', 'crystal', 'crystal', 'crystal', 'ruin', 'ruin', 'ruin'];
  for (const type of plan) {
    if (!locked.length) break;
    // lidt væk fra startområdet, så man skal udvide for at finde dem
    const far = locked.filter((i) => !open(i));
    const pool = far.length ? far : locked;
    const i = pool[Math.floor(Math.random() * pool.length)];
    st.specials[i] = type;
    locked.splice(locked.indexOf(i), 1);
  }
  return st;
}

// ---------- Version 6: ugens konkurrence ----------
function addWeek(n) {
  const id = weekId();
  if (S.weekScore.id !== id) S.weekScore = { id, n: 0 };
  S.weekScore.n += n;
}
const weekPrizeFor = (place) => WEEK_PRIZES.find((p) => place <= p.upTo);

// ---------- Version 6: missioner ----------
const currentMission = () => MISSIONS[S.mission];
function missionProgress(m = currentMission()) {
  if (!m) return null;
  const [cur, target] = m.p();
  return { cur: Math.min(cur, target), target, done: cur >= target };
}
function claimMission() {
  const m = currentMission(), pr = missionProgress(m);
  if (!m || !pr.done) return false;
  earn(m.reward);
  addXP(Math.round(m.reward / 10));
  if (m.krystal) addItem('krystal', m.krystal);
  S.mission++;
  Sound.play('level');
  const next = currentMission();
  const chapterDone = !next || next.ch !== m.ch;
  toast(`${icon('mission')} Mission klaret: +${m.reward} ${icon('coin')}${m.krystal ? ` og ${m.krystal} ${icon('krystal')}` : ''}${chapterDone && next ? ` · Nyt kapitel: ${MISSION_CHAPTERS[next.ch].title}` : ''}`, 'good', 4500);
  save();
  return true;
}
