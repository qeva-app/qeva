const DEFAULT_API = 'http://127.0.0.1:3100';

async function getConfig() {
  const data = await chrome.storage.local.get([
    'apiBase',
    'accessToken',
    'autofillEnabled',
    'savePromptEnabled',
  ]);
  return {
    apiBase: (data.apiBase || DEFAULT_API).replace(/\/$/, ''),
    accessToken: data.accessToken || '',
    autofillEnabled: data.autofillEnabled !== false,
    savePromptEnabled: data.savePromptEnabled !== false,
  };
}

async function api(path, options = {}) {
  const { apiBase, accessToken } = await getConfig();
  if (!accessToken) throw new Error('Not signed in — set an access token in the popup');

  // Ensure we can reach the API host (optional permissions for non-localhost)
  try {
    const origin = new URL(apiBase).origin + '/*';
    await chrome.permissions.request({ origins: [origin] }).catch(() => {});
  } catch {
    /* ignore */
  }

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(json.details) ? json.details.filter(Boolean).join('; ') : '';
    throw new Error(details ? `${json.error || 'Error'}: ${details}` : json.error || `HTTP ${res.status}`);
  }
  return json;
}

async function getLogins(host) {
  const data = await api(`/api/v1/passwords?host=${encodeURIComponent(host || '')}`);
  return data.passwords || [];
}

async function saveLogin(payload) {
  const host = payload.host || '';
  if (host && payload.username) {
    const existing = await getLogins(host);
    const dup = existing.find(
      (p) =>
        (p.username || '').toLowerCase() === String(payload.username).toLowerCase() &&
        !p.locked
    );
    if (dup) {
      return { skipped: true, entry: dup, reason: 'Already in vault' };
    }
  }
  const entry = await api('/api/v1/passwords', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { skipped: false, entry };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'QEWA_GET_LOGINS' || message.type === 'QEVA_GET_LOGINS') {
        const passwords = await getLogins(message.host || '');
        sendResponse({ ok: true, passwords });
        return;
      }
      if (message.type === 'QEWA_SAVE_LOGIN' || message.type === 'QEVA_SAVE_LOGIN') {
        const result = await saveLogin(message.payload || {});
        sendResponse({ ok: true, ...result });
        return;
      }
      if (message.type === 'QEWA_PING' || message.type === 'QEVA_PING') {
        const cfg = await getConfig();
        sendResponse({
          ok: !!cfg.accessToken,
          apiBase: cfg.apiBase,
          autofillEnabled: cfg.autofillEnabled,
          savePromptEnabled: cfg.savePromptEnabled,
        });
        return;
      }
      if (message.type === 'QEVA_TEST') {
        const cfg = await getConfig();
        if (!cfg.accessToken) throw new Error('No access token');
        const data = await api('/api/v1/auth', {
          method: 'POST',
          body: JSON.stringify({ token: cfg.accessToken }),
        });
        sendResponse({ ok: true, scopes: data.scopes || [], apiBase: cfg.apiBase });
        return;
      }
      if (message.type === 'QEVA_GET_CONFIG') {
        sendResponse({ ok: true, ...(await getConfig()) });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});
