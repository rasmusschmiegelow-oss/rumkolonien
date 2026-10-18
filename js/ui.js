'use strict';
// HUD, dialoger, beskeder og bannere.

let installPrompt = null; // sættes, når browseren tilbyder at installere appen

const $ = (id) => document.getElementById(id);
const modal = $('modal');
let modalView = null; // opdaterer den åbne dialog uden at udskifte knapperne

const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  return `${Math.floor(m / 60)}t ${m % 60}m`;
};

const needList = (inp) => Object.entries(inp).map(([id, q]) =>
  `<span class="need-chip ${have(id) >= q ? 'ok' : 'no'}" title="${ITEMS[id].name}">${icon(id)}${have(id)}/${q}</span>`).join('')
  || '<span class="need-chip ok">Intet input</span>';

function showModal(title, html, view) {
  $('modalTitle').innerHTML = title;
  $('modalBody').innerHTML = html;
  modal.hidden = false;
  modalView = view || null;
}
function closeModal() { if (!modal.hidden) Sound.play('close'); modal.hidden = true; modalView = null; Sound.hush(); }

function toast(html, kind = '', ms = 2800) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = html;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.remove(), ms);
}

// ---------- Tryk på kortet ----------
function onTile(idx) {
  const tile = S.tiles[idx];
  const now = Date.now();
  if (visiting) return toast(`Du besøger ${escapeHtml(visiting.name)}. Tryk på "Tilbage" for at komme hjem.`);
  if (editMode) return editTap(idx);
  if (crewPick) { const id = crewPick; if (assignCrew(id, idx)) { endCrewPick(); toast(`${icon('col-' + id)} ${COLONISTS[id].name} arbejder nu ved ${tileName(idx).toLowerCase()}.`, 'good'); } return; }
  if (collectPickup(idx)) return;
  Sound.play('click');
  switch (tile.t) {
    case 'plot':
      if (!tile.crop) return openPlant(idx);
      if (now >= tile.end) return harvest(idx);
      return toast(`${icon(tile.crop)} ${ITEMS[tile.crop].name} er klar om ${fmtTime((tile.end - now) / 1000)}`);
    case 'b':
      if (BUILDINGS[tile.id].garage) return openGarage(idx);
      if (BUILDINGS[tile.id].lab) return openLab(idx);
      if (BUILDINGS[tile.id].monolith) return openMonolith();
      if (BUILDINGS[tile.id].gen) return openGenlab();
      if (BUILDINGS[tile.id].power) return openEnergy();
      if (tile.id === 'habitat') return openPop();
      collect(idx);
      return openBuilding(idx);
    case 'pen': return tapPen(idx);
    case 'deco': return openDecor(idx);
    case 'pad': return openOrders();
    case 'empty': return openBuild(idx);
    case 'locked':
      if (!neighbourCleared(idx)) return toast('Ryd et felt ved siden af først.');
      return openClear(idx);
  }
}

// ---------- Redigering ----------
function setEdit(on) {
  editMode = on;
  editSel = -1;
  closeModal();
  $('editBanner').hidden = !on;
  document.body.classList.toggle('editing', on);
  if (on) Sound.play('click');
}

function editTap(idx) {
  const t = S.tiles[idx];
  if (t.t === 'locked') return toast('Ryd klipperne, før du kan bygge her.');
  if (editSel < 0) {
    if (t.t === 'empty') return toast('Vælg først det, du vil flytte.');
    editSel = idx;
    Sound.play('click');
    return;
  }
  if (idx === editSel) { editSel = -1; return; }
  swapTiles(editSel, idx);
  resetAgents();
  burst(idx, '#FF7A1A');
  Sound.play('build');
  editSel = -1;
}

// ---------- Rådgiver og festival ----------
function openAdvisor() {
  const list = adviceList().slice(0, 5);
  showModal(`${icon('col-ida')} Hvad nu?`, `
    <p class="quote">“Her er, hvad jeg ville gøre lige nu.” <span class="muted">— Ida</span></p>
    <div class="list">${list.map((a, i) => `<div class="row">
      <div class="ico">${icon(a.icon)}</div><div class="info"><b>${a.text}</b></div>
      ${a.idx >= 0 || a.act ? `<button class="primary" data-act="advice" data-arg="${i}">${a.act ? 'Åbn' : 'Vis'}</button>` : ''}
    </div>`).join('')}</div>`);
  openAdvisor.list = list;
}

function openFestival() {
  if (!isFestival()) {
    return showModal(`${icon('festbillet')} Marsfestivalen`, `
      <p>Festivalen holdes hver torsdag til søndag fra niveau ${FESTIVAL.level}. Ordrer, kolonister og moderskibet giver festbilletter, som du kan bruge i festivalbutikken.</p>
      <p>Næste festival starter om <b><span data-until="${festivalStarts()}"></span></b>. Du har ${S.tickets} ${icon('festbillet', 'ic-s')}.</p>`);
  }
  const rows = FEST_SHOP.map((f, i) => {
    const name = f.kind === 'decor' ? DECOR[f.id].name : f.kind === 'item' ? `${f.n} × ${ITEMS[f.id].name}` : `${f.n} kreditter`;
    const sub = f.kind === 'decor' ? `Eksklusiv pynt · +${DECOR[f.id].happy} lykke${S.decorInv[f.id] ? ` · du har ${S.decorInv[f.id]} pakket ned` : ''}` : 'Byttes med det samme';
    return `<div class="row"><div class="ico">${icon(f.id)}</div><div class="info"><b>${name}</b><small>${sub}</small></div>
      <button class="primary" data-act="festbuy" data-arg="${i}" ${S.tickets >= f.tickets ? '' : 'disabled'}>${f.tickets} ${icon('festbillet', 'ic-s')}</button></div>`;
  }).join('');
  showModal(`${icon('festbillet')} Marsfestivalen`, `
    <div class="fest-head"><span>Du har <b>${S.tickets}</b> ${icon('festbillet', 'ic-s')}</span><span>Slutter om <span data-until="${festivalEnds()}"></span></span></div>
    <p class="muted small">Hver ordre giver 1–3 billetter, kolonister og containere på moderskibet giver 2.</p>
    <div class="list">${rows}</div>`);
}

// ---------- Dialoger ----------
function openPlant(idx) {
  const rows = Object.entries(CROPS).map(([id, c]) => {
    const locked = c.level > S.level;
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(id)}</div>
      <div class="info"><b>${ITEMS[id].name}${S.genes[id] ? ` <span class="sort">${S.genes[id].names.join(' · ')}</span>` : ''}</b><small>${locked ? `Låses op på niveau ${c.level}` : `${fmtTime(c.time * (hasTrait(id, 'hurtig') ? 0.75 : 1))} · giver ${HARVEST_YIELD + (hasTrait(id, 'rig') ? 1 : 0)} stk · +${c.xp} ${icon('xp', 'ic-s')}`}</small></div>
      <div class="traits">${traitBadges(id)}</div>
      <button class="primary" data-act="plant" data-idx="${idx}" data-arg="${id}" ${locked || S.credits < c.cost ? 'disabled' : ''}>${c.cost} ${icon('coin', 'ic-s')}</button>
    </div>`;
  }).join('');
  const perks = [];
  if (crewCropMult(idx) < 1) perks.push(`${icon('col-bo', 'ic-s')} Bo passer kuplerne her: ${Math.round((1 - crewCropMult(idx)) * 100)} % hurtigere`);
  if (S.life[idx] >= 10) perks.push(`${icon('lav', 'ic-s')} Livszone ${Math.round(S.life[idx])} %: ${Math.round((1 - lifeCrop(idx)) * 100)} % hurtigere`);
  if (policyMult('crop') < 1) perks.push(`${icon('raad', 'ic-s')} Rådets politik: ${Math.round((1 - policyMult('crop')) * 100)} % hurtigere`);
  showModal(`${icon('kuppel')} Drivhuskuppel`,
    `${perks.length ? `<p class="perks">${perks.join(' · ')}</p>` : ''}<p class="muted tip">Tip: Når du har plantet én gang, kan du trække fingeren hen over tomme kupler for at plante det samme igen.</p><div class="list">${rows}</div>`);
}

function queueSlots(tile, now) {
  let html = '';
  for (let i = 0; i < queueMax(tile); i++) {
    const q = tile.queue[i];
    if (!q) { html += '<div class="slot"></div>'; continue; }
    const done = q.end <= now;
    const pct = done ? 100 : Math.max(0, Math.min(100, ((now - q.start) / (q.end - q.start)) * 100));
    html += `<div class="slot ${done ? 'done' : ''}">${icon(q.r)}
      <small>${done ? 'Klar' : q.start > now ? 'Venter' : fmtTime((q.end - now) / 1000)}</small>
      <div class="bar" style="width:${pct}%"></div></div>`;
  }
  return html;
}

function refreshBuilding(idx) {
  const tile = S.tiles[idx];
  const el = $('bslots');
  if (!el || tile.t !== 'b') return;
  const now = Date.now();
  el.innerHTML = queueSlots(tile, now);
  $('bcount').textContent = `Kø (${tile.queue.length}/${queueMax(tile)})`;
  $('bcollect').hidden = !tile.queue.some((q) => q.end <= now);
  document.querySelectorAll('[data-act="make"]').forEach((btn) => {
    const r = RECIPES[btn.dataset.arg];
    btn.disabled = r.level > S.level || tile.queue.length >= queueMax(tile) || !Object.entries(r.in).every(([id, q]) => have(id) >= q);
  });
}

function openBuilding(idx) {
  const tile = S.tiles[idx];
  const b = BUILDINGS[tile.id];
  if (!b.recipes.length) {
    return showModal(`${icon(tile.id)} ${b.name}`, `<p>${b.desc}</p><p class="muted">${S.event.type === 'storm' ? 'Skjoldet er aktivt lige nu.' : 'Skjoldet er klar, når næste storm kommer.'}</p>`);
  }
  const rows = b.recipes.map((rid) => {
    const r = RECIPES[rid];
    const locked = r.level > S.level;
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(rid)}</div>
      <div class="info"><b>${ITEMS[rid].name}</b><small>${locked ? `Låses op på niveau ${r.level}` : `${fmtTime(r.time * buildTime(idx))} · +${r.xp} ${icon('xp', 'ic-s')}`}</small>
      ${locked ? '' : `<div class="needs">${needList(r.in)}</div>`}</div>
      <button class="primary" data-act="make" data-idx="${idx}" data-arg="${rid}">Producér</button>
    </div>`;
  }).join('');
  const perks = [];
  if (tile.id === 'isbor' && S.specials[idx] === 'ice') perks.push(`${icon('iskrater', 'ic-s')} Står på et iskrater: dobbelt så hurtig`);
  if (tile.id === 'isbor' && season().id === 'vinter') perks.push(`${icon('vinter', 'ic-s')} Vinter: dobbelt så hurtig`);
  if (season().id === 'sommer') perks.push(`${icon('sommer', 'ic-s')} Sommer: 15 % hurtigere`);
  if (crewBuildMult(idx) < 1) perks.push(`${icon('col-ida', 'ic-s')} Ida passer maskinerne: ${Math.round((1 - crewBuildMult(idx)) * 100)} % hurtigere`);
  if (policyMult('build') !== 1) perks.push(`${icon('raad', 'ic-s')} Rådets politik: ${Math.round((1 - policyMult('build')) * 100)} % hurtigere`);
  showModal(`${icon(tile.id)} ${b.name}`,
    `${perks.length ? `<p class="perks">${perks.join(' · ')}</p>` : ''}<div class="section-title" id="bcount"></div>
     <div class="queue" id="bslots"></div>
     <p id="bcollect" hidden><button class="primary wide" data-act="collect" data-idx="${idx}">Saml færdige varer</button></p>
     <div class="section-title">Opskrifter</div><div class="list">${rows}</div>
     ${upgradeHTML(idx)}`,
    () => refreshBuilding(idx));
  refreshBuilding(idx);
}

