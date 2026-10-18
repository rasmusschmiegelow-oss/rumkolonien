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
function closeModal() { modal.hidden = true; modalView = null; }

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
  if (editMode) return editTap(idx);
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
      <div class="info"><b>${ITEMS[id].name}</b><small>${locked ? `Låses op på niveau ${c.level}` : `${fmtTime(c.time)} · giver ${HARVEST_YIELD} stk · +${c.xp} ${icon('xp', 'ic-s')}`}</small></div>
      <button class="primary" data-act="plant" data-idx="${idx}" data-arg="${id}" ${locked || S.credits < c.cost ? 'disabled' : ''}>${c.cost} ${icon('coin', 'ic-s')}</button>
    </div>`;
  }).join('');
  showModal(`${icon('kuppel')} Drivhuskuppel`,
    `<p class="muted tip">Tip: Når du har plantet én gang, kan du trække fingeren hen over tomme kupler for at plante det samme igen.</p><div class="list">${rows}</div>`);
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
      <div class="info"><b>${ITEMS[rid].name}</b><small>${locked ? `Låses op på niveau ${r.level}` : `${fmtTime(r.time * speedOf(tile))} · +${r.xp} ${icon('xp', 'ic-s')}`}</small>
      ${locked ? '' : `<div class="needs">${needList(r.in)}</div>`}</div>
      <button class="primary" data-act="make" data-idx="${idx}" data-arg="${rid}">Producér</button>
    </div>`;
  }).join('');
  showModal(`${icon(tile.id)} ${b.name}`,
    `<div class="section-title" id="bcount"></div>
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
  showModal(`${icon('lab')} Forskningslab`, `${head}<p class="muted tip">Forskning koster krystaller og artefakter fra roverens ekspeditioner. Fordelene gælder for altid.</p><div class="list">${rows}</div>`);
}

function openDecor(idx) {
  const d = DECOR[S.tiles[idx].id];
  showModal(`${icon(S.tiles[idx].id)} ${d.name}`, `
    <p>+${d.happy} ${icon('lykke', 'ic-s')} lykke. Koloniens lykke er nu <b>${happiness()}</b> af ${HAPPY_MAX}, så alle ordrer betaler <b>${happiness()} %</b> mere.</p>
    <button class="wide" data-act="removedeco" data-idx="${idx}">Fjern og få ${Math.round(d.cost / 2)} ${icon('coin', 'ic-s')} tilbage</button>`);
}

function openGarage(idx) {
  const x = S.expedition;
  if (x && Date.now() >= x.end) {
    const res = finishExpedition();
    const list = res.found.map(([it, n]) => `<span>${icon(it)} ${n} × ${ITEMS[it].name}</span>`).join('');
    showModal(`${icon('rover')} Roveren er tilbage!`, `
      <p>Fra ${res.e.name} har roveren fundet:</p>
      <div class="unlocks">${list || '<span>Kun støv denne gang</span>'}</div>
      <p class="muted small">Krystaller og artefakter kan sælges dyrt på lageret.</p>
      <button class="primary wide" data-act="close">Fantastisk</button>`);
    return;
  }
  if (x) {
    const e = EXPEDITIONS.find((y) => y.id === x.id);
    showModal(`${icon('garage')} Rovergarage`, `
      <div class="row"><div class="ico">${icon('rover')}</div><div class="info"><b>På vej til ${e.name}</b>
      <small>Tilbage om <span data-until="${x.end}"></span></small></div></div>`);
    return;
  }
  const rows = EXPEDITIONS.map((e) => {
    const locked = e.level > S.level;
    const ok = !locked && Object.entries(e.cost).every(([it, q]) => have(it) >= q);
    const loot = e.loot.map(([it, , , ch]) => `${icon(it, 'ic-s')}${ch < 1 ? ` ${Math.round(ch * 100)} %` : ''}`).join(' ');
    return `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon('rover')}</div>
      <div class="info"><b>${e.name}</b><small>${locked ? `Låses op på niveau ${e.level}` : `${e.desc} · ${fmtTime(e.time)} · fund: ${loot}`}</small>
      ${locked ? '' : `<div class="needs">${needList(e.cost)}</div>`}</div>
      <button class="primary" data-act="expedition" data-arg="${e.id}" ${ok ? '' : 'disabled'}>Send</button>
    </div>`;
  }).join('');
  showModal(`${icon('garage')} Rovergarage`, `<p class="muted tip">Roveren skal have brændstof og proviant med.</p><div class="list">${rows}</div>`);
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
    <button class="${tab === 'boers' ? 'on' : ''}" data-act="invtab" data-arg="boers">${icon('boers', 'ic-s')} Rumbørsen</button></div>`;
  if (tab === 'boers') return openMarket(tabs);
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
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const built = owns(id), locked = b.level > S.level;
    const what = b.recipes.length ? 'Laver ' + b.recipes.map((r) => ITEMS[r].name.toLowerCase()).join(', ') : b.desc;
    rows += `<div class="row ${locked ? 'locked' : ''}">
      <div class="ico">${icon(id)}</div>
      <div class="info"><b>${b.name}</b><small>${built ? 'Allerede bygget' : locked ? `Låses op på niveau ${b.level}` : what}</small></div>
      <button class="primary" data-act="build" data-idx="${idx}" data-arg="${id}" ${built || locked || S.credits < b.cost ? 'disabled' : ''}>${b.cost} ${icon('coin', 'ic-s')}</button>
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
  const cost = clearCost(S.cleared);
  showModal(`${icon('rock')} Klipper`, `<p>Ryd klipperne, og gør plads til flere kupler og bygninger. Måske finder du jernmalm.</p>
    <button class="primary wide" data-act="clear" data-idx="${idx}" ${S.credits < cost ? 'disabled' : ''}>Ryd feltet · ${cost} ${icon('coin', 'ic-s')}</button>`);
}

function openColony(tab = 'goals') {
  const tabs = [['goals', 'Mål'], ['medals', 'Medaljer'], ['robots', 'Robotter'], ['people', 'Kolonister']];
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
    <p class="small">Få besked, når afgrøder, bygninger, roveren eller forskningen er klar. Det virker, mens spillet er åbent i baggrunden, og bedst når det er installeret som app.</p>
    <button data-act="notify" ${Notify.supported() ? '' : 'disabled'}>${icon('klokke', 'ic-s')} ${Notify.on ? 'Slå beskeder fra' : 'Giv mig besked'}</button>
    <div class="section-title">Spil på flere enheder</div>
    <p class="small">Med en gemmekode kan du flytte din koloni til en anden telefon eller computer.</p>
    <div class="btnrow"><button data-act="export">Vis gemmekode</button><button data-act="import">Indlæs gemmekode</button>
    ${installPrompt ? '<button class="primary" data-act="install">Installér som app</button>' : ''}</div>
    <div id="savebox"></div>
    <div class="section-title">Forfra</div>
    <button data-act="reset">Start en ny koloni</button>`);
}

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
    case 'sound': {
      const m = Sound.toggle();
      btn.innerHTML = icon(m ? 'mute' : 'sound');
      if (!m) Sound.play('click');
      return;
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
    case 'reset':
      if (confirm('Vil du slette din koloni og starte forfra?')) { newState(); save(); closeModal(); centerCamera(); }
      return;
  }
});
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------- HUD ----------
function updateHUD() {
  $('credits').textContent = S.credits.toLocaleString('da-DK');
  $('level').textContent = S.level;
  const need = xpNeeded(S.level);
  $('xpfill').style.width = (S.xp / need) * 100 + '%';
  $('xptext').textContent = `${S.xp}/${need}`;
  const ready = S.orders.filter(canFulfil).length + (S.colonist && canFulfil(S.colonist) ? 1 : 0);
  setBadge('orderBadge', ready);
  setBadge('colonyBadge', claimableGoals());
  $('silo').textContent = `${invTotal()}/${cap()}`;
  const fest = isFestival();
  $('festChip').hidden = !fest;
  if (fest) $('festNum').textContent = S.tickets;
  $('arcadeBtn').hidden = S.level < ARCADE.level;
  Notify.badge(readyCount());
  const h = happiness();
  $('happy').hidden = !h;
  $('happyNum').textContent = `${h} %`;
  $('silo').classList.toggle('full', invTotal() >= cap());
  const clk = solClock();
  $('clock').innerHTML = `${icon(clk.night ? 'moon' : 'sun', 'ic-s')} Sol ${clk.sol} · ${clk.time}`;

  const tb = $('tutorial');
  if (S.tut < TUTORIAL.length) {
    tb.hidden = false;
    tb.innerHTML = `<span class="step">${S.tut + 1}/${TUTORIAL.length}</span> ${TUTORIAL[S.tut].text}`;
  } else tb.hidden = true;

  const eb = $('eventBanner'), ev = S.event, now = Date.now();
  if (ev.type && ev.until > now) {
    eb.hidden = false;
    eb.innerHTML = ev.type === 'storm'
      ? `${icon('storm', 'ic-s')} Støvstorm · ${fmtTime((ev.until - now) / 1000)}${owns('skjold') ? ' · skjoldet beskytter' : ''}`
      : `${icon('meteor', 'ic-s')} Meteorregn · saml jernmalmen op`;
  } else eb.hidden = true;

  document.querySelectorAll('[data-until]').forEach((el) => { el.textContent = fmtTime((Number(el.dataset.until) - now) / 1000); });
}

function setBadge(id, n) {
  const b = $(id);
  b.hidden = !n;
  b.textContent = n;
}
