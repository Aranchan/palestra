/* Palestra: PWA per schede, allenamenti e progressi.
   Dati in localStorage, foto in IndexedDB. Nessuna dipendenza. */
'use strict';

const VERSIONE = '1.0';
const KEY = 'palestra.v1';
const KEY_FX = 'palestra.fx';
const FX_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FX_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/* ---------- Utilità ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const oggi = () => ds(new Date());
const parseDs = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const num = v => { if (v === '' || v == null) return ''; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? '' : n; };
const fmtN = n => (n === '' || n == null) ? '' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: false });
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
function fmtData(s, lungo) {
  const d = parseDs(s);
  if (lungo) return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  return `${GIORNI[d.getDay()]} ${d.getDate()}/${pad(d.getMonth() + 1)}`;
}
function fmtDurata(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function lunedi(s) { const d = parseDs(s); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return ds(d); }
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function vibra(p) { if (db.impostazioni.vibrazione && navigator.vibrate) navigator.vibrate(p); }

/* ---------- Dati ---------- */
const DEFAULT = () => ({
  versione: 1,
  esercizi: [],      // esercizi personali
  schede: [],        // modelli di giornata
  allenamenti: [],   // giornate di allenamento
  impostazioni: { recupero: 90, vibrazione: true, suono: true, schermoAcceso: true, fotocamera: 'user' }
});
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.versione) { const def = DEFAULT(); return { ...def, ...d, impostazioni: { ...def.impostazioni, ...d.impostazioni } }; }
  } catch (e) { }
  return DEFAULT();
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Memoria piena: impossibile salvare'); }
}
let fxList = (() => { try { return JSON.parse(localStorage.getItem(KEY_FX)) || []; } catch (e) { return []; } })();

/* Catalogo esercizi: base + database esteso + personali */
let _cat = null;
function catalogo() {
  if (_cat) return _cat;
  _cat = new Map();
  ESERCIZI_BASE.forEach(([nome, gruppo, attrezzo, misura]) => {
    const id = 'b-' + slug(nome);
    _cat.set(id, { id, nome, gruppo, attrezzo, misura, tipo: 'base' });
  });
  fxList.forEach(e => _cat.set(e.id, { ...e, tipo: 'fx' }));
  db.esercizi.forEach(e => _cat.set(e.id, { ...e, tipo: 'mio' }));
  return _cat;
}
const resetCat = () => { _cat = null; };
function exInfo(id, nomeSalvato) {
  return catalogo().get(id) || { id, nome: nomeSalvato || 'Esercizio', gruppo: 'Altro', attrezzo: '', misura: 'rip', tipo: 'perso' };
}
const unita = m => m === 'sec' ? 'Sec' : m === 'min' ? 'Min' : 'Rip';

/* ---------- Foto (IndexedDB) ---------- */
let _idb = null;
function idb() {
  if (_idb) return _idb;
  _idb = new Promise((res, rej) => {
    const r = indexedDB.open('palestra-foto', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('foto');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _idb;
}
async function fotoOp(mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction('foto', mode); const st = tx.objectStore('foto');
    const r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
  });
}
const fotoPut = (id, blob) => fotoOp('readwrite', s => s.put(blob, id));
const fotoGet = id => fotoOp('readonly', s => s.get(id));
const fotoDel = id => fotoOp('readwrite', s => s.delete(id));
const fotoClear = () => fotoOp('readwrite', s => s.clear());
const _urls = new Map();
async function fotoUrl(id) {
  if (!id) return '';
  if (_urls.has(id)) return _urls.get(id);
  const b = await fotoGet(id).catch(() => null);
  if (!b) return '';
  const u = URL.createObjectURL(b); _urls.set(id, u); return u;
}
// Riempie <img data-foto="id"> dopo il render
function caricaFoto(root) {
  root.querySelectorAll('img[data-foto]').forEach(async img => {
    const u = await fotoUrl(img.dataset.foto);
    if (u) img.src = u; else img.remove();
  });
}

/* ---------- Livelli (pagine e fogli) con tasto Indietro ---------- */
const stack = [];
const waiters = [];
function openLayer(el, onClose) {
  stack.push({ el, onClose });
  history.pushState({ l: stack.length }, '');
}
function closeLayer() {
  return new Promise(res => {
    if (!stack.length) return res();
    waiters.push(res); history.back();
  });
}
window.addEventListener('popstate', () => {
  const top = stack.pop();
  if (top) { top.el.remove(); top.onClose && top.onClose(); }
  const w = waiters.shift(); w && w();
});

function sheet(html, bind) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeLayer(); });
  $('#sheet-root').appendChild(bg);
  openLayer(bg);
  bind && bind(bg.firstElementChild);
  return bg;
}
function conferma(titolo, testo, ok = 'Conferma', pericolo = false) {
  return new Promise(res => {
    let v = false;
    const bg = sheet(`<h2>${esc(titolo)}</h2><p class="muted">${testo}</p>
      <div class="acts"><button class="btn" data-x="0">Annulla</button><button class="btn ${pericolo ? 'danger' : 'pri'}" data-x="1">${esc(ok)}</button></div>`,
      sh => sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        v = b.dataset.x === '1'; await closeLayer();
      }));
    stack[stack.length - 1].onClose = () => res(v);
    return bg;
  });
}
function chiedi(titolo, valore = '', tipo = 'text', aiuto = '') {
  return new Promise(res => {
    let v = null;
    sheet(`<h2>${esc(titolo)}</h2>${aiuto ? `<p class="muted small">${aiuto}</p>` : ''}
      <input id="ask" type="text" ${tipo === 'num' ? 'inputmode="decimal"' : ''} value="${esc(valore)}">
      <div class="acts"><button class="btn" data-x="0">Annulla</button><button class="btn pri" data-x="1">OK</button></div>`,
      sh => {
        const i = $('#ask', sh); setTimeout(() => { i.focus(); i.select(); }, 150);
        const ok = async () => { v = i.value.trim(); await closeLayer(); };
        i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
        sh.addEventListener('click', async e => {
          const b = e.target.closest('[data-x]'); if (!b) return;
          if (b.dataset.x === '1') ok(); else closeLayer();
        });
      });
    stack[stack.length - 1].onClose = () => res(v);
  });
}
function menu(titolo, voci) {
  return new Promise(res => {
    let v = null;
    sheet(`${titolo ? `<h2>${esc(titolo)}</h2>` : ''}${voci.map((x, i) =>
      `<button class="menu-item ${x.danger ? 'danger' : ''}" data-i="${i}"><span>${x.icon || ''}</span><span>${esc(x.label)}</span></button>`).join('')}`,
      sh => sh.addEventListener('click', async e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        v = voci[+b.dataset.i].id; await closeLayer();
      }));
    stack[stack.length - 1].onClose = () => res(v);
  });
}

function openPage(build) {
  const el = document.createElement('div'); el.className = 'page';
  $('#page-root').appendChild(el);
  const p = {
    el, onClose: null,
    render() {
      const st = el.scrollTop; const v = build(p);
      el.innerHTML = `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="Indietro">←</button>
        <h1 class="ellipsis">${v.title}</h1>${v.actions || ''}</header>
        <main>${v.body}</main>${v.foot ? `<div class="page-foot">${v.foot}</div>` : ''}`;
      el.scrollTop = st; caricaFoto(el); v.after && v.after();
    }
  };
  el.addEventListener('click', e => { if (e.target.closest('[data-act="back"]')) closeLayer(); });
  openLayer(el, () => { p.onClose && p.onClose(); renderTab(); });
  p.render();
  return p;
}

/* ---------- Statistiche ---------- */
const pesoSerie = (ex, s) => num(ex.pesoUnico ? ex.peso : s.peso);
const ordinaAll = (a, b) => (b.data.localeCompare(a.data)) || ((b.creato || 0) - (a.creato || 0));

