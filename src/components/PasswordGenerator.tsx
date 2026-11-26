'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, RefreshCw, Download, Settings2, Sparkles, Save, Trash2, Shield,
} from 'lucide-react';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';
import { calculatePasswordStrength } from '@/lib/password-strength';
import { copyWithAutoClear } from '@/lib/clipboard';
import { setVaultPrefill } from '@/lib/vault-prefill';
import {
  isHistoryEnabled,
  setHistoryEnabled,
  loadHistory,
  pushHistory,
  wipeHistory,
} from '@/lib/generator-history';
import type { PasswordPolicy } from '@/lib/password-policy';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';

type Mode = 'password' | 'passphrase' | 'pronounceable';

const PRESETS: Record<string, Partial<{
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
  excludeSequential: boolean;
  mode: Mode;
}>> = {
  basic: {
    length: 12,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeSimilar: false,
    excludeAmbiguous: false,
    excludeSequential: false,
    mode: 'password',
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
    mode: 'password',
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
    mode: 'password',
  },
  pronounceable: {
    length: 16,
    numbers: true,
    symbols: false,
    mode: 'pronounceable',
  },
};

export default function PasswordGenerator() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [options, setOptions] = useState({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false,
    excludeSequential: false,
    excludeChars: '',
    wordCount: 4,
    separator: '-',
    count: 1,
  });
  const [password, setPassword] = useState('');
  const [batch, setBatch] = useState<{ value: string; strength: number; selected: boolean }[]>([]);
  const [strength, setStrength] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [persistHistory, setPersistHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaWebsite, setMetaWebsite] = useState('');

  useEffect(() => {
    setPersistHistory(isHistoryEnabled());
    loadHistory().then(setHistory).catch(() => {});
    fetch('/api/generator')
      .then((r) => r.json())
      .then((data) => {
        if (data.policy) {
          setPolicy(data.policy);
          const d = data.defaults || {};
          setOptions((prev) => ({
            ...prev,
            length: d.length ?? prev.length,
            uppercase: d.uppercase ?? prev.uppercase,
            lowercase: d.lowercase ?? prev.lowercase,
            numbers: d.numbers ?? prev.numbers,
            symbols: d.symbols ?? prev.symbols,
            excludeAmbiguous: d.excludeAmbiguous ?? prev.excludeAmbiguous,
            excludeSimilar: d.excludeSimilar ?? prev.excludeSimilar,
          }));
          if (data.policy.defaultMode) setMode(data.policy.defaultMode);
        }
      })
      .catch(() => {});
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        ...options,
        passphrase: mode === 'passphrase',
        pronounceable: mode === 'pronounceable',
        count: options.count,
      };
      const res = await fetch('/api/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.passwords?.length) {
        toast.error(data.error || 'Generation failed');
        setGenerating(false);
        return;
      }

      const strengths: number[] = data.strengths || data.passwords.map((p: string) => calculatePasswordStrength(p).score);
      setPassword(data.passwords[0]);
      setStrength(strengths[0] || 0);
      setBatch(
        data.passwords.map((value: string, i: number) => ({
          value,
          strength: strengths[i] || calculatePasswordStrength(value).score,
          selected: false,
        }))
      );

      let nextHist = history;
      for (const pw of data.passwords as string[]) {
        nextHist = [pw, ...nextHist.filter((h) => h !== pw)].slice(0, 50);
      }
      setHistory(nextHist);
      if (persistHistory) {
        for (const pw of data.passwords as string[]) {
          await pushHistory(pw);
        }
        setHistory(await loadHistory());
      }
    } catch {
      toast.error('Generation failed');
    }
    setGenerating(false);
  }, [options, mode, history, persistHistory]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyPassword = async (value = password) => {
    if (!value) return;
    try {
      await copyWithAutoClear(value);
      toast.success('Password copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const saveToVault = (value: string) => {
    setVaultPrefill({
      password: value,
      title: metaTitle || undefined,
      website: metaWebsite || undefined,
    });
    toast.success('Opening vault…');
    router.push('/vault?action=add');
  };

  const saveSelectedBatch = () => {
    const selected = batch.filter((b) => b.selected);
    if (!selected.length) {
      toast.error('Select at least one password');
      return;
    }
    setVaultPrefill({
      password: selected[0].value,
      title: metaTitle || undefined,
      website: metaWebsite || undefined,
      passwords: selected.map((b, i) => ({
        password: b.value,
        title: metaTitle ? `${metaTitle} ${i + 1}` : undefined,
      })),
    });
    toast.success(`Saving ${selected.length} credential(s)…`);
    router.push('/vault?action=add');
  };

  const downloadPassword = () => {
    if (!password) return;
    const blob = new Blob([password], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-password.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const minLen = policy?.minLength ?? 4;

  return (
    <PageShell className="mx-auto max-w-3xl">
      <PageHeader
        title="Password Generator"
        description="Generate strong passwords, pronounceable secrets, or passphrases"
      />

      {policy && (
        <PageBlock>
          <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-xs text-muted-foreground">
            <Shield size={14} className="mt-0.5 shrink-0 text-primary" />
            <p>
              Policy: min {policy.minLength} chars
              {policy.requireUpper ? ', upper' : ''}
              {policy.requireLower ? ', lower' : ''}
              {policy.requireNumber ? ', number' : ''}
              {policy.requireSymbol ? ', symbol' : ''}
              — rotate every {policy.rotationDays} days
            </p>
          </div>
        </PageBlock>
      )}

      <PageBlock>
      <AnimatedCard className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label" htmlFor="gen-title">Title (optional)</label>
            <input
              id="gen-title"
              className="input"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="e.g. AWS Console"
            />
          </div>
          <div>
            <label className="label" htmlFor="gen-website">Website (optional)</label>
            <input
              id="gen-website"
              className="input"
              value={metaWebsite}
              onChange={(e) => setMetaWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 p-4 shadow-inner">
            <p className="flex-1 select-all break-all font-mono text-lg text-foreground">
              {password || 'Click Generate to create a password'}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => copyPassword()}
                disabled={!password}
                className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-40"
                aria-label="Copy password"
              >
                <Copy size={18} />
              </button>
              <button
                type="button"
                onClick={downloadPassword}
                disabled={!password}
                className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-40"
                aria-label="Download password"
              >
                <Download size={18} />
              </button>
              <button
                type="button"
                onClick={() => saveToVault(password)}
                disabled={!password}
                className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-40"
                aria-label="Save to vault"
                title="Save to vault"
              >
                <Save size={18} />
              </button>
            </div>
          </div>
          {password && (
            <div className="mt-3">
              <PasswordStrengthIndicator score={strength} />
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={generate} disabled={generating} className="btn-primary flex-1">
            <RefreshCw size={18} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={() => saveToVault(password)}
            disabled={!password}
            className="btn-outline flex-1 gap-2"
          >
            <Save size={16} /> Save to vault
          </button>
        </div>
      </AnimatedCard>
      </PageBlock>

      <PageBlock>
      <AnimatedCard delay={0.1} className="p-6">
        <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles size={18} /> Presets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(PRESETS).map(([name, preset]) => {
            const presetMode = preset.mode || 'password';
            const selected =
              mode === presetMode &&
              Object.entries(preset).every(([k, v]) => {
                if (k === 'mode') return true;
                return (options as Record<string, unknown>)[k] === v;
              });
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const { mode: m, ...rest } = preset;
                  setMode(m || 'password');
                  setOptions((prev) => ({ ...prev, ...rest }));
                }}
                className={`p-3 text-center rounded-xl border transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <p className="font-medium text-foreground capitalize text-sm leading-tight">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {preset.length ? `${preset.length} chars` : 'mode'}
                </p>
              </button>
            );
          })}
        </div>
      </AnimatedCard>
      </PageBlock>

      <PageBlock>
      <AnimatedCard delay={0.2} className="p-6">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Settings2 size={18} /> Options
        </h3>

        <div className="flex bg-muted rounded-lg p-0.5 mb-4" role="tablist">
          {(
            [
              ['password', 'Password'],
              ['pronounceable', 'Pronounceable'],
              ['passphrase', 'Passphrase'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === id ? 'bg-card shadow text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="label" htmlFor="batch-count">
            Batch count: {options.count}
          </label>
          <input
            id="batch-count"
            type="range"
            min={1}
            max={20}
            value={options.count}
            onChange={(e) => setOptions((p) => ({ ...p, count: +e.target.value }))}
            className="w-full"
          />
        </div>

        {mode === 'passphrase' ? (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="word-count">
                Word Count: {options.wordCount}
              </label>
              <input
                id="word-count"
                type="range"
                min={3}
                max={10}
                value={options.wordCount}
                onChange={(e) => setOptions((p) => ({ ...p, wordCount: +e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="label" htmlFor="separator">Separator</label>
              <input
                id="separator"
                value={options.separator}
                onChange={(e) => setOptions((p) => ({ ...p, separator: e.target.value.slice(0, 3) }))}
                className="input w-20"
                maxLength={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="pw-length">
                Length: {options.length}
              </label>
              <input
                id="pw-length"
                type="range"
                min={minLen}
                max={policy?.maxLength ?? 128}
                value={options.length}
                onChange={(e) => setOptions((p) => ({ ...p, length: +e.target.value }))}
                className="w-full"
              />
            </div>
            {mode === 'password' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'uppercase', label: 'Uppercase (A-Z)', locked: policy?.requireUpper },
                    { key: 'lowercase', label: 'Lowercase (a-z)', locked: policy?.requireLower },
                    { key: 'numbers', label: 'Numbers (0-9)', locked: policy?.requireNumber },
                    { key: 'symbols', label: 'Symbols (!@#$)', locked: policy?.requireSymbol },
                    { key: 'excludeSimilar', label: 'Exclude Similar', locked: policy?.excludeSimilar },
                    { key: 'excludeAmbiguous', label: 'Exclude Ambiguous', locked: policy?.excludeAmbiguous },
                    { key: 'excludeSequential', label: 'Exclude Sequential', locked: false },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!(options as Record<string, unknown>)[opt.key] || !!opt.locked}
                        disabled={!!opt.locked}
                        onChange={(e) => setOptions((p) => ({ ...p, [opt.key]: e.target.checked }))}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">
                        {opt.label}
                        {opt.locked ? ' (policy)' : ''}
                      </span>
                    </label>
                  ))}
                </div>
                <div>
                  <label className="label" htmlFor="exclude-chars">Exclude Characters</label>
                  <input
                    id="exclude-chars"
                    value={options.excludeChars}
                    onChange={(e) => setOptions((p) => ({ ...p, excludeChars: e.target.value }))}
                    className="input font-mono"
                    placeholder="Characters to exclude"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </AnimatedCard>
      </PageBlock>

      {batch.length > 1 && (
        <PageBlock>
        <AnimatedCard delay={0.25} className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">Batch results</h3>
            <button type="button" className="btn-outline btn-sm gap-1.5" onClick={saveSelectedBatch}>
              <Save size={14} /> Save selected
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {batch.map((row, i) => (
              <div key={`${row.value}-${i}`} className="flex items-center gap-3 p-2 bg-background rounded-lg">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) =>
                    setBatch((prev) =>
                      prev.map((b, idx) => (idx === i ? { ...b, selected: e.target.checked } : b))
                    )
                  }
                  aria-label={`Select password ${i + 1}`}
                />
                <p className="flex-1 font-mono text-sm truncate">{row.value}</p>
                <span className="text-[11px] text-muted-foreground w-8 text-right">{row.strength}</span>
                <button type="button" onClick={() => copyPassword(row.value)} aria-label="Copy">
                  <Copy size={14} className="text-muted-foreground hover:text-primary" />
                </button>
                <button type="button" onClick={() => saveToVault(row.value)} aria-label="Save">
                  <Save size={14} className="text-muted-foreground hover:text-primary" />
                </button>
              </div>
            ))}
          </div>
        </AnimatedCard>
        </PageBlock>
      )}

      <PageBlock>
      <AnimatedCard delay={0.3} className="p-6">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-display font-semibold text-foreground">Generation History</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={persistHistory}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPersistHistory(on);
                  setHistoryEnabled(on);
                  if (on) {
                    saveHistoryFromState(history);
                  } else {
                    setHistory([]);
                  }
                }}
              />
              Remember on this device
            </label>
            {history.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                onClick={() => {
                  wipeHistory();
                  setHistory([]);
                  toast.success('History cleared');
                }}
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {history.map((pw) => (
              <div key={pw} className="flex items-center gap-3 p-2 bg-background rounded-lg">
                <p className="flex-1 font-mono text-sm text-foreground truncate">{pw}</p>
                <button type="button" onClick={() => copyPassword(pw)} aria-label="Copy from history">
                  <Copy size={14} className="text-muted-foreground hover:text-primary" />
                </button>
                <button type="button" onClick={() => saveToVault(pw)} aria-label="Save from history">
                  <Save size={14} className="text-muted-foreground hover:text-primary" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AnimatedCard>
      </PageBlock>
    </PageShell>
  );
}

async function saveHistoryFromState(entries: string[]) {
  const { saveHistory } = await import('@/lib/generator-history');
  await saveHistory(entries);
}
