import dns from 'dns/promises';
import net from 'net';
import {
  testSQLServerConnection,
  testPostgreSQLConnection,
} from '@/lib/test-connections';
import type { ProbeType } from '@/lib/validation';

const PROBE_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 4096;

export type ProbeInput = {
  type: ProbeType;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  url?: string;
  headerName?: string;
  ssl?: boolean;
  encrypt?: boolean;
};

export type ProbeResult = { success: boolean; message: string };

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80')) return true; // link-local
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIp(normalized.slice(7));
    }
    return false;
  }
  return true;
}

/** Resolve hostname and reject private / metadata targets (SSRF). */
export async function assertSafeOutboundHost(hostname: string): Promise<void> {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Target host is not allowed');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Target host is not allowed');
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('Could not resolve host');
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error('Target host is not allowed');
  }
}

export async function assertSafeOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }
  await assertSafeOutboundHost(parsed.hostname);
  return parsed;
}

async function probeHttp(input: ProbeInput): Promise<ProbeResult> {
  if (!input.url) return { success: false, message: 'URL is required' };
  let url: URL;
  try {
    url = await assertSafeOutboundUrl(input.url);
  } catch (e: any) {
    return { success: false, message: e?.message || 'Unsafe URL' };
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'QEVA-ServiceProbe/1.0',
  };

  if (input.type === 'http_bearer') {
    if (!input.password) return { success: false, message: 'Token is required' };
    headers.Authorization = `Bearer ${input.password}`;
  } else if (input.type === 'http_basic') {
    if (!input.username && !input.password) {
      return { success: false, message: 'Username/password required' };
    }
    const token = Buffer.from(`${input.username || ''}:${input.password || ''}`).toString(
      'base64'
    );
    headers.Authorization = `Basic ${token}`;
  } else if (input.type === 'http_header') {
    if (!input.headerName) return { success: false, message: 'Header name is required' };
    if (!input.password) return { success: false, message: 'API key is required' };
    headers[input.headerName] = input.password;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });
    // Drain a tiny amount then drop — never keep secrets from body
    const reader = res.body?.getReader();
    if (reader) {
      let read = 0;
      while (read < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        read += value?.byteLength || 0;
      }
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }
    if (res.status >= 200 && res.status < 400) {
      return { success: true, message: `HTTP ${res.status}` };
    }
    return { success: false, message: `HTTP ${res.status}` };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { success: false, message: 'Connection timed out' };
    }
    return { success: false, message: e?.message || 'Request failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function assertDbHost(host: string | undefined): Promise<ProbeResult | null> {
  try {
    await assertSafeOutboundHost(host || '');
    return null;
  } catch (e: any) {
    return { success: false, message: e?.message || 'Unsafe host' };
  }
}

export async function runServiceProbe(input: ProbeInput): Promise<ProbeResult> {
  switch (input.type) {
    case 'sqlserver': {
      const blocked = await assertDbHost(input.host);
      if (blocked) return blocked;
      return testSQLServerConnection({
        host: input.host || '',
        port: input.port || 1433,
        database: input.database || '',
        username: input.username,
        password: input.password,
        encrypt: input.encrypt ?? true,
      });
    }
    case 'postgres': {
      const blocked = await assertDbHost(input.host);
      if (blocked) return blocked;
      return testPostgreSQLConnection({
        host: input.host || '',
        port: input.port || 5432,
        database: input.database || '',
        username: input.username,
        password: input.password,
        ssl: input.ssl,
      });
    }
    case 'http_basic':
    case 'http_bearer':
    case 'http_header':
      return probeHttp(input);
    default:
      return { success: false, message: `Unsupported probe type: ${input.type}` };
  }
}

/** Reject executable / archive uploads — profiles must be JSON text only. */
export function looksLikeExecutableUpload(
  filename: string | undefined,
  bytes: Uint8Array | Buffer
): string | null {
  const name = (filename || '').toLowerCase();
  const bannedExt = [
    '.dll',
    '.jar',
    '.so',
    '.exe',
    '.bat',
    '.cmd',
    '.ps1',
    '.sh',
    '.msi',
    '.dmg',
    '.apk',
    '.wasm',
    '.node',
    '.zip',
    '.7z',
    '.rar',
    '.gz',
    '.tar',
  ];
  if (bannedExt.some((ext) => name.endsWith(ext))) {
    return 'Executable or archive uploads are not allowed';
  }
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return 'PE/executable content is not allowed';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x7f &&
    bytes[1] === 0x45 &&
    bytes[2] === 0x4c &&
    bytes[3] === 0x46
  ) {
    return 'ELF/executable content is not allowed';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'Archive uploads are not allowed';
  }
  // JAR/ZIP often same PK magic; also reject Java class
  if (bytes.length >= 4 && bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) {
    return 'Binary class files are not allowed';
  }
  return null;
}

export function parseConnectionProfileJson(
  text: string,
  maxBytes = 32_768
): { ok: true; raw: unknown } | { ok: false; error: string } {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length > maxBytes) return { ok: false, error: 'Profile too large (max 32KB)' };
  const exec = looksLikeExecutableUpload('profile.json', buf);
  if (exec) return { ok: false, error: exec };
  try {
    return { ok: true, raw: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}