function upgradeHTML(idx) {
  const tile = S.tiles[idx], b = BUILDINGS[tile.id], lvl = tile.lvl || 1;
  const stars = Array.from({ length: UPGRADE_MAX }, (_, k) => `<span class="${k < lvl ? 'on' : ''}">${icon('xp', 'ic-s')}</span>`).join('');
  let body;
  if (lvl >= UPGRADE_MAX) body = '<small>Fuldt opgraderet</small>';
  else if (S.level < 6) body = '<small>Opgraderinger låses op på niveau 6</small>';
  else {
    const c = upgradeCost(b, lvl);
    body = `<small>Niveau ${lvl + 1}: ${QUEUE_MAX + lvl} pladser i køen og ${Math.round(lvl * 15)} % hurtigere</small>
      <div class="needs"><span class="need-chip ${have('jern') >= c.jern ? 'ok' : 'no'}">${icon('jern')}${have('jern')}/${c.jern}</span></div>`;
    return `<div class="section-title">Opgradering</div><div class="row upgrade">
      <div class="ico stars">${stars}</div><div class="info"><b>Niveau ${lvl}</b>${body}</div>
      <button class="primary" data-act="upgrade" data-idx="${idx}" ${S.credits < c.credits || have('jern') < c.jern ? 'disabled' : ''}>${c.credits} ${icon('coin', 'ic-s')}</button></div>`;
  }
  return `<div class="section-title">Opgradering</div><div class="row upgrade"><div class="ico stars">${stars}</div><div class="info"><b>Niveau ${lvl}</b>${body}</div></div>`;
}

function openLab(idx) {
  const a = S.research.active;
  let head = '';
  if (a) {
    const r = RESEARCH[a.id];
    head = `<div class="row active-res"><div class="ico">${icon('lab')}</div><div class="info"><b>Forsker i ${r.name}</b>
      <div class="pbar"><div style="width:${Math.min(100, (Date.now() - a.start) / (a.end - a.start) * 100)}%"></div></div>
      <small>Færdig om <span data-until="${a.end}"></span></small></div></div>`;
  }
  const rows = Object.entries(RESEARCH).map(([id, r]) => {
    const st = researchState(id);
    const ok = st === 'open' && !a && S.credits >= r.credits && Object.entries(r.cost).every(([it, q]) => have(it) >= q);
    const why = st === 'locked' ? (r.level > S.level ? `Låses op på niveau ${r.level}` : `Kræver ${RESEARCH[r.needs].name}`) : r.desc;
    return `<div class="row ${st === 'locked' ? 'locked' : ''} ${st === 'done' ? 'claimed' : ''}">
      <div class="ico">${icon(st === 'done' ? 'medalje' : 'lab')}</div>
      <div class="info"><b>${r.name}</b><small>${why} · ${fmtTime(r.time)}</small>
      ${st === 'open' ? `<div class="needs">${needList(r.cost)}</div>` : ''}</div>
      ${st === 'done' ? '<button disabled>Færdig</button>' : st === 'active' ? '<button disabled>I gang</button>'
        : `<button class="primary" data-act="research" data-arg="${id}" ${ok ? '' : 'disabled'}>${r.credits} ${icon('coin', 'ic-s')}</button>`}
    </div>`;
  }).join('');
  const m = S.mystery;
  const myst = `<div class="section-title">Mars-mysteriet · ${m.n}/${MYSTERY.length} fragmenter</div>
    <div class="row myst">${icon('fragment', 'ic-l')}<div class="info">${m.active
      ? `<b>Afkoder fragment ${m.n + 1}</b><div class="pbar"><div style="width:${Math.min(100, (Date.now() - m.active.start) / (m.active.end - m.active.start) * 100)}%"></div></div><small>Færdig om <span data-until="${m.active.end}"></span></small>`
      : m.n >= MYSTERY.length ? '<b>Signalet er afkodet</b><small>Byg Monolitten, hvis du ikke allerede har gjort det.</small>'
      : `<b>Afkod et fragment af signalet fra De Første</b><small>Kræver et artefakt fra ruiner eller udforskning. ${DECODE.min} min.</small><div class="needs">${needList(DECODE.cost)}</div>`}</div>
      ${!m.active && m.n < MYSTERY.length ? `<button class="primary" data-act="decode" ${Object.entries(DECODE.cost).every(([it, q]) => have(it) >= q) ? '' : 'disabled'}>Afkod</button>` : ''}</div>
    ${m.n ? `<details class="journal-box"><summary>Læs de afkodede fragmenter</summary><ol class="journal">${MYSTERY.slice(0, m.n).map((f) => `<li><b>${COLONISTS[f.who].name}:</b> ${f.text}</li>`).join('')}</ol></details>` : ''}`;
  showModal(`${icon('lab')} Forskningslab`, `${head}${myst}<div class="section-title">Forskning</div><p class="muted tip">Forskning koster krystaller og artefakter fra roverens ekspeditioner. Fordelene gælder for altid.</p><div class="list">${rows}</div>`);
}

function openDecor(idx) {
  const d = DECOR[S.tiles[idx].id];
  showModal(`${icon(S.tiles[idx].id)} ${d.name}`, `
    <p>+${d.happy} ${icon('lykke', 'ic-s')} lykke. Koloniens lykke er nu <b>${happiness()}</b> af ${HAPPY_MAX}, så alle ordrer betaler <b>${happiness()} %</b> mere.</p>
    <button class="wide" data-act="removedeco" data-idx="${idx}">Fjern og få ${Math.round(d.cost / 2)} ${icon('coin', 'ic-s')} tilbage</button>`);
}

function openGarage() {
  const x = S.expedition;
  if (x && Date.now() >= x.end) {
    const res = finishExpedition();
    const list = res.found.map(([it, n]) => `<span>${icon(it)} ${n} × ${it === 'coin' ? 'kreditter' : ITEMS[it].name}</span>`).join('');
    showModal(`${icon('rover')} Roveren er tilbage!`, `
      <p>Fra <b>${res.e.name}</b> har roveren fundet:${res.first ? ' <span class="up">Ny sektor kortlagt!</span>' : ''}</p>
      <div class="unlocks">${list || '<span>Kun støv denne gang</span>'}</div>
      <button class="primary wide" data-act="explore">Se kortet</button>`);
    return;
  }
  openExplore();
}

function openExplore(sel) {
  const x = S.expedition, now = Date.now();
  const cells = SECTORS.map((sec) => {
    const seen = sectorSeen(sec.i), done = S.explore.done[sec.i], home = sec.i === SECTOR_HOME;
    const here = x && x.sector === sec.i;
    const cls = ['sector', seen ? 'seen' : 'fog', done ? 'done' : '', home ? 'home' : '', sel === sec.i ? 'sel' : '', here ? 'here' : ''].join(' ');
    return `<button class="${cls}" data-act="sector" data-arg="${sec.i}" ${seen ? '' : 'disabled'} title="${seen ? sec.name : 'Ukendt'}">
      ${seen ? icon(SECTOR_TYPES[sec.type].icon, 'ic-m') : '<span class="q">?</span>'}${here ? icon('rover', 'rv') : ''}${done && !home ? '<i>✓</i>' : ''}</button>`;
  }).join('');
  let panel = '';
  if (x && x.sector != null) {
    panel = `<div class="row"><div class="ico">${icon('rover')}</div><div class="info"><b>På vej til ${SECTORS[x.sector].name}</b><small>Tilbage om <span data-until="${x.end}"></span></small></div></div>`;
  } else if (sel != null && sel !== SECTOR_HOME) {
    const sec = SECTORS[sel], type = SECTOR_TYPES[sec.type], trip = sectorTrip(sel), ready = sectorReady(sel, now);
    const first = !S.explore.done[sel];
    const loot = type.loot.map(([it, , , ch]) => `${icon(it, 'ic-s')}${ch < 1 ? ` ${Math.round(ch * 100)} %` : ''}`).join(' ');
    const ok = owns('garage') && ready && Object.entries(trip.cost).every(([it, q]) => have(it) >= q);
    panel = `<div class="row"><div class="ico">${icon(type.icon)}</div>
      <div class="info"><b>${sec.name}</b><small>${type.name} · ${fmtTime(trip.min * 60 * (hasTech('rover') ? 0.6 : 1))} · fund: ${loot}${first ? '' : ' · halvt udbytte ved genbesøg'}${ready ? '' : ` · klar om ${fmtTime((S.explore.done[sel] + REVISIT_MS - now) / 1000)}`}</small>
      <div class="needs">${needList(trip.cost)}</div></div>
      <button class="primary" data-act="sendrover" data-arg="${sel}" ${ok ? '' : 'disabled'}>Send</button></div>`;
  } else {
    panel = `<p class="muted small">Tryk på en sektor ved siden af det kortlagte område. Hver sektor, du udforsker, afslører naboerne. Navngivne steder er rigtige steder på Mars.</p>`;
  }
  const doneN = Object.keys(S.explore.done).length;
  showModal(`${icon('rover')} Udforsk Mars`, `
    <p class="muted small">${doneN} af ${SECTORS.length - 1} sektorer kortlagt${owns('garage') ? '' : ' · Byg en rovergarage for at sende roveren ud'}</p>
    <div class="mars-map">${cells}</div>${panel}`);
}

// ---------- Terraforming, energi, befolkning, mysteriet ----------
async function openTerraform() {
  const draw = (r) => {
    const total = S.terraTotal || 0, st = terraStage(total), next = TERRA_STAGES[st + 1];
    const pct = next ? (total - TERRA_STAGES[st].at) / (next.at - TERRA_STAGES[st].at) * 100 : 100;
    const stages = TERRA_STAGES.map((t, i) => `<div class="tstage ${i <= st ? 'on' : ''}"><b>${i}</b><span>${t.name}</span></div>`).join('');
    const top = r && r.top ? r.top.map((p, i) => `<div class="lb-row ${p.me ? 'me' : ''}"><span class="lb-place">${i + 1}</span><span class="lb-name">${escapeHtml(p.name)}</span><span class="lb-score">${p.points} <small>point</small></span></div>`).join('') : '';
    const inputs = Object.entries(TERRA_ITEMS).map(([id, pts]) => `<label class="tin">${icon(id)}<span>${ITEMS[id].name}<small>${pts} point · du har ${have(id)}</small></span>
      <input type="number" min="0" max="${Math.min(id === 'krystal' ? 50 : 500, have(id))}" value="0" data-terra="${id}"></label>`).join('');
    showModal(`${icon('terraform')} Terraforming af Mars`, `
      <p class="small">Alle kolonister på Mars arbejder sammen om at give planeten liv igen. Ilt, vand, alger og krystaller gør atmosfæren tykkere og varmere. Når Mars når et nyt trin, ændrer det sig for alle spillere.</p>
      <div class="terra-now"><b>Trin ${st}: ${TERRA_STAGES[st].name}</b><small>${TERRA_STAGES[st].desc}</small>
        <div class="pbar big"><div style="width:${pct}%"></div></div>
        <small>${total.toLocaleString('da-DK')} point${next ? ` · ${(next.at - total).toLocaleString('da-DK')} til "${next.name}"` : ' · Mars er blå igen!'}${r && r.players ? ` · ${r.players} kolonister har bidraget` : ''}</small></div>
      <div class="tstages">${stages}</div>
      <div class="section-title">Dit bidrag · ${(S.terraMine || 0).toLocaleString('da-DK')} point</div>
      <div class="terra-form">${inputs}</div>
      <p class="muted small">Du får 20 % over markedsværdien for det, du giver, og erfaring. Højst 3000 point i timen.</p>
      <button class="primary wide" data-act="terragive">Send til atmosfæren</button>
      ${top ? `<div class="section-title">Største bidragydere</div><div class="lb">${top}</div>` : ''}`);
  };
  draw(null);
  const r = await Cloud.terraStatus();
  if (!modal.hidden && $('modalTitle').textContent.includes('Terraforming')) draw(r);
}

async function terraGive() {
  const items = {};
  document.querySelectorAll('[data-terra]').forEach((el) => { const n = Math.floor(Number(el.value) || 0); if (n > 0) items[el.dataset.terra] = Math.min(n, have(el.dataset.terra)); });
  if (!Object.keys(items).length) return fail('Vælg hvor meget du vil give.');
  try {
    const r = await Cloud.terraContribute(items);
    if (!r || !r.ok) return fail(r && r.reason === 'limit' ? `Du kan give ${r.left} point mere i denne time.` : 'Bidraget kunne ikke sendes.');
    let value = 0;
    for (const [id, n] of Object.entries(items)) { addItem(id, -n); value += ITEMS[id].value * n; }
    const credits = Math.round(value * 1.2);
    earn(credits); addXP(Math.max(1, Math.round(r.points / 10)));
    save();
    Sound.play('level');
    toast(`${icon('terraform')} +${r.points} point til Mars. Du fik ${credits} ${icon('coin')}.`, 'good', 4000);
    openTerraform();
  } catch (e) { fail('Ingen forbindelse lige nu.'); }
}