// Ultima esecuzione di un esercizio in un'altra giornata
function ultimaVolta(exId, escludiId) {
  const lista = db.allenamenti.filter(a => a.id !== escludiId).sort(ordinaAll);
  for (const a of lista) {
    const ex = a.esercizi.find(e => e.exId === exId && e.serie.some(s => s.fatta));
    if (ex) return { a, ex };
  }
  return null;
}
function riassuntoSerie(ex, soloFatte = true) {
  const m = exInfo(ex.exId, ex.nome).misura;
  const parti = ex.serie.filter(s => !soloFatte || s.fatta).map(s => {
    const p = pesoSerie(ex, s);
    return `${fmtN(s.rip) || '–'}${m === 'sec' ? '"' : m === 'min' ? '′' : ''}${p !== '' ? ' × ' + fmtN(p) : ''}`;
  });
  // raggruppa le serie uguali: 3 × (10 × 40)
  const out = []; let i = 0;
  while (i < parti.length) { let j = i; while (j < parti.length && parti[j] === parti[i]) j++; out.push((j - i > 1 ? (j - i) + '× ' : '') + parti[i]); i = j; }
  return out.join(' · ') + (ex.serie.some(s => pesoSerie(ex, s) !== '') ? ' kg' : '');
}
// Storico per esercizio: per ogni giornata, peso massimo, 1RM stimato e volume
function storico(exId) {
  const out = [];
  db.allenamenti.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(a => {
    a.esercizi.filter(e => e.exId === exId).forEach(ex => {
      const fatte = ex.serie.filter(s => s.fatta); if (!fatte.length) return;
      let max = 0, rm = 0, vol = 0, ripTot = 0;
      fatte.forEach(s => {
        const p = +pesoSerie(ex, s) || 0, r = +num(s.rip) || 0;
        max = Math.max(max, p); vol += p * r; ripTot += r;
        if (p && r && r <= 15) rm = Math.max(rm, p * (1 + r / 30)); // formula di Epley
      });
      out.push({ a, ex, max, rm, vol, ripTot });
    });
  });
  return out;
}
function recordPrecedente(exId, escludiAll, escludiEx) {
  let best = 0;
  db.allenamenti.forEach(a => a.esercizi.forEach(ex => {
    if (ex.exId !== exId) return;
    ex.serie.forEach(s => { if (s.fatta && !(a.id === escludiAll && ex === escludiEx)) best = Math.max(best, +pesoSerie(ex, s) || 0); });
  }));
  return best;
}

/* ---------- Timer di recupero ---------- */
const rest = { fine: 0, tot: 0, label: '', iv: null, suonato: false };
let audioCtx = null;
function beep() {
  if (!db.impostazioni.suono) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .25, .5].forEach((t, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + t; g.gain.setValueAtTime(.25, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .2);
      o.start(t0); o.stop(t0 + .22);
    });
  } catch (e) { }
}
function avviaRecupero(sec, label) {
  if (!sec) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { }
  rest.fine = Date.now() + sec * 1000; rest.tot = sec; rest.label = label; rest.suonato = false;
  clearInterval(rest.iv); rest.iv = setInterval(tickRecupero, 250); tickRecupero();
}
function fermaRecupero() { clearInterval(rest.iv); rest.iv = null; $('#rest').hidden = true; }
function tickRecupero() {
  const el = $('#rest'); const left = (rest.fine - Date.now()) / 1000;
  el.hidden = false;
  if (left <= 0) {
    if (!rest.suonato) { rest.suonato = true; vibra([300, 120, 300, 120, 500]); beep(); }
    el.className = 'rest done';
    el.innerHTML = `<div class="t">Via!</div><div class="lbl">Recupero finito<br>${esc(rest.label)}</div><button data-r="x">OK</button>`;
    if (left < -8) fermaRecupero();
    return;
  }
  el.className = 'rest';
  el.innerHTML = `<div class="t">${fmtClock(left)}</div><div class="lbl">Recupero<br>${esc(rest.label)}</div>
    <button data-r="-15">−15</button><button data-r="15">+15</button><button data-r="x">✕</button>`;
}
$('#rest').addEventListener('click', e => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  if (b.dataset.r === 'x') return fermaRecupero();
  rest.fine += (+b.dataset.r) * 1000; rest.suonato = false; tickRecupero();
});

/* ---------- Schermo sempre acceso ---------- */
let wakeLock = null, wakeWanted = false;
async function tieniAcceso(on) {
  wakeWanted = on && db.impostazioni.schermoAcceso;
  try {
    if (wakeWanted && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!wakeWanted && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (wakeWanted) tieniAcceso(true); if (rest.iv) tickRecupero(); }
});

/* ---------- Fotocamera e convalida ---------- */
function timbra(src, sw, sh, specchio, testo) {
  const max = 1280, k = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * k), h = Math.round(sh * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (specchio) { g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(src, 0, 0, w, h); g.restore(); }
  else g.drawImage(src, 0, 0, w, h);
  const fs = Math.round(Math.max(16, w * .036)), band = Math.round(fs * 3.1);
  g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, h - band, w, band);
  g.fillStyle = '#c6f135'; g.font = `700 ${fs}px system-ui, sans-serif`; g.textBaseline = 'middle';
  g.fillText('✓ ' + testo, fs * .7, h - band + band * .32, w - fs * 1.4);
  const d = new Date();
  g.fillStyle = '#fff'; g.font = `500 ${Math.round(fs * .8)}px system-ui, sans-serif`;
  g.fillText(`${fmtData(ds(d), true)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`, fs * .7, h - band + band * .72);
  return new Promise(res => c.toBlob(res, 'image/jpeg', .82));
}

function scattaFoto(testo) {
  return new Promise(resolve => {
    let facing = db.impostazioni.fotocamera || 'user', stream = null, fatto = false, blob = null, prevUrl = null;
    const el = document.createElement('div'); el.className = 'cam';
    document.body.appendChild(el);
    openLayer(el, () => { stop(); if (prevUrl) URL.revokeObjectURL(prevUrl); if (!fatto) resolve(null); });

    function stop() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
    function vistaCamera(errore) {
      el.innerHTML = `<div class="bar-top"><button class="round" data-c="close">✕</button><div class="grow"><b>Foto di convalida</b><div class="tiny">Scattala adesso: non si possono usare foto della galleria</div></div></div>
        ${errore ? `<div class="grow" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;color:#fff;text-align:center;gap:16px">
            <div style="font-size:44px">📷</div><div>${errore}</div>
            <button class="btn pri" data-c="nativa">Apri la fotocamera del telefono</button></div>`
          : `<video playsinline muted autoplay></video>`}
        <div class="bar-bot"><button class="round" data-c="nativa" title="Fotocamera del telefono">📱</button>
          <button class="shutter" data-c="shot" ${errore ? 'disabled style="opacity:.3"' : ''} aria-label="Scatta"></button>
          <button class="round" data-c="flip" title="Cambia fotocamera">🔄</button></div>`;
    }
    async function avvia() {
      stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return vistaCamera('Questo browser non permette di usare la fotocamera dentro l\'app.');
      vistaCamera();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (fatto || !el.isConnected) return stop();
        const v = $('video', el); v.srcObject = stream; v.classList.toggle('mirror', facing === 'user'); await v.play();
      } catch (err) {
        vistaCamera(err && err.name === 'NotAllowedError'
          ? 'Permesso fotocamera negato. Consentilo dalle impostazioni del sito in Chrome, oppure usa la fotocamera del telefono.'
          : 'Impossibile avviare la fotocamera.');
      }
    }
    function anteprima(b) {
      blob = b; stop();
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      prevUrl = URL.createObjectURL(b);
      el.innerHTML = `<div class="bar-top"><div class="grow"><b>Va bene questa?</b></div></div><img src="${prevUrl}" alt="">
        <div class="bar-bot"><button class="btn" data-c="redo">↺ Rifai</button><button class="btn pri" data-c="ok">✓ Usa e concludi</button></div>`;
    }
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const c = b.dataset.c;
      if (c === 'close') closeLayer();
      else if (c === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; avvia(); }
      else if (c === 'shot') {
        const v = $('video', el); if (!v || !v.videoWidth) return;
        vibra(40);
        anteprima(await timbra(v, v.videoWidth, v.videoHeight, facing === 'user', testo));
      }
      else if (c === 'redo') avvia();
      else if (c === 'ok') { fatto = true; await closeLayer(); resolve(blob); }
      else if (c === 'nativa') {
        stop();
        const inp = $('#photo-fallback');
        inp.setAttribute('capture', facing === 'user' ? 'user' : 'environment');
        inp.value = '';
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return avvia();
          // Accetta solo una foto appena scattata
          if (Date.now() - f.lastModified > 3 * 60 * 1000) { toast('Serve una foto scattata adesso, non dalla galleria', 3200); return avvia(); }
          const img = new Image(); const u = URL.createObjectURL(f);
          img.onload = async () => { const bb = await timbra(img, img.naturalWidth, img.naturalHeight, false, testo); URL.revokeObjectURL(u); anteprima(bb); };
          img.onerror = () => { URL.revokeObjectURL(u); toast('Foto non leggibile'); avvia(); };
          img.src = u;
        };
        inp.click();
      }
    });
    avvia();
  });
}

