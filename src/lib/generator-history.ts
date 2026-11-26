/**
 * Device-local encrypted generation history (never uploaded).
 * AES-GCM with a persistent wrapping key in localStorage.
 */

const ENABLED_KEY = 'qeva:gen-history-enabled';
const WRAP_KEY = 'qeva:gen-history-wrap';
const DATA_KEY = 'qeva:gen-history-data';
const MAX_ENTRIES = 50;

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): ArrayBuffer {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function getOrCreateWrapKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(WRAP_KEY);
  if (existing) {
    return crypto.subtle.importKey('raw', fromB64(existing), { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(WRAP_KEY, b64(raw));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function isHistoryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function setHistoryEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    localStorage.setItem(ENABLED_KEY, '1');
  } else {
    localStorage.removeItem(ENABLED_KEY);
    wipeHistory();
  }
}

export async function loadHistory(): Promise<string[]> {
  if (typeof window === 'undefined' || !isHistoryEnabled()) return [];
  const blob = localStorage.getItem(DATA_KEY);
  if (!blob) return [];
  try {
    const [ivB64, dataB64] = blob.split('.');
    const key = await getOrCreateWrapKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      key,
      fromB64(dataB64)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveHistory(entries: string[]): Promise<void> {
  if (typeof window === 'undefined' || !isHistoryEnabled()) return;
  const trimmed = entries.slice(0, MAX_ENTRIES);
  const key = await getOrCreateWrapKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(trimmed))
  );
  localStorage.setItem(DATA_KEY, `${b64(iv)}.${b64(sealed)}`);
}

export function wipeHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DATA_KEY);
}

export async function pushHistory(password: string): Promise<string[]> {
  const prev = await loadHistory();
  const next = [password, ...prev.filter((p) => p !== password)].slice(0, MAX_ENTRIES);
  await saveHistory(next);
  return next;
}
