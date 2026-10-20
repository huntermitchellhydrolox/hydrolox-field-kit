/* Hydrolox Field Kit – offline content browser */
import * as H from './hlxcrypto.js';

const CONTENT_CACHE = 'content';
const THUMB_CACHE = 'thumbs';
const LS_FAVS = 'hlx-favs';
const LS_RECENT = 'hlx-recent';
const LS_SYNC = 'hlx-last-sync';

/* ---------- Icons ---------- */
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  animation: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  caseStudy: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3z"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  cloudOff: '<path d="M3 3l18 18M8 8a5 5 0 0 0-1 9.9h10a4 4 0 0 0 1.6-.3M12 6a6 6 0 0 1 6 5 4 4 0 0 1 2.7 4.4"/>',
  plus: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.5-3.5"/>',
  minus: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.5-3.5"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
};
const icon = (name, fill) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.file}</svg>`;
document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fmtBytes = (n) => {
  if (!n) return '0 MB';
  if (n < 1e6) return Math.max(1, Math.round(n / 1e3)) + ' KB';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';
  return (n / 1e9).toFixed(2) + ' GB';
};
// "01 - Dairyland_Power_Case-Study.pdf" -> "Dairyland Power Case-Study"
const pretty = (name) =>
  name.replace(/\.[^.]+$/, '').replace(/^\d+\s*[-_.)]\s*/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || name;
const prettyFolder = (name) => name.replace(/^\d+\s*[-_.)]\s*/, '').trim() || name;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const EXT = {
  video: ['mp4', 'm4v', 'mov', 'webm'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'],
  pdf: ['pdf'],
  slides: ['ppt', 'pptx', 'key'],
};
function kindOf(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  for (const [k, list] of Object.entries(EXT)) if (list.includes(ext)) return k;
  return 'file';
}
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

function folderIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('anim')) return 'animation';
  if (n.includes('case')) return 'caseStudy';
  if (n.includes('install')) return 'wrench';
  if (n.includes('video')) return 'video';
  if (n.includes('present') || n.includes('slide')) return 'slides';
  if (n.includes('photo') || n.includes('image')) return 'image';
  return 'folder';
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* ---------- State ---------- */
const state = {
  files: [],          // [{p, s, h, url, name, dir, kind}]
  folders: new Set(), // "Case Studies", "Case Studies/2024", ...
  cached: new Set(),  // urls present in content cache
  syncing: false,
  failed: 0,
  key: null,          // AES key (CryptoKey) once unlocked
  kid: null,          // id of the team passcode the key belongs to
  needNewCode: false,
};

function fileUrl(f) {
  return 'files/' + f.id;
}

function loadManifest(m) {
  state.manifest = m;
  state.files = (m.files || []).map((f) => {
    const parts = f.p.split('/');
    const file = { ...f, name: parts[parts.length - 1], dir: parts.slice(0, -1).join('/'), kind: kindOf(f.p) };
    file.url = fileUrl(file);
    file.title = pretty(file.name);
    return file;
  });
  state.folders = new Set(m.folders || []);
  for (const f of state.files) {
    const parts = f.dir ? f.dir.split('/') : [];
    for (let i = 1; i <= parts.length; i++) state.folders.add(parts.slice(0, i).join('/'));
  }
  state.byPath = new Map(state.files.map((f) => [f.p, f]));
}

/* ---------- Status UI ---------- */
function setStatus(kind, text) {
  const el = $('status');
  el.className = 'status ' + (kind || '');
  el.querySelector('.status-text').textContent = text;
}
function setProgress(frac) {
  $('progress').hidden = frac == null;
  $('progressBar').style.width = Math.round((frac || 0) * 100) + '%';
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3600);
}
function idleStatus() {
  const total = state.files.length;
  const have = state.files.filter((f) => state.cached.has(f.url)).length;
  if (state.needNewCode) return setStatus('warn', 'New passcode needed · tap');
  if (total === 0) return setStatus('', 'No files yet');
  if (have === total) return setStatus('ok', `All ${total} files saved offline`);
  if (!navigator.onLine) return setStatus('warn', `Offline · ${have} of ${total} saved`);
  return setStatus('warn', `${have} of ${total} saved · tap to retry`);
}

/* ---------- Key storage (IndexedDB) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('hlx', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) {
  try {
    const db = await idb();
    return await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); });
  } catch { return null; }
}
async function kvSet(k, v) {
  const db = await idb();
  await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
async function kvClear() {
  try { const db = await idb(); await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = res; t.onerror = res; }); } catch {}
}
// Stored as a non-extractable CryptoKey; falls back to raw bytes if the browser can't store keys.
async function saveKey(kid, info, passcode, key) {
  try { await kvSet('key', { kid, key }); }
  catch {
    const raw = await crypto.subtle.exportKey('raw', await H.unlockKeyInfo(info, passcode, true));
    await kvSet('key', { kid, raw: H.b64.to(raw) });
  }
  state.key = key; state.kid = kid;
}
async function loadKey() {
  const v = await kvGet('key');
  if (!v) return false;
  state.kid = v.kid;
  state.key = v.key || await crypto.subtle.importKey('raw', H.b64.from(v.raw), 'AES-GCM', false, ['decrypt']);
  return true;
}

/* ---------- Sync ---------- */
async function readCachedManifest() {
  try {
    const r = await (await caches.open(CONTENT_CACHE)).match('index.json');
    return r ? await r.json() : null;
  } catch { return null; }
}

async function refreshCachedSet() {
  const cache = await caches.open(CONTENT_CACHE);
  const keys = await cache.keys();
  state.cached = new Set(keys.map((k) => relUrl(k.url)).filter((u) => u.startsWith('files/')));
}
const BASE_PATH = new URL('./', location.href).pathname;
function relUrl(abs) {
  const u = new URL(abs);
  return (u.pathname.startsWith(BASE_PATH) ? u.pathname.slice(BASE_PATH.length) : u.pathname) + u.search;
}

async function fetchKeyInfo() {
  const r = await fetch('data/key.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('key ' + r.status);
  return r.json();
}

async function downloadOne(cache, f, onProgress) {
  const type = f.t || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Content-Length': String(f.s) };
  const get = async () => {
    const r = await fetch('data/' + f.id + '.bin', { cache: 'no-store' });
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    return r.body;
  };
  try {
    // Stream straight to disk – keeps memory low for big videos.
    await cache.put(f.url, new Response(H.decryptToStream(await get(), state.key, onProgress), { headers }));
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    // Older browsers can't store streamed responses: fall back to memory.
    const parts = await H.decryptStream(await get(), state.key, onProgress);
    await cache.put(f.url, new Response(new Blob(parts, { type }), { headers }));
  }
}

async function sync({ manual = false } = {}) {
  if (state.syncing || !state.key) return;
  if (isIOS && !isStandalone) return;
  if (!navigator.onLine) { if (manual) toast('No connection – showing saved files'); idleStatus(); return; }
  state.syncing = true;
  $('btnSync').disabled = true;
  try {
    setStatus('busy', 'Checking for updates…');
    let manifest = null;
    try {
      const info = await fetchKeyInfo();
      if (info.kid !== state.kid) {
        // Team passcode was changed. Keep the saved library usable; ask for the new code.
        state.needNewCode = true;
        idleStatus();
        if (manual) showLock('changed');
        return;
      }
      state.needNewCode = false;
      const r = await fetch('data/index.bin', { cache: 'no-store' });
      if (!r.ok) throw new Error('index ' + r.status);
      manifest = await H.decryptJSON(new Uint8Array(await r.arrayBuffer()), state.key);
    } catch (e) {
      console.warn('update check failed', e);
      if (manual) toast("Couldn't check for updates – showing saved files");
      idleStatus();
      return;
    }
    // If a library is already on the device, keep showing it until the update is fully saved.
    const prevManifest = state.files.length ? state.manifest : null;
    loadManifest(manifest);
    await refreshCachedSet();
    const todo = state.files.filter((f) => !state.cached.has(f.url));
    const cache = await caches.open(CONTENT_CACHE);
    if (prevManifest && todo.length) loadManifest(prevManifest);
    else await cache.put('index.json', new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
    route();
    const totalBytes = todo.reduce((a, f) => a + (f.s || 0), 0) || 1;
    let doneBytes = 0, doneCount = 0;
    state.failed = 0;
    if (todo.length) { try { await navigator.storage?.persist?.(); } catch {} }

    const queue = [...todo].sort((a, b) => a.s - b.s); // small files first: usable sooner
    const inflight = new Map();
    const report = () => {
      const partial = [...inflight.values()].reduce((a, b) => a + b, 0);
      setProgress((doneBytes + partial) / totalBytes);
      setStatus('busy', `Saving ${Math.min(doneCount + 1, todo.length)} of ${todo.length} · ${fmtBytes(Math.max(0, totalBytes - doneBytes - partial))} left`);
    };
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        inflight.set(f.id, 0); report();
        try {
          await downloadOne(cache, f, (n) => { inflight.set(f.id, n); report(); });
          state.cached.add(f.url);
          markCardSaved(f.url);
        } catch (e) {
          console.warn('download failed', f.p, e);
          state.failed++;
        }
        inflight.delete(f.id);
        doneBytes += f.s || 0; doneCount++;
        report();
      }
    };
    if (todo.length) await worker(); // one at a time keeps memory low on tablets
    setProgress(null);
    if (state.failed) {
      toast(`${state.failed} file(s) couldn't download. They'll retry next time you're online.`);
    } else {
      // Everything new is saved: now it's safe to drop old versions and remember the new list.
      const wanted = new Set((manifest.files || []).map((f) => 'files/' + f.id));
      for (const req of await cache.keys()) {
        const rel = relUrl(req.url);
        if (rel.startsWith('files/') && !wanted.has(rel)) {
          await cache.delete(req);
          (await caches.open(THUMB_CACHE)).delete(req.url).catch(() => {});
        }
      }
      await cache.put('index.json', new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
      if (state.manifest !== manifest) { loadManifest(manifest); if (viewer.hidden) route(); }
      await refreshCachedSet();
      ls.set(LS_SYNC, Date.now());
    }
    idleStatus();
  } finally {
    state.syncing = false;
    $('btnSync').disabled = false;
  }
}

