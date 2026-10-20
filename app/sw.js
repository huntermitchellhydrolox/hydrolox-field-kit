/* Hydrolox Field Kit – service worker
 * - App shell: cached on install, served cache-first.
 * - Content files (files/<id>): decrypted by app.js during sync, stored in the
 *   'content' cache and served from there,
 *   with byte-range support so videos play offline on iPad/Safari.
 */
const BUILD = '__BUILD__';            // replaced by tools/build.mjs on every publish
const SHELL = 'shell-' + BUILD;
const CONTENT = 'content';

const SHELL_FILES = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'hlxcrypto.js',
  'logo.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/pdf.min.mjs',
  'vendor/pdf.worker.min.mjs',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('shell-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope);
  const rel = url.pathname.slice(scope.pathname.length);

  if (rel.startsWith('data/')) {
    return; // encrypted downloads: always straight from the network
  } else if (rel.startsWith('files/')) {
    event.respondWith(serveContent(req));
  } else if (req.mode === 'navigate' && (rel === '' || rel === 'index.html')) {
    event.respondWith(
      fromShell('index.html').then((r) => r || fetch(req))
    );
  } else {
    event.respondWith(
      fromShell(req, { ignoreSearch: true }).then((r) => r || fetch(req))
    );
  }
});

async function fromShell(req, opts) {
  return (await caches.open(SHELL)).match(req, opts);
}

async function serveContent(req) {
  const cache = await caches.open(CONTENT);
  const cached = await cache.match(req.url);
  if (cached) return withRange(req, cached);
  return new Response('Not saved on this device yet', { status: 404 });
}

// Safari requires 206 Partial Content responses for <video>.
async function withRange(req, res) {
  const range = req.headers.get('range');
  if (!range) return res;
  const blob = await res.blob();
  const size = blob.size;
  const type = res.headers.get('Content-Type') || '';
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return new Response(blob, { headers: { 'Content-Type': type } });

  let start, end;
  if (m[1] === '') {                 // suffix range: bytes=-500
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    headers: {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
