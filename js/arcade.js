'use strict';
// Asteroidejagt: tryk på asteroiderne, før de rammer kolonien. Gyldne krystaller giver ekstra.

function openArcade() {
  const left = arcadePlaysLeft();
  showModal(`${icon('joystick')} Asteroidejagt`, `
    <p>Asteroiderne regner ned over kolonien. Tryk på dem for at sprænge dem, før de når jorden. Krystallerne er sjældne og giver ekstra.</p>
    <div class="arcade-stats"><span>Runder tilbage i dag: <b>${left}/${ARCADE.plays}</b></span><span>Bedste: <b>${S.arcade.best}</b></span></div>
    <button class="primary wide" data-act="arcadestart" ${left ? '' : 'disabled'}>${left ? 'Start' : 'Kom tilbage i morgen'}</button>`);
}

function startArcade() {
  if (!arcadePlaysLeft()) return;
  showModal(`${icon('joystick')} Asteroidejagt`, `
    <div class="arcade-hud"><span>Point <b id="arcScore">0</b></span><span id="arcTime">${ARCADE.seconds}s</span></div>
    <canvas id="arcade" class="arcade"></canvas>`);
  const cv = document.getElementById('arcade');
  const g = cv.getContext('2d');
  const W = cv.clientWidth, H = Math.round(Math.min(window.innerHeight * 0.55, W * 1.15));
  const dpr = window.devicePixelRatio || 1;
  cv.style.height = H + 'px';
  cv.width = W * dpr; cv.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const rocks = [], bits = [];
  const start = performance.now();
  let score = 0, golden = 0, last = start, spawn = 0, done = false;
  const stars = Array.from({ length: 50 }, () => [Math.random() * W, Math.random() * H, Math.random()]);

  function add() {
    const gold = Math.random() < 0.07;
    const small = !gold && Math.random() < 0.3;
    const r = gold ? 20 : small ? 16 : 24 + Math.random() * 8;
    const t = (performance.now() - start) / 1000;
    rocks.push({ x: r + Math.random() * (W - 2 * r), y: -r, r, gold, small,
      vy: (55 + Math.random() * 45 + t * 3.5) * (small ? 1.5 : 1), vx: (Math.random() - 0.5) * 30, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2 });
  }

  function hit(e) {
    if (done) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = rocks.length - 1; i >= 0; i--) {
      const a = rocks[i];
      if (Math.hypot(a.x - x, a.y - y) < a.r + 14) {
        rocks.splice(i, 1);
        const pts = a.gold ? 5 : a.small ? 2 : 1;
        score += pts;
        if (a.gold) golden++;
        for (let k = 0; k < 12; k++) {
          const ang = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120;
          bits.push({ x: a.x, y: a.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0.6, c: a.gold ? '#B17FDB' : '#B89A88' });
        }
        bits.push({ x: a.x, y: a.y, vx: 0, vy: -40, life: 0.8, text: '+' + pts });
        Sound.play('boom', { gap: 0 }); if (a.gold) Sound.play('gold');
        document.getElementById('arcScore').textContent = score;
        return;
      }
    }
  }
  cv.addEventListener('pointerdown', hit);

  function frame(now) {
    if (!document.body.contains(cv)) return; // dialogen er lukket
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    const remain = Math.max(0, ARCADE.seconds - t);
    document.getElementById('arcTime').textContent = Math.ceil(remain) + 's';

    spawn -= dt;
    if (spawn <= 0 && remain > 0) { add(); spawn = Math.max(0.28, 0.9 - t * 0.02); }

    g.fillStyle = '#120D1C'; g.fillRect(0, 0, W, H);
    for (const [sx, sy, b] of stars) { g.fillStyle = `rgba(255,255,255,${0.3 + b * 0.5})`; g.fillRect(sx, sy, 1.5, 1.5); }
    // Mars i bunden
    g.fillStyle = '#C8623A'; g.beginPath(); g.ellipse(W / 2, H + W * 0.55, W * 0.9, W * 0.62, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2A1A14'; g.lineWidth = 3; g.stroke();

    for (let i = rocks.length - 1; i >= 0; i--) {
      const a = rocks[i];
      a.y += a.vy * dt; a.x += a.vx * dt; a.rot += a.vr * dt;
      if (a.y - a.r > H - 30) {
        rocks.splice(i, 1);
        for (let k = 0; k < 6; k++) bits.push({ x: a.x, y: H - 30, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 80, life: 0.5, c: '#FF7A1A' });
        continue;
      }
      g.save(); g.translate(a.x, a.y); g.rotate(a.rot);
      drawSprite(g, a.gold ? 'krystal' : 'asteroide', 0, 0, a.r * 2.4);
      g.restore();
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      g.globalAlpha = Math.min(1, b.life * 2);
      if (b.text) {
        g.font = 'bold 18px "Space Grotesk", sans-serif'; g.textAlign = 'center';
        g.lineWidth = 4; g.strokeStyle = '#2A1A14'; g.strokeText(b.text, b.x, b.y);
        g.fillStyle = '#FFF'; g.fillText(b.text, b.x, b.y);
      } else { g.fillStyle = b.c; g.fillRect(b.x - 2, b.y - 2, 4, 4); }
      g.globalAlpha = 1;
    }

    if (remain <= 0 && !done) {
      done = true;
      const record = score > S.arcade.best;
      const r = arcadeReward(score, golden);
      Sound.play('arcade');
      setTimeout(() => {
        showModal(`${icon('joystick')} Godt skudt!`, `
          <div class="levelup"><div class="big-num">${score}</div><p>point${record ? ' · ny rekord!' : ''}</p>
          <div class="unlocks"><span>${icon('coin')} +${r.credits}</span>${r.jern ? `<span>${icon('jern')} +${r.jern}</span>` : ''}${r.krystal ? `<span>${icon('krystal')} +${r.krystal}</span>` : ''}</div>
          <button class="primary wide" data-act="arcade">${arcadePlaysLeft() ? `Spil igen (${arcadePlaysLeft()} tilbage)` : 'Færdig for i dag'}</button></div>`);
      }, 400);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