function openEnergy() {
  const p = powerStatus();
  const ok = p.ratio >= 1;
  const n = (id) => S.tiles.filter((t) => t.t === 'b' && t.id === id).length;
  showModal(`${icon('energi')} Energinet`, `
    <div class="terra-now ${ok ? '' : 'bad'}"><b>${p.prod} kW produceret · ${p.use} kW brugt</b>
      <small>${ok ? 'Overskud: al produktion går 10 % hurtigere.' : `Underskud: produktion og dyr er ${Math.round((p.mult - 1) * 100)} % langsommere. Byg flere solpaneler eller vindmøller.`}</small></div>
    <div class="list">
      <div class="row"><div class="ico">${icon('rocket')}</div><div class="info"><b>Landingsfartøjets reaktor</b><small>${p.parts.lander} kW · vokser med dit niveau</small></div></div>
      <div class="row"><div class="ico">${icon('solpanel')}</div><div class="info"><b>${n('solpanel')} solpaneler</b><small>${Math.round(p.parts.sol)} kW · solen giver ${Math.round(p.sun * 100)} % lige nu (nul om natten, mindre om vinteren og i storme)</small></div></div>
      <div class="row"><div class="ico">${icon('vindmolle')}</div><div class="info"><b>${n('vindmolle')} vindmøller</b><small>${Math.round(p.parts.vind)} kW · vinden giver ${Math.round(p.wind * 100)} % (mest om natten og i støvstorme)</small></div></div>
      <div class="row"><div class="ico">${icon('batteribank')}</div><div class="info"><b>${n('batteribank')} batteribanker</b><small>${Math.round(p.parts.batteri)} kW · aflader, når solen er svag</small></div></div>
    </div>
    <p class="muted small">Byg energi på ryddede felter. Hver bygning bruger 2 kW (mere når den er opgraderet), labbet 3, krystalboret 4, og dyr og habitater 1.</p>`);
}

function openPop() {
  const need = popNeeds(), cap = popCap(), reserve = foodReserve();
  const sols = need.food ? Math.floor(Math.min(reserve / need.food, need.ilt ? have('ilt') / need.ilt : Infinity)) : '∞';
  const nextSol = (solIndex() + 1) * DAY_MS;
  showModal(`${icon('befolkning')} Befolkning og livsstøtte`, `
    <div class="terra-now ${S.pop.moral < 40 ? 'bad' : ''}"><b>${S.pop.n} af ${cap} kolonister · moral ${S.pop.moral} %</b>
      <div class="pbar big"><div style="width:${S.pop.moral}%"></div></div>
      <small>${S.pop.moral >= 60 ? (S.pop.n < cap ? 'Kolonisterne er glade, og der flytter flere ind hver sol.' : 'Kolonisterne er glade. Byg et habitat for at få plads til flere.') : 'Moralen er lav. Ingen flytter ind, før alle får ilt og mad.'}</small></div>
    <div class="list">
      <div class="row"><div class="ico">${icon('ilt')}</div><div class="info"><b>${need.ilt} ilt pr. sol</b><small>Du har ${have('ilt')}. Bioreaktoren laver ilt af alger.</small></div></div>
      <div class="row"><div class="ico">${icon('gryde')}</div><div class="info"><b>${need.food} madpoint pr. sol</b><small>Du har ${reserve} madpoint (${sols} sol). Æg og mælk giver 1, rumgryde og brød 2${S.pop.rich ? ', fine retter op til 4' : ''}.</small></div></div>
      <div class="row"><div class="ico">${icon('box')}</div><div class="info"><b>Spis også fine retter</b><small>Suppe, pizza, tærte, pandekager, ost og latte. Ellers spises kun basisvarer.</small></div>
        <button data-act="poprich">${S.pop.rich ? 'Til' : 'Fra'}</button></div>
    </div>
    <div class="list">
      <div class="row"><div class="ico">${icon('lav')}</div><div class="info"><b>Livszone ${lifeAvg()} %</b><small>${lifeMoral() ? `Den grønne jord giver +${lifeMoral()} moral pr. sol.` : 'Ved 40 % giver den grønne jord +2 moral pr. sol, ved 70 % +4.'}</small></div></div>
      ${crewMoral() ? `<div class="row"><div class="ico">${icon('col-dina')}</div><div class="info"><b>Dina passer habitatet</b><small>+${crewMoral()} moral pr. sol</small></div></div>` : ''}
      ${policySum('moral') ? `<div class="row"><div class="ico">${icon('raad')}</div><div class="info"><b>Rådets politikker</b><small>${policySum('moral') > 0 ? '+' : ''}${policySum('moral')} moral pr. sol</small></div></div>` : ''}
    </div>
    <p class="muted small">Landingsfartøjet holder de første ${POP_BASE} i live. Hvert habitat giver plads til ${POP_PER_HABITAT} mere. Hver kolonist ud over de første 4 gør produktionen 1 % hurtigere (højst 20 %). Næste sol om <span data-until="${nextSol}"></span>.</p>`);
}

// Lyd: fire skydere og lydløs.
const SOUND_SLIDERS = [
  ['music', 'Musik', 'musik'], ['sfx', 'Effekter', 'sound'], ['amb', 'Vind og maskiner', 'storm'], ['voice', 'Kolonisternes stemmer', 'col-ida'],
];
function openSound() {
  const v = Sound.vol;
  showModal(`${icon('sound')} Lyd`, `
    <div class="sliders">${SOUND_SLIDERS.map(([k, name, ic]) => `
      <label class="slider"><span>${icon(ic, 'ic-s')} ${name}</span>
      <input type="range" min="0" max="100" step="5" value="${Math.round(v[k] * 100)}" data-vol="${k}" aria-label="${name}"></label>`).join('')}
    </div>
    <p class="muted">Lydeffekter og jingler: Kenney.nl (CC0). Stemmer lavet med ElevenLabs.</p>
    <button class="wide" data-act="soundmute">${Sound.muted ? 'Slå lyden til' : 'Slå al lyd fra'}</button>`);
  const voiceIds = Object.keys(COLONISTS).filter((k) => COLONISTS[k].level <= S.level);
  $('modalBody').querySelectorAll('[data-vol]').forEach((el) => {
    el.addEventListener('input', () => Sound.setVol(el.dataset.vol, el.value / 100));
    el.addEventListener('change', () => {
      if (el.dataset.vol === 'sfx') Sound.play('coin');
      if (el.dataset.vol === 'voice') Sound.say(voiceIds[Math.floor(Math.random() * voiceIds.length)] + '_hej', { force: true });
    });
  });
}

function showFragment(i) {
  const f = MYSTERY[i];
  showModal(`${icon('fragment')} Fragment ${i + 1} af ${MYSTERY.length}`, `
    <div class="colonist"><div class="portrait">${icon('col-' + f.who, 'ic-xl')}</div><div class="col-body"><b>${COLONISTS[f.who].name}</b><p class="quote big">“${f.text}”</p></div></div>
    ${i + 1 >= MYSTERY.length ? '<p><b>Alle fragmenter er afkodet.</b> Nu kan du bygge Monolitten på et ryddet felt.</p>' : ''}
    <button class="primary wide" data-act="close">Videre</button>`);
  Sound.say('mys' + i, { force: true });
}

function openMonolith() {
  const today = dayStr(new Date()), used = S.timewave === today;
  const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
  showModal(`${icon('monolit')} Monolitten`, `
    <p class="quote big">“${MONOLITH_DONE}”</p>
    <div class="terra-now"><b>Tidsbølgen</b><small>Én gang i døgnet kan Monolitten gøre alle afgrøder modne og alle bygninger og dyr færdige på én gang.</small></div>
    <button class="primary wide" data-act="timewave" ${used ? 'disabled' : ''}>${used ? `Klar igen om <span data-until="${tomorrow.getTime()}"></span>` : 'Udløs tidsbølgen'}</button>`);
  Sound.say('monolit', { cooldown: 10 * 60000 });
}

function orderCard(o, i) {
  const ok = canFulfil(o);
  return `<div class="order ${ok ? 'ready' : ''} ${o.express ? 'express' : ''}">
    <div class="order-head">${icon('rocket', 'ic-m')}${o.express ? `<span class="tag">Ekspres · <span data-until="${o.until}"></span></span>` : ''}</div>
    <div class="needs">${needList(o.items)}</div>
    <div class="reward">+${orderPay(o.credits)} ${icon('coin', 'ic-s')} · +${o.xp} ${icon('xp', 'ic-s')}</div>
    <div class="btns">
      <button class="primary" data-act="deliver" data-arg="${i}" ${ok ? '' : 'disabled'}>Lever</button>
      <button data-act="discard" data-arg="${i}" title="Kassér ordren" aria-label="Kassér ordren">✕</button>
    </div>
  </div>`;
}

function openOrders() {
  let col = '';
  if (S.colonist) {
    const c = S.colonist, def = COLONISTS[c.id], ok = canFulfil(c);
    Sound.say(c.id + '_hej', { cooldown: 5 * 60000 });
    col = `<div class="colonist ${ok ? 'ready' : ''}">
      <div class="portrait">${icon('col-' + c.id, 'ic-xl')}</div>
      <div class="col-body">
        <b>${def.name}</b>
        <p class="quote">“${colonistLine(c.id)}”</p>
        <div class="needs">${needList(c.items)}</div>
        <div class="col-foot"><span class="reward">+${orderPay(c.credits)} ${icon('coin', 'ic-s')} · +${c.xp} ${icon('xp', 'ic-s')}</span>
        <button class="primary" data-act="colonist" ${ok ? '' : 'disabled'}>Giv</button></div>
      </div>
    </div>`;
  }
  let ship = '';
  if (S.ship) {
    const sh = S.ship, left = sh.crates.filter((c) => !c.done).length;
    ship = `<div class="ship-box">
      <div class="ship-head">${icon('moderskib', 'ic-l')}<div><b>Moderskibet</b>
      <small>Flyver om <span data-until="${sh.until}"></span> · ${left} af ${sh.crates.length} containere mangler · bonus +${sh.bonus} ${icon('coin', 'ic-s')} og ${sh.krystal} ${icon('krystal', 'ic-s')}</small></div></div>
      <div class="crates">${sh.crates.map((c, i) => `<div class="crate ${c.done ? 'done' : have(c.item) >= c.n ? 'ready' : ''}">
        ${icon(c.done ? 'container' : c.item, 'ic-m')}
        <small>${c.done ? 'Fyldt' : `${Math.min(have(c.item), c.n)}/${c.n}`}</small>
        ${c.done ? '' : `<button class="primary" data-act="crate" data-arg="${i}" ${have(c.item) >= c.n ? '' : 'disabled'}>Læs</button>`}
      </div>`).join('')}</div>
    </div>`;
  } else if (S.level >= SHIP.level && S.tut >= TUTORIAL.length) {
    ship = `<p class="muted small">${icon('moderskib', 'ic-s')} Moderskibet kommer igen om <span data-until="${S.shipNext}"></span>.</p>`;
  }
  showModal(`${icon('rocket')} Landingspladsen`,
    `${ship}${col}<div class="section-title">Fragtskibe${payMult() > 1 ? ` · +${Math.round((payMult() - 1) * 100)} % bonus` : ''}</div>
     <div class="orders">${S.orders.map(orderCard).join('')}</div>`);
}

function priceTag(p) {
  const arrow = p.trend > 0.05 ? '<span class="up">▲</span>' : p.trend < -0.05 ? '<span class="down">▼</span>' : '';
  return `${arrow}${p.sell}${icon('coin', 'ic-s')}`;
}

