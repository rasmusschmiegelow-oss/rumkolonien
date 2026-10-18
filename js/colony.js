'use strict';
// Version 10: kolonirådet, gen-lab, specialister, livszonen og Marsvejr.
// Det gør Rumkolonien til et spil om at lede en koloni, ikke bare om at passe en gård.

// ---------- Politikker ----------
const policyOn = (id) => (S.council.policies[id] || 0) > solIndex();
// Ganger sammen for alle aktive politikker, fx policyMult('build').
function policyMult(key) {
  let k = 1;
  for (const id of Object.keys(S.council.policies)) if (policyOn(id) && POLICIES[id][key] != null) k *= POLICIES[id][key];
  return k;
}
function policySum(key) {
  let n = 0;
  for (const id of Object.keys(S.council.policies)) if (policyOn(id) && POLICIES[id][key]) n += POLICIES[id][key];
  return n;
}
const activePolicies = () => Object.keys(S.council.policies).filter(policyOn);

// ---------- Kolonirådet ----------
const councilPending = () => (S.council.pending ? COUNCIL.find((c) => c.id === S.council.pending) : null);

function councilTick(now) {
  if (S.level < COUNCIL_LEVEL || S.tut < TUTORIAL.length || S.council.pending) return;
  const sol = solIndex(now);
  if (S.council.sol >= sol) return;
  S.council.sol = sol;
  let id = S.council.chain;
  if (!id) {
    let pool = COUNCIL.filter((c) => c.level <= S.level && !S.council.seen[c.id]);
    if (!pool.length) { S.council.seen = {}; pool = COUNCIL.filter((c) => c.level <= S.level); }
    if (!pool.length) return;
    id = pick(pool).id;
  }
  S.council.chain = null;
  S.council.pending = id;
  S.council.seen[id] = true;
  const c = COUNCIL.find((x) => x.id === id);
  toast(`${icon('raad')} Kolonirådet: ${COLONISTS[c.who].name} har brug for en beslutning.`, 'good', 4500);
  Sound.play('open');
  save();
}

// Kan valget betales? Negative varer og kreditter skal man have.
function fxAffordable(fx) {
  if (fx.credits < 0 && S.credits < -fx.credits) return false;
  for (const [it, q] of Object.entries(fx.items || {})) if (q < 0 && have(it) < -q) return false;
  return true;
}

// Kort tekst om, hvad et valg gør.
function fxText(fx) {
  const out = [];
  if (fx.credits) out.push(`${fx.credits > 0 ? '+' : ''}${fx.credits} ${icon('coin', 'ic-s')}`);
  for (const [it, q] of Object.entries(fx.items || {})) out.push(`${q > 0 ? '+' : ''}${q} ${icon(it, 'ic-s')}`);
  if (fx.moral) out.push(`moral ${fx.moral > 0 ? '+' : ''}${fx.moral}`);
  if (fx.pop) out.push(`+${fx.pop} kolonister`);
  if (fx.xp) out.push(`+${fx.xp} ${icon('xp', 'ic-s')}`);
  if (fx.policy) out.push(`<b>${POLICIES[fx.policy[0]].name}</b> i ${fx.policy[1]} sol: ${POLICIES[fx.policy[0]].desc}`);
  if (fx.chain) out.push('Historien fortsætter');
  return out.join(' · ');
}

function decide(choice) {
  const c = councilPending();
  if (!c) return false;
  const opt = c[choice], fx = opt.fx;
  if (!fxAffordable(fx)) return fail('Det har kolonien ikke råd til lige nu.');
  if (fx.credits) { if (fx.credits > 0) earn(fx.credits); else S.credits += fx.credits; }
  for (const [it, q] of Object.entries(fx.items || {})) addItem(it, q);
  if (fx.moral) S.pop.moral = Math.max(10, Math.min(100, S.pop.moral + fx.moral));
  if (fx.pop) S.pop.n += fx.pop;
  if (fx.xp) addXP(fx.xp);
  if (fx.policy) S.council.policies[fx.policy[0]] = solIndex() + 1 + fx.policy[1];
  if (fx.chain) S.council.chain = fx.chain;
  S.council.pending = null;
  S.council.decided = (S.council.decided || 0) + 1;
  S.council.log.unshift({ id: c.id, choice, sol: solIndex() });
  S.council.log = S.council.log.slice(0, 12);
  Sound.play(fx.policy ? 'mission' : 'coin');
  save();
  return opt;
}

