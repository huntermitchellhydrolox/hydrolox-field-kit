/* Hydrolox Field Kit – encryption format (shared by the app and Publisher.html)
 *
 * Key:   PBKDF2-SHA256(passcode, salt, ITER) -> AES-256-GCM key
 * Blob:  header (24 bytes) + N encrypted chunks
 *        header = "HLX1" | noncePrefix(8) | chunkSize u32 | totalSize u64   (big-endian)
 *        chunk i = AES-GCM(plain[i]) with IV = noncePrefix | u32(i)
 *                  and AAD = header | u32(i) | lastFlag(1 byte)
 *        Header in the AAD authenticates sizes; lastFlag + counter stop truncation/reordering.
 */

const MAGIC = [0x48, 0x4c, 0x58, 0x31]; // "HLX1"
const HEADER = 24;
export const CHUNK = 4 * 1024 * 1024;
export const ITER = 600000;

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = {
  to(bytes) { let s = ''; const b = new Uint8Array(bytes); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); },
  from(str) { const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
};
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export const randomId = () => Array.from(randomBytes(12), (x) => x.toString(16).padStart(2, '0')).join('');

export async function deriveKey(passcode, salt, iter = ITER, extractable = false) {
  const base = await subtle.importKey('raw', enc.encode(passcode.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base,
    { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

function makeHeader(total, chunkSize = CHUNK) {
  const h = new Uint8Array(HEADER);
  h.set(MAGIC, 0);
  h.set(randomBytes(8), 4);
  const dv = new DataView(h.buffer);
  dv.setUint32(12, chunkSize);
  dv.setUint32(16, Math.floor(total / 2 ** 32));
  dv.setUint32(20, total >>> 0);
  return h;
}
function parseHeader(h) {
  for (let i = 0; i < 4; i++) if (h[i] !== MAGIC[i]) throw new Error('Not an HLX1 file');
  const dv = new DataView(h.buffer, h.byteOffset, HEADER);
  const chunkSize = dv.getUint32(12);
  const total = dv.getUint32(16) * 2 ** 32 + dv.getUint32(20);
  const count = Math.max(1, Math.ceil(total / chunkSize));
  return { chunkSize, total, count };
}
function ivFor(h, i) {
  const iv = new Uint8Array(12);
  iv.set(h.subarray(4, 12), 0);
  new DataView(iv.buffer).setUint32(8, i);
  return iv;
}
function aadFor(h, i, last) {
  const a = new Uint8Array(HEADER + 5);
  a.set(h.subarray(0, HEADER), 0);
  const dv = new DataView(a.buffer);
  dv.setUint32(HEADER, i);
  a[HEADER + 4] = last ? 1 : 0;
  return a;
}

/** Encrypt a Blob/File. `write(Uint8Array)` receives output in order. */
export async function encryptBlob(blob, key, write, onProgress) {
  const total = blob.size;
  const h = makeHeader(total);
  const { count, chunkSize } = parseHeader(h);
  await write(h);
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const plain = new Uint8Array(await blob.slice(start, Math.min(total, start + chunkSize)).arrayBuffer());
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv: ivFor(h, i), additionalData: aadFor(h, i, i === count - 1) }, key, plain);
    await write(new Uint8Array(ct));
    onProgress?.(Math.min(total, start + chunkSize), total);
  }
}

/** Encrypt bytes in memory -> Uint8Array (used for small things: index, check value). */
export async function encryptBytes(bytes, key) {
  const parts = [];
  await encryptBlob(new Blob([bytes]), key, (p) => { parts.push(p); });
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

/** Simple byte queue for streaming decryption. */
class Queue {
  constructor() { this.parts = []; this.length = 0; }
  push(u8) { if (u8.length) { this.parts.push(u8); this.length += u8.length; } }
  take(n) {
    const out = new Uint8Array(n);
    let off = 0;
    while (off < n) {
      const p = this.parts[0];
      const need = n - off;
      if (p.length <= need) { out.set(p, off); off += p.length; this.parts.shift(); }
      else { out.set(p.subarray(0, need), off); this.parts[0] = p.subarray(need); off += need; }
    }
    this.length -= n;
    return out;
  }
}

/** Decrypt a ReadableStream (e.g. fetch response.body) into a new ReadableStream of plaintext.
 *  Only one chunk is held in memory at a time, so large videos can stream straight into Cache Storage. */
export function decryptToStream(stream, key, onProgress) {
  const reader = stream.getReader();
  const q = new Queue();
  let h = null, info = null, i = 0, done = false, produced = 0;
  const pump = async () => {
    const r = await reader.read();
    if (r.done) done = true; else q.push(r.value instanceof Uint8Array ? r.value : new Uint8Array(r.value));
  };
  const need = async (n) => { while (q.length < n) { if (done) throw new Error('File is truncated'); await pump(); } };
  return new ReadableStream({
    async pull(ctrl) {
      try {
        if (!h) { await need(HEADER); h = q.take(HEADER); info = parseHeader(h); }
        const plainLen = Math.min(info.chunkSize, info.total - i * info.chunkSize);
        await need(plainLen + 16);
        const ct = q.take(plainLen + 16);
        const pt = await subtle.decrypt({ name: 'AES-GCM', iv: ivFor(h, i), additionalData: aadFor(h, i, i === info.count - 1) }, key, ct);
        produced += pt.byteLength;
        onProgress?.(produced, info.total);
        if (pt.byteLength) ctrl.enqueue(new Uint8Array(pt));
        i++;
        if (i >= info.count) { ctrl.close(); reader.cancel().catch(() => {}); }
      } catch (e) {
        ctrl.error(e);
        reader.cancel().catch(() => {});
      }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

/** Decrypt a ReadableStream fully into memory. Returns array of plaintext Uint8Array parts. */
export async function decryptStream(stream, key, onProgress) {
  const r = decryptToStream(stream, key, onProgress).getReader();
  const out = [];
  for (;;) { const { done, value } = await r.read(); if (done) break; out.push(value); }
  return out;
}

export async function decryptBytes(bytes, key) {
  const parts = await decryptStream(new Blob([bytes]).stream(), key);
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

export async function encryptJSON(obj, key) { return encryptBytes(enc.encode(JSON.stringify(obj)), key); }
export async function decryptJSON(bytes, key) { return JSON.parse(dec.decode(await decryptBytes(bytes, key))); }

/* ---- key.json helpers ---- */
const CHECK = 'hydrolox-field-kit-ok';

export async function createKeyInfo(passcode) {
  const salt = randomBytes(16);
  const key = await deriveKey(passcode, salt);
  const check = await encryptBytes(enc.encode(CHECK), key);
  return { info: { v: 1, kid: randomId(), salt: b64.to(salt), iter: ITER, check: b64.to(check) }, key };
}

/** Returns the CryptoKey if the passcode is right, otherwise null. */
export async function unlockKeyInfo(info, passcode, extractable = false) {
  const key = await deriveKey(passcode, b64.from(info.salt), info.iter, extractable);
  try {
    const plain = await decryptBytes(b64.from(info.check), key);
    return dec.decode(plain) === CHECK ? key : null;
  } catch { return null; }
}
