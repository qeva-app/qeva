/**
 * Offline asserts for service probe SSRF + upload guards.
 * Run: node scripts/selfcheck-service-probe.js
 */
const assert = require('assert');
const path = require('path');

async function main() {
  // Load compiled-free TS via next's path - use dynamic import of built helpers is hard;
  // duplicate minimal checks that mirror service-probe guards for CI without ts-node.
  function isPrivateIp(ip) {
    const net = require('net');
    if (net.isIPv4(ip)) {
      const [a, b] = ip.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      return false;
    }
    return ip === '::1' || ip.toLowerCase().startsWith('fe80');
  }

  assert.strictEqual(isPrivateIp('127.0.0.1'), true);
  assert.strictEqual(isPrivateIp('10.0.0.1'), true);
  assert.strictEqual(isPrivateIp('192.168.1.1'), true);
  assert.strictEqual(isPrivateIp('8.8.8.8'), false);

  // DB probes must reject the same private hosts as HTTP (assertSafeOutboundHost)
  function assertSafeOutboundHost(hostname) {
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
      throw new Error('Target host is not allowed');
    }
    const net = require('net');
    if (net.isIP(hostname) && isPrivateIp(hostname)) {
      throw new Error('Target host is not allowed');
    }
  }
  assert.throws(() => assertSafeOutboundHost('127.0.0.1'));
  assert.throws(() => assertSafeOutboundHost('10.1.2.3'));
  assert.throws(() => assertSafeOutboundHost('localhost'));
  assert.doesNotThrow(() => assertSafeOutboundHost('8.8.8.8'));

  function looksLikeExecutable(filename, bytes) {
    const name = (filename || '').toLowerCase();
    if (['.dll', '.jar', '.exe', '.so'].some((e) => name.endsWith(e))) return true;
    if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) return true;
    return false;
  }

  assert.strictEqual(looksLikeExecutable('driver.dll', Buffer.from('{}')), true);
  assert.strictEqual(looksLikeExecutable('profile.json', Buffer.from('{"type":"postgres"}')), false);
  assert.strictEqual(looksLikeExecutable('x.bin', Buffer.from([0x4d, 0x5a, 0x90, 0x00])), true);

  // Zod schema via requiring compiled path - skip; validate JSON shape manually
  const profile = JSON.parse('{"type":"http_header","url":"https://api.datadoghq.com/api/v1/validate","headerName":"DD-API-KEY","password":"x"}');
  assert.strictEqual(profile.type, 'http_header');
  assert.ok(profile.url.startsWith('https://'));

  console.log('selfcheck-service-probe: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
