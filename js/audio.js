'use strict';
// Lydeffekter genereret med Web Audio, så spillet ikke behøver lydfiler.

const Sound = (() => {
  const KEY = 'rumkolonien-mute';
  let ac = null;
  let muted = false;
  let tapped = false; // browsere tillader kun vibration efter et tryk på skærmen
  window.addEventListener('pointerdown', () => { tapped = true; }, { once: true, capture: true });
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* ingen lagring */ }

  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.1, freq = 900, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  const fx = {
    click:  () => tone(660, 0.05, 'triangle', 0.07),
    plop:   () => { tone(520, 0.09, 'sine', 0.18, -280); tone(780, 0.06, 'sine', 0.06, 0, 0.04); },
    plant:  () => tone(300, 0.08, 'triangle', 0.1, 120),
    coin:   () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.16, 'square', 0.05, 0, 0.07); },
    error:  () => tone(150, 0.2, 'sawtooth', 0.06),
    build:  () => { noise(0.18, 0.15, 400); tone(220, 0.18, 'triangle', 0.12, 140, 0.06); },
    level:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, 0, i * 0.09)),
    whoosh: () => { noise(0.8, 0.12, 600); tone(180, 0.8, 'sawtooth', 0.03, 700); },
    pickup: () => tone(880, 0.12, 'sine', 0.12, 500),
    storm:  () => noise(1.6, 0.09, 300),
    queue:  () => tone(440, 0.06, 'triangle', 0.08, 80),
  };

  return {
    play(name) { if (!muted) try { fx[name] && fx[name](); } catch (e) { /* lyd er pynt */ } },
    buzz(ms = 12) {
      if (muted || !navigator.vibrate || !tapped) return;
      try { navigator.vibrate(ms); } catch (e) { /* ikke understøttet */ }
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ingen lagring */ }
      return muted;
    },
    get muted() { return muted; },
  };
})();
