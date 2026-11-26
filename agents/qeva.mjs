#!/usr/bin/env node
/**
 * Qeva CLI — same /api/v1 surface humans use via the extension.
 * Config: ~/.qeva/config.json  { baseUrl, token }
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_PATH = path.join(os.homedir(), '.qeva', 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(partial) {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...loadConfig(), ...partial };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

function usage() {
  console.log(`Usage:
  qeva config set --base <url> --token <token>
  qeva config show
  qeva me
  qeva list [--host <host>]
  qeva get <id|host>
  qeva create --title <t> --username <u> --password <p> [--website <url>]
  qeva update <id> [--title t] [--username u] [--password p] [--website url]
  qeva delete <id>
`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function api(method, pathname, body) {
  const cfg = loadConfig();
  if (!cfg.baseUrl || !cfg.token) {
    throw new Error('Run: qeva config set --base <url> --token <token>');
  }
  const url = `${String(cfg.baseUrl).replace(/\/$/, '')}${pathname}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function looksLikeId(value) {
  return /^[a-z0-9]{20,}$/i.test(value) || value.startsWith('c');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub] = args._;

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    usage();
    return;
  }

  if (cmd === 'config' && sub === 'set') {
    if (!args.base || !args.token) throw new Error('--base and --token required');
    const cfg = saveConfig({ baseUrl: args.base, token: args.token });
    console.log(JSON.stringify({ ok: true, baseUrl: cfg.baseUrl, token: '***' }, null, 2));
    return;
  }

  if (cmd === 'config' && sub === 'show') {
    const cfg = loadConfig();
    console.log(
      JSON.stringify(
        { baseUrl: cfg.baseUrl || null, token: cfg.token ? '***' : null },
        null,
        2
      )
    );
    return;
  }

  if (cmd === 'me') {
    console.log(JSON.stringify(await api('GET', '/api/v1/me'), null, 2));
    return;
  }

  if (cmd === 'list') {
    const q = args.host ? `?host=${encodeURIComponent(args.host)}` : '';
    console.log(JSON.stringify(await api('GET', `/api/v1/passwords${q}`), null, 2));
    return;
  }

  if (cmd === 'get') {
    const target = args._[1];
    if (!target) throw new Error('get <id|host> required');
    if (looksLikeId(target) && !args.host) {
      console.log(JSON.stringify(await api('GET', `/api/v1/passwords/${target}`), null, 2));
      return;
    }
    const data = await api('GET', `/api/v1/passwords?host=${encodeURIComponent(target)}`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (cmd === 'create') {
    const body = {
      title: args.title,
      username: args.username,
      password: args.password,
      website: args.website,
    };
    if (!body.username || !body.password) {
      throw new Error('--username and --password required');
    }
    console.log(JSON.stringify(await api('POST', '/api/v1/passwords', body), null, 2));
    return;
  }

  if (cmd === 'update') {
    const id = args._[1];
    if (!id) throw new Error('update <id> required');
    const body = {};
    if (args.title) body.title = args.title;
    if (args.username) body.username = args.username;
    if (args.password) body.password = args.password;
    if (args.website !== undefined) body.website = args.website;
    console.log(JSON.stringify(await api('PUT', `/api/v1/passwords/${id}`, body), null, 2));
    return;
  }

  if (cmd === 'delete') {
    const id = args._[1];
    if (!id) throw new Error('delete <id> required');
    console.log(JSON.stringify(await api('DELETE', `/api/v1/passwords/${id}`), null, 2));
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