function markCardSaved(url) {
  document.querySelectorAll(`.card[data-url="${CSS.escape(url)}"] .not-saved`).forEach((el) => el.remove());
  document.querySelectorAll(`.card[data-url="${CSS.escape(url)}"] .thumb`).forEach((el) => queueThumb(el.closest('.card')));
}

/* ---------- Favorites & recent ---------- */
const favs = () => new Set(ls.get(LS_FAVS, []));
function toggleFav(p) {
  const s = favs();
  s.has(p) ? s.delete(p) : s.add(p);
  ls.set(LS_FAVS, [...s]);
  return s.has(p);
}
function pushRecent(p) {
  const r = ls.get(LS_RECENT, []).filter((x) => x !== p);
  r.unshift(p);
  ls.set(LS_RECENT, r.slice(0, 8));
}

/* ---------- Rendering ---------- */
const main = $('main');

function childrenOf(dir) {
  const prefix = dir ? dir + '/' : '';
  const sub = [...state.folders].filter((f) => f.startsWith(prefix) && f !== dir && !f.slice(prefix.length).includes('/'));
  const files = state.files.filter((f) => f.dir === dir);
  sub.sort(collator.compare);
  files.sort((a, b) => collator.compare(a.name, b.name));
  return { sub, files };
}
const countIn = (dir) => state.files.filter((f) => f.dir === dir || f.dir.startsWith(dir + '/')).length;
const hrefFor = (dir) => '#/' + dir.split('/').map(encodeURIComponent).join('/');