function openInventory(tab = 'lager') {
  const tabs = `<div class="tabs"><button class="${tab === 'lager' ? 'on' : ''}" data-act="invtab" data-arg="lager">${icon('box', 'ic-s')} Lager</button>
    <button class="${tab === 'boers' ? 'on' : ''}" data-act="invtab" data-arg="boers">${icon('boers', 'ic-s')} Rumbørsen</button>
    <button class="${tab.startsWith('post') ? 'on' : ''}" data-act="invtab" data-arg="post">${icon('rumposten', 'ic-s')} Rumposten</button></div>`;
  if (tab === 'boers') return openMarket(tabs);
  if (tab.startsWith('post')) return openPost(tabs, tab);
  const ids = Object.keys(ITEMS).filter((id) => have(id) > 0);
  const used = invTotal(), c = cap(), cost = siloCost(S.silo);
  const rows = ids.map((id) => {
    const p = marketPrice(id);
    return `<div class="inv-item ${p.hot ? 'hot' : ''}">
      ${icon(id, 'ic-l')}
      <div class="info"><b>${have(id)}</b><small>${ITEMS[id].name}</small></div>
      <div class="sellbtns"><button data-act="sell" data-arg="${id}" title="Sælg 1">${priceTag(p)}</button>
      ${have(id) > 1 ? `<button data-act="sellall" data-arg="${id}" title="Sælg alle">Alle</button>` : ''}</div>
    </div>`;
  }).join('');
  showModal(`${icon('box')} Lager`,
    `${tabs}<div class="silo">
      <div class="silo-bar"><div style="width:${Math.min(100, used / c * 100)}%" class="${used >= c ? 'full' : ''}"></div></div>
      <div class="silo-row"><span><b>${used}/${c}</b> pladser brugt</span>
      <button class="primary" data-act="silo" ${S.credits < cost ? 'disabled' : ''}>Udvid +30 · ${cost} ${icon('coin', 'ic-s')}</button></div>
    </div>
    <div class="inv">${rows || '<p class="muted">Lageret er tomt. Plant noget i kuplerne!</p>'}</div>
    <p class="muted small">Priserne følger Rumbørsen og skifter hver time. ▲ betyder, at prisen er steget siden sidste time.</p>`);
}

function openMarket(tabs) {
  const hot = demandToday();
  const hotRows = hot.map((id) => {
    const p = marketPrice(id);
    return `<div class="row hot"><div class="ico">${icon(id)}</div>
      <div class="info"><b>${ITEMS[id].name}</b><small>80 % over normal pris i dag · du har ${have(id)}</small></div>
      <button class="primary" data-act="sell" data-arg="${id}" data-tab="boers" ${have(id) ? '' : 'disabled'}>Sælg ${priceTag(p)}</button></div>`;
  }).join('');
  const buyRows = MARKET_BUY.filter((id) => !(id in CROPS) || CROPS[id].level <= S.level).map((id) => {
    const p = marketPrice(id);
    const arrow = p.trend > 0.05 ? '<span class="up">▲</span>' : p.trend < -0.05 ? '<span class="down">▼</span>' : '';
    return `<div class="inv-item">${icon(id, 'ic-l')}<div class="info"><b>${have(id)}</b><small>${ITEMS[id].name}</small></div>
      <div class="sellbtns"><button data-act="buy" data-arg="${id}" title="Køb 1">${arrow}${p.buy}${icon('coin', 'ic-s')}</button>
      <button data-act="buy5" data-arg="${id}" title="Køb 5">×5</button></div></div>`;
  }).join('');
  const nextHour = (hourIndex() + 1) * MARKET_HOUR;
  showModal(`${icon('boers')} Rumbørsen`, `${tabs}
    <p class="muted small">Nye priser om <span data-until="${nextHour}"></span>.</p>
    <div class="section-title">Dagens efterspørgsel</div><div class="list">${hotRows}</div>
    <div class="section-title">Køb råvarer</div><div class="inv">${buyRows}</div>`);
}

function openBuild(idx) {
  const pc = plotCost(countTiles('plot'));
  let rows = `<div class="row">
      <div class="ico">${icon('kuppel')}</div>
      <div class="info"><b>Drivhuskuppel</b><small>Her dyrker du afgrøder</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="plot" ${S.credits < pc ? 'disabled' : ''}>${pc} ${icon('coin', 'ic-s')}</button>
    </div>`;
  for (const [id, a] of Object.entries(ANIMALS)) {
    const locked = a.level > S.level;
    rows += `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(id)}</div>
      <div class="info"><b>${a.name}</b><small>${locked ? `Låses op på niveau ${a.level}` : `${PEN_SIZE} ${a.animalName.toLowerCase()}, der giver ${ITEMS[a.product].name.toLowerCase()}, når de får foder`}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}" ${locked || S.credits < a.cost ? 'disabled' : ''}>${a.cost} ${icon('coin', 'ic-s')}</button>
    </div>`;
  }
  const sp = S.specials[idx];
  rows = `<div class="row">
      <div class="ico">${icon('lav')}</div>
      <div class="info"><b>Så lav</b><small>Livszone ${Math.round(S.life[idx] || 0)} % · +45 % her og +15 % omkring. Grøn jord får afgrøder til at gro op til 20 % hurtigere.</small></div>
      <button class="primary" data-act="sow" data-idx="${idx}" ${have('alge') >= LIFE_SOW.alge ? '' : 'disabled'}>${LIFE_SOW.alge} ${icon('alge', 'ic-s')}</button>
    </div>` + rows;
  if (sp) rows = `<div class="row special"><div class="ico">${icon(SPECIALS[sp].sprite)}</div><div class="info"><b>${SPECIALS[sp].name}</b><small>${SPECIALS[sp].desc}</small></div></div>` + rows;
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const built = !b.multi && owns(id), locked = b.level > S.level;
    const wrongGround = (b.needs && sp !== b.needs) || (b.monolith && S.mystery.n < MYSTERY.length);
    const extra = Object.entries(b.items || {}).map(([it, q]) => ` + ${q} ${ITEMS[it].name.toLowerCase()}`).join('');
    const what = b.monolith && S.mystery.n < MYSTERY.length ? `Kræver alle 6 fragmenter afkodet (${S.mystery.n}/6)`
      : wrongGround ? `Kan kun bygges på en ${SPECIALS[b.needs].name.toLowerCase()}`
      : !b.recipes.length ? b.desc + extra
      : 'Laver ' + b.recipes.map((r) => ITEMS[r].name.toLowerCase()).join(', ');
    rows += `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(id)}</div>
      <div class="info"><b>${b.name}</b><small>${built ? 'Allerede bygget' : locked ? `Låses op på niveau ${b.level}` : what}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}" ${built || locked || wrongGround || S.credits < b.cost ? 'disabled' : ''}>${b.cost} ${icon('coin', 'ic-s')}</button>
    </div>`;
  }
  let deco = '';
  for (const [id, d] of Object.entries(DECOR)) {
    if (d.fest) continue;
    const locked = d.level > S.level;
    deco += `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(id)}</div>
      <div class="info"><b>${d.name}</b><small>${locked ? `Låses op på niveau ${d.level}` : `+${d.happy} lykke · ordrer betaler ${d.happy} % mere`}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}" ${locked || S.credits < d.cost ? 'disabled' : ''}>${d.cost} ${icon('coin', 'ic-s')}</button>
    </div>`;
  }
  let fest = '';
  for (const [id, n] of Object.entries(S.decorInv || {})) {
    if (!n) continue;
    fest += `<div class="row"><div class="ico">${icon(id)}</div>
      <div class="info"><b>${DECOR[id].name}</b><small>Festivalpynt · +${DECOR[id].happy} lykke · du har ${n}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}">Sæt op</button></div>`;
  }
  showModal(`${icon('box')} Byg her`, `<div class="list">${rows}</div>
    ${fest ? `<div class="section-title">Festivalpynt</div><div class="list">${fest}</div>` : ''}
    <div class="section-title">Pynt · lykke ${happiness()}/${HAPPY_MAX}</div><div class="list">${deco}</div>`);
}

function openClear(idx) {
  const sp = S.specials[idx];
  const cost = clearCost(S.cleared) * (sp ? 2 : 1);
  if (sp) {
    return showModal(`${icon(SPECIALS[sp].sprite)} ${SPECIALS[sp].name}`, `<p>Under klipperne her gemmer sig en ${SPECIALS[sp].name.toLowerCase()}. ${SPECIALS[sp].desc}</p>
      <button class="primary wide" data-act="clear" data-idx="${idx}" ${S.credits < cost ? 'disabled' : ''}>Ryd feltet · ${cost} ${icon('coin', 'ic-s')}</button>`);
  }
  showModal(`${icon('rock')} Klipper`, `<p>Ryd klipperne, og gør plads til flere kupler og bygninger. Måske finder du jernmalm.</p>
    <button class="primary wide" data-act="clear" data-idx="${idx}" ${S.credits < cost ? 'disabled' : ''}>Ryd feltet · ${cost} ${icon('coin', 'ic-s')}</button>`);
}