/* ---------- Giornate di allenamento ---------- */
function nuovaSerie(rip, peso) { return { rip: rip ?? 10, peso: peso ?? '', fatta: false }; }
function nuovoEsAll(exId, cfg = {}) {
  const info = exInfo(exId);
  const nSerie = cfg.serie || (info.misura === 'min' ? 1 : 3);
  const rip = cfg.rip ?? (info.misura === 'min' ? 20 : info.misura === 'sec' ? 30 : 10);
  const ex = {
    exId, nome: info.nome, pesoUnico: true, peso: cfg.peso ?? '', recupero: cfg.recupero ?? db.impostazioni.recupero,
    note: cfg.note || '', fatto: false, serie: Array.from({ length: nSerie }, () => nuovaSerie(rip, ''))
  };
  // Precompila i pesi dall'ultima volta
  const u = ultimaVolta(exId);
  if (u) {
    const fatte = u.ex.serie.filter(s => s.fatta);
    if (u.ex.pesoUnico) { if (ex.peso === '' && u.ex.peso !== '') ex.peso = u.ex.peso; }
    else if (fatte.some(s => s.peso !== '')) {
      ex.pesoUnico = false;
      ex.serie.forEach((s, j) => { s.peso = (fatte[j] || fatte[fatte.length - 1]).peso; });
    }
  }
  return ex;
}
function creaAllenamento({ data, nome, scheda }) {
  const a = { id: uid(), creato: Date.now(), data: data || oggi(), nome: nome || (scheda ? scheda.nome : 'Allenamento libero'), schedaId: scheda ? scheda.id : null,
    esercizi: [], note: '', conclusa: false, conclusaAt: null, inizio: null, fotoId: null };
  if (scheda) a.esercizi = scheda.esercizi.map(x => nuovoEsAll(x.exId, x));
  db.allenamenti.push(a); save();
  return a;
}

let elapsedIv = null;
function apriAllenamento(id) {
  const a = () => db.allenamenti.find(x => x.id === id);
  if (!a()) return;
  const page = openPage(p => vistaAllenamento(a()));
  tieniAcceso(!a().conclusa);
  clearInterval(elapsedIv);
  elapsedIv = setInterval(() => {
    const el = $('#elapsed', page.el), s = a();
    if (el && s && s.inizio && !s.conclusa) el.textContent = '⏱ ' + fmtClock((Date.now() - s.inizio) / 1000);
  }, 1000);
  page.onClose = () => { clearInterval(elapsedIv); tieniAcceso(false); };

  page.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = a(); if (!s) return;
    const i = +b.dataset.i, ex = s.esercizi[i];
    switch (b.dataset.act) {
      case 'set': {
        if (s.conclusa) return;
        const st = ex.serie[+b.dataset.j]; st.fatta = !st.fatta;
        if (st.fatta) {
          if (!s.inizio) s.inizio = Date.now();
          vibra(30);
          const p = +pesoSerie(ex, st) || 0;
          if (p) { const rec = recordPrecedente(ex.exId, s.id, ex); if (rec && p > rec) toast(`🏆 Nuovo record: ${fmtN(p)} kg`, 3000); }
          const tutte = ex.serie.every(x => x.fatta);
          const ultimo = tutte && s.esercizi.every(x => x === ex || x.fatto);
          if (!ultimo) avviaRecupero(+ex.recupero || 0, tutte ? 'Esercizio completato' : exInfo(ex.exId, ex.nome).nome);
        }
        ex.fatto = ex.serie.length > 0 && ex.serie.every(x => x.fatta);
        save(); page.render(); break;
      }
      case 'ex-toggle':
        if (s.conclusa) return;
        ex.fatto = !ex.fatto; ex.serie.forEach(x => x.fatta = ex.fatto);
        if (ex.fatto && !s.inizio) s.inizio = Date.now();
        if (ex.fatto) vibra(30);
        save(); page.render(); break;
      case 'mode':
        if (s.conclusa) return;
        if (b.dataset.v === '1' && !ex.pesoUnico) { ex.pesoUnico = true; ex.peso = ex.serie.find(x => x.peso !== '')?.peso ?? ''; }
        else if (b.dataset.v === '0' && ex.pesoUnico) { ex.pesoUnico = false; ex.serie.forEach(x => { if (x.peso === '') x.peso = ex.peso; }); }
        save(); page.render(); break;
      case 'set-add': {
        const last = ex.serie[ex.serie.length - 1];
        ex.serie.push(nuovaSerie(last ? last.rip : 10, last ? last.peso : ''));
        ex.fatto = false; save(); page.render(); break;
      }
      case 'set-del':
        if (ex.serie.length > 1) { ex.serie.pop(); ex.fatto = ex.serie.every(x => x.fatta); save(); page.render(); }
        break;
      case 'ex-menu': {
        const info = exInfo(ex.exId, ex.nome);
        const voci = [];
        if (!s.conclusa) voci.push(
          { id: 'su', label: 'Sposta su', icon: '↑' }, { id: 'giu', label: 'Sposta giù', icon: '↓' },
          { id: 'rec', label: `Recupero (${ex.recupero} s)`, icon: '⏱' }, { id: 'note', label: 'Note', icon: '📝' });
        voci.push({ id: 'stat', label: 'Progressi di questo esercizio', icon: '📈' });
        if (!s.conclusa) voci.push({ id: 'del', label: 'Rimuovi dalla giornata', icon: '🗑', danger: true });
        const v = await menu(info.nome, voci);
        if (v === 'su' && i > 0) [s.esercizi[i - 1], s.esercizi[i]] = [s.esercizi[i], s.esercizi[i - 1]];
        if (v === 'giu' && i < s.esercizi.length - 1) [s.esercizi[i + 1], s.esercizi[i]] = [s.esercizi[i], s.esercizi[i + 1]];
        if (v === 'rec') { const r = await chiedi('Recupero tra le serie (secondi)', ex.recupero, 'num'); if (r !== null && num(r) !== '') ex.recupero = Math.round(num(r)); }
        if (v === 'note') { const r = await chiedi('Note', ex.note); if (r !== null) ex.note = r; }
        if (v === 'del' && await conferma('Rimuovere l\'esercizio?', esc(info.nome), 'Rimuovi', true)) s.esercizi.splice(i, 1);
        if (v === 'stat') { apriEsercizio(ex.exId); return; }
        save(); page.render(); break;
      }
      case 'add':
        scegliEsercizi(ids => { ids.forEach(id => s.esercizi.push(nuovoEsAll(id))); save(); page.render(); });
        break;
      case 'concludi': concludi(s, page); break;
      case 'foto': apriFoto(s.fotoId, s); break;
      case 'menu': {
        const voci = [{ id: 'nome', label: 'Rinomina', icon: '✏️' }, { id: 'dup', label: 'Ripeti oggi', icon: '🔁' },
          { id: 'scheda', label: 'Salva come scheda', icon: '📋' }];
        if (s.conclusa) voci.push({ id: 'riapri', label: 'Riapri la giornata', icon: '🔓' });
        voci.push({ id: 'del', label: 'Elimina giornata', icon: '🗑', danger: true });
        const v = await menu(s.nome, voci);
        if (v === 'nome') { const r = await chiedi('Nome della giornata', s.nome); if (r) s.nome = r; }
        if (v === 'dup') {
          const n = creaAllenamento({ nome: s.nome, scheda: { id: s.schedaId, nome: s.nome, esercizi: s.esercizi.map(x => ({ exId: x.exId, serie: x.serie.length, rip: x.serie[0]?.rip, recupero: x.recupero, note: x.note })) } });
          await closeLayer(); apriAllenamento(n.id); toast('Nuova giornata creata'); return;
        }
        if (v === 'scheda') {
          const r = await chiedi('Nome della scheda', s.nome);
          if (r) { db.schede.push(schedaDa(r, s)); save(); toast('Scheda salvata'); }
        }
        if (v === 'riapri' && await conferma('Riaprire la giornata?', 'La foto di convalida verrà eliminata: per concluderla di nuovo dovrai scattarne un\'altra.', 'Riapri', true)) {
          if (s.fotoId) await fotoDel(s.fotoId).catch(() => { });
          s.fotoId = null; s.conclusa = false; s.conclusaAt = null; tieniAcceso(true);
        }
        if (v === 'del' && await conferma('Eliminare la giornata?', 'Verranno eliminati esercizi, pesi e foto di questa giornata.', 'Elimina', true)) {
          if (s.fotoId) await fotoDel(s.fotoId).catch(() => { });
          db.allenamenti = db.allenamenti.filter(x => x !== s); save(); closeLayer(); return;
        }
        save(); page.render(); break;
      }
    }
  });
  page.el.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const s = a(), ex = s.esercizi[+e.target.dataset.i];
    if (f === 'peso-unico') ex.peso = num(e.target.value);
    else if (f === 'rip') ex.serie[+e.target.dataset.j].rip = num(e.target.value);
    else if (f === 'peso') ex.serie[+e.target.dataset.j].peso = num(e.target.value);
    else if (f === 'note') s.note = e.target.value;
    else if (f === 'data') { if (e.target.value) s.data = e.target.value; }
    save();
  });
}
function schedaDa(nome, s) {
  return { id: uid(), nome, esercizi: s.esercizi.map(x => ({ exId: x.exId, nome: x.nome, serie: x.serie.length, rip: x.serie[0]?.rip ?? 10, peso: x.pesoUnico ? x.peso : (x.serie[0]?.peso ?? ''), recupero: x.recupero, note: x.note })) };
}