function tileHTML(dir) {
  const name = dir.split('/').pop();
  const n = countIn(dir);
  return `<a class="tile" href="${hrefFor(dir)}">
    ${icon(folderIcon(name))}
    <div><div class="tile-name">${esc(prettyFolder(name))}</div>
    <div class="tile-count">${n} ${n === 1 ? 'file' : 'files'}</div></div></a>`;
}

function cardHTML(f, { showPath = false } = {}) {
  const fav = favs().has(f.p);
  const saved = state.cached.has(f.url);
  const label = { video: 'VIDEO', pdf: 'PDF', image: 'IMAGE', slides: 'SLIDES' }[f.kind] || (f.name.split('.').pop() || '').toUpperCase();
  return `<button class="card" type="button" data-path="${esc(f.p)}" data-url="${esc(f.url)}">
    <div class="thumb ${f.kind}">
      ${icon(f.kind === 'video' ? 'video' : f.kind)}
      <span class="badge">${esc(label)}</span>
      ${f.kind === 'video' ? `<span class="play">${icon('play')}</span>` : ''}
      ${saved ? '' : `<span class="not-saved">${icon('cloudOff')}Not saved</span>`}
    </div>
    <div class="card-body">
      <div style="flex:1;min-width:0">
        <div class="card-name">${esc(f.title)}</div>
        ${showPath ? `<div class="card-path">${esc(f.dir.split('/').map(prettyFolder).join(' › '))}</div>` : ''}
      </div>
      ${fav ? `<span class="card-star">${icon('star', true)}</span>` : ''}
    </div>
  </button>`;
}