function openColony(tab = 'goals') {
  const tabs = [['goals', 'Mål'], ['board', 'Rangliste'], ['medals', 'Medaljer'], ['robots', 'Robotter'], ['people', 'Kolonister']];
  if (S.level >= PRESTIGE_LEVEL || S.prestige) tabs.push(['phobos', 'Phobos']);
  let body = '';
  if (tab === 'goals') {
    const streak = S.daily.streak || 0, day = ((Math.max(1, streak) - 1) % 7) + 1;
    body += `<div class="section-title">Daglig belønning · ${streak} ${streak === 1 ? 'dag' : 'dage'} i træk</div><div class="days">`;
    for (let d = 1; d <= 7; d++) body += `<div class="day ${d <= day ? 'got' : ''} ${d === 7 ? 'big' : ''}">${icon(d === 7 ? 'gift' : 'coin', 'ic-m')}<small>Dag ${d}</small></div>`;
    body += `</div><p class="muted small">Kom tilbage hver dag. Dag 7 giver en stor gave.</p>`;
    const r = weeklyReward();
    body += `<div class="section-title">Ugens mål</div><div class="list">`;
    S.weekly.tasks.forEach((t, i) => {
      const w = WEEKLY_TYPES[t.type], done = t.progress >= t.target;
      body += `<div class="row ${t.claimed ? 'claimed' : ''}">
        <div class="ico">${icon(w.icon)}</div>
        <div class="info"><b>${w.label}</b>
          <div class="pbar"><div style="width:${t.progress / t.target * 100}%"></div></div>
          <small>${t.progress}/${t.target} · +${r.credits} ${icon('coin', 'ic-s')} +${r.xp} ${icon('xp', 'ic-s')}</small></div>
        <button class="primary" data-act="claim" data-arg="${i}" ${done && !t.claimed ? '' : 'disabled'}>${t.claimed ? 'Hentet' : 'Hent'}</button>
      </div>`;
    });
    body += '</div>';
  } else if (tab === 'phobos') {
    const n = S.prestige || 0;
    body += `<div class="colonist"><div class="portrait">${icon('phobos', 'ic-xl')}</div><div class="col-body">
      <b>${n ? `${n} ${n === 1 ? 'stjerne' : 'stjerner'} fra Phobos` : 'Ny koloni på Phobos'}</b>
      <p class="quote">Når kolonien på Mars er færdigbygget, kan du starte forfra på Mars' måne Phobos. Du tager erfaringen med dig.</p></div></div>
      <div class="section-title">Hver ny koloni giver</div>
      <div class="list"><div class="row"><div class="ico">${icon('coin')}</div><div class="info"><b>+10 % på alle ordrer</b><small>Nu: +${Math.round(prestigePay(n) * 100)} %</small></div></div>
      <div class="row"><div class="ico">${icon('sprout')}</div><div class="info"><b>Afgrøder gror 5 % hurtigere</b><small>Nu: ${Math.round((1 - prestigeGrowth(n)) * 100)} % hurtigere (højst 25 %)</small></div></div>
      <div class="row"><div class="ico">${icon('coin')}</div><div class="info"><b>${500 * (n + 1)} kreditter at starte med</b><small>og en grå månekoloni med nye klipper og hemmeligheder</small></div></div></div>
      <p class="muted small">Du beholder medaljer, missioner, statistik, festbilletter, festivalpynt og dit navn. Kortet, lageret, bygninger, forskning og robotter starter forfra.</p>
      <button class="primary wide" data-act="phobos" ${S.level >= PRESTIGE_LEVEL ? '' : 'disabled'}>${S.level >= PRESTIGE_LEVEL ? 'Rejs til Phobos' : `Kræver niveau ${PRESTIGE_LEVEL}`}</button>`;
  } else if (tab === 'board') {
    body += `<div class="tabs sub">${[['week', 'Ugens leverancer'], ['level', 'Niveau'], ['arcade', 'Asteroidejagt'], ['medals', 'Medaljer']]
      .map(([k, l]) => `<button class="${k === openColony.board ? 'on' : ''}" data-act="board" data-arg="${k}">${l}</button>`).join('')}</div>
      <div id="boardList"><p class="muted">Henter ranglisten …</p></div>
      <p class="muted small">Du hedder <b>${escapeHtml(S.playerName)}</b> på ranglisten. Du kan skifte navn under ? → Din koloni i skyen.</p>`;
    setTimeout(() => loadBoard(openColony.board), 0);
  } else if (tab === 'medals') {
    const got = MEDALS.filter((m) => S.medals[m.id]).length;
    body += `<p class="muted small">${got} af ${MEDALS.length} medaljer</p><div class="medals">`;
    for (const m of MEDALS) {
      body += `<div class="medal ${S.medals[m.id] ? 'got' : ''}">${icon('medalje', 'ic-l')}<b>${m.name}</b><small>${m.desc}</small><small class="rw">+${m.reward} ${icon('coin', 'ic-s')}</small></div>`;
    }
    body += '</div>';
  } else if (tab === 'robots') {
    body += '<div class="list">';
    for (const [id, r] of Object.entries(ROBOTS)) {
      const locked = r.level > S.level, owned = S.robots[id];
      const extra = Object.entries(r.items).map(([it, q]) => ` + ${q} ${icon(it, 'ic-s')}`).join('');
      body += `<div class="row ${locked ? 'locked' : ''}">
        <div class="ico">${icon(id)}</div>
        <div class="info"><b>${r.name}</b><small>${locked ? `Låses op på niveau ${r.level}` : r.desc}</small></div>
        <button class="primary" data-act="robot" data-arg="${id}" ${owned || locked ? 'disabled' : ''}>${owned ? 'Arbejder' : `${r.cost} ${icon('coin', 'ic-s')}${extra}`}</button>
      </div>`;
    }
    body += '</div><p class="muted small">Robotter arbejder også, mens du er væk.</p>';
  } else {
    body += '<div class="list">';
    for (const [id, c] of Object.entries(COLONISTS)) {
      const locked = c.level > S.level, n = S.story[id];
      body += `<details class="row people ${locked ? 'locked' : ''}" ${locked ? '' : 'open'}>
        <summary><div class="ico">${icon('col-' + id, 'ic-l')}</div>
        <div class="info"><b>${c.name}</b><small>${locked ? `Ankommer på niveau ${c.level}` : `Kapitel ${n}/${c.lines.length}`}</small></div></summary>
        ${locked ? '' : `<ol class="journal">${c.lines.slice(0, n).map((l) => `<li>${l}</li>`).join('') || '<li class="muted">Hjælp med en opgave for at høre mere.</li>'}</ol>`}
      </details>`;
    }
    body += '</div>';
  }
  showModal(`${icon('goal')} Kolonien${S.mayor ? ' · Koloniborgmester 🏅' : ''}`,
    `<div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="tab" data-arg="${k}">${l}</button>`).join('')}</div>${body}`);
}

openColony.board = 'week';
async function loadBoard(board) {
  const el = $('boardList');
  if (!el) return;
  const isWeek = board === 'week';
  if (isWeek) board = 'week:' + weekId();
  try {
    const res = await Cloud.leaderboard(board);
    if (!$('boardList')) return;
    const unit = board === 'level' ? 'niveau' : board === 'arcade' ? 'point' : isWeek ? 'leverancer' : 'medaljer';
    const rows = (res.top || []).map((r) => `<div class="lb-row ${r.me ? 'me' : ''}">
      <span class="lb-place">${r.place <= 3 ? ['🥇', '🥈', '🥉'][r.place - 1] : r.place}</span>
      <span class="lb-name">${escapeHtml(r.name)}${r.me ? '' : ` <button class="tiny" data-act="visit" data-arg="${r.id}">Besøg</button>`}</span><span class="lb-score">${board === 'level' ? `<small>niveau</small> ${r.score}` : `${r.score} <small>${unit}</small>`}</span></div>`).join('');
    const me = res.me && res.me.place > 50 ? `<div class="lb-row me"><span class="lb-place">${res.me.place}</span><span class="lb-name">${escapeHtml(S.playerName)}</span><span class="lb-score">${res.me.score}</span></div>` : '';
    const head = isWeek ? `<p class="small week-info">${icon('pokal', 'ic-s')} Hver ordre, kolonist og container tæller. Ugen slutter søndag kl. 24. Præmier: 1. plads ${WEEK_PRIZES[0].credits} ${icon('coin', 'ic-s')} + ${WEEK_PRIZES[0].krystal} ${icon('krystal', 'ic-s')}, top 3, top 10 og alle deltagere får noget. Du har <b>${S.weekScore.id === weekId() ? S.weekScore.n : 0}</b> denne uge.</p>` : '';
    $('boardList').innerHTML = head + (rows ? `<div class="lb">${rows}${me}</div>` : '<p class="muted">Ingen på ranglisten endnu. Bliv den første!</p>');
  } catch (e) {
    $('boardList').innerHTML = '<p class="muted">Ranglisten kan ikke hentes lige nu. Tjek din forbindelse.</p>';
  }
}

// ---------- Rumposten ----------
function postItemName(it, n) { return `${n} × ${ITEMS[it] ? ITEMS[it].name : it}`; }

async function openPost(tabs, tab) {
  const sub = tab === 'post' ? 'post-buy' : tab;
  const subtabs = `<div class="tabs sub">${[['post-buy', 'Køb fra andre'], ['post-sell', 'Sæt til salg'], ['post-mine', 'Mine annoncer']]
    .map(([k, l]) => `<button class="${k === sub ? 'on' : ''}" data-act="invtab" data-arg="${k}">${l}</button>`).join('')}</div>`;
  if (sub === 'post-sell') {
    const ids = Object.keys(ITEMS).filter((id) => have(id) > 0);
    const first = ids[0];
    showModal(`${icon('rumposten')} Rumposten`, `${tabs}${subtabs}
      ${ids.length ? `<p class="muted small">Sæt varer til salg for andre spillere. Varerne forlader dit lager med det samme, og pengene venter på dig, når nogen køber. Annoncer gælder i 2 døgn, og du kan have 6 ad gangen.</p>
      <div class="post-form">
        <label>Vare <select id="postItem">${ids.map((id) => `<option value="${id}">${ITEMS[id].name} (${have(id)})</option>`).join('')}</select></label>
        <label>Antal <input id="postQty" type="number" min="1" max="${Math.min(20, have(first))}" value="${Math.min(5, have(first))}"></label>
        <label>Pris i alt <input id="postPrice" type="number" min="1"></label>
        <p class="muted small" id="postHint"></p>
        <button class="primary wide" data-act="postsell">Sæt til salg</button>
      </div>` : '<p class="muted">Dit lager er tomt.</p>'}`);
    if (ids.length) postFormUpdate(true);
    return;
  }
  showModal(`${icon('rumposten')} Rumposten`, `${tabs}${subtabs}<div id="postList"><p class="muted">Henter annoncer …</p></div>`);
  try {
    if (sub === 'post-mine') {
      const list = await Cloud.market.mine();
      if (!$('postList')) return;
      const sold = list.filter((l) => l.sold).reduce((a, l) => a + l.price, 0);
      $('postList').innerHTML = (sold ? `<button class="primary wide" data-act="postcollect">Hent ${sold} ${icon('coin', 'ic-s')} for solgte varer</button>` : '')
        + (list.length ? `<div class="list">${list.map((l) => `<div class="row ${l.sold ? 'hot' : ''}">
          <div class="ico">${icon(l.item)}</div><div class="info"><b>${postItemName(l.item, l.qty)}</b><small>${l.price} kreditter · ${l.sold ? 'Solgt!' : l.expired ? 'Udløbet' : 'Til salg'}</small></div>
          ${l.sold ? '' : `<button data-act="postcancel" data-arg="${l.id}">Tag tilbage</button>`}</div>`).join('')}</div>`
          : '<p class="muted">Du har ingen annoncer.</p>');
    } else {
      const list = await Cloud.market.browse();
      if (!$('postList')) return;
      $('postList').innerHTML = list.length ? `<div class="list">${list.filter((l) => ITEMS[l.item]).map((l) => {
        const val = ITEMS[l.item].value * l.qty, cheap = l.price < val;
        return `<div class="row"><div class="ico">${icon(l.item)}</div>
          <div class="info"><b>${postItemName(l.item, l.qty)}</b><small>fra ${escapeHtml(l.seller)}${cheap ? ' · <span class="up">godt tilbud</span>' : ''}</small></div>
          <button class="primary" data-act="postbuy" data-arg="${l.id}" data-price="${l.price}" data-qty="${l.qty}" ${S.credits < l.price || !spaceFor(l.qty) ? 'disabled' : ''}>${l.price} ${icon('coin', 'ic-s')}</button></div>`;
      }).join('')}</div>` : '<p class="muted">Ingen varer til salg lige nu. Sæt selv noget til salg!</p>';
    }
  } catch (e) {
    if ($('postList')) $('postList').innerHTML = '<p class="muted">Rumposten kan ikke nås lige nu. Tjek din forbindelse.</p>';
  }
}

function postFormUpdate(resetPrice) {
  const it = $('postItem').value, qtyEl = $('postQty');
  qtyEl.max = Math.min(20, have(it));
  let q = Math.max(1, Math.min(Number(qtyEl.value) || 1, Number(qtyEl.max)));
  qtyEl.value = q;
  const val = ITEMS[it].value * q;
  const lo = Math.max(1, Math.round(val * POST_MIN)), hi = Math.round(val * POST_MAX);
  if (resetPrice) $('postPrice').value = Math.round(val * 1.1);
  $('postHint').textContent = `Markedsværdi ${val} kreditter. Prisen skal ligge mellem ${lo} og ${hi}.`;
}

async function postSell() {
  const it = $('postItem').value, q = Number($('postQty').value), price = Math.round(Number($('postPrice').value));
  const val = ITEMS[it].value * q;
  if (!q || q > have(it) || q > 20) return fail('Ugyldigt antal.');
  if (!price || price < Math.max(1, Math.round(val * POST_MIN)) || price > Math.round(val * POST_MAX)) return fail('Prisen ligger uden for det tilladte.');
  try {
    const r = await Cloud.market.list(it, q, price);
    if (!r || !r.ok) return fail(r && r.reason === 'full' ? 'Du har allerede 6 annoncer. Vent, til nogen bliver solgt.' : 'Annoncen kunne ikke oprettes.');
    addItem(it, -q);
    save();
    Sound.play('coin');
    toast(`${icon('rumposten')} ${postItemName(it, q)} er sat til salg for ${price} ${icon('coin')}.`, 'good');
    openInventory('post-mine');
  } catch (e) { fail('Rumposten kan ikke nås lige nu.'); }
}

async function postBuy(id, price, qty) {
  if (S.credits < price) return fail('Ikke nok kreditter.');
  if (!spaceFor(qty)) return fail('Lageret er fuldt.');
  try {
    const r = await Cloud.market.buy(id);
    if (!r || !r.ok) { toast('Annoncen er allerede solgt.'); return openInventory('post-buy'); }
    S.credits -= r.price;
    addItem(r.item, r.qty);
    save();
    Sound.play('coin');
    toast(`${icon(r.item)} Du købte ${postItemName(r.item, r.qty)} for ${r.price} ${icon('coin')}.`, 'good');
    openInventory('post-buy');
  } catch (e) { fail('Rumposten kan ikke nås lige nu.'); }
}

async function postCancel(id) {
  try {
    const r = await Cloud.market.cancel(id);
    if (r && r.ok) {
      addItem(r.item, r.qty); save();
      toast(`${postItemName(r.item, r.qty)} er tilbage på lageret.`);
    }
    openInventory('post-mine');
  } catch (e) { fail('Rumposten kan ikke nås lige nu.'); }
}

// ---------- Saml alt, foto, Phobos og Bølle ----------
function doCollectAll() {
  const r = collectAll();
  const parts = [];
  if (r.harvest) parts.push(`høstede ${r.harvest}`);
  if (r.collect) parts.push(`samlede ${r.collect} varer`);
  if (r.fed) parts.push(`fodrede ${r.fed} dyr`);
  if (r.planted) parts.push(`plantede ${r.planted}`);
  if (!parts.length) return toast(r.full ? 'Lageret er fuldt. Sælg noget, eller udvid lageret.' : 'Der er ikke noget at samle lige nu.', r.full ? 'bad' : '');
  Sound.play('plop'); Sound.play('pickup'); Sound.buzz(20);
  toast(`${icon('saml')} Du ${parts.join(', ')}.${r.full ? ' Lageret blev fuldt.' : ''}`, 'good', 4000);
}

let photoUrl = null;
function openPhoto() {
  const shot = renderPhoto();
  shot.toBlob((blob) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(blob);
    openPhoto.blob = blob;
    showModal(`${icon('kamera')} Fotomodus`, `
      <img class="photo" src="${photoUrl}" alt="Billede af kolonien">
      <div class="btnrow">${navigator.canShare && navigator.canShare({ files: [new File([blob], 'rumkolonien.png', { type: 'image/png' })] })
        ? '<button class="primary" data-act="photoshare">Del billedet</button>' : ''}
        <a class="btnlink" href="${photoUrl}" download="rumkolonien.png">Gem billedet</a></div>`);
    Sound.play('click');
  }, 'image/png');
}

function sharePhoto() {
  const file = new File([openPhoto.blob], 'rumkolonien.png', { type: 'image/png' });
  navigator.share({ files: [file], title: 'Min koloni på Mars', text: `Se min koloni i Rumkolonien! Niveau ${S.level}.`, url: location.origin + location.pathname })
    .catch(() => { /* deling annulleret */ });
}

function onPet() {
  if (S.pet.found) return collectPet();
  Sound.play('click');
  toast(`${icon('boelle')} Bølle leder efter skatte. Kom tilbage om ${fmtTime((S.pet.next - Date.now()) / 1000)}.`);
}

// ---------- Naboer ----------
async function openNeighbors() {
  showModal(`${icon('nabo')} Naboer`, `<p class="muted tip">Besøg andre kolonier, og hjælp dem en gang om dagen. Du får ${HELP_REWARD(S.level)} ${icon('coin', 'ic-s')} for hver nabo, du hjælper, og de får en gave, næste gang de spiller.</p><div id="nbList"><p class="muted">Leder efter naboer …</p></div>`);
  try {
    const list = await Cloud.neighbors();
    if (!$('nbList')) return;
    $('nbList').innerHTML = list.length ? `<div class="list">${list.map((n) => `<div class="row">
      <div class="ico">${icon('nabo')}</div><div class="info"><b>${escapeHtml(n.name)}</b><small>Niveau ${n.level}${n.helped ? ' · hjulpet i dag' : ''}</small></div>
      <button data-act="visit" data-arg="${n.id}">Besøg</button>
      <button class="primary" data-act="helpnb" data-arg="${n.id}" ${n.helped ? 'disabled' : ''}>Hjælp</button></div>`).join('')}</div>`
      : '<p class="muted">Der er ingen andre kolonister endnu. Del spillet med en ven!</p>';
  } catch (e) {
    if ($('nbList')) $('nbList').innerHTML = '<p class="muted">Naboerne kan ikke hentes lige nu. Tjek din forbindelse.</p>';
  }
}

async function visitNeighbor(id) {
  try {
    const v = await Cloud.visit(id);
    if (!v || !Array.isArray(v.tiles) || v.tiles.length !== COLS * ROWS) return fail('Kolonien kan ikke vises.');
    closeModal();
    startVisit(v);
    $('visitName').textContent = `${v.name} · niveau ${v.level}`;
    $('visitHelp').dataset.arg = id;
    $('visitHelp').disabled = false;
    $('visitBanner').hidden = false;
    document.body.classList.add('visiting');
    Sound.play('whoosh');
  } catch (e) { fail('Kolonien kunne ikke hentes. Tjek din forbindelse.'); }
}

function leaveVisit() {
  endVisit();
  $('visitBanner').hidden = true;
  document.body.classList.remove('visiting');
}

async function helpNeighbor(id, btn) {
  if (btn) btn.disabled = true;
  try {
    const r = await Cloud.help(id);
    if (r && r.ok) {
      const credits = HELP_REWARD(S.level);
      earn(credits);
      S.stats.helped++;
      giveTickets(1);
      save();
      Sound.play('coin');
      toast(`${icon('nabo')} Du hjalp din nabo: +${credits} ${icon('coin')}`, 'good');
    } else {
      const why = { already: 'Du har allerede hjulpet denne nabo i dag.', limit: 'Du kan hjælpe 10 naboer om dagen. Kom igen i morgen.', self: 'Det er din egen koloni.' }[r && r.reason] || 'Det lykkedes ikke.';
      toast(why);
    }
  } catch (e) { fail('Ingen forbindelse lige nu.'); if (btn) btn.disabled = false; }
}

// ---------- Missioner ----------
function openMissions() {
  const m = currentMission();
  if (!m) {
    return showModal(`${icon('mission')} Missioner`, `<div class="levelup"><div class="big-num">20/20</div><p>Alle missioner er klaret. Kolonien er klar til fremtiden!</p></div>`);
  }
  const ch = MISSION_CHAPTERS[m.ch];
  const inCh = MISSIONS.map((x, i) => ({ ...x, i })).filter((x) => x.ch === m.ch);
  const rows = inCh.map((x) => {
    const done = x.i < S.mission, cur = x.i === S.mission, pr = missionProgress(x);
    return `<div class="row ${done ? 'claimed' : ''} ${!done && !cur ? 'locked' : ''}">
      <div class="ico">${icon(done ? 'medalje' : 'mission')}</div>
      <div class="info"><b>${x.text}</b>${cur ? `<div class="pbar"><div style="width:${pr.cur / pr.target * 100}%"></div></div><small>${pr.cur}/${pr.target} · +${x.reward} ${icon('coin', 'ic-s')}${x.krystal ? ` +${x.krystal} ${icon('krystal', 'ic-s')}` : ''}</small>` : `<small>+${x.reward} ${icon('coin', 'ic-s')}</small>`}</div>
      ${cur ? `<button class="primary" data-act="claimmission" ${pr.done ? '' : 'disabled'}>Hent</button>` : done ? '<button disabled>Klaret</button>' : ''}
    </div>`;
  }).join('');
  showModal(`${icon('mission')} Kapitel ${m.ch + 1}: ${ch.title}`, `
    <div class="colonist"><div class="portrait">${icon('col-' + ch.col, 'ic-xl')}</div><div class="col-body"><b>${COLONISTS[ch.col].name}</b><p class="quote">“${ch.intro}”</p></div></div>
    <div class="section-title">Mission ${S.mission + 1} af ${MISSIONS.length}</div><div class="list">${rows}</div>`);
}

function cloudStatusText() {
  if (Cloud.status === 'offline') return 'Ingen forbindelse. Kolonien gemmes stadig på denne enhed og sendes, når nettet er tilbage.';
  if (Cloud.lastOk) return `Gemt i skyen kl. ${new Date(Cloud.lastOk).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}.`;
  return 'Forbinder …';
}

function showLevelUp(level, bonus, unlocks) {
  showModal(`${icon('xp')} Niveau ${level}!`, `
    <div class="levelup">
      <div class="big-num">${level}</div>
      <p>+${bonus} ${icon('coin', 'ic-s')} i bonus</p>
      ${unlocks.length ? `<div class="section-title">Nyt</div><div class="unlocks">${unlocks.map((u) => `<span>${u}</span>`).join('')}</div>` : '<p class="muted">Flere ordrer og større belønninger.</p>'}
      <button class="primary wide" data-act="close">Fedt!</button>
    </div>`);
}

function showDaily(r) {
  let days = '';
  for (let d = 1; d <= 7; d++) days += `<div class="day ${d < r.day ? 'got' : ''} ${d === r.day ? 'today' : ''} ${d === 7 ? 'big' : ''}">${icon(d === 7 ? 'gift' : 'coin', 'ic-m')}<small>Dag ${d}</small></div>`;
  showModal(`${icon('gift')} Velkommen tilbage!`, `
    <div class="days">${days}</div>
    <p class="center">Dag ${r.day} i træk: <b>+${r.credits}</b> ${icon('coin', 'ic-s')} og <b>+${r.xp}</b> ${icon('xp', 'ic-s')}</p>
    <button class="primary wide" data-act="close">Hent</button>`);
  Sound.play('coin');
}

function showStory(res) {
  const def = COLONISTS[res.id];
  const next = res.chapter && res.chapter < def.lines.length ? 'Kom tilbage senere, så hører du mere.' : '';
  showModal(`${icon('col-' + res.id)} ${def.name}`, `
    <p class="quote big">“${COLONIST_DONE_LINE}”</p>
    <p>+${res.credits} ${icon('coin', 'ic-s')} · +${res.xp} ${icon('xp', 'ic-s')}${res.chapter ? ` · Kapitel ${res.chapter}/${def.lines.length} låst op` : ''}</p>
    <p class="muted">${next}</p>
    <button class="primary wide" data-act="close">Selv tak</button>`);
}

function openHelp() {
  showModal(`${icon('goal')} Sådan spiller du`, `
    <p><b>Velkommen til Mars!</b> Din opgave er at få kolonien til at vokse.</p>
    <div class="list help">
      <div class="row"><div class="ico">${icon('kuppel')}</div><div class="info"><b>Drivhuskupler</b><small>Tryk for at plante. Når afgrøden er moden, trykker du igen. Træk fingeren over flere kupler for at høste eller plante dem alle.</small></div></div>
      <div class="row"><div class="ico">${icon('madprinter')}</div><div class="info"><b>Bygninger</b><small>De laver varer af dine råvarer. Hver bygning har plads til 3 ting i køen.</small></div></div>
      <div class="row"><div class="ico">${icon('pad')}</div><div class="info"><b>Landingspladsen</b><small>Fragtskibe og kolonister beder om varer. Ekspresskibe betaler det dobbelte, men venter ikke længe.</small></div></div>
      <div class="row"><div class="ico">${icon('box')}</div><div class="info"><b>Lager</b><small>Der er begrænset plads. Udvid lageret, eller sælg det, du ikke skal bruge.</small></div></div>
      <div class="row"><div class="ico">${icon('hoensehus')}</div><div class="info"><b>Dyr</b><small>Rumhøns og marsgeder giver æg og mælk, når de får foder. Tryk på indhegningen for at samle ind og fodre.</small></div></div>
      <div class="row"><div class="ico">${icon('rover')}</div><div class="info"><b>Ekspeditioner</b><small>Fra niveau 7 kan roveren køre ud efter krystaller og artefakter.</small></div></div>
      <div class="row"><div class="ico">${icon('storm')}</div><div class="info"><b>Vejret på Mars</b><small>Støvstorme gør, at afgrøderne gror langsommere. Ved meteorregn kan du samle jernmalm op.</small></div></div>
      <div class="row"><div class="ico">${icon('moon')}</div><div class="info"><b>Dag og nat</b><small>En sol (Mars-dag) varer 8 minutter. Solnedgangen er blå på Mars.</small></div></div>
    </div>
    <p class="muted small">Træk i kortet for at flytte det, og knib eller scroll for at zoome. Spillet gemmes i din browser.</p>
    <div class="section-title">Beskeder</div>
    <p class="small">Få besked, når afgrøder, bygninger, roveren eller forskningen er klar. ${Native.on ? 'Beskederne kommer også, når appen er lukket.' : 'Det virker, mens spillet er åbent i baggrunden, og bedst når det er installeret som app.'}</p>
    <button data-act="notify" ${Notify.supported() ? '' : 'disabled'}>${icon('klokke', 'ic-s')} ${Notify.on ? 'Slå beskeder fra' : 'Giv mig besked'}</button>
    <div class="section-title">Din koloni i skyen</div>
    <p class="small">${cloudStatusText()} Åbn dit hemmelige link på en anden telefon eller computer for at spille videre der. Del det ikke med andre, for linket giver adgang til kolonien.</p>
    <label class="namefield">Dit navn på ranglisten <input id="playerName" maxlength="20" value="${escapeHtml(S.playerName)}"></label>
    <div class="btnrow"><button class="primary" data-act="copylink">Kopiér mit link</button><button data-act="cloudsave">Gem nu</button></div>
    <div class="section-title">Gemmekode uden net</div>
    <p class="small">Du kan også flytte kolonien med en gemmekode, som du indsætter manuelt.</p>
    <div class="btnrow"><button data-act="export">Vis gemmekode</button><button data-act="import">Indlæs gemmekode</button>
    ${installPrompt ? '<button class="primary" data-act="install">Installér som app</button>' : ''}</div>
    <div id="savebox"></div>
    <div class="section-title">Forfra</div>
    <button data-act="reset">Start en ny koloni</button>`);
}

// ---------- Version 10: kolonirådet ----------
const solsLeft = (until) => Math.max(0, until - solIndex());
function policyChips() {
  const list = activePolicies();
  if (!list.length) return '<p class="muted small">Ingen politikker er i kraft lige nu.</p>';
  return `<div class="policies">${list.map((id) => `<div class="policy"><b>${POLICIES[id].name}</b><small>${POLICIES[id].desc} · ${solsLeft(S.council.policies[id])} sol tilbage</small></div>`).join('')}</div>`;
}
function openCouncil() {
  const c = councilPending();
  const nextSol = (solIndex() + 1) * DAY_MS;
  let body;
  if (c) {
    const opt = (k) => {
      const o = c[k], ok = fxAffordable(o.fx);
      return `<button class="choice ${k}" data-act="decide" data-arg="${k}" ${ok ? '' : 'disabled'}><b>${o.label}</b><small>${fxText(o.fx) || 'Ingen umiddelbar virkning'}</small>${ok ? '' : '<em>Det har I ikke råd til</em>'}</button>`;
    };
    body = `<div class="colonist council"><div class="portrait">${icon('col-' + c.who, 'ic-xl')}</div><div class="col-body"><b>${COLONISTS[c.who].name}</b><p class="quote big">“${c.text}”</p></div></div>
      <div class="choices">${opt('a')}${opt('b')}</div>`;
  } else {
    body = `<p class="center">Rådet mødes igen om <b><span data-until="${nextSol}"></span></b>, når en ny sol begynder.</p>`;
  }
  const log = S.council.log.slice(0, 4).map((l) => { const d = COUNCIL.find((x) => x.id === l.id); return d ? `<li>${COLONISTS[d.who].name.split(' ')[1]}: <b>${d[l.choice].label}</b></li>` : ''; }).join('');
  showModal(`${icon('raad')} Kolonirådet`, `${body}
    <div class="section-title">Politikker i kraft</div>${policyChips()}
    ${log ? `<div class="section-title">Seneste beslutninger</div><ul class="log">${log}</ul>` : ''}`);
}

// ---------- Version 10: gen-lab ----------
function cropChoices(role, sel, other) {
  return Object.keys(CROPS).filter((id) => CROPS[id].level <= S.level).map((id) => {
    const enough = have(id) >= GENE.seeds;
    return `<button class="crop-pick ${sel === id ? 'on' : ''}" data-act="genpick" data-arg="${role}:${id}" ${enough && id !== other ? '' : 'disabled'} title="${ITEMS[id].name}">${icon(id)}<small>${have(id)}</small></button>`;
  }).join('');
}
function traitBadges(crop, cls = 'ic-s') {
  return cropTraits(crop).map((t) => `<span class="trait" title="${TRAITS[t].name}: ${TRAITS[t].desc}">${icon(t, cls)}</span>`).join('');
}
function openGenlab() {
  const g = S.gene.active;
  let head;
  if (g) {
    head = `<div class="cross-run">${icon(g.a, 'ic-xl')}<span class="x">×</span>${icon(g.b, 'ic-xl')}</div>
      <p class="center">Krydsningen er færdig om <b><span data-until="${g.end}"></span></b>.</p>`;
  } else {
    const sel = openGenlab.sel || {};
    const a = sel.a, b = sel.b;
    const known = a && b ? S.gene.book[a + '+' + b] : null;
    const result = a && b ? (known ? `${icon(known)} <b>${hybridName(a, b)}</b> giver egenskaben <b>${TRAITS[known].name}</b>.` : `${icon('dna')} <b>${hybridName(a, b)}</b>: Egenskaben er ukendt. Prøv det!`) : 'Vælg en moderplante og en faderplante.';
    const ready = a && b && have(a) >= GENE.seeds && have(b) >= GENE.seeds && S.credits >= GENE.credits;
    head = `<p class="small">Moderplanten får en ny egenskab, som afhænger af faderen. Hver afgrøde kan have ${GENE.max} egenskaber. Et forsøg koster ${GENE.seeds} af hver afgrøde og ${GENE.credits} ${icon('coin', 'ic-s')} og tager ${GENE.min} minutter.</p>
      <div class="section-title">Moderplante</div><div class="crop-row">${cropChoices('a', a, b)}</div>
      <div class="section-title">Faderplante</div><div class="crop-row">${cropChoices('b', b, a)}</div>
      <div class="cross-preview">${result}</div>
      <button class="primary wide" data-act="cross" ${ready ? '' : 'disabled'}>Kryds</button>`;
  }
  const book = Object.keys(CROPS).filter((id) => S.genes[id]).map((id) => `<div class="row"><div class="ico">${icon(id)}</div>
    <div class="info"><b>${ITEMS[id].name}</b><small>${S.genes[id].traits.map((t, i) => `${S.genes[id].names[i]}: ${TRAITS[t].name.toLowerCase()} (${TRAITS[t].desc.toLowerCase()})`).join(' · ')}</small></div>
    <div class="traits">${traitBadges(id, 'ic')}</div></div>`).join('');
  const found = Object.keys(S.gene.book).length;
  showModal(`${icon('genlab')} Gen-lab`, `${head}
    <div class="section-title">Sortsbogen · ${found} krydsninger</div>
    ${book ? `<div class="list">${book}</div>` : '<p class="muted small">Ingen nye sorter endnu.</p>'}`);
}
function showCross(r) {
  const t = TRAITS[r.trait];
  showModal(`${icon('dna')} ${r.gained ? 'Ny Mars-sort!' : 'Krydsningen er færdig'}`, `
    <div class="levelup"><div class="cross-run">${icon(r.a, 'ic-xl')}<span class="x">×</span>${icon(r.b, 'ic-xl')}</div>
    <div class="big-name">${r.name}</div>
    <div class="unlocks"><span>${icon(r.trait)} ${t.name}: ${t.desc}</span></div>
    <p>${r.gained ? `Fra nu af gror sorten ${r.name} i alle kupler, hvor du planter ${ITEMS[r.a].name.toLowerCase()}.` : `${ITEMS[r.a].name} ${cropTraits(r.a).includes(r.trait) ? 'har allerede den egenskab' : `har allerede ${GENE.max} egenskaber`}. Krydsningen står i sortsbogen.`}</p>
    <button class="primary wide" data-act="genlab">Videre</button></div>`);
}

// ---------- Version 10: specialister ----------
let crewPick = null;
function tileName(idx) {
  const t = S.tiles[idx];
  if (!t) return '';
  if (t.t === 'b') return BUILDINGS[t.id].name;
  return { plot: 'Drivhuskuppel', pad: 'Landingspladsen', empty: 'Ryddet felt', pen: ANIMALS[t.id] ? ANIMALS[t.id].name : 'Indhegning' }[t.t] || 'Feltet';
}
function openCrew() {
  const rows = Object.keys(CREW).map((id) => {
    const c = S.crew[id], def = CREW[id], col = COLONISTS[id];
    if (!crewUnlocked(id)) return `<div class="row locked"><div class="ico">${icon('col-' + id)}</div><div class="info"><b>${col.name}</b><small>Kommer på niveau ${Math.max(CREW_LEVEL, col.level)}</small></div></div>`;
    const tired = c.energy < 30;
    return `<div class="row crew">
      <div class="ico">${icon('col-' + id)}</div>
      <div class="info"><b>${col.name}</b><small>${def.desc}</small>
        <div class="energy ${tired ? 'low' : ''}"><div style="width:${c.energy}%"></div></div>
        <small>${c.post >= 0 ? `Arbejder ved <b>${tileName(c.post)}</b>${tired ? ' · træt: halv effekt' : ''}` : `Hviler · energi ${c.energy} %`}</small></div>
      <div class="btncol">${c.post >= 0 ? `<button data-act="crewrest" data-arg="${id}">Hvil</button>` : ''}<button class="primary" data-act="crewpick" data-arg="${id}" ${c.energy < 10 ? 'disabled' : ''}>${c.post >= 0 ? 'Flyt' : 'Sæt på post'}</button></div>
    </div>`;
  }).join('');
  showModal(`${icon('befolkning')} Specialister`, `<p class="small">Sæt specialisterne på en post. De mister ${CREW_WORK} % energi pr. sol, mens de arbejder, og får ${CREW_REST} % igen pr. sol, de hviler. Under 30 % giver de halv effekt.</p>
    <div class="list">${rows}</div>`);
}
function startCrewPick(id) {
  crewPick = id;
  closeModal();
  const posts = { ida: 'en produktionsbygning', bo: 'en kuppel eller et ryddet felt mellem kuplerne', kim: 'landingspladsen eller rovergaragen', dina: 'et habitat eller forskningslabbet' }[id];
  $('crewBannerIc').src = `${ICON_DIR}col-${id}.svg`;
  $('crewBannerText').textContent = `Tryk på ${posts} til ${COLONISTS[id].name}.`;
  $('crewBanner').hidden = false;
}
function endCrewPick() { crewPick = null; $('crewBanner').hidden = true; }

// ---------- Knapper ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const idx = Number(btn.dataset.idx), arg = btn.dataset.arg;
  switch (btn.dataset.act) {
    case 'close': Sound.play('click'); return closeModal();
    case 'orders': Sound.play('click'); return openOrders();
    case 'inventory': Sound.play('click'); return openInventory();
    case 'colony': Sound.play('click'); return openColony();
    case 'help': Sound.play('click'); return openHelp();
    case 'tab': Sound.play('click'); return openColony(arg);
    case 'sound': return openSound();
    case 'soundmute': {
      const m = Sound.toggle();
      $('soundBtn').innerHTML = icon(m ? 'mute' : 'sound');
      if (!m) Sound.play('click');
      return openSound();
    }
    case 'plant': if (plant(idx, arg)) closeModal(); return;
    case 'make': if (enqueue(idx, arg)) refreshBuilding(idx); return;
    case 'collect': collect(idx); return refreshBuilding(idx);
    case 'deliver': { const lvl = S.level; deliver(Number(arg)); if (S.level === lvl) openOrders(); return; }
    case 'discard': discard(Number(arg)); return openOrders();
    case 'colonist': { const lvl = S.level, res = deliverColonist(); if (res && S.level === lvl) showStory(res); return; }
    case 'sell': sell(arg); return openInventory(btn.dataset.tab || 'lager');
    case 'sellall': sell(arg, have(arg)); return openInventory();
    case 'invtab': Sound.play('click'); return openInventory(arg);
    case 'buy': buyItem(arg, 1); return openInventory('boers');
    case 'buy5': buyItem(arg, 5); return openInventory('boers');
    case 'crate': { const lvl = S.level; loadCrate(Number(arg)); if (S.level === lvl) openOrders(); return; }
    case 'research': if (startResearch(arg)) openLab(); return;
    case 'removedeco': removeDecor(idx); return closeModal();
    case 'music': {
      const on = Music.toggle();
      btn.innerHTML = icon(on ? 'musik' : 'musik-fra');
      return;
    }
    case 'silo': upgradeSilo(); return openInventory();
    case 'build': if (buildOn(idx, arg)) closeModal(); return;
    case 'clear': if (clearTile(idx)) closeModal(); return;
    case 'robot': buyRobot(arg); return openColony('robots');
    case 'claim': { const lvl = S.level; claimWeekly(Number(arg)); if (S.level === lvl) openColony('goals'); return; }
    case 'upgrade': if (upgradeBuilding(idx)) openBuilding(idx); return;
    case 'expedition': if (startExpedition(arg)) closeModal(); return;
    case 'export': {
      $('savebox').innerHTML = `<textarea readonly rows="4">${exportSave()}</textarea><button class="primary wide" data-act="copy">Kopiér</button>`;
      return;
    }
    case 'copy': {
      const ta = document.querySelector('#savebox textarea');
      ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(
        () => toast('Gemmekoden er kopieret.', 'good'), () => { document.execCommand('copy'); toast('Gemmekoden er kopieret.', 'good'); });
      return;
    }
    case 'import':
      $('savebox').innerHTML = '<textarea rows="4" placeholder="Indsæt din gemmekode her"></textarea><button class="primary wide" data-act="doimport">Indlæs</button>';
      return;
    case 'doimport': {
      const code = document.querySelector('#savebox textarea').value;
      if (!code.trim()) return;
      if (!confirm('Den nuværende koloni på denne enhed bliver erstattet. Fortsæt?')) return;
      if (importSave(code)) { closeModal(); centerCamera(); toast('Kolonien er indlæst.', 'good'); }
      else fail('Gemmekoden kunne ikke læses.');
      return;
    }
    case 'install':
      if (installPrompt) { installPrompt.prompt(); installPrompt = null; closeModal(); }
      return;
    case 'edit': return setEdit(!editMode);
    case 'editdone': return setEdit(false);
    case 'advisor': Sound.play('click'); return openAdvisor();
    case 'advice': {
      const a = (openAdvisor.list || [])[Number(arg)];
      if (!a) return;
      if (a.act === 'inventory') return openInventory('boers');
      if (a.act === 'colony') return openColony('goals');
      if (a.act === 'festival') return openFestival();
      if (a.act === 'arcade') return openArcade();
      if (a.act === 'missions') return openMissions();
      if (a.act === 'neighbors') return openNeighbors();
      if (a.act === 'energy') return openEnergy();
      if (a.act === 'pop') return openPop();
      if (a.act === 'explore') return openExplore();
      if (a.act === 'council') return openCouncil();
      if (a.act === 'crew') return openCrew();
      if (a.act === 'shelter') { seekShelter(); return closeModal(); }
      if (a.act === 'pet') { closeModal(); camGoal = { x: pet.x, y: pet.y - 60 }; return; }
      closeModal();
      focusTile(a.idx);
      return;
    }
    case 'festival': Sound.play('click'); return openFestival();
    case 'festbuy': if (buyFest(Number(arg))) openFestival(); return;
    case 'arcade': Sound.play('click'); return openArcade();
    case 'arcadestart': return startArcade();
    case 'notify':
      Notify.toggle().then((on) => {
        if (on === 'denied') toast('Browseren har blokeret beskeder fra spillet. Du kan tillade dem i browserens indstillinger for siden.', 'bad', 5000);
        else toast(on ? `${icon('klokke')} Du får besked, når noget er klar.` : 'Beskeder er slået fra.', on ? 'good' : '');
        if (!modal.hidden) openHelp();
      });
      return;
    case 'cloudtake': return Cloud.take();
    case 'cloudkeep': return Cloud.keep();
    case 'board': openColony.board = arg; return openColony('board');
    case 'cloudsave': save(); Cloud.push(true).then(() => { toast(Cloud.status === 'ok' ? 'Gemt i skyen.' : 'Ingen forbindelse lige nu.', Cloud.status === 'ok' ? 'good' : 'bad'); if (!modal.hidden) openHelp(); }); return;
    case 'copylink': {
      const link = Cloud.link;
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
        () => toast('Linket er kopieret. Åbn det på din anden enhed.', 'good', 4000),
        () => { $('savebox').innerHTML = `<textarea readonly rows="3">${link}</textarea>`; });
      return;
    }
    case 'neighbors': Sound.play('click'); return openNeighbors();
    case 'visit': return visitNeighbor(arg);
    case 'leavevisit': Sound.play('click'); return leaveVisit();
    case 'helpnb': return helpNeighbor(arg, btn);
    case 'missions': Sound.play('click'); return openMissions();
    case 'claimmission': { const lvl = S.level; claimMission(); if (S.level === lvl) openMissions(); return; }
    case 'season': {
      const se = season();
      return toast(`${icon(se.id)} <b>${se.name}</b>: ${se.desc} Skifter om ${fmtTime((seasonEnds() - Date.now()) / 1000)}.`, '', 5000);
    }
    case 'collectall': return doCollectAll();
    case 'photo': return openPhoto();
    case 'photoshare': return sharePhoto();
    case 'phobos':
      if (confirm('Vil du forlade Mars og starte en ny koloni på Phobos? Kortet, lageret og bygningerne starter forfra.')) {
        if (startPhobos()) { closeModal(); resetAgents(); centerCamera(); Sound.play('whoosh'); Sound.play('levelup'); Sound.say('kim_phobos', { force: true }); toast(`${icon('phobos')} Velkommen til Phobos! Du har nu ${S.prestige} ${S.prestige === 1 ? 'stjerne' : 'stjerner'}.`, 'good', 5000); }
      }
      return;
    case 'postsell': return postSell();
    case 'postbuy': return postBuy(Number(arg), Number(btn.dataset.price), Number(btn.dataset.qty));
    case 'postcancel': return postCancel(Number(arg));
    case 'postcollect': Cloud.collectSales().then(() => openInventory('post-mine')); return;
    case 'explore': Sound.play('click'); return openExplore();
    case 'sector': Sound.play('click'); return openExplore(Number(arg));
    case 'sendrover': if (startSector(Number(arg))) openExplore(); return;
    case 'terra': Sound.play('click'); return openTerraform();
    case 'terragive': return terraGive();
    case 'energy': Sound.play('click'); return openEnergy();
    case 'pop': Sound.play('click'); return openPop();
    case 'poprich': S.pop.rich = !S.pop.rich; save(); return openPop();
    case 'decode': if (startDecode()) openLab(); return;
    case 'timewave': { const n = timeWave(); if (n !== false) { closeModal(); toast(`${icon('monolit')} Tidsbølgen skyllede over kolonien. ${n} ting er færdige.`, 'good', 5000); } return; }
    case 'council': Sound.play('click'); return openCouncil();
    case 'decide': {
      const c = councilPending(), lvl = S.level, o = decide(arg);
      if (!o) return;
      closeModal();
      if (S.level === lvl) toast(`${icon('col-' + c.who)} ${COLONISTS[c.who].name}: “${o.label}. Det gør vi.”`, 'good', 3500);
      return;
    }
    case 'genlab': Sound.play('click'); return openGenlab();
    case 'genpick': { const [role, id] = arg.split(':'); openGenlab.sel = { ...(openGenlab.sel || {}), [role]: id }; Sound.play('click'); return openGenlab(); }
    case 'cross': { const sel = openGenlab.sel || {}; if (startCross(sel.a, sel.b)) openGenlab(); return; }
    case 'crew': Sound.play('click'); return openCrew();
    case 'crewpick': return startCrewPick(arg);
    case 'crewrest': restCrew(arg); return openCrew();
    case 'crewcancel': return endCrewPick();
    case 'sow': if (sowLichen(idx)) closeModal(); return;
    case 'shelter': seekShelter(); return;
    case 'reset':
      if (confirm('Vil du slette din koloni og starte forfra?')) { newState(); save(); closeModal(); centerCamera(); }
      return;
  }
});
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('input', (e) => {
  if (e.target.id === 'postQty') postFormUpdate(true);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'postItem') { $('postQty').value = Math.min(5, have(e.target.value)); return postFormUpdate(true); }
  if (e.target.id !== 'playerName') return;
  const name = e.target.value.trim().slice(0, 20);
  if (name.length < 2) { e.target.value = S.playerName; return fail('Navnet skal være mindst 2 tegn.'); }
  S.playerName = name;
  save();
  Cloud.push(true);
  toast(`Du hedder nu ${escapeHtml(name)} på ranglisten.`, 'good');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); if (crewPick) endCrewPick(); } });

// ---------- HUD ----------
function updateHUD() {
  $('credits').textContent = S.credits.toLocaleString('da-DK');
  $('level').textContent = S.level + (S.prestige ? ` ★${S.prestige}` : '');
  const need = xpNeeded(S.level);
  $('xpfill').style.width = (S.xp / need) * 100 + '%';
  $('xptext').textContent = `${S.xp}/${need}`;
  const ready = S.orders.filter(canFulfil).length + (S.colonist && canFulfil(S.colonist) ? 1 : 0);
  setBadge('orderBadge', ready);
  setBadge('colonyBadge', claimableGoals());
  $('silo').textContent = `${invTotal()}/${cap()}`;
  const pw = powerStatus();
  $('powerNum').textContent = `${pw.prod}/${pw.use}`;
  $('powerChip').classList.toggle('bad', pw.ratio < 1);
  $('popChip').hidden = S.level < 2;
  $('popNum').textContent = `${S.pop.n}/${popCap()}`;
  $('popChip').classList.toggle('bad', S.pop.moral < 40);
  $('terraNum').textContent = terraStage();
  const fest = isFestival();
  $('festChip').hidden = !fest;
  if (fest) $('festNum').textContent = S.tickets;
  $('arcadeBtn').hidden = S.level < ARCADE.level;
  $('councilBtn').hidden = S.level < COUNCIL_LEVEL || S.tut < TUTORIAL.length;
  setBadge('councilBadge', S.council.pending ? 1 : 0);
  $('crewBtn').hidden = S.level < CREW_LEVEL;
  Notify.badge(readyCount());
  const h = happiness();
  $('happy').hidden = !h;
  $('happyNum').textContent = `${h} %`;
  $('silo').classList.toggle('full', invTotal() >= cap());
  const clk = solClock();
  const clockHtml = `${icon(season().id, 'ic-s')} ${season().name} · ${icon(clk.night ? 'moon' : 'sun', 'ic-s')} ${clk.time}`;
  if ($('clock').dataset.html !== clockHtml) { $('clock').innerHTML = clockHtml; $('clock').dataset.html = clockHtml; }

  const tb = $('tutorial');
  if (S.tut < TUTORIAL.length) {
    tb.hidden = false;
    tb.classList.remove('mission');
    tb.innerHTML = `<span class="step">${S.tut + 1}/${TUTORIAL.length}</span> ${TUTORIAL[S.tut].text}`;
  } else if (currentMission()) {
    const m = currentMission(), pr = missionProgress(m);
    tb.hidden = false;
    tb.classList.add('mission');
    tb.classList.toggle('done', pr.done);
    const html = `${icon('mission', 'ic-s')} <span>${m.text}</span> <b>${pr.done ? 'Klar! Tryk for at hente' : `${pr.cur}/${pr.target}`}</b>`;
    if (tb.dataset.html !== html) { tb.innerHTML = html; tb.dataset.html = html; }
  } else tb.hidden = true;

  const eb = $('eventBanner'), ev = S.event, now = Date.now();
  if (ev.type && ev.until > now) {
    eb.hidden = false;
    const html = ev.type === 'storm'
      ? `${icon('storm', 'ic-s')} Støvstorm · ${fmtTime((ev.until - now) / 1000)}${owns('skjold') ? ' · skjoldet beskytter' : ''}`
      : ev.type === 'flare'
        ? (!ev.hit ? `${icon('solstorm', 'ic-s')} Solstorm om <b data-until="${ev.warnUntil}"></b> ${ev.shelter ? '· alle er i ly' : '<button class="primary" data-act="shelter">Søg ly</button>'}`
          : `${icon('solstorm', 'ic-s')} Solstorm · ${fmtTime((ev.until - now) / 1000)}${ev.shelter ? ' · alle er i ly' : ''}`)
        : `${icon('meteor', 'ic-s')} Meteorregn · saml jernmalmen op`;
    if (eb.dataset.html !== html) { eb.innerHTML = html; eb.dataset.html = html; }
    eb.classList.toggle('flare', ev.type === 'flare' && !ev.hit);
  } else eb.hidden = true;

  document.querySelectorAll('[data-until]').forEach((el) => { el.textContent = fmtTime((Number(el.dataset.until) - now) / 1000); });
}

function setBadge(id, n) {
  const b = $(id);
  b.hidden = !n;
  b.textContent = n;
}
