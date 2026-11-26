'use client';

import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Trash2, X, Shield, Users, KeyRound, Activity } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';
import { REPORT_CATALOG, type ReportCatalogItem } from '@/lib/reports-catalog';

type ReportRow = {
  id: string;
  name: string;
  type: string;
  format: string;
  period?: string | null;
  status: string;
  createdAt: string;
  findings?: string | null;
};

const CATEGORY_ICON: Record<string, typeof FileText> = {
  Evidence: Shield,
  Risk: Shield,
  People: Users,
  Access: KeyRound,
  Ops: Activity,
};

export default function ReportsPage() {
  const [catalog] = useState<ReportCatalogItem[]>(REPORT_CATALOG);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportCatalogItem | null>(null);
  const [period, setPeriod] = useState('30d');
  const [format, setFormat] = useState('CSV');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const fetchReports = () => {
    fetch('/api/reports')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          toast.error(d.error || 'Could not load report history');
          setReports([]);
          setLoading(false);
          return;
        }
        setReports(Array.isArray(d.reports) ? d.reports : []);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Could not load report history');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(catalog.map((c) => c.category)))],
    [catalog]
  );

  const visibleCatalog = useMemo(
    () =>
      categoryFilter === 'All' ? catalog : catalog.filter((c) => c.category === categoryFilter),
    [catalog, categoryFilter]
  );

  const labelForType = (type: string) =>
    catalog.find((c) => c.id === type)?.label || type;

  const openGenerate = (item: ReportCatalogItem) => {
    setSelected(item);
    setName('');
    setPeriod('30d');
    setFormat('CSV');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setCreating(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selected.id,
          period,
          format,
          name: name || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Report ready');
        setSelected(null);
        fetchReports();
      } else {
        toast.error(data.error || 'Failed to generate');
      }
    } catch {
      toast.error('Failed');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Delete failed');
      return;
    }
    fetchReports();
  };

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Point-in-time evidence packs and exception exports — not live dashboards.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              categoryFilter === c
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCatalog.map((item, i) => {
          const Icon = CATEGORY_ICON[item.category] || FileText;
          return (
            <AnimatedCard key={item.id} delay={i * 0.03} className="p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                  <h3 className="font-semibold text-foreground">{item.label}</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground flex-1">{item.description}</p>
              <button type="button" onClick={() => openGenerate(item)} className="btn-primary w-full">
                Generate
              </button>
            </AnimatedCard>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">History</h2>
        <div className="space-y-3">
          {reports.map((r, i) => (
            <AnimatedCard key={r.id} delay={i * 0.02} className="p-4 flex items-center gap-4">
              <FileText size={20} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {labelForType(r.type)} · {r.format} · {r.period || '—'} ·{' '}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.findings && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 line-clamp-1">
                    {r.findings.split('\n')[0]}
                  </p>
                )}
              </div>
              <span
                className={`badge ${
                  String(r.status).toUpperCase() === 'COMPLETED'
                    ? 'badge-green'
                    : String(r.status).toUpperCase() === 'FAILED'
                      ? 'badge-red'
                      : 'badge-amber'
                }`}
              >
                {r.status}
              </span>
              {String(r.status).toUpperCase() === 'COMPLETED' && (
                <a
                  href={`/api/reports/${r.id}/download`}
                  className="p-2 text-muted-foreground hover:text-primary rounded"
                  title="Download"
                >
                  <Download size={16} />
                </a>
              )}
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="p-2 text-muted-foreground hover:text-destructive rounded"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </AnimatedCard>
          ))}
          {reports.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              No reports generated yet — pick a catalog item above.
            </p>
          )}
        </div>
      </div>

      {selected && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Generate {selected.label}</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{selected.description}</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Name (optional)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder={selected.label}
                />
              </div>
              <div>
                <label className="label">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="select"
                >
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                  <option value="1y">1 year</option>
                </select>
              </div>
              <div>
                <label className="label">Download format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="select"
                >
                  <option value="CSV">CSV (Excel-friendly)</option>
                  <option value="JSON">JSON</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