// ---------- Gen-lab ----------
function strHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const crossTrait = (a, b) => Object.keys(TRAITS)[strHash(a + '+' + b) % Object.keys(TRAITS).length];
function hybridName(a, b) {
  const x = ITEMS[a].name, y = ITEMS[b].name.toLowerCase();
  return x.slice(0, Math.ceil(x.length / 2)) + y.slice(Math.floor(y.length / 2));
}
const cropTraits = (crop) => (S.genes[crop] ? S.genes[crop].traits : []);
const hasTrait = (crop, t) => cropTraits(crop).includes(t);

function startCross(a, b) {
  if (S.gene.active || a === b || !CROPS[a] || !CROPS[b]) return false;
  if (CROPS[a].level > S.level || CROPS[b].level > S.level) return false;
  if (have(a) < GENE.seeds || have(b) < GENE.seeds) return fail(`Kræver ${GENE.seeds} af hver afgrøde.`);
  if (S.credits < GENE.credits) return fail('Ikke nok kreditter.');
  addItem(a, -GENE.seeds); addItem(b, -GENE.seeds);
  S.credits -= GENE.credits;
  const now = Date.now();
  S.gene.active = { a, b, start: now, end: now + GENE.min * 60000 * crewLabMult() };
  Sound.play('decode');
  save();
  return true;
}

function geneTick(now) {
  const g = S.gene.active;
  if (!g || now < g.end) return;
  S.gene.active = null;
  const trait = crossTrait(g.a, g.b), key = g.a + '+' + g.b;
  const first = !S.gene.book[key];
  S.gene.book[key] = trait;
  const cur = S.genes[g.a] || { traits: [], names: [] };
  let gained = false;
  if (!cur.traits.includes(trait) && cur.traits.length < GENE.max) { cur.traits.push(trait); cur.names.push(hybridName(g.a, g.b)); gained = true; }
  S.genes[g.a] = cur;
  addXP(first ? 12 : 4);
  Sound.play('research');
  save();
  showCross({ ...g, trait, gained, first, name: hybridName(g.a, g.b) });
}

// ---------- Specialister ----------
const crewUnlocked = (id) => S.level >= Math.max(CREW_LEVEL, COLONISTS[id].level);
const crewAt = (idx) => Object.keys(S.crew).find((id) => S.crew[id].post === idx);
// Hvor stor er effekten? Trætte specialister giver halv effekt.
const crewEff = (id) => (S.crew[id].energy < 30 ? 0.5 : 1);
function crewPostOk(id, idx) {
  const t = S.tiles[idx];
  if (!t) return false;
  const kinds = CREW[id].posts;
  if (t.t === 'b') {
    if (kinds.includes('b')) return BUILDINGS[t.id].recipes.length > 0;
    return kinds.includes(t.id) || (t.id === 'garage' && kinds.includes('garage')) || (BUILDINGS[t.id].lab && kinds.includes('lab'));
  }
  return kinds.includes(t.t);
}
function assignCrew(id, idx) {
  if (!crewPostOk(id, idx)) return fail(`${COLONISTS[id].name} kan ikke arbejde der. ${CREW[id].desc}`);
  if (S.crew[id].energy < 10) return fail(`${COLONISTS[id].name} er for træt. Lad ${id === 'bo' || id === 'kim' ? 'ham' : 'hende'} hvile en sol først.`);
  const other = crewAt(idx);
  if (other && other !== id) S.crew[other].post = -1;
  S.crew[id].post = idx;
  burst(idx, '#5BB8F0');
  Sound.play('door');
  save();
  return true;
}
function restCrew(id) { S.crew[id].post = -1; Sound.play('click'); save(); }

// Bonusser, der bruges i de eksisterende regler.
function crewBuildMult(idx) {
  return S.crew.ida.post === idx ? 1 - 0.3 * crewEff('ida') : 1;
}
function crewCropMult(idx) {
  const p = S.crew.bo.post;
  if (p < 0) return 1;
  const r1 = Math.floor(idx / COLS), c1 = idx % COLS, r2 = Math.floor(p / COLS), c2 = p % COLS;
  return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) <= 1 ? 1 - 0.3 * crewEff('bo') : 1;
}
const crewPostKind = (id) => { const p = S.crew[id].post; if (p < 0) return null; const t = S.tiles[p]; return t.t === 'b' ? (BUILDINGS[t.id].lab ? 'lab' : t.id) : t.t; };
const crewPay = () => (crewPostKind('kim') === 'pad' ? 0.15 * crewEff('kim') : 0);
const crewRoverMult = () => (crewPostKind('kim') === 'garage' ? 1 - 0.3 * crewEff('kim') : 1);
const crewLabMult = () => (crewPostKind('dina') === 'lab' ? 1 - 0.25 * crewEff('dina') : 1);
const crewMoral = () => (crewPostKind('dina') === 'habitat' ? 4 * crewEff('dina') : 0);

