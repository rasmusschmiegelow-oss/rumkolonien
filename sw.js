// Service worker: gør spillet installérbart og spilbart uden net.
const CACHE = 'rumkolonien-v10';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/data.js', 'js/audio.js', 'js/music.js', 'js/arcade.js', 'js/notify.js', 'js/cloud.js', 'js/sprites.js', 'js/state.js', 'js/map.js', 'js/ui.js', 'js/main.js',
  'assets/app-192.png', 'assets/app-512.png',
  "assets/icons/aeg.svg",
  "assets/icons/alge.svg",
  "assets/icons/artefakt.svg",
  "assets/icons/asteroide.svg",
  "assets/icons/bageri.svg",
  "assets/icons/batteri.svg",
  "assets/icons/batteribank.svg",
  "assets/icons/batterifabrik.svg",
  "assets/icons/befolkning.svg",
  "assets/icons/bioreaktor.svg",
  "assets/icons/boelle.svg",
  "assets/icons/boers.svg",
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
  "assets/icons/container.svg",
  "assets/icons/deco-flag.svg",
  "assets/icons/deco-lampe.svg",
  "assets/icons/deco-lanterne.svg",
  "assets/icons/deco-raketmonument.svg",
  "assets/icons/deco-springvand.svg",
  "assets/icons/deco-statue.svg",
  "assets/icons/deco-teleskop.svg",
  "assets/icons/deco-trae.svg",
  "assets/icons/druer.svg",
  "assets/icons/efteraar.svg",
  "assets/icons/energi.svg",
  "assets/icons/festbillet.svg",
  "assets/icons/flyt.svg",
  "assets/icons/foder.svg",
  "assets/icons/foderfabrik.svg",
  "assets/icons/foraar.svg",
  "assets/icons/fragment.svg",
  "assets/icons/garage.svg",
  "assets/icons/ged.svg",
  "assets/icons/gedestald.svg",
  "assets/icons/gift.svg",
  "assets/icons/goal.svg",
  "assets/icons/gryde.svg",
  "assets/icons/habitat.svg",
  "assets/icons/hoensehus.svg",
  "assets/icons/hone.svg",
  "assets/icons/hoster.svg",
  "assets/icons/hvede.svg",
  "assets/icons/ilt.svg",
  "assets/icons/isbor.svg",
  "assets/icons/iskrater.svg",
  "assets/icons/jern.svg",
  "assets/icons/jordbaer.svg",
  "assets/icons/joystick.svg",
  "assets/icons/kaffe.svg",
  "assets/icons/kaffebar.svg",
  "assets/icons/kamera.svg",
  "assets/icons/kartoffel.svg",
  "assets/icons/klokke.svg",
  "assets/icons/krydderilab.svg",
  "assets/icons/krystal.svg",
  "assets/icons/krystalaare.svg",
  "assets/icons/krystalbor.svg",
  "assets/icons/kuppel.svg",
  "assets/icons/lab.svg",
  "assets/icons/latte.svg",
  "assets/icons/lykke.svg",
  "assets/icons/madprinter.svg",
  "assets/icons/maelk.svg",
  "assets/icons/medalje.svg",
  "assets/icons/mejeri.svg",
  "assets/icons/meteor.svg",
  "assets/icons/mine.svg",
  "assets/icons/mission.svg",
  "assets/icons/moderskib.svg",
  "assets/icons/monolit.svg",
  "assets/icons/moon.svg",
  "assets/icons/musik-fra.svg",
  "assets/icons/musik.svg",
  "assets/icons/mute.svg",
  "assets/icons/nabo.svg",
  "assets/icons/ost.svg",
  "assets/icons/pad.svg",
  "assets/icons/pakker.svg",
  "assets/icons/pandekage.svg",
  "assets/icons/phobos.svg",
  "assets/icons/pizza.svg",
  "assets/icons/plot.svg",
  "assets/icons/pokal.svg",
  "assets/icons/rock.svg",
  "assets/icons/rocket.svg",
  "assets/icons/rover.svg",
  "assets/icons/ruin.svg",
  "assets/icons/rumdragt.svg",
  "assets/icons/rumposten.svg",
  "assets/icons/saml.svg",
  "assets/icons/skjold.svg",
  "assets/icons/solpanel.svg",
  "assets/icons/sommer.svg",
  "assets/icons/sound.svg",
  "assets/icons/sprout.svg",
  "assets/icons/stof.svg",
  "assets/icons/storm.svg",
  "assets/icons/sun.svg",
  "assets/icons/suppe.svg",
  "assets/icons/svamp.svg",
  "assets/icons/taerte.svg",
  "assets/icons/tekstil.svg",
  "assets/icons/terraform.svg",
  "assets/icons/tomat.svg",
  "assets/icons/vand.svg",
  "assets/icons/vin.svg",
  "assets/icons/vindmolle.svg",
  "assets/icons/vinkaelder.svg",
  "assets/icons/vinter.svg",
  "assets/icons/vrag.svg",
  "assets/icons/vulkan.svg",
  "assets/icons/xp.svg",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Kode og sider hentes fra nettet først, så en ny version slår igennem med det samme.
// Ikoner ændrer sig sjældent og tages fra cachen. Uden net bruges cachen til alt.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true });
  const fromNet = () => fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  });
  if (url.pathname.includes('/assets/')) {
    e.respondWith(fromCache().then((hit) => hit || fromNet()));
  } else {
    e.respondWith(fromNet().catch(() => fromCache()));
  }
});

// Tryk på en besked åbner spillet.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => 'focus' in c);
    return w ? w.focus() : self.clients.openWindow('./');
  }));
});
