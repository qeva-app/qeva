#!/usr/bin/env node
/**
 * Minimal MCP stdio server for Qeva — same /api/v1 tools as the CLI.
 * Env: QEVA_BASE_URL, QEVA_TOKEN  (or ~/.qeva/config.json)
 *
 * Cursor mcp.json example:
 *   { "mcpServers": { "qeva": { "command": "node", "args": ["agents/mcp-server.mjs"], "env": { "QEVA_BASE_URL": "...", "QEVA_TOKEN": "..." } } } }
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

const CONFIG_PATH = path.join(os.homedir(), '.qeva', 'config.json');

function loadConfig() {
  const fromEnv = {
    baseUrl: process.env.QEVA_BASE_URL,
    token: process.env.QEVA_TOKEN,
  };
  if (fromEnv.baseUrl && fromEnv.token) return fromEnv;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function api(method, pathname, body) {
  const cfg = loadConfig();
  if (!cfg.baseUrl || !cfg.token) {
    throw new Error('Set QEVA_BASE_URL + QEVA_TOKEN (or run qeva config set)');
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const TOOLS = [
  {
    name: 'qeva_me',
    description: 'Identify the Qeva user and token (human or agent client)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'qeva_list_passwords',
    description: 'List vault logins the token can access; pass host to resolve + reveal secrets',
    inputSchema: {
      type: 'object',
      properties: { host: { type: 'string', description: 'Optional website host filter' } },
    },
  },
  {
    name: 'qeva_get_password',
    description: 'Get one login by id and reveal the secret when allowed',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'qeva_create_password',
    description: 'Create a login in the vault (PUBLIC_KEY encryption)',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'qeva_update_password',
    description: 'Update a login (not USER_MASTER entries)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'qeva_delete_password',
    description: 'Delete a login the token may delete',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case 'qeva_me':
      return api('GET', '/api/v1/me');
    case 'qeva_list_passwords': {
      const q = args.host ? `?host=${encodeURIComponent(args.host)}` : '';
      return api('GET', `/api/v1/passwords${q}`);
    }
    case 'qeva_get_password':
      return api('GET', `/api/v1/passwords/${args.id}`);
    case 'qeva_create_password':
      return api('POST', '/api/v1/passwords', args);
    case 'qeva_update_password': {
      const { id, ...body } = args;
      return api('PUT', `/api/v1/passwords/${id}`, body);
    }
    case 'qeva_delete_password':
      return api('DELETE', `/api/v1/passwords/${args.id}`);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(msg) {
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'qeva', version: '1.0.0' },
        },
      });
    }
    if (method === 'notifications/initialized' || method === 'initialized') {
      return;
    }
    if (method === 'tools/list') {
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    }
    if (method === 'tools/call') {
      const result = await callTool(params?.name, params?.arguments || {});
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      });
    }
    if (method === 'ping') {
      return send({ jsonrpc: '2.0', id, result: {} });
    }
    return send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err) {
    if (id === undefined) return;
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err.message || String(err) },
    });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  handle(msg);
});
