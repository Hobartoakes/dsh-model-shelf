// Catalog labels never become URLs: only keys present in the fixed registry do.
export const ICON_CACHE_KEY = 'dsh-model-shelf.icons.v1';
const ICON_BASE = 'https://unpkg.com/@lobehub/icons-static-png@1.97.0/light/';
const MAX_BYTES = 128 * 1024;
const MAX_ITEMS = 32;
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const isPNG = bytes => {
  if (bytes.length < 24 || !signature.every((v, i) => bytes[i] === v) || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  return width > 0 && height > 0 && width <= 2048 && height <= 2048;
};
const toDataURL = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return 'data:image/png;base64,' + btoa(binary);
};
const cachedPNG = value => {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,') || value.length > MAX_BYTES * 1.4 + 32) return false;
  try { const raw = atob(value.slice(22)); return isPNG(Uint8Array.from(raw, c => c.charCodeAt(0))); } catch { return false; }
};
async function limitedBody(response) {
  const len = Number(response.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw Error('icon too large');
  const reader = response.body?.getReader();
  if (!reader) throw Error('stream unavailable');
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw Error('icon too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!isPNG(bytes)) throw Error('invalid PNG');
  return bytes;
}

export function createIconStore({ storage, bundled = {}, registry = {}, fetcher = globalThis.fetch }) {
  let cache = {}, revision = 0, enabled = false;
  const listeners = new Set(), inFlight = new Map(), attempted = new Set(), controllers = new Set();
  try {
    const data = JSON.parse(storage.getItem(ICON_CACHE_KEY) || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data))
      for (const [key, value] of Object.entries(data).slice(-MAX_ITEMS)) if (Object.hasOwn(registry, key) && cachedPNG(value)) cache[key] = value;
  } catch { /* Storage is optional. */ }
  const emit = () => { revision++; for (const listener of listeners) listener(); };
  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) { for (const controller of controllers) controller.abort(); inFlight.clear(); attempted.clear(); }
  }
  async function load(key, allow = enabled) {
    if (!allow || Object.hasOwn(bundled, key) || cache[key] || !Object.hasOwn(registry, key) || attempted.has(key)) return;
    if (inFlight.has(key)) return inFlight.get(key);
    const filename = registry[key];
    if (typeof filename !== 'string' || !/^[a-z0-9-]+\.png$/.test(filename)) return;
    attempted.add(key);
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    const promise = (async () => {
      try {
        const response = await fetcher(ICON_BASE + filename, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
        if (!response.ok || !/^image\/png(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) return;
        const bytes = await limitedBody(response);
        if (controller.signal.aborted) return;
        const dataURL = toDataURL(bytes);
        if (typeof Image !== 'undefined') {
          const image = new Image(); image.src = dataURL;
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight || controller.signal.aborted) return;
        }
        cache[key] = dataURL;
        const keys = Object.keys(cache); while (keys.length > MAX_ITEMS) delete cache[keys.shift()];
        try { storage.setItem(ICON_CACHE_KEY, JSON.stringify(cache)); } catch { /* In-memory still works. */ }
        emit();
      } catch { /* Offline, blocked, invalid or aborted: use default. */ }
      finally { clearTimeout(timeout); controllers.delete(controller); if (inFlight.get(key) === promise) inFlight.delete(key); }
    })();
    inFlight.set(key, promise); return promise;
  }
  function discard(key) {
    if (!Object.hasOwn(cache, key)) return;
    delete cache[key];
    try { storage.setItem(ICON_CACHE_KEY, JSON.stringify(cache)); } catch { /* Optional storage. */ }
    emit();
  }
  return { get: key => bundled[key] ?? cache[key] ?? null, load, setEnabled, discard, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => revision, dispose() { setEnabled(false); listeners.clear(); } };
}
