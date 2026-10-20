// Builds the publishable site into ./_site (runs automatically on GitHub).
//   - copies the app from ./app
//   - copies the encrypted files from ./data (made by Publisher.html)
//   - downloads PDF.js into ./_site/vendor
//   - stamps the service worker so tablets pick up app updates
// Plain files are never part of the repository or the site.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, '_site');
const PDFJS_VERSION = '4.10.38';
const PDFJS = ['pdf.min.mjs', 'pdf.worker.min.mjs'];

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.cp(APP, OUT, { recursive: true });

  if (await exists(DATA)) {
    await fs.cp(DATA, path.join(OUT, 'data'), { recursive: true });
    const n = (await fs.readdir(DATA)).filter((f) => f.endsWith('.bin') && f !== 'index.bin').length;
    console.log(`Encrypted data: ${n} files`);
  } else {
    console.warn('No ./data folder yet – run Publisher.html first.');
  }
  // Backup copy of the publisher, reachable at <site>/publish.html
  if (await exists(path.join(ROOT, 'Publisher.html'))) await fs.copyFile(path.join(ROOT, 'Publisher.html'), path.join(OUT, 'publish.html'));

  await fs.mkdir(path.join(OUT, 'vendor'), { recursive: true });
  for (const name of PDFJS) {
    const dest = path.join(OUT, 'vendor', name);
    if (await exists(dest)) continue;
    const url = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/${name}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Download failed: ${url} (${r.status})`);
    await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
  }

  const h = crypto.createHash('sha1');
  for (const name of ['index.html', 'app.css', 'app.js', 'hlxcrypto.js', 'sw.js', 'manifest.webmanifest', 'logo.svg', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) h.update(await fs.readFile(path.join(OUT, name)));
  const swPath = path.join(OUT, 'sw.js');
  await fs.writeFile(swPath, (await fs.readFile(swPath, 'utf8')).replace('__BUILD__', h.digest('hex').slice(0, 10)));
  await fs.writeFile(path.join(OUT, '.nojekyll'), '');
  await fs.writeFile(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  console.log('Built -> _site');
}

main().catch((e) => { console.error(e); process.exit(1); });
