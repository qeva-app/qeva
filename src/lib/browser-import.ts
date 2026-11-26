import { calculatePasswordStrength } from './password-strength';

export interface ImportedEntry {
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
}

export interface ParseResult {
  entries: ImportedEntry[];
  errors: string[];
  source: string;
}

export type ImportFormat =
  | 'auto'
  | 'chrome'
  | 'firefox'
  | 'safari'
  | 'bitwarden'
  | 'onepassword'
  | 'lastpass'
  | 'csv'
  | 'json';

function categorizeByUrl(url?: string): string {
  if (!url) return 'Other';
  const domain = url.toLowerCase();
  const categoryMap: Record<string, string[]> = {
    Email: ['gmail', 'outlook', 'yahoo', 'mail', 'proton'],
    'Development Tools': ['github', 'gitlab', 'bitbucket', 'stackoverflow', 'npm'],
    'Cloud Platforms': ['aws', 'azure', 'gcloud', 'digitalocean', 'heroku'],
    Collaboration: ['slack', 'teams', 'discord', 'zoom'],
    'Project Management': ['jira', 'asana', 'trello', 'notion', 'monday'],
    'Analytics Tools': ['analytics', 'mixpanel', 'amplitude', 'datadog'],
    Databases: ['mongodb', 'postgres', 'mysql', 'redis', 'elastic'],
    Documentation: ['confluence', 'notion', 'gitbook'],
  };
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => domain.includes(kw))) return category;
  }
  return 'Other';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else current += char;
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function headerIndex(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(h));
}

export function parseCSV(content: string, formatHint: ImportFormat = 'auto'): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { entries: [], errors: ['File is empty or has no data rows'], source: 'csv' };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const entries: ImportedEntry[] = [];
  const errors: string[] = [];

  let source = formatHint === 'auto' ? 'csv' : formatHint;
  if (formatHint === 'auto' || formatHint === 'csv') {
    if (headers.includes('name') && headers.includes('url') && headers.includes('password')) source = 'chrome';
    if (headers.includes('hostname') && headers.includes('password')) source = 'firefox';
    if (headers.includes('title') && headers.includes('url') && headers.includes('username') && headers.includes('password') && headers.includes('notes')) {
      // could be lastpass or generic
      if (headers.includes('grouping') || headers.includes('fav')) source = 'lastpass';
    }
    if (headers.includes('title') && headers.includes('username') && headers.includes('password') && (headers.includes('url') || headers.includes('urls'))) {
      if (headers.includes('type') || headers.includes('vault')) source = 'onepassword';
    }
  }

  // LastPass: url,username,password,totp,extra,name,grouping,fav
  // 1Password CSV: Title,Url,Username,Password,Notes,...
  // Chrome: name,url,username,password
  // Firefox: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,...
  const nameIdx = headerIndex(headers, ['name', 'title', 'hostname', 'account', 'login_uri']);
  const userIdx = headerIndex(headers, ['username', 'user', 'login', 'login_username', 'email']);
  const passIdx = headerIndex(headers, ['password', 'pass', 'login_password']);
  const urlIdx = headerIndex(headers, ['url', 'urls', 'hostname', 'website', 'login_uri', 'web site']);
  const notesIdx = headerIndex(headers, ['notes', 'note', 'comment', 'extra', 'remarks']);

  if (passIdx === -1) {
    return { entries: [], errors: ['No password column found'], source };
  }

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const entry: ImportedEntry = {
        title: values[nameIdx] || values[urlIdx] || `Imported Entry ${i}`,
        username: values[userIdx] || '',
        password: values[passIdx] || '',
        url: values[urlIdx],
        notes: values[notesIdx],
      };
      if (entry.password) entries.push(entry);
    } catch {
      errors.push(`Failed to parse row ${i + 1}`);
    }
  }

  return { entries, errors, source };
}

