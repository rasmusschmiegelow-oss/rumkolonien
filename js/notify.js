'use strict';
// Beskeder, når noget bliver klar, mens spillet ligger i baggrunden, og et tal på app-ikonet.
// Uden en server kan beskederne kun sendes, så længe browseren holder spillet i live.

const Notify = (() => {
  const KEY = 'rumkolonien-notify';
  let wanted = false;
  try { wanted = localStorage.getItem(KEY) === '1'; } catch (e) { /* ingen lagring */ }
  let timers = [];
  let lastBadge = -1;

  const supported = () => 'Notification' in window;
  const allowed = () => supported() && Notification.permission === 'granted';

  async function show(title, body) {
    const opts = { body, icon: 'assets/app-192.png', badge: 'assets/app-192.png', tag: title };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) return reg.showNotification(title, opts);
      new Notification(title, opts);
    } catch (e) { /* beskeder er en bonus */ }
  }

  // Kommende ting, der bliver klar, med tidspunkt.
  function upcoming() {
    const now = Date.now(), ev = [];
    const crops = S.tiles.filter((t) => t.t === 'plot' && t.crop && t.end > now);
    if (crops.length) {
      const first = crops.reduce((a, b) => (b.end < a.end ? b : a));
      ev.push({ at: first.end, title: 'Afgrøderne er modne', body: `${ITEMS[first.crop].name} er klar til høst i drivhuskuplerne.` });
    }
    S.tiles.forEach((t) => {
      if (t.t !== 'b' || !t.queue || !t.queue.length) return;
      const lastQ = t.queue[t.queue.length - 1];
      if (lastQ.end > now) ev.push({ at: lastQ.end, title: `${BUILDINGS[t.id].name} er færdig`, body: 'Saml varerne, og sæt ny produktion i gang.' });
    });
    const pens = S.tiles.filter((t) => t.t === 'pen').flatMap((t) => t.animals.filter((a) => a.end > now).map((a) => ({ a, t })));
    if (pens.length) {
      const p = pens.reduce((x, y) => (y.a.end < x.a.end ? y : x));
      ev.push({ at: p.a.end, title: `${ANIMALS[p.t.id].animalName} har noget til dig`, body: `${ITEMS[ANIMALS[p.t.id].product].name} er klar.` });
    }
    if (S.expedition && S.expedition.end > now) ev.push({ at: S.expedition.end, title: 'Roveren er tilbage', body: 'Se, hvad den har fundet.' });
    if (S.research.active && S.research.active.end > now) ev.push({ at: S.research.active.end, title: 'Forskningen er færdig', body: `${RESEARCH[S.research.active.id].name} er klar.` });
    if (!S.ship && S.level >= SHIP.level && S.shipNext > now) ev.push({ at: S.shipNext, title: 'Moderskibet er på vej', body: 'Der er nye containere, der skal fyldes.' });
    return ev.sort((a, b) => a.at - b.at).slice(0, 8);
  }

  function clear() { timers.forEach(clearTimeout); timers = []; }

  function schedule() {
    clear();
    if (!wanted || !allowed()) return;
    const now = Date.now();
    for (const e of upcoming()) {
      if (e.at - now > 6 * 60 * 60 * 1000) continue;
      timers.push(setTimeout(() => { if (document.hidden) show(e.title, e.body); }, e.at - now + 1000));
    }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) schedule(); else clear(); });

  return {
    get on() { return wanted && allowed(); },
    supported,
    async toggle() {
      if (wanted && allowed()) {
        wanted = false;
      } else {
        if (!supported()) return false;
        const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
        if (p === 'denied') return 'denied';
        wanted = p === 'granted';
      }
      try { localStorage.setItem(KEY, wanted ? '1' : '0'); } catch (e) { /* ingen lagring */ }
      return wanted;
    },
    badge(n) {
      if (n === lastBadge || !('setAppBadge' in navigator)) return;
      lastBadge = n;
      try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) { /* ikke understøttet */ }
    },
  };
})();
