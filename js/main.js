'use strict';
// Opstart og hovedløkke.

let lastFrame = performance.now(), lastTick = 0, lastModalTick = 0, lastSeason = -1;

function loop(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (now - lastTick > 250) {
    lastTick = now;
    const t = Date.now();
    expireOrders(t);
    eventTick(t);
    colonistTick(t);
    tutorialTick();
    medalTick();
    shipTick(t);
    petTick(t);
    popTick(t);
    mysteryTick(t);
    if (lastSeason !== seasonIndex(t)) {
      if (lastSeason !== -1) { const se = season(t); toast(`${icon(se.id)} Nu er det <b>${se.name.toLowerCase()}</b> på Mars. ${se.desc}`, 'good', 6000); }
      lastSeason = seasonIndex(t);
    }
    researchTick(t);
    colonyTick(t);
    Sound.ambience(soundscape(t));
  }
  updateAgents(dt);
  draw(now);
  updateHUD();
  if (modalView && now - lastModalTick > 500) { lastModalTick = now; modalView(); }
  requestAnimationFrame(loop);
}

// Hvad kulissen skal spille: vejr, tid på døgnet og det, der arbejder tæt på midten af skærmen.
function soundscape(now) {
  const st = { storm: S.event.type === 'storm' && S.event.until > now, night: solClock(now).night,
    winter: season(now).id === 'vinter', machines: 0, lab: 0, animal: null };
  let near = Infinity;
  const reach = Math.max(viewW, viewH) * 0.55;
  S.tiles.forEach((t, i) => {
    if (t.t !== 'b' && t.t !== 'pen') return;
    const [x, y] = toScreen(...tileCenter(i));
    const d = Math.hypot(x - viewW / 2, y - viewH / 2), w = Math.max(0, 1 - d / reach);
    if (!w) return;
    if (t.t === 'pen') { if (t.animals.length && d < near) { near = d; st.animal = ANIMALS[t.id].animal; } return; }
    if (t.queue && t.queue.some((q) => q.start <= now && q.end > now)) st.machines += w * 0.45;
    if (t.id === 'lab' && S.research.active) st.lab = Math.max(st.lab, w);
  });
  return st;
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Når en ny version af appen tager over, genindlæses siden én gang, så alle filer passer sammen.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; save(); location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* spillet virker også uden */ });
}

async function start() {
  load();
  await loadSprites();
  resize();
  centerCamera();
  ensureWeekly();
  robotsCatchUp();
  $('soundBtn').innerHTML = icon(Sound.muted ? 'mute' : 'sound');
  $('musicBtn').innerHTML = icon(Music.on ? 'musik' : 'musik-fra');
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  setInterval(save, 5000);
  document.body.classList.add('ready');
  requestAnimationFrame(loop);

  Cloud.start();
  const daily = checkDaily();
  if (S.tut === 0 && S.stats.harvest === 0) openHelp();
  else if (daily) showDaily(daily);
}

start();