function vistaAllenamento(s) {
  if (!s) return { title: '', body: '' };
  const tot = s.esercizi.length, fatti = s.esercizi.filter(e => e.fatto).length;
  const dis = s.conclusa ? 'disabled' : '';
  let body = '';
  if (s.conclusa) {
    body += `<div class="locked-note">✓ Giornata conclusa · ${fmtData(s.data, true)}${s.inizio && s.conclusaAt ? ' · ' + fmtDurata(s.conclusaAt - s.inizio) : ''}</div>`;
    if (s.fotoId) body += `<img class="session-photo" data-foto="${s.fotoId}" data-act="foto" alt="Foto di convalida">`;
  }
  body += `<div class="row" style="margin:6px 0">
      <input type="date" data-f="data" value="${s.data}" ${dis} style="max-width:170px">
      <div class="grow right">${s.conclusa ? '' : `<span id="elapsed" class="badge acc">${s.inizio ? '⏱ ' + fmtClock((Date.now() - s.inizio) / 1000) : 'Non iniziato'}</span>`}</div></div>
    <div class="small muted">${fatti} di ${tot} esercizi fatti</div>
    <div class="bar ${fatti === tot && tot ? 'ok' : ''}"><i style="width:${tot ? fatti / tot * 100 : 0}%"></i></div>`;

  if (!tot) body += `<div class="empty"><div class="big">🏋️</div>Nessun esercizio.<br>Aggiungine dall'elenco.</div>`;
  s.esercizi.forEach((ex, i) => {
    const info = exInfo(ex.exId, ex.nome), conPeso = info.misura !== 'min';
    const prev = ultimaVolta(ex.exId, s.id);
    body += `<div class="card ex ${ex.fatto ? 'done' : ''}">
      <div class="ex-head">
        <button class="check ${ex.fatto ? 'on' : ''}" data-act="ex-toggle" data-i="${i}" ${dis} aria-label="Fatto">✓</button>
        <div class="grow"><div class="ex-name">${esc(info.nome)}</div>
          <div class="ex-sub">${esc(info.gruppo)} · ${ex.serie.length} serie${ex.recupero ? ` · recupero ${ex.recupero}s` : ''}</div></div>
        <button class="icon-btn" data-act="ex-menu" data-i="${i}" aria-label="Opzioni">⋮</button>
      </div>
      ${ex.note ? `<div class="prev">📝 ${esc(ex.note)}</div>` : ''}
      ${conPeso ? `<div class="ex-ctrl">
        <div class="seg"><button data-act="mode" data-i="${i}" data-v="1" class="${ex.pesoUnico ? 'on' : ''}">Peso unico</button><button data-act="mode" data-i="${i}" data-v="0" class="${ex.pesoUnico ? '' : 'on'}">Per serie</button></div>
        ${ex.pesoUnico ? `<div class="peso-unico"><input type="text" inputmode="decimal" data-f="peso-unico" data-i="${i}" value="${fmtN(ex.peso)}" placeholder="–" ${dis}><span class="muted small">kg</span></div>` : ''}
      </div>` : ''}
      <table class="sets"><tr><th>#</th><th>${unita(info.misura)}</th>${conPeso && !ex.pesoUnico ? '<th>Kg</th>' : ''}<th>Fatta</th></tr>
      ${ex.serie.map((st, j) => `<tr class="${st.fatta ? 'ok' : ''}"><td class="n">${j + 1}</td>
        <td><input type="text" inputmode="decimal" data-f="rip" data-i="${i}" data-j="${j}" value="${fmtN(st.rip)}" ${dis}></td>
        ${conPeso && !ex.pesoUnico ? `<td><input type="text" inputmode="decimal" data-f="peso" data-i="${i}" data-j="${j}" value="${fmtN(st.peso)}" placeholder="–" ${dis}></td>` : ''}
        <td style="width:50px"><button class="set-tick ${st.fatta ? 'on' : ''}" data-act="set" data-i="${i}" data-j="${j}" ${dis}>✓</button></td></tr>`).join('')}
      </table>
      ${s.conclusa ? '' : `<div class="ex-foot"><button class="btn sm" data-act="set-add" data-i="${i}">+ Serie</button><button class="btn sm" data-act="set-del" data-i="${i}" ${ex.serie.length < 2 ? 'disabled' : ''}>− Serie</button></div>`}
      ${prev ? `<div class="prev">Ultima volta (${fmtData(prev.a.data)}): ${esc(riassuntoSerie(prev.ex))}</div>` : ''}
    </div>`;
  });
  if (!s.conclusa) body += `<button class="btn block" data-act="add" style="margin-top:6px">+ Aggiungi esercizi</button>`;
  body += `<label class="f"><span>Note della giornata</span><textarea data-f="note" ${dis} placeholder="Come è andata?">${esc(s.note)}</textarea></label>`;

  return {
    title: esc(s.nome),
    actions: `<button class="icon-btn" data-act="menu" aria-label="Menu">⋮</button>`,
    body,
    foot: s.conclusa ? '' : `<button class="btn pri" data-act="concludi">📷 Concludi giornata</button>`
  };
}

async function concludi(s, page) {
  if (!s.esercizi.length) return toast('Aggiungi almeno un esercizio');
  const mancano = s.esercizi.filter(e => !e.fatto);
  if (mancano.length && !await conferma('Ci sono esercizi non fatti',
    `${mancano.map(e => esc(exInfo(e.exId, e.nome).nome)).join(', ')}.<br><br>Vuoi concludere lo stesso?`, 'Concludi lo stesso')) return;
  const blob = await scattaFoto(s.nome);
  if (!blob) return toast('Per concludere serve la foto');
  const id = uid();
  try { await fotoPut(id, blob); } catch (e) { return toast('Impossibile salvare la foto'); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  s.fotoId = id; s.conclusa = true; s.conclusaAt = Date.now();
  if (!s.inizio) s.inizio = null;
  save(); fermaRecupero(); tieniAcceso(false); vibra([60, 60, 200]);
  page.render(); page.el.scrollTop = 0;
  toast('Giornata conclusa 💪', 2800);
}

function apriFoto(id, s) {
  if (!id) return;
  const bg = sheet(`<h2>${esc(s ? s.nome : 'Foto')}</h2>${s ? `<p class="muted small" style="margin-top:-8px">${fmtData(s.data, true)}</p>` : ''}
    <img class="session-photo" data-foto="${id}" alt="">
    <div class="acts"><button class="btn" data-x="share">Condividi</button>${s ? '<button class="btn pri" data-x="open">Apri giornata</button>' : ''}</div>`,
    sh => sh.addEventListener('click', async e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'open') { await closeLayer(); apriAllenamento(s.id); }
      if (b.dataset.x === 'share') {
        const blob = await fotoGet(id); const f = new File([blob], `allenamento-${s ? s.data : 'foto'}.jpg`, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(() => { });
        else scarica(f, f.name);
      }
    }));
  caricaFoto(bg);
}

/* ---------- Scelta esercizi (multipla) ---------- */
function scegliEsercizi(cb) {
  const sel = []; let q = '', g = '';
  let scelto = false;
  const bg = sheet(`<h2>Aggiungi esercizi</h2>
    <input type="search" id="pick-q" placeholder="Cerca…" autocomplete="off">
    <div class="chips" id="pick-g"></div>
    <div id="pick-list" style="min-height:40vh"></div>
    <div class="acts" style="position:sticky;bottom:0;background:var(--card);padding-top:8px">
      <button class="btn" data-x="new">+ Nuovo</button><button class="btn pri" data-x="ok" id="pick-ok" disabled>Aggiungi</button></div>`,
    sh => {
      const lista = () => {
        const qq = slug(q);
        const items = [...catalogo().values()].filter(e => (!g || e.gruppo === g) && (!qq || slug(e.nome).includes(qq) || slug(e.attrezzo || '').includes(qq)))
          .sort((a, b) => (a.tipo === 'fx') - (b.tipo === 'fx') || a.nome.localeCompare(b.nome, 'it')).slice(0, 200);
        $('#pick-list', sh).innerHTML = items.length ? items.map(e => `<div class="list-item" data-id="${esc(e.id)}" style="cursor:pointer">
            <button class="check ${sel.includes(e.id) ? 'on' : ''}" tabindex="-1">✓</button>
            <div class="grow"><div>${esc(e.nome)}</div><div class="tiny muted">${esc(e.gruppo)}${e.attrezzo ? ' · ' + esc(e.attrezzo) : ''}${e.tipo === 'mio' ? ' · personale' : ''}</div></div></div>`).join('')
          : `<div class="empty">Nessun esercizio trovato.<br><button class="btn" data-x="new" style="margin-top:12px">Crea “${esc(q)}”</button></div>`;
        $('#pick-ok', sh).disabled = !sel.length;
        $('#pick-ok', sh).textContent = sel.length ? `Aggiungi (${sel.length})` : 'Aggiungi';
      };
      $('#pick-g', sh).innerHTML = ['', ...GRUPPI].map(x => `<button class="chip ${x === g ? 'on' : ''}" data-g="${x}">${x || 'Tutti'}</button>`).join('');
      $('#pick-q', sh).addEventListener('input', e => { q = e.target.value; lista(); });
      sh.addEventListener('click', async e => {
        const c = e.target.closest('[data-g]');
        if (c) { g = c.dataset.g; sh.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === c)); return lista(); }
        const it = e.target.closest('[data-id]');
        if (it) { const id = it.dataset.id; const k = sel.indexOf(id); k < 0 ? sel.push(id) : sel.splice(k, 1); return lista(); }
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'ok') { scelto = true; await closeLayer(); cb(sel); }
        if (x.dataset.x === 'new') {
          const nuovo = await formEsercizio(null, q);
          if (nuovo) { sel.push(nuovo.id); q = ''; $('#pick-q', sh).value = ''; lista(); }
        }
      });
      lista();
    });
  return bg;
}

