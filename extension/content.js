const ROOT_ID = 'qeva-ext-root';
const PENDING_KEY = 'qevaPendingFill';

function isVisibleInput(el) {
  return (
    el instanceof HTMLInputElement &&
    el.offsetParent !== null &&
    el.type !== 'hidden' &&
    !el.disabled &&
    el.getAttribute('aria-hidden') !== 'true'
  );
}

/** True login signals — avoid random app text fields (role name, search, etc.). */
function isLoginUsernameInput(el) {
  if (!isVisibleInput(el) || el.type === 'password') return false;
  if (el.type === 'email') return true;
  const ac = (el.autocomplete || '').toLowerCase();
  if (ac === 'username' || ac === 'email') return true;
  const name = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''}`.toLowerCase();
  if (/(^|[^a-z])(email|username|user|login|identifier)([^a-z]|$)/i.test(name)) return true;
  return false;
}

function findLoginFields(root = document) {
  const password =
    [...root.querySelectorAll('input[type="password"]')].find(isVisibleInput) || null;

  const username =
    [...root.querySelectorAll('input')].find(isLoginUsernameInput) || null;

  // Need a password field, or an email/username step (SPA) — never bare text alone
  if (!password && !username) return null;

  const form =
    (password && password.closest('form')) ||
    (username && username.closest('form')) ||
    document.body;

  return { password: password || null, username, form, anchor: password || username };
}

function removeChip() {
  document.getElementById(ROOT_ID)?.querySelector('[data-qeva-chip]')?.remove();
}

function isSameOriginAsApi(apiBase) {
  if (!apiBase) return false;
  try {
    return new URL(apiBase).origin === location.origin;
  } catch {
    return false;
  }
}

function setNativeValue(el, value) {
  if (!el || value == null) return;
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(value) }));
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; inset: 0; pointer-events: none;';
  document.documentElement.appendChild(root);
  return root;
}

function showToast(text) {
  const root = ensureRoot();
  root.querySelector('[data-qeva-toast]')?.remove();
  const el = document.createElement('div');
  el.dataset.qevaToast = '1';
  el.textContent = text;
  el.style.cssText =
    'pointer-events:auto;position:fixed;bottom:16px;right:16px;background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;font:13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:280px';
  root.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function fillCredential(fields, cred) {
  if (fields.username && cred.username) setNativeValue(fields.username, cred.username);
  if (fields.password && cred.password) setNativeValue(fields.password, cred.password);

  // Google-style: email now, password on next screen
  if (cred.password && !fields.password) {
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          host: location.hostname,
          username: cred.username || '',
          password: cred.password,
          title: cred.title || '',
          at: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
    showToast(`Qeva filled email — password will fill on the next step`);
    return;
  }

  showToast(`Qeva filled: ${cred.title}`);
}

function tryPendingPasswordFill(fields) {
  if (!fields?.password) return false;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return false;
    const pending = JSON.parse(raw);
    if (!pending?.password) return false;
    if (Date.now() - (pending.at || 0) > 5 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_KEY);
      return false;
    }
    setNativeValue(fields.password, pending.password);
    if (fields.username && pending.username) setNativeValue(fields.username, pending.username);
    sessionStorage.removeItem(PENDING_KEY);
    showToast(`Qeva filled password: ${pending.title || 'login'}`);
    return true;
  } catch {
    return false;
  }
}

function send(type, payload = {}) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, ...payload }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false, error: 'No response' });
      });
    } catch (e) {
      resolve({ ok: false, error: e.message || String(e) });
    }
  });
}

function placeChip(anchorEl, onClick) {
  if (!anchorEl) return null;
  const root = ensureRoot();
  let chip = root.querySelector('[data-qeva-chip]');
  if (!chip) {
    chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.qevaChip = '1';
    chip.textContent = 'q.';
    chip.title = 'Qeva — fill from vault';
    chip.style.cssText =
      'pointer-events:auto;position:fixed;width:28px;height:28px;border:0;border-radius:8px;background:#1d4ed8;color:#fff;font:700 12px/28px ui-sans-serif,system-ui;cursor:pointer;box-shadow:0 4px 14px rgba(29,78,216,.45);padding:0;z-index:2147483647';
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    root.appendChild(chip);
  }
  const rect = anchorEl.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return chip;
  chip.style.top = `${Math.max(8, rect.top + (rect.height - 28) / 2)}px`;
  chip.style.left = `${Math.min(window.innerWidth - 40, Math.max(8, rect.right - 34))}px`;
  chip.style.display = 'block';
  return chip;
}

function showPicker(passwords, fields) {
  const root = ensureRoot();
  root.querySelector('[data-qeva-picker]')?.remove();

  const usable = passwords.filter((p) => (p.password || p.username) && !p.locked);
  const locked = passwords.filter((p) => p.locked);

  const panel = document.createElement('div');
  panel.dataset.qevaPicker = '1';
  panel.style.cssText =
    'pointer-events:auto;position:fixed;bottom:56px;right:16px;width:280px;max-height:320px;overflow:auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 16px 40px rgba(15,23,42,.18);font:13px/1.4 system-ui,sans-serif;z-index:2147483647';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600';
  header.innerHTML = '<span>Qeva matches</span>';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.style.cssText = 'border:0;background:transparent;font-size:18px;cursor:pointer;line-height:1;color:#64748b';
  close.onclick = () => panel.remove();
  header.appendChild(close);
  panel.appendChild(header);

  if (!usable.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'margin:12px;color:#64748b';
    empty.textContent = locked.length
      ? 'Vault locked for these credentials — unlock in the Qeva web app.'
      : 'No matching logins. Add one in Qeva with website containing google.com or gmail.com.';
    panel.appendChild(empty);
  } else {
    usable.forEach((cred) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText =
        'display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #f1f5f9;background:#fff;padding:10px 12px;cursor:pointer';
      row.innerHTML = `<div style="font-weight:600">${escapeHtml(cred.title)}</div><div style="color:#64748b;font-size:12px">${escapeHtml(cred.username || '')}</div>`;
      row.onmouseenter = () => (row.style.background = '#f8fafc');
      row.onmouseleave = () => (row.style.background = '#fff');
      row.onclick = () => {
        fillCredential(fields, cred);
        panel.remove();
      };
      panel.appendChild(row);
    });
  }

  root.appendChild(panel);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showSavePrompt(payload) {
  const root = ensureRoot();
  root.querySelector('[data-qeva-save]')?.remove();

  const bar = document.createElement('div');
  bar.dataset.qevaSave = '1';
  bar.style.cssText =
    'pointer-events:auto;position:fixed;bottom:16px;right:16px;display:flex;gap:8px;align-items:center;background:#0f172a;color:#fff;padding:10px 12px;border-radius:10px;font:13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);z-index:2147483647;max-width:360px;opacity:0.45;transition:opacity .2s ease';
  bar.innerHTML = `<span style="flex:1">Save login to Qeva?<br/><span style="opacity:.7;font-size:12px">${escapeHtml(payload.host || '')}</span></span>`;

  let hideTimer = null;
  const clearHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const scheduleHide = () => {
    clearHide();
    hideTimer = setTimeout(() => {
      if (bar.isConnected) bar.remove();
    }, 10000);
  };
  const closeBar = () => {
    clearHide();
    bar.remove();
  };

  bar.onmouseenter = () => {
    bar.style.opacity = '1';
    clearHide();
  };
  bar.onmouseleave = () => {
    bar.style.opacity = '0.45';
    scheduleHide();
  };

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText =
    'border:0;border-radius:6px;background:#2563eb;color:#fff;padding:6px 10px;font-weight:600;cursor:pointer';
  saveBtn.onclick = async () => {
    closeBar();
    const res = await send('QEVA_SAVE_LOGIN', { payload });
    if (res?.ok && res.skipped) showToast(res.reason || 'Already in vault');
    else if (res?.ok) showToast('Saved to Qeva');
    else showToast(res?.error || 'Save failed');
  };

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Not now';
  dismiss.style.cssText =
    'border:0;border-radius:6px;background:transparent;color:#cbd5e1;padding:6px 8px;cursor:pointer';
  dismiss.onclick = () => closeBar();

  bar.appendChild(saveBtn);
  bar.appendChild(dismiss);
  root.appendChild(bar);
  scheduleHide();
}

async function openPickerForPage() {
  const fields = findLoginFields();
  if (!fields) {
    showToast('No email/password field found yet — wait for the form to load');
    return;
  }
  const res = await send('QEVA_GET_LOGINS', { host: location.hostname });
  if (!res?.ok) {
    showToast(res?.error || 'Could not reach Qeva — check the extension token');
    return;
  }
  showPicker(res.passwords || [], fields);
}

let lastAnchor = null;
let didAnnounce = false;
let autofillTriedHost = null;

async function refreshUi(opts = {}) {
  const ping = await send('QEVA_PING');
  if (!ping?.ok) {
    removeChip();
    lastAnchor = null;
    if (opts.announce && !didAnnounce) {
      didAnnounce = true;
      showToast('Qeva: open the extension and save your access token');
    }
    return;
  }

  // Never show autofill chrome on the Qeva web app itself
  if (isSameOriginAsApi(ping.apiBase)) {
    removeChip();
    lastAnchor = null;
    return;
  }

  const fields = findLoginFields();
  if (!fields) {
    removeChip();
    lastAnchor = null;
    return;
  }

  if (tryPendingPasswordFill(fields)) {
    /* filled from previous step */
  }

  // SPA churn (Google): same field already wired — skip chip + network
  if (
    opts.fromMutation &&
    fields.anchor === lastAnchor &&
    document.getElementById(ROOT_ID)?.querySelector('[data-qeva-chip]')
  ) {
    return;
  }

  placeChip(fields.anchor, openPickerForPage);
  lastAnchor = fields.anchor;

  if (opts.autofillOnce && ping.autofillEnabled && fields.password) {
    const host = location.hostname;
    if (autofillTriedHost === host) return;
    autofillTriedHost = host;
    const res = await send('QEVA_GET_LOGINS', { host });
    const usable = (res?.passwords || []).filter((p) => p.password && !p.locked);
    if (usable.length === 1) fillCredential(fields, usable[0]);
    else if ((res?.passwords || []).some((p) => p.locked) && !usable.length) {
      showToast('Qeva: unlock vault in the web app for encrypted credentials');
    }
  }
}

function setup() {
  refreshUi({ announce: true, autofillOnce: true });

  const reposition = () => {
    if (lastAnchor) placeChip(lastAnchor, openPickerForPage);
    else refreshUi();
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });

  // Google / SPAs: email first, password appears later — debounce hard, no repeat fetches
  const mo = new MutationObserver(() => {
    clearTimeout(mo._t);
    mo._t = setTimeout(() => refreshUi({ autofillOnce: true, fromMutation: true }), 500);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

document.addEventListener(
  'submit',
  async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const password = form.querySelector('input[type="password"]');
    if (!password?.value) return;

    const ping = await send('QEVA_PING');
    if (!ping?.ok || ping.savePromptEnabled === false) return;

    const usernameEl =
      form.querySelector('input[autocomplete="username"]') ||
      form.querySelector('input[type="email"]') ||
      form.querySelector('input[type="text"]');

    showSavePrompt({
      title: document.title.slice(0, 80) || location.hostname,
      host: location.hostname,
      website: location.origin,
      username: usernameEl?.value || '',
      password: password.value,
    });
  },
  true
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'QEVA_FILL_PAGE') {
    openPickerForPage().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'QEVA_FILL_CREDENTIAL' && message.credential) {
    const fields = findLoginFields();
    if (!fields) {
      sendResponse({ ok: false, error: 'No login field' });
      return;
    }
    fillCredential(fields, message.credential);
    sendResponse({ ok: true });
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
