import crypto from 'crypto';

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
  excludeSequential: boolean;
  excludeChars: string;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumbers: boolean;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const SIMILAR = 'il1Lo0O';
const AMBIGUOUS = '{}[]()/\\\'"`~,;:.<>';

const WORD_LIST = [
  'apple', 'banana', 'cherry', 'dolphin', 'eagle', 'forest', 'garden', 'harbor',
  'island', 'jungle', 'kitten', 'lemon', 'marble', 'noodle', 'orange', 'pepper',
  'quilted', 'rabbit', 'sunset', 'tunnel', 'umbrella', 'violet', 'walnut', 'xylophone',
  'yellow', 'zebra', 'anchor', 'bridge', 'castle', 'diamond', 'ember', 'falcon',
  'glacier', 'hammer', 'ivory', 'jasmine', 'knight', 'lantern', 'meadow', 'nebula',
  'orchid', 'phantom', 'quartz', 'ripple', 'silver', 'timber', 'utopia', 'velvet',
  'whisper', 'crystal', 'thunder', 'breeze', 'cosmic', 'dragon', 'eclipse', 'flame',
  'golden', 'horizon', 'ignite', 'journey', 'kaleidoscope', 'lighthouse', 'mystery', 'nexus',
];

export const PRESETS: Record<string, GeneratorOptions> = {
  basic: {
    length: 12,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: false,
    excludeAmbiguous: false,
    excludeSequential: false,
    excludeChars: '',
  },
  secure: {
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: true,
    excludeAmbiguous: false,
    excludeSequential: true,
    excludeChars: '',
  },
  memorable: {
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: true,
    excludeAmbiguous: true,
    excludeSequential: true,
    excludeChars: '',
  },
  pronounceable: {
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: true,
    excludeAmbiguous: true,
    excludeSequential: false,
    excludeChars: '',
  },
};

export interface PronounceableOptions {
  length: number;
  capitalize: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

const DEFAULT_OPTIONS: GeneratorOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: false,
  excludeAmbiguous: false,
  excludeSequential: false,
  excludeChars: '',
};

/** Unbiased index in [0, max). Uses rejection sampling; supports max > 255. */
function randomIndex(max: number): number {
  if (max <= 0) return 0;
  if (max === 1) return 0;

  // Enough bytes to cover max without overflow bias
  const byteCount = Math.ceil(Math.log2(max) / 8) || 1;
  const range = 256 ** byteCount;
  const limit = range - (range % max);

  while (true) {
    const buf = crypto.randomBytes(byteCount);
    let value = 0;
    for (let i = 0; i < byteCount; i++) value = value * 256 + buf[i];
    if (value < limit) return value % max;
  }
}

function pickChar(charset: string): string {
  return charset[randomIndex(charset.length)];
}

function applyExclusions(charset: string, opts: GeneratorOptions): string {
  let result = charset;
  if (opts.excludeSimilar) {
    result = result.split('').filter((c) => !SIMILAR.includes(c)).join('');
  }
  if (opts.excludeAmbiguous) {
    result = result.split('').filter((c) => !AMBIGUOUS.includes(c)).join('');
  }
  if (opts.excludeChars) {
    const banned = new Set(opts.excludeChars.split(''));
    result = result.split('').filter((c) => !banned.has(c)).join('');
  }
  return result;
}

function shuffle(chars: string[]): string[] {
  const arr = [...chars];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function removeSequential(password: string, charset: string): string {
  if (!charset) return password;
  const result = password.split('');
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1].charCodeAt(0);
    const curr = result[i].charCodeAt(0);
    if (Math.abs(curr - prev) === 1) {
      let next = pickChar(charset);
      let attempts = 0;
      while (Math.abs(next.charCodeAt(0) - prev) === 1 && attempts < 16) {
        next = pickChar(charset);
        attempts++;
      }
      result[i] = next;
    }
  }
  return result.join('');
}

export function generatePassword(options: Partial<GeneratorOptions> = {}): string {
  const opts: GeneratorOptions = { ...DEFAULT_OPTIONS, ...options };
  opts.length = Math.min(128, Math.max(4, Math.floor(opts.length || 16)));

  const pools: string[] = [];
  if (opts.uppercase) pools.push(applyExclusions(UPPERCASE, opts));
  if (opts.lowercase) pools.push(applyExclusions(LOWERCASE, opts));
  if (opts.numbers) pools.push(applyExclusions(NUMBERS, opts));
  if (opts.symbols) pools.push(applyExclusions(SYMBOLS, opts));

  const activePools = pools.filter((p) => p.length > 0);
  let charset = activePools.join('');
  if (!charset) {
    charset = applyExclusions(LOWERCASE + NUMBERS, opts) || LOWERCASE + NUMBERS;
  }

  const required = activePools.map((pool) => pickChar(pool));
  const remainingLength = Math.max(0, opts.length - required.length);
  const rest: string[] = [];
  for (let i = 0; i < remainingLength; i++) {
    rest.push(pickChar(charset));
  }

  let password = shuffle([...required, ...rest]).join('').slice(0, opts.length);

  if (opts.excludeSequential) {
    password = removeSequential(password, charset);
  }

  return password;
}

const CONSONANTS = 'bcdfghjklmnpqrstvwxz';
const VOWELS = 'aeiouy';

/** Syllable-style pronounceable password (CVC blocks). */
export function generatePronounceable(options: Partial<PronounceableOptions> = {}): string {
  const opts: PronounceableOptions = {
    length: 16,
    capitalize: true,
    includeNumbers: true,
    includeSymbols: false,
    ...options,
  };
  opts.length = Math.min(64, Math.max(8, Math.floor(opts.length || 16)));

  let out = '';
  while (out.length < opts.length) {
    out += pickChar(CONSONANTS) + pickChar(VOWELS) + pickChar(CONSONANTS);
  }
  out = out.slice(0, opts.length);

  if (opts.capitalize) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }

  const trail: string[] = [];
  if (opts.includeNumbers) trail.push(pickChar(NUMBERS));
  if (opts.includeSymbols) trail.push(pickChar('!@#$%&*'));
  if (trail.length) {
    const base = out.slice(0, Math.max(1, opts.length - trail.length));
    out = (base + trail.join('')).slice(0, opts.length);
  }

  return out;
}

export function generatePassphrase(options: Partial<PassphraseOptions> = {}): string {
  const opts: PassphraseOptions = {
    wordCount: 4,
    separator: '-',
    capitalize: true,
    includeNumbers: true,
    ...options,
  };

  opts.wordCount = Math.min(10, Math.max(3, Math.floor(opts.wordCount || 4)));
  const separator = (opts.separator || '-').slice(0, 3);

  const words: string[] = [];
  for (let i = 0; i < opts.wordCount; i++) {
    let word = WORD_LIST[randomIndex(WORD_LIST.length)];
    if (opts.capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  let passphrase = words.join(separator);
  if (opts.includeNumbers) {
    const num = randomIndex(900) + 100;
    passphrase += separator + num;
  }

  return passphrase;
}

export function calculateEntropy(password: string, charsetSize?: number): number {
  const size = charsetSize ?? Math.max(new Set(password).size, 2);
  return Math.round(password.length * Math.log2(size));
}