function renderHome() {
  const { sub, files } = childrenOf('');
  const fav = [...favs()].map((p) => state.byPath.get(p)).filter(Boolean);
  const recent = ls.get(LS_RECENT, []).map((p) => state.byPath.get(p)).filter(Boolean).slice(0, 4);
  let html = '';
  if (!sub.length && !files.length) {
    html = `<div class="empty">${icon('folder')}No files have been published yet.<br>Add files to the “iPad Files” folder and publish.</div>`;
  } else {
    html += `<div class="section-title">Folders</div><div class="tiles">${sub.map(tileHTML).join('')}</div>`;
    if (files.length) html += `<div class="section-title">Files</div><div class="cards">${files.map((f) => cardHTML(f)).join('')}</div>`;
    if (fav.length) html += `<div class="section-title">${icon('star', true)} Starred</div><div class="cards">${fav.map((f) => cardHTML(f, { showPath: true })).join('')}</div>`;
    if (recent.length) html += `<div class="section-title">${icon('clock')} Recently opened</div><div class="cards">${recent.map((f) => cardHTML(f, { showPath: true })).join('')}</div>`;
  }
  main.innerHTML = html;
  hydrateCards();
}

function renderFolder(dir) {
  if (!state.folders.has(dir)) { location.hash = '#/'; return; }
  const parts = dir.split('/');
  const parent = parts.slice(0, -1).join('/');
  const { sub, files } = childrenOf(dir);
  const crumbs = parts.slice(0, -1).map((p, i) =>
    `<span class="sep">›</span><a href="${hrefFor(parts.slice(0, i + 1).join('/'))}">${esc(prettyFolder(p))}</a>`).join('');
  let html = `<nav class="crumbs">
      <button class="crumb-back" type="button" data-go="${esc(parent ? hrefFor(parent) : '#/')}">${icon('chevronLeft')}${parent ? esc(prettyFolder(parts[parts.length - 2])) : 'Home'}</button>
      ${parts.length > 2 ? crumbs : ''}
    </nav>
    <h1 class="folder-title">${esc(prettyFolder(parts[parts.length - 1]))}</h1>
    <p class="folder-meta">${countIn(dir)} files</p>`;
  if (sub.length) html += `<div class="tiles sub" style="margin-top:14px">${sub.map(tileHTML).join('')}</div>`;
  if (files.length) html += `<div class="cards" style="margin-top:18px">${files.map((f) => cardHTML(f)).join('')}</div>`;
  if (!sub.length && !files.length) html += `<div class="empty">${icon('folder')}This folder is empty.</div>`;
  main.innerHTML = html;
  hydrateCards();
}

function renderSearch(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = state.files.filter((f) => {
    const hay = (f.title + ' ' + f.name + ' ' + f.dir).toLowerCase();
    return terms.every((t) => hay.includes(t));
  }).sort((a, b) => collator.compare(a.title, b.title));
  main.innerHTML = hits.length
    ? `<div class="section-title">${hits.length} result${hits.length === 1 ? '' : 's'}</div><div class="cards">${hits.map((f) => cardHTML(f, { showPath: true })).join('')}</div>`
    : `<div class="empty">${icon('search')}No files match “${esc(q)}”.</div>`;
  hydrateCards();
}