/** Bitwarden JSON export (unencrypted). */
export function parseBitwardenJSON(content: string): ParseResult {
  try {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : data.items || [];
    const entries: ImportedEntry[] = [];
    for (const item of items) {
      if (item.type != null && item.type !== 1 && item.type !== 'login') continue; // 1 = login
      const login = item.login || {};
      const password = login.password || item.password || '';
      if (!password) continue;
      const uris = login.uris || [];
      const url = uris[0]?.uri || item.url || undefined;
      entries.push({
        title: item.name || item.title || 'Untitled',
        username: login.username || item.username || '',
        password,
        url,
        notes: item.notes || undefined,
      });
    }
    return { entries, errors: [], source: 'bitwarden' };
  } catch {
    return { entries: [], errors: ['Invalid Bitwarden JSON'], source: 'bitwarden' };
  }
}

/** 1Password 1PUX is a zip; accept 1Password unencrypted CSV via parseCSV, or JSON items array. */
export function parse1PasswordJSON(content: string): ParseResult {
  try {
    const data = JSON.parse(content);
    const entries: ImportedEntry[] = [];
    const accounts = data.accounts || [data];
    for (const account of accounts) {
      const vaults = account.vaults || [account];
      for (const vault of vaults) {
        const items = vault.items || vault.rows || [];
        for (const item of items) {
          const fields = item.fields || item.details?.fields || [];
          let username = '';
          let password = '';
          let url = item.url || item.urls?.[0]?.url || '';
          for (const f of fields) {
            const des = (f.designation || f.name || f.id || '').toLowerCase();
            const val = f.value || f.v || '';
            if (des.includes('username') || des === 'username') username = val;
            if (des.includes('password') || des === 'password') password = val;
          }
          if (!password && item.password) password = item.password;
          if (!password) continue;
          entries.push({
            title: item.title || item.name || 'Untitled',
            username: username || item.username || '',
            password,
            url: url || undefined,
            notes: item.notes || undefined,
          });
        }
      }
    }
    if (entries.length === 0) {
      // Fall back to generic JSON
      return parseJSON(content);
    }
    return { entries, errors: [], source: 'onepassword' };
  } catch {
    return { entries: [], errors: ['Invalid 1Password JSON'], source: 'onepassword' };
  }
}

export function parseJSON(content: string): ParseResult {
  try {
    const data = JSON.parse(content);
    // Bitwarden shape
    if (data.items && Array.isArray(data.items) && data.items[0]?.login) {
      return parseBitwardenJSON(content);
    }
    const entries: ImportedEntry[] = [];
    const items = Array.isArray(data) ? data : data.items || data.entries || data.passwords || [];
    for (const item of items) {
      entries.push({
        title: item.title || item.name || item.hostname || 'Untitled',
        username: item.username || item.login || item.user || '',
        password: item.password || item.pass || '',
        url: item.url || item.website || item.hostname,
        notes: item.notes || item.note,
      });
    }
    return { entries: entries.filter((e) => e.password), errors: [], source: 'json' };
  } catch {
    return { entries: [], errors: ['Invalid JSON format'], source: 'json' };
  }
}

/** Detect format and parse CSV or JSON content. */
export function parseImport(
  content: string,
  format: ImportFormat = 'auto'
): ParseResult {
  const trimmed = content.trim();
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (format === 'bitwarden' || (format === 'auto' && looksJson && trimmed.includes('"login"'))) {
    if (looksJson) return parseBitwardenJSON(content);
  }
  if (format === 'onepassword' && looksJson) {
    return parse1PasswordJSON(content);
  }
  if (format === 'json' || (format === 'auto' && looksJson)) {
    return parseJSON(content);
  }
  if (format === 'lastpass' || format === 'chrome' || format === 'firefox' || format === 'safari' || format === 'onepassword' || format === 'csv' || format === 'auto') {
    return parseCSV(content, format === 'auto' ? 'auto' : format);
  }
  return looksJson ? parseJSON(content) : parseCSV(content, 'auto');
}

export function processImport(
  entries: ImportedEntry[],
  options: { autoCategory?: boolean; autoTag?: boolean } = {}
) {
  return entries.map((entry) => {
    let tag: string | undefined;
    if (options.autoTag && entry.url) {
      try {
        tag = new URL(entry.url.startsWith('http') ? entry.url : `https://${entry.url}`).hostname.replace(
          /^www\./,
          ''
        );
      } catch {
        tag = undefined;
      }
    }
    return {
      ...entry,
      category: options.autoCategory ? categorizeByUrl(entry.url) : undefined,
      tags: tag,
      strength: calculatePasswordStrength(entry.password).score,
    };
  });
}
