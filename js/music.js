'use strict';
// Stille ambient-musik, der genereres i browseren og spilles gennem lydens musikkanal. Om dagen spilles en lys
// lydisk skala, om natten en dybere dorisk. Starter først efter et tryk.

const Music = (() => {
  const KEY = 'rumkolonien-music';
  let on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch (e) { /* ingen lagring */ }
  let ac = null, master = null, verb = null, timer = null, nextBar = 0, bar = 0;

  // Akkorder som MIDI-toner. Dag: C-lydisk. Nat: A-dorisk, en oktav lavere.
  const DAY = { chords: [[48, 55, 64, 71], [50, 57, 66, 69], [45, 52, 60, 67], [47, 54, 62, 69]], scale: [72, 74, 76, 78, 79, 83, 84] };
  const NIGHT = { chords: [[45, 52, 60, 64], [43, 50, 59, 62], [41, 48, 57, 60], [43, 50, 55, 62]], scale: [69, 71, 72, 74, 76, 78, 81] };
  const BAR = 4.8; // sekunder pr. takt
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) return true;
    ac = Sound.context();
    if (!ac) return false;
    master = ac.createGain();
    master.gain.value = 0;
    // enkel rumklang: to forsinkelser med feedback
    verb = ac.createDelay(1); verb.delayTime.value = 0.33;
    const fb = ac.createGain(); fb.gain.value = 0.35;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    verb.connect(lp).connect(fb).connect(verb);
    lp.connect(master);
    master.connect(Sound.bus('music'));
    return true;
  }

  function pad(midi, t, dur) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 1.003;
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); g.connect(verb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  function pluck(midi, t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(master); g.connect(verb);
    o.start(t); o.stop(t + 1.7);
  }

  function schedule() {
    if (!ac) return;
    const night = typeof solClock === 'function' && solClock().night;
    const mode = night ? NIGHT : DAY;
    while (nextBar < ac.currentTime + 1) {
      const chord = mode.chords[bar % mode.chords.length];
      chord.forEach((m) => pad(m, nextBar, BAR * 1.3));
      // et par spredte toner over akkorden
      const notes = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < notes; i++) {
        pluck(mode.scale[Math.floor(Math.random() * mode.scale.length)] - (night ? 12 : 0), nextBar + 0.6 + Math.random() * (BAR - 1));
      }
      nextBar += BAR;
      bar++;
    }
  }

  function start() {
    if (!on || !init()) return;
    if (timer) return;
    nextBar = ac.currentTime + 0.1;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(0.55, ac.currentTime, 1.5);
    timer = setInterval(schedule, 400);
    schedule();
  }

  function stop() {
    if (!ac || !timer) return;
    clearInterval(timer); timer = null;
    master.gain.setTargetAtTime(0, ac.currentTime, 0.4);
  }

  // Browsere må først spille lyd efter et tryk.
  window.addEventListener('pointerdown', () => start(), { once: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (on && ac) start(); });

  return {
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* ingen lagring */ }
      if (on) start(); else stop();
      return on;
    },
    get on() { return on; },
  };
})();
