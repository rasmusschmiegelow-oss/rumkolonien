'use strict';
// Sky-gemning og ranglister i Supabase.
// Hver koloni har en hemmelig kolonikode (uuid), som kun ligger på spillerens enheder.
// Databasen kender kun en hash af koden og kan kun tilgås gennem fire funktioner (se README).

const Cloud = (() => {
  const URL = 'https://uzjgohczjzxicbexvndq.supabase.co';
  const API_KEY = 'sb_publishable_JDTTIE2B4y4YuZGBfkHtew_DSh4MiST'; // offentlig nøgle, beregnet til browsere
  const KEY_STORE = 'rumkolonien-cloud-key';
  const PUSH_EVERY = 60 * 1000;

  let key = null;
  let pushedAt = 0;      // S.savedAt for seneste gemning i skyen
  let lastPush = 0;
  let status = 'idle';   // idle | ok | offline | busy
  let lastOk = 0;
  const sent = {};       // seneste indsendte score pr. rangliste

  try { key = localStorage.getItem(KEY_STORE); } catch (e) { /* ingen lagring */ }
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));
  function setKey(k) {
    key = k;
    try { localStorage.setItem(KEY_STORE, k); } catch (e) { /* ingen lagring */ }
  }
  const isKey = (k) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k || '');

  async function rpc(fn, body, keepalive) {
    const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: !!keepalive,
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function push(force, keepalive) {
    if (!key || status === 'busy') return;
    if (!force && S.savedAt <= pushedAt) return;
    status = 'busy';
    try {
      const snap = S.savedAt;
      const res = await rpc('save_colony', {
        p_key: key, p_name: S.playerName, p_data: S, p_level: S.level, p_saved_at: snap,
      }, keepalive);
      if (res && res.ok === false && res.reason === 'newer') {
        status = 'ok';
        offerNewer();
        return;
      }
      pushedAt = snap;
      lastOk = Date.now();
      status = 'ok';
      submitScores();
    } catch (e) {
      status = 'offline';
    }
  }

  function submitScores() {
    const scores = { level: S.level, arcade: S.arcade.best, medals: Object.keys(S.medals).length };
    for (const [board, score] of Object.entries(scores)) {
      if (sent[board] === score) continue;
      sent[board] = score;
      rpc('submit_score', { p_key: key, p_board: board, p_score: score }).catch(() => { delete sent[board]; });
    }
  }

  async function fetchColony(k) {
    return rpc('load_colony', { p_key: k });
  }

  // Der ligger en nyere udgave i skyen (fx fra telefonen). Spørg, før vi skifter.
  let offered = false;
  async function offerNewer() {
    if (offered) return;
    offered = true;
    try {
      const c = await fetchColony(key);
      if (!c) return;
      const when = new Date(Number(c.saved_at)).toLocaleString('da-DK', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
      showModal(`${icon('rocket')} Nyere koloni i skyen`, `
        <p>Der ligger en nyere udgave af <b>${escapeHtml(c.name)}</b> i skyen (niveau ${c.level}, gemt ${when}). Den er nok gemt fra en anden enhed.</p>
        <div class="btnrow"><button class="primary" data-act="cloudtake">Hent den nyere</button><button data-act="cloudkeep">Behold denne</button></div>`);
      offerNewer.data = c;
    } catch (e) { offered = false; }
  }

  function adopt(c) {
    S = migrate(c.data);
    S.savedAt = Number(c.saved_at) || Date.now();
    pushedAt = S.savedAt;
    fillOrders();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* privat vindue */ }
    resetAgents();
    centerCamera();
  }

  // Åbnet fra et delelink (#koloni=...): hent den koloni.
  async function fromLink() {
    const m = location.hash.match(/koloni=([0-9a-f-]{36})/i);
    if (!m || !isKey(m[1])) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1] === key) return false;
    try {
      const c = await fetchColony(m[1]);
      if (!c) { toast('Kolonien fra linket findes ikke i skyen.', 'bad', 4000); return false; }
      const local = S.level > 1 || S.stats.harvest > 3;
      if (local && !confirm(`Vil du hente "${c.name}" (niveau ${c.level}) fra linket? Kolonien på denne enhed bliver erstattet.`)) return false;
      setKey(m[1]);
      adopt(c);
      toast(`${icon('rocket')} ${escapeHtml(c.name)} er hentet fra skyen.`, 'good', 4000);
      return true;
    } catch (e) {
      toast('Kunne ikke hente kolonien. Tjek din forbindelse.', 'bad', 4000);
      return false;
    }
  }

  async function start() {
    if (!S.playerName) S.playerName = `Kolonist ${100 + Math.floor(Math.random() * 900)}`;
    const linked = await fromLink();
    if (!key) setKey(newKey());
    if (!linked) {
      try {
        const c = await fetchColony(key);
        if (c && Number(c.saved_at) > (S.savedAt || 0) + 10000) offerNewer();
        else if (c) { pushedAt = Math.min(S.savedAt || 0, Number(c.saved_at)); lastOk = Date.now(); status = 'ok'; }
      } catch (e) { status = 'offline'; }
    }
    push(true);
    setInterval(() => { if (Date.now() - lastPush > PUSH_EVERY) { lastPush = Date.now(); push(); } }, 5000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) push(false, true); });
    // Et link indsat i samme fane ændrer kun #-delen, så siden genindlæses ikke.
    window.addEventListener('hashchange', () => { fromLink(); });
  }

  async function leaderboard(board) {
    return rpc('get_leaderboard', { p_board: board, p_key: key });
  }

  return {
    start, push, leaderboard, adopt,
    get key() { return key; },
    get link() { return `${location.origin}${location.pathname}#koloni=${key}`; },
    get status() { return status; },
    get lastOk() { return lastOk; },
    take() { if (offerNewer.data) { adopt(offerNewer.data); toast('Den nyeste koloni er hentet.', 'good'); } closeModal(); },
    keep() { closeModal(); S.savedAt = Date.now(); push(true); },
  };
})();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
