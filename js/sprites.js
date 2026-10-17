'use strict';
// Grafik tegnet i Paper (assets/icons/*.svg). Hvert ikon rasteriseres én gang
// i 4x opløsning, så det er skarpt på kortet, også når man zoomer.

const ICON_DIR = 'assets/icons/';
const SPRITES = {};
const SPRITE_NAMES = [
  ...Object.keys(ITEMS), ...Object.keys(BUILDINGS),
  'plot', 'kuppel', 'pad', 'rock', 'sprout',
  'col-ida', 'col-bo', 'col-kim', 'col-dina', 'hoster', 'pakker',
  'rocket', 'coin', 'xp', 'box', 'goal', 'storm', 'meteor', 'gift', 'sun', 'moon', 'sound', 'mute',
];

function loadSprites() {
  return Promise.all(SPRITE_NAMES.map((name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 64, h = img.naturalHeight || 64, k = 4;
      const c = document.createElement('canvas');
      c.width = w * k; c.height = h * k;
      c.getContext('2d').drawImage(img, 0, 0, w * k, h * k);
      SPRITES[name] = { img: c, w, h };
      resolve();
    };
    img.onerror = () => resolve();
    img.src = ICON_DIR + name + '.svg';
  })));
}

// <img>-tag til brug i menuer og HUD.
const icon = (name, cls = 'ic') => `<img class="${cls}" src="${ICON_DIR}${name}.svg" alt="" draggable="false">`;

// Tegn en sprite centreret vandret om x, med bunden af dens "fod" (fy i spritens
// egne koordinater) placeret på y.
function drawSprite(ctx, name, x, y, size, footY) {
  const s = SPRITES[name];
  if (!s) return;
  const k = size / s.w;
  const fy = footY == null ? s.h / 2 : footY;
  ctx.drawImage(s.img, x - (s.w * k) / 2, y - fy * k, s.w * k, s.h * k);
}