function formEsercizio(e, nomeIniziale = '') {
  return new Promise(res => {
    let out = null;
    const v = e || { nome: nomeIniziale, gruppo: 'Petto', attrezzo: '', misura: 'rip' };
    sheet(`<h2>${e ? 'Modifica esercizio' : 'Nuovo esercizio'}</h2>
      <label class="f"><span>Nome</span><input type="text" id="fe-nome" value="${esc(v.nome)}"></label>
      <div class="grid2">
        <label class="f"><span>Gruppo</span><select id="fe-gruppo">${GRUPPI.map(x => `<option ${x === v.gruppo ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="f"><span>Misura</span><select id="fe-misura">
          <option value="rip" ${v.misura === 'rip' ? 'selected' : ''}>Ripetizioni</option>
          <option value="sec" ${v.misura === 'sec' ? 'selected' : ''}>Secondi</option>
          <option value="min" ${v.misura === 'min' ? 'selected' : ''}>Minuti (cardio)</option></select></label>
      </div>
      <label class="f"><span>Attrezzo</span><input type="text" id="fe-attr" value="${esc(v.attrezzo)}" placeholder="Es. Manubri, Macchina, Cavi" list="fe-attrs"></label>
      <datalist id="fe-attrs">${[...new Set([...catalogo().values()].map(x => x.attrezzo).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="acts"><button class="btn" data-x="0">Annulla</button><button class="btn pri" data-x="1">Salva</button></div>`,
      sh => {
        setTimeout(() => $('#fe-nome', sh).focus(), 150);
        sh.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-x]'); if (!b) return;
          if (b.dataset.x === '1') {
            const nome = $('#fe-nome', sh).value.trim(); if (!nome) return toast('Scrivi il nome');
            const dati = { nome, gruppo: $('#fe-gruppo', sh).value, misura: $('#fe-misura', sh).value, attrezzo: $('#fe-attr', sh).value.trim() };
            if (e) { const t = db.esercizi.find(x => x.id === e.id); Object.assign(t, dati); out = t; }
            else { out = { id: 'u-' + uid(), ...dati }; db.esercizi.push(out); }
            save(); resetCat();
          }
          closeLayer();
        });
      });
    stack[stack.length - 1].onClose = () => res(out);
  });
}

/* ---------- Schede ---------- */
function apriScheda(id) {
  const sc = () => db.schede.find(x => x.id === id);
  const page = openPage(() => {
    const s = sc(); if (!s) return { title: '', body: '' };
    let body = `<label class="f"><span>Nome della scheda</span><input type="text" data-f="nome" value="${esc(s.nome)}" placeholder="Es. Giorno A · Petto e tricipiti"></label>`;
    if (!s.esercizi.length) body += `<div class="empty"><div class="big">📋</div>Aggiungi gli esercizi di questa giornata.</div>`;
    s.esercizi.forEach((x, i) => {
      const info = exInfo(x.exId, x.nome);
      body += `<div class="card"><div class="row"><div class="grow"><b>${i + 1}. ${esc(info.nome)}</b><div class="tiny muted">${esc(info.gruppo)}${info.attrezzo ? ' · ' + esc(info.attrezzo) : ''}</div></div>
        <button class="icon-btn" data-act="su" data-i="${i}">↑</button><button class="icon-btn" data-act="giu" data-i="${i}">↓</button><button class="icon-btn" data-act="del" data-i="${i}">✕</button></div>
        <div class="grid2" style="grid-template-columns:repeat(4,1fr);margin-top:8px">
          <label class="f" style="margin:0"><span>Serie</span><input type="text" inputmode="numeric" data-f="serie" data-i="${i}" value="${fmtN(x.serie)}"></label>
          <label class="f" style="margin:0"><span>${unita(info.misura)}</span><input type="text" inputmode="decimal" data-f="rip" data-i="${i}" value="${fmtN(x.rip)}"></label>
          <label class="f" style="margin:0"><span>Kg</span><input type="text" inputmode="decimal" data-f="peso" data-i="${i}" value="${fmtN(x.peso)}" placeholder="–"></label>
          <label class="f" style="margin:0"><span>Rec. s</span><input type="text" inputmode="numeric" data-f="recupero" data-i="${i}" value="${fmtN(x.recupero)}"></label>
        </div>
        <input type="text" data-f="note" data-i="${i}" value="${esc(x.note || '')}" placeholder="Note (es. presa larga, tempo 3-1-1)" style="margin-top:8px"></div>`;
    });
    body += `<button class="btn block" data-act="add">+ Aggiungi esercizi</button>
      <p class="tiny muted">Il peso è quello di partenza: quando avvii la scheda l'app usa i pesi dell'ultima volta, se ci sono.</p>`;
    return {
      title: esc(s.nome || 'Nuova scheda'),
      actions: `<button class="icon-btn" data-act="menu">⋮</button>`,
      body,
      foot: `<button class="btn pri" data-act="start" ${s.esercizi.length ? '' : 'disabled'}>▶ Avvia oggi</button>`
    };
  });
  page.onClose = () => { const s = sc(); if (s && !s.nome.trim()) s.nome = 'Scheda senza nome'; save(); };
  page.el.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const s = sc();
    if (f === 'nome') { s.nome = e.target.value; $('h1', page.el).textContent = s.nome || 'Nuova scheda'; }
    else {
      const x = s.esercizi[+e.target.dataset.i];
      if (f === 'note') x.note = e.target.value;
      else if (f === 'serie') x.serie = Math.max(1, Math.round(num(e.target.value) || 1));
      else if (f === 'recupero') x.recupero = Math.round(num(e.target.value) || 0);
      else x[f] = num(e.target.value);
    }
    save();
  });
  page.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = sc(), i = +b.dataset.i;
    switch (b.dataset.act) {
      case 'su': if (i > 0) [s.esercizi[i - 1], s.esercizi[i]] = [s.esercizi[i], s.esercizi[i - 1]]; break;
      case 'giu': if (i < s.esercizi.length - 1) [s.esercizi[i + 1], s.esercizi[i]] = [s.esercizi[i], s.esercizi[i + 1]]; break;
      case 'del': s.esercizi.splice(i, 1); break;
      case 'add':
        scegliEsercizi(ids => {
          ids.forEach(id => { const inf = exInfo(id); s.esercizi.push({ exId: id, nome: inf.nome, serie: inf.misura === 'min' ? 1 : 3, rip: inf.misura === 'min' ? 20 : inf.misura === 'sec' ? 30 : 10, peso: '', recupero: db.impostazioni.recupero, note: '' }); });
          save(); page.render();
        });
        return;
      case 'start': {
        save(); const a = creaAllenamento({ scheda: s });
        await closeLayer(); switchTab('allenamenti'); apriAllenamento(a.id); return;
      }
      case 'menu': {
        const v = await menu(s.nome, [{ id: 'dup', label: 'Duplica', icon: '⧉' }, { id: 'del', label: 'Elimina scheda', icon: '🗑', danger: true }]);
        if (v === 'dup') { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.nome += ' (copia)'; db.schede.push(c); save(); await closeLayer(); apriScheda(c.id); return; }
        if (v === 'del' && await conferma('Eliminare la scheda?', 'Le giornate già fatte con questa scheda restano.', 'Elimina', true)) {
          db.schede = db.schede.filter(x => x !== s); save(); closeLayer(); return;
        }
        break;
      }
      default: return;
    }
    save(); page.render();
  });
}

function schedeEsempio() {
  const mk = (nome, lista) => ({
    id: uid(), nome, esercizi: lista.map(([n, serie, rip, rec]) => {
      const id = 'b-' + slug(n); return { exId: id, nome: n, serie, rip, peso: '', recupero: rec ?? 90, note: '' };
    })
  });
  db.schede.push(
    mk('A · Petto e tricipiti', [['Panca piana con bilanciere', 4, 8, 120], ['Panca inclinata con manubri', 3, 10], ['Croci ai cavi', 3, 12, 60], ['Push down con corda', 3, 12, 60], ['French press', 3, 10, 60], ['Plank', 3, 45, 45]]),
    mk('B · Dorso e bicipiti', [['Lat machine avanti', 4, 10], ['Rematore con manubrio', 3, 10], ['Pulley basso', 3, 12], ['Face pull', 3, 15, 60], ['Curl con manubri', 3, 10, 60], ['Curl a martello', 3, 12, 60]]),
    mk('C · Gambe e spalle', [['Squat con bilanciere', 4, 8, 150], ['Leg press', 3, 12, 120], ['Leg curl sdraiato', 3, 12], ['Calf raise in piedi', 4, 15, 60], ['Lento avanti con manubri', 3, 10], ['Alzate laterali', 3, 15, 60]])
  );
  save();
}

/* ---------- Dettaglio esercizio ---------- */
function grafico(punti, etichetta) {
  if (punti.length < 2) return `<p class="muted small">Servono almeno due giornate per vedere il grafico.</p>`;
  const W = 360, H = 180, P = { l: 38, r: 10, t: 12, b: 24 };
  const ys = punti.map(p => p.y), mn = Math.min(...ys), mx = Math.max(...ys);
  const lo = mn === mx ? mn - 1 : mn - (mx - mn) * .1, hi = mn === mx ? mx + 1 : mx + (mx - mn) * .1;
  const X = i => P.l + i * (W - P.l - P.r) / (punti.length - 1), Y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const path = punti.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const ticks = [lo + (hi - lo) * .1, (lo + hi) / 2, hi - (hi - lo) * .1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etichetta)}">
    ${ticks.map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#333842"/><text x="${P.l - 6}" y="${Y(t) + 4}" fill="#9aa1ad" font-size="12" text-anchor="end">${fmtN(Math.round(t * 10) / 10)}</text>`).join('')}
    <path d="${path}" fill="none" stroke="#c6f135" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${punti.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="4" fill="#c6f135"/>`).join('')}
    <text x="${P.l}" y="${H - 6}" fill="#9aa1ad" font-size="12">${esc(punti[0].x)}</text>
    <text x="${W - P.r}" y="${H - 6}" fill="#9aa1ad" font-size="12" text-anchor="end">${esc(punti[punti.length - 1].x)}</text></svg>`;
}

function apriEsercizio(id) {
  let metrica = 'max';
  const page = openPage(() => {
    const info = exInfo(id), st = storico(id);
    const rec = st.reduce((m, x) => Math.max(m, x.max), 0), rm = st.reduce((m, x) => Math.max(m, x.rm), 0);
    let body = `<div class="muted small">${esc(info.gruppo)}${info.attrezzo ? ' · ' + esc(info.attrezzo) : ''}${info.tipo === 'mio' ? ' · esercizio personale' : ''}</div>`;
    if (info.img && info.img.length) body += `<img class="ex-img" src="${FX_IMG + info.img[0]}" alt="" loading="lazy">${info.img[1] ? `<img class="ex-img" src="${FX_IMG + info.img[1]}" alt="" loading="lazy">` : ''}`;
    if (info.istr && info.istr.length) body += `<details class="card"><summary><b>Come si esegue</b> <span class="muted small">(in inglese)</span></summary><ol class="small">${info.istr.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>`;
    body += `<div class="stats"><div class="stat"><b>${rec ? fmtN(rec) : '–'}</b><span>Record kg</span></div>
      <div class="stat"><b>${rm ? fmtN(Math.round(rm)) : '–'}</b><span>1RM stimato</span></div>
      <div class="stat"><b>${st.length}</b><span>Giornate</span></div></div>`;
    if (st.length) {
      const m = info.misura === 'rip' && rec ? metrica : 'rip';
      const pts = st.slice(-20).map(x => ({ x: fmtData(x.a.data), y: m === 'max' ? x.max : m === 'rm' ? Math.round(x.rm * 10) / 10 : m === 'vol' ? x.vol : x.ripTot }));
      if (info.misura === 'rip' && rec) body += `<div class="seg" style="margin:8px 0">${[['max', 'Peso max'], ['rm', '1RM'], ['vol', 'Volume']].map(([k, l]) => `<button data-act="m" data-v="${k}" class="${m === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      body += `<div class="card">${grafico(pts, 'Andamento')}</div><div class="sec-title">Storico</div><div class="card">`;
      body += st.slice().reverse().slice(0, 30).map(x => `<div class="list-item" data-act="open" data-id="${x.a.id}" style="cursor:pointer"><div class="grow"><div class="small"><b>${fmtData(x.a.data)}</b> · ${esc(x.a.nome)}</div><div class="tiny muted">${esc(riassuntoSerie(x.ex))}</div></div>${x.max && x.max >= rec ? '<span class="badge acc">🏆</span>' : ''}</div>`).join('');
      body += `</div>`;
    } else body += `<div class="empty">Non hai ancora fatto questo esercizio.</div>`;
    return { title: esc(info.nome), actions: info.tipo === 'mio' ? `<button class="icon-btn" data-act="menu">⋮</button>` : '', body };
  });
  page.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'm') { metrica = b.dataset.v; page.render(); }
    if (b.dataset.act === 'open') apriAllenamento(b.dataset.id);
    if (b.dataset.act === 'menu') {
      const v = await menu(null, [{ id: 'mod', label: 'Modifica', icon: '✏️' }, { id: 'del', label: 'Elimina esercizio', icon: '🗑', danger: true }]);
      if (v === 'mod') { await formEsercizio(exInfo(id)); page.render(); }
      if (v === 'del' && await conferma('Eliminare l\'esercizio?', 'Lo storico delle giornate già fatte resta.', 'Elimina', true)) {
        db.esercizi = db.esercizi.filter(x => x.id !== id); save(); resetCat(); closeLayer();
      }
    }
  });
}

/* ---------- Schede principali ---------- */
let tab = 'allenamenti';
const stato = { q: '', g: '', mese: null, tutte: false };
const TITOLI = { allenamenti: 'Allenamenti', schede: 'Schede', esercizi: 'Esercizi', progressi: 'Progressi', altro: 'Altro' };
function switchTab(t) {
  tab = t; document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#title').textContent = TITOLI[t]; window.scrollTo(0, 0); renderTab();
}
$('#tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });

function renderTab() {
  const m = $('#main');
  m.innerHTML = ({ allenamenti: tabAllenamenti, schede: tabSchede, esercizi: tabEsercizi, progressi: tabProgressi, altro: tabAltro })[tab]();
  caricaFoto(m);
}

function cardAllenamento(a) {
  const tot = a.esercizi.length, f = a.esercizi.filter(e => e.fatto).length;
  return `<div class="card tap row" data-act="open" data-id="${a.id}">
    <div class="grow"><h3 class="ellipsis">${esc(a.nome)}</h3>
      <div class="small muted">${fmtData(a.data, true)}</div>
      <div class="row" style="margin-top:6px;gap:6px">${a.conclusa ? '<span class="badge ok">✓ Conclusa</span>' : '<span class="badge warn">In corso</span>'}
      <span class="badge">${f}/${tot} esercizi</span>${a.conclusa && a.inizio ? `<span class="badge">${fmtDurata(a.conclusaAt - a.inizio)}</span>` : ''}</div>
      ${a.conclusa ? '' : `<div class="bar"><i style="width:${tot ? f / tot * 100 : 0}%"></i></div>`}</div>
    ${a.fotoId ? `<img data-foto="${a.fotoId}" alt="" style="width:62px;height:82px;object-fit:cover;border-radius:10px">` : ''}</div>`;
}
function tabAllenamenti() {
  const inCorso = db.allenamenti.filter(a => !a.conclusa).sort(ordinaAll);
  const concluse = db.allenamenti.filter(a => a.conclusa).sort(ordinaAll);
  const sett = lunedi(oggi());
  const nSett = concluse.filter(a => a.data >= sett).length;
  let h = `<div class="fab-row"><button class="btn pri" data-act="new">+ Nuovo allenamento</button></div>
    <div class="small muted" style="margin:4px 4px 0">Questa settimana: <b style="color:var(--text)">${nSett}</b> ${nSett === 1 ? 'giornata conclusa' : 'giornate concluse'} · serie di <b style="color:var(--text)">${serieSettimane()}</b> settimane</div>`;
  if (inCorso.length) h += `<div class="sec-title">In corso</div>` + inCorso.map(cardAllenamento).join('');
  if (concluse.length) {
    h += `<div class="sec-title">Concluse</div>` + concluse.slice(0, stato.tutte ? 9999 : 20).map(cardAllenamento).join('');
    if (concluse.length > 20 && !stato.tutte) h += `<button class="btn block" data-act="tutte">Mostra tutte (${concluse.length})</button>`;
  }
  if (!db.allenamenti.length) h += `<div class="empty"><div class="big">🏋️</div>Nessun allenamento.<br>Crea una scheda oppure inizia un allenamento libero.</div>`;
  return h;
}
function nuovoAllenamentoSheet() {
  sheet(`<h2>Nuovo allenamento</h2>
    <label class="f"><span>Data</span><input type="date" id="na-data" value="${oggi()}"></label>
    <div class="sec-title" style="margin-top:8px">Da una scheda</div>
    ${db.schede.length ? db.schede.map(s => `<button class="menu-item" data-s="${s.id}"><span>📋</span><span class="grow"><b>${esc(s.nome)}</b><br><span class="tiny muted">${s.esercizi.length} esercizi${ultimaScheda(s.id)}</span></span></button>`).join('')
      : '<p class="muted small">Non hai ancora schede: puoi crearle nella sezione Schede.</p>'}
    <div class="sec-title">Oppure</div>
    <button class="menu-item" data-s=""><span>✨</span><span><b>Allenamento libero</b><br><span class="tiny muted">Scegli gli esercizi al momento</span></span></button>`,
    sh => sh.addEventListener('click', async e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const data = $('#na-data', sh).value || oggi();
      const scheda = db.schede.find(x => x.id === b.dataset.s);
      const a = creaAllenamento({ data, scheda });
      await closeLayer(); apriAllenamento(a.id);
    }));
}
function ultimaScheda(id) {
  const a = db.allenamenti.filter(x => x.schedaId === id).sort(ordinaAll)[0];
  return a ? ` · ultima: ${fmtData(a.data)}` : '';
}
function serieSettimane() {
  const sett = new Set(db.allenamenti.filter(a => a.conclusa).map(a => lunedi(a.data)));
  let d = parseDs(lunedi(oggi())), n = 0;
  if (!sett.has(ds(d))) d.setDate(d.getDate() - 7);
  while (sett.has(ds(d))) { n++; d.setDate(d.getDate() - 7); }
  return n;
}

function tabSchede() {
  let h = `<div class="fab-row"><button class="btn pri" data-act="new-scheda">+ Nuova scheda</button></div>`;
  if (!db.schede.length) return h + `<div class="empty"><div class="big">📋</div>Una scheda è il modello di una giornata: esercizi, serie, ripetizioni e recupero.<br><br><button class="btn" data-act="esempio">Carica 3 schede di esempio</button></div>`;
  h += db.schede.map(s => `<div class="card tap" data-act="open-scheda" data-id="${s.id}">
    <div class="row"><div class="grow"><h3>${esc(s.nome)}</h3><div class="small muted ellipsis">${s.esercizi.map(x => esc(exInfo(x.exId, x.nome).nome)).join(' · ') || 'Nessun esercizio'}</div>
    <div class="tiny muted" style="margin-top:4px">${s.esercizi.length} esercizi${ultimaScheda(s.id)}</div></div>
    <button class="btn sm pri" data-act="start-scheda" data-id="${s.id}">▶</button></div></div>`).join('');
  return h;
}

function tabEsercizi() {
  const qq = slug(stato.q);
  const items = [...catalogo().values()].filter(e => (!stato.g || e.gruppo === stato.g) && (!qq || slug(e.nome).includes(qq) || slug(e.attrezzo || '').includes(qq)))
    .sort((a, b) => (a.tipo === 'fx') - (b.tipo === 'fx') || a.nome.localeCompare(b.nome, 'it'));
  const usati = new Map();
  db.allenamenti.forEach(a => a.esercizi.forEach(e => { if (e.fatto) usati.set(e.exId, (usati.get(e.exId) || 0) + 1); }));
  return `<div class="row"><input type="search" id="ex-q" placeholder="Cerca tra ${catalogo().size} esercizi…" value="${esc(stato.q)}" class="grow"><button class="btn pri" data-act="new-ex">+</button></div>
    <div class="chips">${['', ...GRUPPI].map(x => `<button class="chip ${x === stato.g ? 'on' : ''}" data-act="g" data-g="${x}">${x || 'Tutti'}</button>`).join('')}</div>
    <div class="card" style="padding:4px 12px">${items.slice(0, 150).map(e => `<div class="list-item" data-act="open-ex" data-id="${esc(e.id)}" style="cursor:pointer">
      <div class="grow"><div>${esc(e.nome)}</div><div class="tiny muted">${esc(e.gruppo)}${e.attrezzo ? ' · ' + esc(e.attrezzo) : ''}${e.tipo === 'mio' ? ' · personale' : ''}</div></div>
      ${usati.get(e.id) ? `<span class="badge">${usati.get(e.id)}×</span>` : ''}</div>`).join('') || '<div class="empty">Nessun risultato</div>'}</div>
    ${items.length > 150 ? `<p class="center tiny muted">Mostrati 150 di ${items.length}: affina la ricerca.</p>` : ''}
    ${fxList.length ? '' : `<p class="center tiny muted">Ti servono altri esercizi? In Altro puoi scaricare un database di oltre 800 esercizi con immagini.</p>`}`;
}

function tabProgressi() {
  const concluse = db.allenamenti.filter(a => a.conclusa).sort(ordinaAll);
  const oggiS = oggi(), mese = stato.mese || oggiS.slice(0, 7);
  const nMese = concluse.filter(a => a.data.startsWith(oggiS.slice(0, 7))).length;
  const sett = lunedi(oggiS);
  let serieSett = 0, volSett = 0;
  db.allenamenti.filter(a => a.data >= sett).forEach(a => a.esercizi.forEach(ex => ex.serie.forEach(s => {
    if (s.fatta) { serieSett++; volSett += (+pesoSerie(ex, s) || 0) * (+num(s.rip) || 0) * (exInfo(ex.exId, ex.nome).misura === 'rip' ? 1 : 0); }
  })));
  let h = `<div class="stats"><div class="stat"><b>${serieSettimane()}</b><span>Settimane di fila</span></div>
    <div class="stat"><b>${nMese}</b><span>Giornate nel mese</span></div>
    <div class="stat"><b>${concluse.length}</b><span>Totale giornate</span></div></div>
    <div class="small muted" style="margin:0 4px">Questa settimana: ${serieSett} serie · ${fmtN(Math.round(volSett))} kg sollevati</div>`;

  // Calendario
  const [y, m] = mese.split('-').map(Number);
  const primo = new Date(y, m - 1, 1), giorni = new Date(y, m, 0).getDate(), off = (primo.getDay() + 6) % 7;
  const perGiorno = {};
  db.allenamenti.forEach(a => { (perGiorno[a.data] = perGiorno[a.data] || []).push(a); });
  h += `<div class="sec-title row"><span class="grow">${MESI[m - 1]} ${y}</span>
    <button class="icon-btn" data-act="mese" data-v="-1">‹</button><button class="icon-btn" data-act="mese" data-v="1">›</button></div>
    <div class="card"><div class="cal">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('')}
    ${'<div class="d x"></div>'.repeat(off)}
    ${Array.from({ length: giorni }, (_, i) => {
      const d = `${mese}-${pad(i + 1)}`, l = perGiorno[d] || [], ok = l.find(a => a.conclusa);
      return `<button class="d ${ok ? 'ok' : l.length ? 'prog' : ''} ${d === oggiS ? 'today' : ''}" ${l.length ? `data-act="open" data-id="${(ok || l[0]).id}"` : ''}>
        ${ok && ok.fotoId ? `<img data-foto="${ok.fotoId}" alt="">` : ''}<span>${i + 1}</span></button>`;
    }).join('')}</div></div>`;

  // Record personali
  const rec = new Map();
  db.allenamenti.forEach(a => a.esercizi.forEach(ex => ex.serie.forEach(s => {
    const p = +pesoSerie(ex, s) || 0; if (!s.fatta || !p) return;
    const r = rec.get(ex.exId); if (!r || p > r.p) rec.set(ex.exId, { p, rip: s.rip, data: a.data, exId: ex.exId, nome: ex.nome });
  })));
  const recs = [...rec.values()].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12);
  if (recs.length) h += `<div class="sec-title">Record personali</div><div class="card" style="padding:4px 12px">${recs.map(r =>
    `<div class="list-item" data-act="open-ex" data-id="${esc(r.exId)}" style="cursor:pointer"><div class="grow"><div>${esc(exInfo(r.exId, r.nome).nome)}</div><div class="tiny muted">${fmtData(r.data)}</div></div><b>${fmtN(r.p)} kg</b><span class="muted small">× ${fmtN(r.rip)}</span></div>`).join('')}</div>`;

  // Galleria foto
  const conFoto = concluse.filter(a => a.fotoId);
  h += `<div class="sec-title">Foto di convalida (${conFoto.length})</div>`;
  h += conFoto.length ? `<div class="gallery">${conFoto.slice(0, 60).map(a => `<button data-act="foto" data-id="${a.id}"><img data-foto="${a.fotoId}" alt="" loading="lazy"><small>${fmtData(a.data)}</small></button>`).join('')}</div>`
    : `<p class="muted small">Le foto delle giornate concluse compariranno qui: utile anche per vedere i cambiamenti nel tempo.</p>`;
  return h;
}

function tabAltro() {
  const im = db.impostazioni;
  const sw = (k, l, d) => `<label class="switch"><span>${l}${d ? `<br><span class="tiny muted">${d}</span>` : ''}</span><input type="checkbox" data-set="${k}" ${im[k] ? 'checked' : ''}></label>`;
  return `<div class="sec-title">Allenamento</div><div class="card">
    <label class="f" style="margin-top:0"><span>Recupero predefinito tra le serie (secondi)</span><input type="text" inputmode="numeric" data-set="recupero" value="${im.recupero}"></label>
    ${sw('vibrazione', 'Vibrazione', 'A fine recupero e quando segni una serie')}
    ${sw('suono', 'Suono a fine recupero')}
    ${sw('schermoAcceso', 'Schermo sempre acceso', 'Durante un allenamento in corso')}
    <label class="f"><span>Fotocamera per la convalida</span><select data-set="fotocamera">
      <option value="user" ${im.fotocamera === 'user' ? 'selected' : ''}>Frontale (selfie)</option>
      <option value="environment" ${im.fotocamera === 'environment' ? 'selected' : ''}>Posteriore</option></select></label></div>

    <div class="sec-title">Database esercizi</div><div class="card">
    ${fxList.length ? `<p class="small" style="margin-top:0">Database esteso installato: <b>${fxList.length}</b> esercizi con immagini (nomi in inglese, gruppi e attrezzi in italiano).</p>
      <button class="btn block danger" data-act="fx-del">Rimuovi database esteso</button>`
      : `<p class="small muted" style="margin-top:0">Oltre agli ${ESERCIZI_BASE.length} esercizi di base puoi scaricare <b>free-exercise-db</b>: più di 800 esercizi di pubblico dominio, con immagini e istruzioni (in inglese). Serve la connessione solo per lo scaricamento.</p>
      <button class="btn block" data-act="fx">⬇ Scarica database esteso</button>`}</div>

    <div class="sec-title">Backup</div><div class="card">
    <p class="small muted" style="margin-top:0">Dati e foto restano solo su questo telefono. Esporta ogni tanto un backup e salvalo su Google Drive.</p>
    <div class="grid2"><button class="btn" data-act="export">⬆ Esporta</button><button class="btn" data-act="import">⬇ Ripristina</button></div>
    <p class="tiny muted" id="spazio"></p></div>

    <div class="sec-title">Dati</div><div class="card">
    <button class="btn block danger" data-act="reset">Cancella tutti i dati</button></div>
    <p class="center tiny muted">Palestra v${VERSIONE} · funziona offline</p>`;
}

/* Eventi della vista principale */
$('#main').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'new': nuovoAllenamentoSheet(); break;
    case 'open': apriAllenamento(id); break;
    case 'tutte': stato.tutte = true; renderTab(); break;
    case 'new-scheda': { const s = { id: uid(), nome: '', esercizi: [] }; db.schede.push(s); save(); apriScheda(s.id); break; }
    case 'open-scheda': apriScheda(id); break;
    case 'start-scheda': { e.stopPropagation(); const a = creaAllenamento({ scheda: db.schede.find(x => x.id === id) }); switchTab('allenamenti'); apriAllenamento(a.id); break; }
    case 'esempio': schedeEsempio(); renderTab(); toast('Schede di esempio caricate'); break;
    case 'g': stato.g = b.dataset.g; renderTab(); break;
    case 'new-ex': { const n = await formEsercizio(null, stato.q); if (n) { renderTab(); apriEsercizio(n.id); } break; }
    case 'open-ex': apriEsercizio(id); break;
    case 'mese': {
      const [y, m] = (stato.mese || oggi().slice(0, 7)).split('-').map(Number);
      const d = new Date(y, m - 1 + (+b.dataset.v), 1); stato.mese = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; renderTab(); break;
    }
    case 'foto': { const a = db.allenamenti.find(x => x.id === id); apriFoto(a.fotoId, a); break; }
    case 'fx': scaricaFx(b); break;
    case 'fx-del':
      if (await conferma('Rimuovere il database esteso?', 'Le giornate già fatte con quegli esercizi mantengono il nome.', 'Rimuovi', true)) {
        fxList = []; localStorage.removeItem(KEY_FX); resetCat(); renderTab();
      }
      break;
    case 'export': esporta(); break;
    case 'import': $('#import-file').click(); break;
    case 'reset':
      if (await conferma('Cancellare tutto?', 'Schede, allenamenti, esercizi personali e foto verranno eliminati. Non si può annullare.', 'Cancella tutto', true)) {
        db = DEFAULT(); save(); await fotoClear().catch(() => { }); resetCat(); renderTab(); toast('Dati cancellati');
      }
      break;
  }
});
$('#main').addEventListener('input', e => {
  if (e.target.id === 'ex-q') {
    stato.q = e.target.value; const pos = e.target.selectionStart; renderTab();
    const i = $('#ex-q'); i.focus(); i.setSelectionRange(pos, pos); return;
  }
  const k = e.target.dataset.set; if (!k) return;
  if (k === 'recupero') { const n = num(e.target.value); if (n !== '') db.impostazioni.recupero = Math.round(n); }
  else if (e.target.type === 'checkbox') db.impostazioni[k] = e.target.checked;
  else db.impostazioni[k] = e.target.value;
  save();
});