function route() {
  const q = $('search').value.trim();
  if (q) return renderSearch(q);
  const dir = decodeURIComponent(location.hash.replace(/^#\/?/, '')).replace(/\/$/, '');
  dir ? renderFolder(dir) : renderHome();
}

main.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { location.hash = go.dataset.go; return; }
  const card = e.target.closest('.card');
  if (card) openFile(state.byPath.get(card.dataset.path));
});

/* ---------- Thumbnails ---------- */
let thumbObserver;
function hydrateCards() {
  thumbObserver?.disconnect();
  thumbObserver = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { thumbObserver.unobserve(en.target); queueThumb(en.target); }
  }, { rootMargin: '200px' });
  main.querySelectorAll('.card').forEach((c) => thumbObserver.observe(c));
}

const thumbQueue = [];
let thumbBusy = false;
const thumbMem = new Map();
function queueThumb(card) {
  const f = state.byPath.get(card.dataset.path);
  if (!f || !['image', 'pdf', 'video'].includes(f.kind) || !state.cached.has(f.url)) return;
  if (f.kind === 'video' && isIOS) return; // iOS won't decode frames from hidden videos
  if (thumbMem.has(f.url)) return applyThumb(f.url, thumbMem.get(f.url));
  thumbQueue.push(f);
  pumpThumbs();
}
function applyThumb(url, src) {
  document.querySelectorAll(`.card[data-url="${CSS.escape(url)}"] .thumb`).forEach((t) => {
    if (t.querySelector('img')) return;
    const img = new Image();
    img.alt = '';
    img.src = src;
    t.prepend(img);
    t.querySelector(':scope > .ico')?.remove();
  });
}
async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  while (thumbQueue.length) {
    const f = thumbQueue.shift();
    if (thumbMem.has(f.url)) { applyThumb(f.url, thumbMem.get(f.url)); continue; }
    try {
      const src = await getThumb(f);
      if (src) { thumbMem.set(f.url, src); applyThumb(f.url, src); }
    } catch {}
  }
  thumbBusy = false;
}
async function getThumb(f) {
  if (f.kind === 'image') return f.url;
  const tc = await caches.open(THUMB_CACHE);
  const key = new URL(f.url, location.href).href;
  const hit = await tc.match(key);
  if (hit) return URL.createObjectURL(await hit.blob());
  const blob = f.kind === 'pdf' ? await pdfThumb(f) : await videoThumb(f);
  if (!blob) return null;
  await tc.put(key, new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }));
  return URL.createObjectURL(blob);
}
const canvasToBlob = (c) => new Promise((res) => c.toBlob(res, 'image/jpeg', 0.8));
async function pdfThumb(f) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ url: f.url }).promise;
  try {
    const page = await doc.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 480 / vp1.width });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return await canvasToBlob(c);
  } finally { doc.destroy(); }
}
function videoThumb(f) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    let done = false;
    const finish = (b) => { if (done) return; done = true; v.removeAttribute('src'); v.load(); resolve(b); };
    const timer = setTimeout(() => finish(null), 5000);
    v.addEventListener('loadeddata', () => { v.currentTime = Math.min(1.5, (v.duration || 2) / 3); }, { once: true });
    v.addEventListener('seeked', async () => {
      try {
        const w = 480, h = Math.round(w * (v.videoHeight / v.videoWidth || 0.5625));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(v, 0, 0, w, h);
        clearTimeout(timer); finish(await canvasToBlob(c));
      } catch { clearTimeout(timer); finish(null); }
    }, { once: true });
    v.addEventListener('error', () => { clearTimeout(timer); finish(null); }, { once: true });
    v.src = f.url;
  });
}

/* ---------- PDF.js ---------- */
let pdfjsPromise;
function loadPdfjs() {
  pdfjsPromise ||= import('./vendor/pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
    return m;
  });
  return pdfjsPromise;
}

/* ---------- Viewer ---------- */
const viewer = $('viewer'), vBody = $('vBody');
let current = null;      // file being viewed
let cleanup = null;      // fn to tear down current view
let pdfZoom = 1;

