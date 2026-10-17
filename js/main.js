'use strict';
// Opstart og hovedløkke.

let lastFrame = performance.now(), lastTick = 0, lastModalTick = 0;

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
    researchTick(t);
  }
  updateAgents(dt);
  draw(now);
  updateHUD();
  if (modalView && now - lastModalTick > 500) { lastModalTick = now; modalView(); }
  requestAnimationFrame(loop);
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
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

  const daily = checkDaily();
  if (S.tut === 0 && S.stats.harvest === 0) openHelp();
  else if (daily) showDaily(daily);
}

start();