/* ---------- Database esteso ---------- */
async function scaricaFx(btn) {
  btn.disabled = true; btn.textContent = 'Scaricamento…';
  try {
    const r = await fetch(FX_URL); if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    fxList = d.map(x => ({
      id: 'f-' + x.id, nome: x.name,
      gruppo: x.category === 'cardio' ? 'Cardio' : (FX_MUSCOLI[x.primaryMuscles[0]] || 'Altro'),
      attrezzo: FX_ATTREZZI[x.equipment] || '',
      misura: x.category === 'cardio' ? 'min' : x.category === 'stretching' ? 'sec' : 'rip',
      img: x.images || [], istr: x.instructions || []
    }));
    localStorage.setItem(KEY_FX, JSON.stringify(fxList));
    resetCat(); renderTab(); toast(`${fxList.length} esercizi aggiunti`);
  } catch (e) {
    fxList = []; toast('Scaricamento non riuscito: controlla la connessione'); btn.disabled = false; btn.textContent = '⬇ Scarica database esteso';
  }
}

/* ---------- Backup ---------- */
function scarica(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function esporta() {
  toast('Preparo il backup…');
  const foto = [];
  for (const a of db.allenamenti) if (a.fotoId) {
    const b = await fotoGet(a.fotoId).catch(() => null);
    if (b) foto.push({ id: a.fotoId, data: await blobToDataUrl(b) });
  }
  const json = JSON.stringify({ app: 'palestra', versione: VERSIONE, esportato: new Date().toISOString(), dati: db, foto });
  const nome = `palestra-backup-${oggi()}.json`;
  const file = new File([json], nome, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Palestra' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  scarica(file, nome);
}
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'palestra' || !j.dati) throw new Error('formato');
    if (!await conferma('Ripristinare il backup?', `Backup del ${new Date(j.esportato).toLocaleDateString('it-IT')} con ${j.dati.allenamenti.length} giornate e ${j.foto.length} foto. I dati attuali verranno sostituiti.`, 'Ripristina', true)) return;
    await fotoClear().catch(() => { });
    for (const p of j.foto) { const b = await (await fetch(p.data)).blob(); await fotoPut(p.id, b); }
    _urls.clear();
    db = { ...DEFAULT(), ...j.dati, impostazioni: { ...DEFAULT().impostazioni, ...j.dati.impostazioni } };
    save(); resetCat(); renderTab(); toast('Backup ripristinato');
  } catch (err) { toast('File di backup non valido'); }
});

/* ---------- Avvio ---------- */
async function mostraSpazio() {
  if (tab !== 'altro' || !navigator.storage || !navigator.storage.estimate) return;
  const e = await navigator.storage.estimate(); const el = $('#spazio');
  if (el) el.textContent = `Spazio usato: ${(e.usage / 1048576).toFixed(1)} MB`;
}
const _renderTab = renderTab;
renderTab = function () { _renderTab(); mostraSpazio(); };

renderTab();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
