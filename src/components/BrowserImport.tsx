'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';
import { parseImport, processImport, type ImportFormat } from '@/lib/browser-import';

const SOURCES: { id: ImportFormat; label: string }[] = [
  { id: 'chrome', label: 'Chrome' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'safari', label: 'Safari' },
  { id: 'bitwarden', label: 'Bitwarden' },
  { id: 'onepassword', label: '1Password' },
  { id: 'lastpass', label: 'LastPass' },
];

export default function BrowserImport() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [browser, setBrowser] = useState<ImportFormat>('chrome');
  const [preview, setPreview] = useState<any[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [detectSource, setDetectSource] = useState('');
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const text = await f.text();
    setFileContent(text);
    setFormat(f.name.endsWith('.json') ? 'json' : 'csv');

    try {
      const parsed = parseImport(text, browser);
      const processed = processImport(parsed.entries, { autoCategory: true });
      setDetectSource(parsed.source);
      setTotalParsed(processed.length);
      setPreview(
        processed.slice(0, 10).map((row) => ({
          title: row.title,
          username: row.username,
          url: row.url || '',
          category: row.category || '',
        }))
      );
      if (parsed.errors.length) toast.warning(parsed.errors[0]);
      if (processed.length === 0) toast.error('No passwords found in this file');
      else setStep(2);
    } catch {
      toast.error('Failed to parse file');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/import/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: fileContent, format, browser }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Import failed');
        return;
      }
      setResult(data);
      setStep(4);
    } catch {
      toast.error('Import failed');
    }
    setImporting(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Passwords</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import from browser CSV/JSON or Bitwarden / 1Password / LastPass exports
        </p>
      </div>

      <div className="flex items-center gap-2">
        {['Upload', 'Preview', 'Import', 'Complete'].map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1
                  ? 'bg-success/100 text-white'
                  : step === i + 1
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > i + 1 ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${step === i + 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < 3 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-success/100' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <AnimatedCard className="p-8 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <h3 className="text-lg font-semibold text-foreground mb-2">Upload Password File</h3>
          <p className="text-sm text-muted-foreground mb-4">
            CSV or JSON export — Bitwarden JSON, 1Password CSV/JSON, LastPass CSV supported
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {SOURCES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBrowser(b.id)}
                className={`px-3 py-2 rounded-md text-sm ${
                  browser === b.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary">
            <Upload size={18} /> Select File
          </button>
        </AnimatedCard>
      )}

      {step === 2 && (
        <AnimatedCard className="p-6">
          <h3 className="font-semibold text-foreground mb-2">
            Preview ({preview.length} of {totalParsed} shown)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            File: {file?.name} · detected as {detectSource || format}
          </p>
          <div className="overflow-x-auto max-h-64 scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {preview[0] &&
                    Object.keys(preview[0]).map((key) => (
                      <th key={key} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2 text-foreground max-w-[200px] truncate">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between mt-4">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost">
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary" disabled={totalParsed === 0}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </AnimatedCard>
      )}

      {step === 3 && (
        <AnimatedCard className="p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Import</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {totalParsed} entries from {browser} ({detectSource || format})
          </p>
          <p className="text-xs text-muted-foreground mb-6">Duplicates will be skipped automatically</p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost">
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </AnimatedCard>
      )}

      {step === 4 && result && (
        <AnimatedCard className="p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-4">Import Complete</h3>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{result.imported}</p>
              <p className="text-xs text-muted-foreground">Imported</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-warning">{result.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-muted-foreground">{result.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-left mb-4 p-3 bg-destructive/10 rounded-lg">
              {result.errors.map((e: string, i: number) => (
                <p key={i} className="text-xs text-destructive">
                  • {e}
                </p>
              ))}
            </div>
          )}
          <a href="/vault" className="btn-primary">
            Go to Vault
          </a>
        </AnimatedCard>
      )}
    </div>
  );
}