async function openFile(f) {
  if (!f) return;
  current = f;
  pushRecent(f.p);
  $('vTitle').textContent = f.title;
  $('vStar').classList.toggle('on', favs().has(f.p));
  $('vStar').innerHTML = icon('star', favs().has(f.p));
  $('vZoomIn').hidden = $('vZoomOut').hidden = f.kind !== 'pdf';
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  history.pushState({ viewer: true }, '');
  prepareShare(f);

  if (!state.cached.has(f.url)) {
    vBody.innerHTML = navigator.onLine
      ? `<div class="v-msg">${icon('cloudOff')}<h3>Still downloading</h3>This file is being saved to the device. Try again in a moment.</div>`
      : `<div class="v-msg">${icon('cloudOff')}<h3>Not saved on this device yet</h3>Connect to Wi-Fi and open the app so it can finish downloading.</div>`;
    return;
  }
  vBody.innerHTML = '<div class="v-center"><div class="spinner"></div></div>';
  try {
    if (f.kind === 'video') showVideo(f);
    else if (f.kind === 'image') showImage(f);
    else if (f.kind === 'pdf') await showPdf(f);
    else showOther(f);
  } catch (e) {
    console.error(e);
    vBody.innerHTML = `<div class="v-msg">${icon('file')}<h3>Couldn't open this file here</h3>Use the share button to open it in another app.</div>`;
  }
}

function closeViewer(fromPop) {
  if (viewer.hidden) return;
  cleanup?.(); cleanup = null;
  vBody.innerHTML = '';
  viewer.hidden = true;
  document.body.style.overflow = '';
  current = null;
  if (!fromPop && history.state?.viewer) history.back();
  route();
}
$('vClose').addEventListener('click', () => closeViewer(false));
window.addEventListener('popstate', () => closeViewer(true));

function showVideo(f) {
  vBody.innerHTML = `<div class="v-center"><video controls playsinline autoplay preload="auto" src="${esc(f.url)}"></video></div>`;
  const v = vBody.querySelector('video');
  cleanup = () => { v.pause(); v.removeAttribute('src'); v.load(); };
}

function showImage(f) {
  vBody.innerHTML = `<div class="img-wrap"><img src="${esc(f.url)}" alt="${esc(f.title)}"></div>`;
}

function showOther(f) {
  vBody.innerHTML = `<div class="v-msg">${icon(f.kind === 'slides' ? 'slides' : 'file')}
    <h3>${esc(f.title)}</h3>
    This file type opens in its own app (for example PowerPoint).<br><br>
    <button class="btn" type="button" id="vOpenOther">Open in another app</button></div>`;
  $('vOpenOther').addEventListener('click', shareCurrent);
}

