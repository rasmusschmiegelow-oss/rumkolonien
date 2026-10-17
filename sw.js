// Service worker: gør spillet installérbart og spilbart uden net.
// Filer hentes fra cachen med det samme og opdateres i baggrunden.
const CACHE = 'rumkolonien-v3';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/data.js', 'js/audio.js', 'js/sprites.js', 'js/state.js', 'js/map.js', 'js/ui.js', 'js/main.js',
  'assets/app-192.png', 'assets/app-512.png',
  "assets/icons/aeg.svg",
  "assets/icons/alge.svg",
  "assets/icons/artefakt.svg",
  "assets/icons/bageri.svg",
  "assets/icons/batteri.svg",
  "assets/icons/batterifabrik.svg",
  "assets/icons/bioreaktor.svg",
  "assets/icons/bomuld.svg",
  "assets/icons/box.svg",
  "assets/icons/braendstof.svg",
  "assets/icons/broed.svg",
  "assets/icons/chili.svg",
  "assets/icons/chilisauce.svg",
  "assets/icons/coin.svg",
  "assets/icons/col-bo.svg",
  "assets/icons/col-dina.svg",
  "assets/icons/col-ida.svg",
  "assets/icons/col-kim.svg",
  "assets/icons/druer.svg",
  "assets/icons/foder.svg",
  "assets/icons/foderfabrik.svg",
  "assets/icons/garage.svg",
  "assets/icons/ged.svg",
  "assets/icons/gedestald.svg",
  "assets/icons/gift.svg",
  "assets/icons/goal.svg",
  "assets/icons/gryde.svg",
  "assets/icons/hoensehus.svg",
  "assets/icons/hone.svg",
  "assets/icons/hoster.svg",
  "assets/icons/hvede.svg",
  "assets/icons/ilt.svg",
  "assets/icons/isbor.svg",
  "assets/icons/jern.svg",
  "assets/icons/jordbaer.svg",
  "assets/icons/kaffe.svg",
  "assets/icons/kaffebar.svg",
  "assets/icons/kartoffel.svg",
  "assets/icons/krydderilab.svg",
  "assets/icons/krystal.svg",
  "assets/icons/kuppel.svg",
  "assets/icons/latte.svg",
  "assets/icons/madprinter.svg",
  "assets/icons/maelk.svg",
  "assets/icons/medalje.svg",
  "assets/icons/mejeri.svg",
  "assets/icons/meteor.svg",
  "assets/icons/mine.svg",
  "assets/icons/moon.svg",
  "assets/icons/mute.svg",
  "assets/icons/ost.svg",
  "assets/icons/pad.svg",
  "assets/icons/pakker.svg",
  "assets/icons/pandekage.svg",
  "assets/icons/pizza.svg",
  "assets/icons/plot.svg",
  "assets/icons/rock.svg",
  "assets/icons/rocket.svg",
  "assets/icons/rover.svg",
  "assets/icons/rumdragt.svg",
  "assets/icons/skjold.svg",
  "assets/icons/sound.svg",
  "assets/icons/sprout.svg",
  "assets/icons/stof.svg",
  "assets/icons/storm.svg",
  "assets/icons/sun.svg",
  "assets/icons/suppe.svg",
  "assets/icons/svamp.svg",
  "assets/icons/taerte.svg",
  "assets/icons/tekstil.svg",
  "assets/icons/tomat.svg",
  "assets/icons/vand.svg",
  "assets/icons/vin.svg",
  "assets/icons/vinkaelder.svg",
  "assets/icons/xp.svg",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