// Én gang pr. sol: arbejde trætter, hvile giver kræfter.
function crewSol() {
  for (const id of Object.keys(S.crew)) {
    const c = S.crew[id];
    if (!crewUnlocked(id)) continue;
    if (c.post >= 0 && !crewPostOk(id, c.post)) c.post = -1; // posten er flyttet eller revet ned
    if (c.post >= 0) {
      c.energy = Math.max(0, c.energy - CREW_WORK);
      if (c.energy <= 0) { c.post = -1; toast(`${icon('col-' + id)} ${COLONISTS[id].name} er udmattet og går hjem for at hvile.`, 'bad', 4500); }
    } else c.energy = Math.min(100, c.energy + CREW_REST);
  }
}

// ---------- Livszonen ----------
function lifeSource(t) {
  if (t.t === 'plot') return t.crop ? LIFE_SOURCE.crop : LIFE_SOURCE.plot;
  if (t.t === 'b') return LIFE_SOURCE[t.id] || 0;
  if (t.t === 'pen') return LIFE_SOURCE.pen;
  if (t.t === 'deco') return LIFE_SOURCE[t.id] || 0.5;
  return 0;
}
function lifeStep() {
  const add = new Array(S.tiles.length).fill(0);
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (t.t === 'locked') continue;
    const src = lifeSource(t) + (S.life[i] >= 60 ? 0.4 : 0); // grøn jord breder sig selv
    if (!src) continue;
    add[i] += src;
    const r = Math.floor(i / COLS), c = i % COLS;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) add[idxOf(rr, cc)] += src * 0.5;
    }
  }
  for (let i = 0; i < S.tiles.length; i++) {
    if (S.tiles[i].t === 'locked') continue;
    S.life[i] = Math.min(100, Math.round((S.life[i] + add[i] * 0.08) * 10) / 10);
  }
}
function lifeTick(now) {
  if (!S.lifeAt) { S.lifeAt = now; return; }
  let n = Math.floor((now - S.lifeAt) / 60000);
  if (!n) return;
  S.lifeAt += n * 60000;
  n = Math.min(n, 240); // højst fire timers vækst, mens man var væk
  for (let k = 0; k < n; k++) lifeStep();
}
function lifeAvg() {
  if (!S || !S.life) return 0;
  let sum = 0, n = 0;
  S.tiles.forEach((t, i) => { if (t.t !== 'locked') { sum += S.life[i]; n++; } });
  return n ? Math.round(sum / n) : 0;
}
const lifeCrop = (idx) => 1 - 0.2 * (S.life[idx] || 0) / 100;
const lifeMoral = () => { const a = lifeAvg(); return a >= 70 ? 4 : a >= 40 ? 2 : 0; };

function sowLichen(idx) {
  const t = S.tiles[idx];
  if (!t || t.t === 'locked') return false;
  for (const [it, q] of Object.entries(LIFE_SOW)) if (have(it) < q) return fail(`Kræver ${q} ${ITEMS[it].name.toLowerCase()}.`);
  for (const [it, q] of Object.entries(LIFE_SOW)) addItem(it, -q);
  S.life[idx] = Math.min(100, S.life[idx] + 45);
  const r = Math.floor(idx / COLS), c = idx % COLS;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && S.tiles[idxOf(rr, cc)].t !== 'locked') S.life[idxOf(rr, cc)] = Math.min(100, S.life[idxOf(rr, cc)] + 15);
  }
  burst(idx, '#7FD68F');
  Sound.play('plant');
  save();
  return true;
}