async function showPdf(f) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ url: f.url });
  const doc = await task.promise;
  if (current !== f) { doc.destroy(); return; }
  pdfZoom = 1;
  const wrap = document.createElement('div');
  wrap.className = 'pdf-pages';
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const el = document.createElement('div');
    el.className = 'pdf-page';
    el.dataset.n = i;
    wrap.appendChild(el);
    pages.push(el);
  }
  vBody.innerHTML = '';
  vBody.appendChild(wrap);

  const first = await doc.getPage(1);
  if (current !== f) { doc.destroy(); return; }
  const base = first.getViewport({ scale: 1 });
  const rendered = new Map(); // n -> zoom rendered at
  const tasks = new Map();

  const layout = () => {
    const avail = Math.min(vBody.clientWidth - 24, 1100);
    const w = Math.round(avail * pdfZoom);
    pages.forEach((el) => {
      const r = el._ratio || base.height / base.width;
      el.style.width = w + 'px';
      el.style.height = Math.round(w * r) + 'px';
    });
    wrap.style.alignItems = pdfZoom > 1 ? 'flex-start' : 'center';
    wrap.style.padding = pdfZoom > 1 ? '12px' : '';
    wrap.style.width = pdfZoom > 1 ? (w + 24) + 'px' : '';
  };

  const renderPage = async (el) => {
    const n = Number(el.dataset.n);
    if (rendered.get(n) === pdfZoom) return;
    rendered.set(n, pdfZoom);
    tasks.get(n)?.cancel?.();
    const page = await doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    el._ratio = vp1.height / vp1.width;
    const cssW = el.clientWidth || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let scale = (cssW * dpr) / vp1.width;
    const maxPx = 5e6; // stay well under iOS canvas memory limits
    if (vp1.width * vp1.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (vp1.width * vp1.height));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    const t = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
    tasks.set(n, t);
    try { await t.promise; } catch { return; }
    el.replaceChildren(c);
    el.style.height = Math.round(el.clientWidth * el._ratio) + 'px';
  };

  layout();
  const release = (el) => {
    const c = el.querySelector('canvas');
    if (c) { c.width = c.height = 0; el.replaceChildren(); }
    tasks.get(Number(el.dataset.n))?.cancel?.();
    rendered.delete(Number(el.dataset.n));
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.isIntersecting ? renderPage(en.target) : release(en.target);
  }, { root: vBody, rootMargin: '1200px 0px' });
  pages.forEach((p) => io.observe(p));

  const rerender = () => {
    layout();
    pages.forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.bottom > -600 && r.top < innerHeight + 600) renderPage(p);
    });
  };
  const onResize = () => rerender();
  window.addEventListener('resize', onResize);
  const zoom = (d) => {
    const prev = pdfZoom;
    pdfZoom = Math.min(3, Math.max(1, Math.round((pdfZoom + d) * 4) / 4));
    if (prev === pdfZoom) return;
    const yFrac = vBody.scrollTop / Math.max(1, vBody.scrollHeight);
    rerender();
    vBody.scrollTop = yFrac * vBody.scrollHeight;
  };
  const zin = () => zoom(0.5), zout = () => zoom(-0.5);
  $('vZoomIn').addEventListener('click', zin);
  $('vZoomOut').addEventListener('click', zout);

  cleanup = () => {
    io.disconnect();
    window.removeEventListener('resize', onResize);
    $('vZoomIn').removeEventListener('click', zin);
    $('vZoomOut').removeEventListener('click', zout);
    tasks.forEach((t) => t.cancel?.());
    pages.forEach(release);
    doc.destroy();
  };
}

$('vStar').addEventListener('click', () => {
  if (!current) return;
  const on = toggleFav(current.p);
  $('vStar').classList.toggle('on', on);
  $('vStar').innerHTML = icon('star', on);
  toast(on ? 'Starred – shows on the home screen' : 'Removed from starred');
});

let shareFile = null;
async function prepareShare(f) {
  shareFile = null;
  try {
    const r = await (await caches.open(CONTENT_CACHE)).match(f.url);
    if (!r || current !== f) return;
    const blob = await r.blob();
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (current === f) shareFile = new File([blob], f.name, { type: f.t || blob.type || MIME[ext] || 'application/octet-stream' });
  } catch {}
}
// Called straight from the tap (no awaits before share) so Safari allows it.
function shareCurrent() {
  const f = current, file = shareFile;
  if (!f) return;
  if (!file) { toast('Still preparing the file – try again in a second'); return; }
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: f.title }).catch((e) => { if (e?.name !== 'AbortError') toast("Couldn't share this file"); });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
}
$('vShare').addEventListener('click', shareCurrent);

/* ---------- Search ---------- */
const search = $('search');
search.addEventListener('input', () => {
  $('searchClear').hidden = !search.value;
  route();
});
search.addEventListener('keydown', (e) => { if (e.key === 'Enter') search.blur(); });
$('searchClear').addEventListener('click', () => { search.value = ''; $('searchClear').hidden = true; route(); search.focus(); });
window.addEventListener('hashchange', () => { if (search.value) { search.value = ''; $('searchClear').hidden = true; } route(); window.scrollTo(0, 0); });

