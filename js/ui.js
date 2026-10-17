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
  if (collectPickup(idx)) return;
  Sound.play('click');
  switch (tile.t) {
    case 'plot':
      if (!tile.crop) return openPlant(idx);
      if (now >= tile.end) return harvest(idx);
      return toast(`${icon(tile.crop)} ${ITEMS[tile.crop].name} er klar om ${fmtTime((tile.end - now) / 1000)}`);
    case 'b':
      if (BUILDINGS[tile.id].garage) return openGarage(idx);
      collect(idx);
      return openBuilding(idx);
    case 'pen': return tapPen(idx);
    case 'pad': return openOrders();
    case 'empty': return openBuild(idx);
    case 'locked':
      if (!neighbourCleared(idx)) return toast('Ryd et felt ved siden af først.');
      return openClear(idx);
  }
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
    <div class="reward">+${o.credits} ${icon('coin', 'ic-s')} · +${o.xp} ${icon('xp', 'ic-s')}</div>
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
        <div class="col-foot"><span class="reward">+${c.credits} ${icon('coin', 'ic-s')} · +${c.xp} ${icon('xp', 'ic-s')}</span>
        <button class="primary" data-act="colonist" ${ok ? '' : 'disabled'}>Giv</button></div>
      </div>
    </div>`;
  }
  showModal(`${icon('rocket')} Landingspladsen`,
    `${col}<div class="section-title">Fragtskibe</div>
     <div class="orders">${S.orders.map(orderCard).join('')}</div>`);
}

function openInventory() {
  const ids = Object.keys(ITEMS).filter((id) => have(id) > 0);
  const used = invTotal(), c = cap(), cost = siloCost(S.silo);
  const rows = ids.map((id) => `<div class="inv-item">
      ${icon(id, 'ic-l')}
      <div class="info"><b>${have(id)}</b><small>${ITEMS[id].name}</small></div>
      <button data-act="sell" data-arg="${id}" title="Sælg 1 for ${Math.max(1, Math.ceil(ITEMS[id].value / 2))} kreditter">+${Math.max(1, Math.ceil(ITEMS[id].value / 2))}${icon('coin', 'ic-s')}</button>
    </div>`).join('');
  showModal(`${icon('box')} Lager`,
    `<div class="silo">
      <div class="silo-bar"><div style="width:${Math.min(100, used / c * 100)}%" class="${used >= c ? 'full' : ''}"></div></div>
      <div class="silo-row"><span><b>${used}/${c}</b> pladser brugt</span>
      <button class="primary" data-act="silo" ${S.credits < cost ? 'disabled' : ''}>Udvid +30 · ${cost} ${icon('coin', 'ic-s')}</button></div>
    </div>
    <div class="inv">${rows || '<p class="muted">Lageret er tomt. Plant noget i kuplerne!</p>'}</div>
    <p class="muted small">Tryk på prisen for at sælge én vare.</p>`);
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
  showModal(`${icon('box')} Byg her`, `<div class="list">${rows}</div>`);
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
    case 'sell': sell(arg); return openInventory();
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