// ---------- Støvdjævle ----------
// Vandrer hen over kortet. Tryk for at fange dem. De forsinker kupler, men giver vindmøller et skub.
let devil = null, devilNext = 0;
function devilTick(now) {
  if (visiting || S.level < DEVIL.level || S.tut < TUTORIAL.length) return;
  if (!devilNext) devilNext = now + rand(1.5, 3) * 60000;
  if (devil && now - devil.t0 > DEVIL.ms) devil = null;
  if (devil || now < devilNext || solClock(now).night) return;
  devilNext = now + rand(3, 7) * 60000;
  // fra den ene kant af det ryddede område til den anden
  const open = S.tiles.map((t, i) => i).filter((i) => S.tiles[i].t !== 'locked');
  const rows = open.map((i) => Math.floor(i / COLS)), cols = open.map((i) => i % COLS);
  const r0 = Math.min(...rows), r1 = Math.max(...rows), c0 = Math.min(...cols), c1 = Math.max(...cols);
  const across = Math.random() < 0.5;
  const a = across ? [rand(r0, r1 + 1), c0 - 1.2] : [r0 - 1.2, rand(c0, c1 + 1)];
  const b = across ? [rand(r0, r1 + 1), c1 + 2.2] : [r1 + 2.2, rand(c0, c1 + 1)];
  const w = ([r, c]) => [(c - r) * TW / 2, (c + r) * TH / 2];
  devil = { a: w(a), b: w(b), t0: now, last: -1, x: 0, y: 0 };
}
function devilPos(now) {
  if (!devil) return null;
  const k = Math.min(1, (now - devil.t0) / DEVIL.ms);
  const wob = Math.sin(now / 400) * 18;
  devil.x = devil.a[0] + (devil.b[0] - devil.a[0]) * k + wob;
  devil.y = devil.a[1] + (devil.b[1] - devil.a[1]) * k;
  return devil;
}
// Kaldes fra tegningen: virkning på de felter, djævlen passerer.
function devilPass(now) {
  const d = devilPos(now);
  if (!d) return;
  const c = Math.floor(d.x / TW + d.y / TH), r = Math.floor(d.y / TH - d.x / TW);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  const idx = idxOf(r, c);
  if (idx === d.last) return;
  d.last = idx;
  const t = S.tiles[idx];
  if (t.t === 'plot' && t.crop && t.end > now && !owns('skjold') && !hasTrait(t.crop, 'haardfoer')) {
    t.end += 15000;
    burst(idx, '#E0A070');
  } else if (t.t === 'b' && t.id === 'vindmolle') {
    earn(25);
    floatItems(idx, [['coin', 25]]);
  }
}
function catchDevil() {
  if (!devil) return false;
  const got = [['jern', 1 + Math.floor(Math.random() * 2)]];
  if (Math.random() < 0.25) got.push(['krystal', 1]);
  for (const [it, n] of got) addItem(it, n);
  S.stats.devils = (S.stats.devils || 0) + 1;
  for (let k = 0; k < 24; k++) particles.push({ x: devil.x + rand(-20, 20), y: devil.y - rand(10, 70), vx: rand(-90, 90), vy: rand(-90, 20), life: 0.9, color: k % 2 ? '#E0A070' : '#C8623A', s: rand(2, 5), puff: true });
  floaters.push({ x: devil.x, y: devil.y - 60, list: got, t0: performance.now() });
  devil = null;
  Sound.play('gold'); Sound.play('pickup');
  save();
  return true;
}

// ---------- Solstorm ----------
function flareTick(now) {
  const ev = S.event;
  if (ev.type !== 'flare' || ev.hit || now < ev.warnUntil) return;
  ev.hit = true;
  if (ev.shelter) {
    // alle er i ly: produktionen holder pause, mens stormen raser
    S.tiles.forEach((t) => { if (t.t === 'b' && t.queue) t.queue.forEach((q) => { if (q.end > now) { q.start += FLARE.ms; q.end += FLARE.ms; } }); });
    S.pop.moral = Math.min(100, S.pop.moral + 5);
    toast(`${icon('solstorm')} Solstormen rammer. Alle er i ly, og produktionen holder pause. I nat kommer der nordlys!`, 'good', 5000);
  } else {
    S.pop.moral = Math.max(10, S.pop.moral - 10);
    for (const c of Object.values(S.crew)) c.energy = Math.max(0, c.energy - 30);
    toast(`${icon('solstorm')} Solstormen ramte kolonisterne udenfor. Moralen falder, og specialisterne er udmattede.`, 'bad', 5000);
  }
  S.aurora = (solIndex(now) + 1) * DAY_MS;
  Sound.play('storm');
  save();
}
function seekShelter() {
  const ev = S.event;
  if (ev.type !== 'flare' || ev.hit || ev.shelter) return false;
  ev.shelter = true;
  Sound.play('door');
  toast(`${icon('habitat')} Alle kolonister er på vej i ly.`, 'good');
  save();
  return true;
}

// ---------- Hver kvarte sekund ----------
function colonyTick(now) {
  councilTick(now);
  geneTick(now);
  lifeTick(now);
  devilTick(now);
  flareTick(now);
}