/* ---------- Info sheet ---------- */
async function openSheet() {
  const total = state.files.length;
  const have = state.files.filter((f) => state.cached.has(f.url)).length;
  const bytes = state.files.reduce((a, f) => a + (f.s || 0), 0);
  let used = '—';
  try { const est = await navigator.storage.estimate(); used = fmtBytes(est.usage); } catch {}
  const last = ls.get(LS_SYNC, null);
  $('facts').innerHTML = `
    <dt>Saved on this device</dt><dd>${have} of ${total} files</dd>
    <dt>Library size</dt><dd>${fmtBytes(bytes)}</dd>
    <dt>Storage used</dt><dd>${used}</dd>
    <dt>Last full update</dt><dd>${last ? new Date(last).toLocaleString() : '—'}</dd>
    <dt>Connection</dt><dd>${navigator.onLine ? 'Online' : 'Offline'}</dd>`;
  $('sheet').hidden = false;
}
$('status').addEventListener('click', () => (state.needNewCode ? showLock('changed') : openSheet()));
$('btnForget').addEventListener('click', async () => {
  if (!confirm('Remove all Field Kit files and the passcode from this device?')) return;
  for (const n of [CONTENT_CACHE, THUMB_CACHE]) { try { await caches.delete(n); } catch {} }
  await kvClear();
  try { localStorage.clear(); } catch {}
  location.reload();
});
$('btnClose').addEventListener('click', () => ($('sheet').hidden = true));
$('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('sheet').hidden = true; });
$('btnSync').addEventListener('click', () => { $('sheet').hidden = true; sync({ manual: true }); });

/* ---------- Install hint (Android) / install gate (iPad Safari) ---------- */
function showInstallHint() {
  if (isStandalone || isIOS) return;
  const el = $('install');
  el.innerHTML = `${icon('phone')}<div><b>Install the app for offline use.</b> In Chrome, tap <b>⋮</b> then <b>Add to Home screen</b> (or <b>Install app</b>), then open it from the new icon.</div>`;
  el.hidden = false;
}
function showGate() {
  $('gate').hidden = false;
}

/* ---------- Lock screen ---------- */
function showLock(mode) {
  const lock = $('lock');
  $('lockTitle').textContent = mode === 'changed' ? 'The team passcode has changed' : 'Enter the team passcode';
  $('lockText').textContent = mode === 'changed'
    ? 'Your saved files still work. Enter the new passcode to get updates.'
    : 'You only need to do this once on this device.';
  $('lockCancel').hidden = mode !== 'changed';
  $('lockErr').textContent = '';
  $('lockInput').value = '';
  lock.hidden = false;
  setTimeout(() => $('lockInput').focus(), 50);
}
$('lockCancel').addEventListener('click', () => ($('lock').hidden = true));
$('lockShow').addEventListener('change', (e) => { $('lockInput').type = e.target.checked ? 'text' : 'password'; });
$('lockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('lockInput').value;
  if (!code) return;
  const btn = $('lockGo');
  btn.disabled = true; btn.textContent = 'Checking…'; $('lockErr').textContent = '';
  try {
    if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true });
    let info;
    try { info = await fetchKeyInfo(); } catch { throw Object.assign(new Error('net'), { offline: true }); }
    const key = await H.unlockKeyInfo(info, code);
    if (!key) { $('lockErr').textContent = "That passcode isn't right. Check with your manager."; return; }
    await saveKey(info.kid, info, code, key);
    state.needNewCode = false;
    $('lock').hidden = true;
    toast('Unlocked – saving files to this device…');
    sync();
  } catch (err) {
    $('lockErr').textContent = err.offline
      ? 'Connect to the internet for this one-time step, then try again.'
      : 'Something went wrong. Please try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Unlock';
  }
});

/* ---------- Boot ---------- */
async function boot() {
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    try { state.reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW failed', e); }
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only reload for app *updates*, never on the very first install.
      if (!hadController || reloading || !viewer.hidden || !$('lock').hidden) return;
      reloading = true; location.reload();
    });
  }
  // iPad: Safari tabs and Home Screen apps have separate storage – only run inside the installed app.
  if (isIOS && !isStandalone) { showGate(); return; }
  showInstallHint();

  const hasKey = await loadKey().catch(() => false);
  const cachedManifest = await readCachedManifest();
  if (cachedManifest) {
    loadManifest(cachedManifest);
    await refreshCachedSet();
    route();
  }
  if (!hasKey) { setStatus('', 'Locked'); showLock('first'); return; }
  idleStatus();
  sync();
}

window.addEventListener('online', () => sync());
window.addEventListener('offline', () => idleStatus());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) { state.reg?.update?.().catch(() => {}); sync(); }
});

boot();
