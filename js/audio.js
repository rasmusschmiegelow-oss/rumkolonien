'use strict';
// Lyd: effekter, jingler og stemmer som lydfiler, plus vind og maskinsummen som kulisse.
// Alt går gennem fire kanaler (musik, effekter, kulisse, stemmer) med hver sin styrke.
// Indtil filerne er hentet, spilles enkle lyde, der genereres i browseren.

const Sound = (() => {
  const KEY = 'rumkolonien-mute', VOL_KEY = 'rumkolonien-vol';
  let ac = null, master = null;
  const bus = {};
  let muted = false;
  let tapped = false; // browsere tillader kun lyd og vibration efter et tryk på skærmen
  let vol = { music: 0.6, sfx: 0.8, amb: 0.5, voice: 0.9 };
  try {
    muted = localStorage.getItem(KEY) === '1';
    vol = { ...vol, ...JSON.parse(localStorage.getItem(VOL_KEY) || '{}') };
  } catch (e) { /* ingen lagring */ }

  // ---------- Lydfiler ----------
  // navn: [filer], styrke, tonehøjde (min, max). Kenney.nl, CC0.
  const SFX = {
    click:   { f: ['click1', 'click2', 'click3'], v: 0.5, r: [0.95, 1.08] },
    open:    { f: ['open1', 'open2'], v: 0.45, r: [0.97, 1.05] },
    close:   { f: ['close1', 'close2'], v: 0.4, r: [0.97, 1.05] },
    plop:    { f: ['harvest1', 'harvest2', 'harvest3'], v: 0.75, r: [0.96, 1.04] },
    plant:   { f: ['plant1', 'plant2', 'plant3'], v: 0.7, r: [0.9, 1.1] },
    coin:    { f: ['coin1', 'coin2', 'coin3'], v: 0.6, r: [0.95, 1.1] },
    cash:    { f: ['cash1', 'cash2'], v: 0.7, r: [0.97, 1.03] },
    error:   { f: ['error1', 'error2'], v: 0.5, r: [1, 1] },
    build:   { f: ['build1', 'build2', 'build3'], v: 0.55, r: [0.9, 1.05] },
    pickup:  { f: ['pickup1', 'pickup2', 'pickup3'], v: 0.5, r: [0.97, 1.06] },
    queue:   { f: ['queue1', 'queue2'], v: 0.5, r: [0.95, 1.05] },
    clear:   { f: ['clear1', 'clear2'], v: 0.7, r: [0.9, 1.05] },
    whoosh:  { f: ['thruster'], v: 0.45, r: [0.95, 1.05], len: 1.8 },
    rover:   { f: ['rover'], v: 0.5, r: [1.1, 1.2], len: 1.6 },
    storm:   { f: ['thunder'], v: 0.8, r: [0.8, 0.95] },
    boom:    { f: ['boom1', 'boom2', 'boom3'], v: 0.45, r: [1.1, 1.4] },
    gold:    { f: ['forcefield'], v: 0.5, r: [1.2, 1.3] },
    decode:  { f: ['decode'], v: 0.5, r: [1, 1], len: 1.4 },
    door:    { f: ['door1', 'door2'], v: 0.35, r: [0.95, 1.05] },
    glass:   { f: ['glass1', 'glass2'], v: 0.5, r: [0.95, 1.1] },
    // jingler: musikken dæmpes, mens de spiller
    levelup:  { f: ['j_levelup'], v: 0.7, jingle: true },
    level:    { f: ['j_reward'], v: 0.6, jingle: true },
    medal:    { f: ['j_medal'], v: 0.65, jingle: true },
    mission:  { f: ['j_mission'], v: 0.65, jingle: true },
    research: { f: ['j_research'], v: 0.6, jingle: true },
    ship:     { f: ['j_ship'], v: 0.65, jingle: true },
    upgrade:  { f: ['j_upgrade'], v: 0.6, jingle: true },
    mystery:  { f: ['j_mystery'], v: 0.65, jingle: true },
    arcade:   { f: ['j_arcade'], v: 0.55, jingle: true },
  };
  const LOOPS = ['hum', 'computer'];
  const buffers = {};
  let loading = null;

  async function fetchBuf(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path);
    const data = await res.arrayBuffer();
    // Safari kender kun callback-udgaven af decodeAudioData
    return new Promise((ok, bad) => ac.decodeAudioData(data, ok, bad));
  }

  function loadAll() {
    if (loading) return loading;
    const names = [...new Set(Object.values(SFX).flatMap((s) => s.f).concat(LOOPS))];
    loading = Promise.all(names.map((n) => fetchBuf(`assets/sfx/${n}.m4a`)
      .then((b) => { buffers[n] = b; }).catch(() => { /* syntetisk lyd i stedet */ })));
    return loading;
  }

  function init() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    // en blød limiter, så mange lyde på én gang ikke klipper
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6;
    master.connect(comp).connect(ac.destination);
    for (const k of ['music', 'sfx', 'amb', 'voice']) {
      bus[k] = ac.createGain();
      bus[k].gain.value = vol[k];
      bus[k].connect(master);
    }
    // Musik og kulisse dæmpes, når nogen taler eller en jingle spiller.
    bus.duck = ac.createGain();
    bus.music.disconnect(); bus.music.connect(bus.duck);
    bus.amb.disconnect(); bus.amb.connect(bus.duck);
    bus.duck.connect(master);
    loadAll();
    return ac;
  }

  function unlock() {
    tapped = true;
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    Ambience.start();
  }
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else if (tapped) ac.resume();
  });

  function duck(sec, depth = 0.35) {
    if (!ac) return;
    const g = bus.duck.gain, t = ac.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(depth, t, 0.08);
    g.setTargetAtTime(1, t + sec, 0.4);
  }

  // Spiller en buffer. Returnerer kilden, så den kan stoppes.
  function playBuf(buf, out, gain, rate = 1, len = 0) {
    const src = ac.createBufferSource(), g = ac.createGain(), t = ac.currentTime;
    src.buffer = buf;
    src.playbackRate.value = rate;
    g.gain.value = gain;
    if (len) { g.gain.setValueAtTime(gain, t + len - 0.4); g.gain.linearRampToValueAtTime(0.0001, t + len); }
    src.connect(g).connect(out);
    src.start(t);
    if (len) src.stop(t + len + 0.05);
    return src;
  }

  // ---------- Syntetiske reservelyde ----------
  function tone(freq, dur, type = 'sine', v = 0.15, slide = 0, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const SYNTH = {
    click:  () => tone(660, 0.05, 'triangle', 0.07),
    plop:   () => { tone(520, 0.09, 'sine', 0.18, -280); tone(780, 0.06, 'sine', 0.06, 0, 0.04); },
    plant:  () => tone(300, 0.08, 'triangle', 0.1, 120),
    coin:   () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.16, 'square', 0.05, 0, 0.07); },
    error:  () => tone(150, 0.2, 'sawtooth', 0.06),
    build:  () => tone(220, 0.18, 'triangle', 0.12, 140),
    level:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.09)),
    whoosh: () => tone(180, 0.8, 'sawtooth', 0.03, 700),
    pickup: () => tone(880, 0.12, 'sine', 0.12, 500),
    queue:  () => tone(440, 0.06, 'triangle', 0.08, 80),
    // dyrene har ingen lydfiler: høns klukker, geder bræger
    hone:   () => { tone(900, 0.06, 'square', 0.03, -300); tone(820, 0.08, 'square', 0.03, -250, 0.1); },
    ged:    () => { const o = 330 + Math.random() * 40; tone(o, 0.35, 'sawtooth', 0.025, -40); tone(o * 1.01, 0.35, 'sawtooth', 0.02, -60, 0.02); },
    pet:    () => { tone(1400, 0.05, 'sine', 0.06, 600); tone(1900, 0.07, 'sine', 0.05, -400, 0.07); },
  };
  const ALIAS = { cash: 'coin', clear: 'build', rover: 'whoosh', boom: 'pickup', gold: 'coin', decode: 'queue',
    door: 'click', glass: 'pickup', open: 'click', close: 'click', storm: 'whoosh' };

  // ---------- Afspilning ----------
  const lastAt = {};
  let combo = 0, comboAt = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function play(name, opt = {}) {
    if (muted || !ac || !tapped) return;
    const now = performance.now();
    if (now - (lastAt[name] || 0) < (opt.gap ?? 45)) return; // "saml alt" må ikke blive til støj
    lastAt[name] = now;
    try {
      const def = SFX[name];
      const buf = def && buffers[pick(def.f)];
      if (!buf) { (SYNTH[name] || SYNTH[ALIAS[name]] || (() => {}))(); return; }
      let rate = def.r ? def.r[0] + Math.random() * (def.r[1] - def.r[0]) : 1;
      if (opt.rate) rate *= opt.rate;
      if (def.jingle) duck(buf.duration + 0.2, 0.25);
      playBuf(buf, bus.sfx, def.v * (opt.v ?? 1), rate, def.len || 0);
    } catch (e) { /* lyd er pynt */ }
  }

  // Høst flere kupler i træk: tonen stiger for hver.
  function harvest() {
    const now = performance.now();
    combo = now - comboAt < 900 ? Math.min(combo + 1, 12) : 0;
    comboAt = now;
    play('plop', { rate: Math.pow(2, combo / 12 * 0.9), gap: 30 });
  }

  // ---------- Stemmer ----------
  const voices = {};
  let speaking = null, sayAt = {};
  function say(id, { force = false, cooldown = 60000 } = {}) {
    if (muted || !ac || !tapped || vol.voice <= 0.01) return;
    const now = Date.now();
    if (!force && now - (sayAt[id] || 0) < cooldown) return;
    if (speaking && !force) return;
    sayAt[id] = now;
    const go = (buf) => {
      if (speaking) try { speaking.stop(); } catch (e) { /* allerede stoppet */ }
      duck(buf.duration + 0.3, 0.3);
      speaking = playBuf(buf, bus.voice, 1);
      speaking.onended = () => { speaking = null; };
    };
    if (voices[id]) return go(voices[id]);
    fetchBuf(`assets/voice/${id}.m4a`).then((b) => { voices[id] = b; go(b); }).catch(() => {});
  }
  function hush() { if (speaking) try { speaking.stop(); } catch (e) { /* allerede stoppet */ } speaking = null; }

  // ---------- Kulisse ----------
  // Marsvind (filtreret støj, der svulmer), stærkere om natten, om vinteren og i storm.
  // Maskinsummen kommer fra bygninger, der arbejder tæt på midten af skærmen.
  const Ambience = (() => {
    let on = false, wind = null, windGain = null, windF = null, hum = null, comp = null, lfo = null;
    let nextAnimal = 0, nextGust = 0;

    function noiseBuf(sec) {
      const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brun støj
      return b;
    }
    function loop(name, g0) {
      const buf = buffers[name];
      if (!buf) return null;
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.value = g0;
      src.connect(g).connect(bus.amb);
      src.start();
      return g;
    }

    function start() {
      if (on || !ac) return;
      on = true;
      wind = ac.createBufferSource();
      wind.buffer = noiseBuf(4); wind.loop = true;
      windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 400; windF.Q.value = 0.7;
      windGain = ac.createGain(); windGain.gain.value = 0;
      // langsom svingning, så vinden lever
      lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = ac.createGain(); lfoG.gain.value = 180;
      lfo.connect(lfoG).connect(windF.frequency);
      wind.connect(windF).connect(windGain).connect(bus.amb);
      wind.start(); lfo.start();
      loadAll().then(() => { hum = loop('hum', 0); comp = loop('computer', 0); });
    }

    // Kaldes et par gange i sekundet fra hovedløkken.
    function update(st) {
      if (!on || !ac) return;
      const t = ac.currentTime;
      const w = st.storm ? 1 : 0.28 + (st.night ? 0.12 : 0) + (st.winter ? 0.1 : 0);
      windGain.gain.setTargetAtTime(w * 0.5, t, 1.2);
      windF.frequency.setTargetAtTime(st.storm ? 650 : st.night ? 300 : 420, t, 2);
      if (hum) hum.gain.setTargetAtTime(Math.min(1, st.machines) * 0.35, t, 0.6);
      if (comp) comp.gain.setTargetAtTime(Math.min(1, st.lab) * 0.25, t, 0.6);
      const now = performance.now();
      if (st.storm && now > nextGust) { nextGust = now + 6000 + Math.random() * 9000; play('storm', { v: 0.5 }); }
      if (st.animal && now > nextAnimal) {
        nextAnimal = now + 5000 + Math.random() * 9000;
        if (!muted && tapped && vol.amb > 0.01) (SYNTH[st.animal] || (() => {}))();
      }
    }
    return { start, update };
  })();

  // ---------- Styrke ----------
  function setVol(k, v) {
    vol[k] = Math.max(0, Math.min(1, v));
    if (bus[k]) bus[k].gain.setTargetAtTime(vol[k], ac.currentTime, 0.05);
    try { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); } catch (e) { /* ingen lagring */ }
  }

  return {
    play, harvest, say, hush,
    ambience: (st) => Ambience.update(st),
    context: () => init(),
    bus: (k) => (init(), bus[k]),
    get vol() { return { ...vol }; },
    setVol,
    buzz(ms = 12) {
      if (muted || !navigator.vibrate || !tapped) return;
      try { navigator.vibrate(ms); } catch (e) { /* ikke understøttet */ }
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ingen lagring */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.05);
      if (muted) hush();
      return muted;
    },
    get muted() { return muted; },
  };
})();
