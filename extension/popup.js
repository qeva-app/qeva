const apiBaseEl = document.getElementById('apiBase');
const tokenEl = document.getElementById('token');
const statusEl = document.getElementById('status');
const autofillEl = document.getElementById('autofill');
const savePromptEl = document.getElementById('savePrompt');
const matchesEl = document.getElementById('matches');

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = 'status ' + (ok ? 'ok' : 'bad');
}

chrome.storage.local.get(
  ['apiBase', 'accessToken', 'autofillEnabled', 'savePromptEnabled'],
  (data) => {
    apiBaseEl.value = data.apiBase || 'http://127.0.0.1:3100';
    tokenEl.value = data.accessToken || '';
    autofillEl.checked = data.autofillEnabled !== false;
    savePromptEl.checked = data.savePromptEnabled !== false;
    setStatus(data.accessToken ? 'Token saved on this device' : 'No token yet', !!data.accessToken);
    loadMatches();
  }
);

document.getElementById('save').addEventListener('click', () => {
  const apiBase = apiBaseEl.value.trim().replace(/\/$/, '');
  const accessToken = tokenEl.value.trim();
  chrome.storage.local.set(
    {
      apiBase,
      accessToken,
      autofillEnabled: autofillEl.checked,
      savePromptEnabled: savePromptEl.checked,
    },
    () => {
      setStatus(accessToken ? 'Saved' : 'Cleared', !!accessToken);
      loadMatches();
    }
  );
});

document.getElementById('test').addEventListener('click', () => {
  const apiBase = apiBaseEl.value.trim().replace(/\/$/, '');
  const accessToken = tokenEl.value.trim();
  chrome.storage.local.set(
    {
      apiBase,
      accessToken,
      autofillEnabled: autofillEl.checked,
      savePromptEnabled: savePromptEl.checked,
    },
    () => {
      chrome.runtime.sendMessage({ type: 'QEVA_TEST' }, (res) => {
        if (res?.ok) {
          const scopes = Array.isArray(res.scopes) ? res.scopes.join(', ') : 'ok';
          setStatus(`Connected · ${scopes}`, true);
        } else {
          setStatus(res?.error || 'Connection failed', false);
        }
      });
    }
  );
});

function loadMatches() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      matchesEl.innerHTML = '<span class="muted">No login page on this tab.</span>';
      return;
    }
    let host = '';
    try {
      host = new URL(tab.url).hostname;
    } catch {
      matchesEl.textContent = 'Invalid tab URL';
      return;
    }

    chrome.runtime.sendMessage({ type: 'QEVA_GET_LOGINS', host }, (res) => {
      if (!res?.ok) {
        matchesEl.innerHTML = `<span class="bad">${escapeHtml(res?.error || 'Failed to load')}</span>`;
        return;
      }
      const list = res.passwords || [];
      if (!list.length) {
        matchesEl.innerHTML = `<span class="muted">No matches for <strong>${escapeHtml(host)}</strong></span>`;
        return;
      }

      matchesEl.innerHTML = '';
      list.forEach((cred) => {
        const row = document.createElement('div');
        row.className = 'match';
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.innerHTML = `<div class="title">${escapeHtml(cred.title)}</div><div class="user">${escapeHtml(cred.username || '')}</div>${
          cred.locked ? '<div class="locked">Locked - unlock vault in web app</div>' : ''
        }`;
        row.appendChild(meta);

        if (!cred.locked && cred.password) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'Fill';
          btn.addEventListener('click', () => {
            chrome.tabs.sendMessage(tab.id, { type: 'QEVA_FILL_CREDENTIAL', credential: cred }, (r) => {
              if (chrome.runtime.lastError || !r?.ok) {
                // Content script may not be injected yet - inject fill via scripting
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (c) => {
                    const password = document.querySelector('input[type="password"]');
                    if (!password) return false;
                    const form = password.closest('form') || document.body;
                    const username =
                      form.querySelector('input[autocomplete="username"]') ||
                      form.querySelector('input[type="email"]') ||
                      form.querySelector('input[type="text"]');
                    const set = (el, v) => {
                      if (!el) return;
                      const proto = HTMLInputElement.prototype;
                      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                      desc?.set?.call(el, v);
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    };
                    if (username && c.username) set(username, c.username);
                    set(password, c.password);
                    return true;
                  },
                  args: [cred],
                });
              }
              window.close();
            });
          });
          row.appendChild(btn);
        }
        matchesEl.appendChild(row);
      });
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
