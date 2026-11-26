'use client';

import { useState, useEffect } from 'react';
import { FolderArchive, Plus, Play, RotateCcw, Trash2, Clock, Download, Settings2, X } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

export default function BackupManagement() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', schedule: '0 2 * * *', retentionDays: 30, compression: true, encryption: true });
  const [creating, setCreating] = useState(false);

  const fetchData = () => {
    Promise.all([
      fetch('/api/backup/configs').then((r) => r.json()),
      fetch('/api/backup/jobs').then((r) => r.json()),
      fetch('/api/backup/metrics').then((r) => r.json()),
    ])
      .then(([c, j, m]) => {
        setConfigs(Array.isArray(c) ? c : []);
        setJobs(Array.isArray(j) ? j : []);
        setMetrics(m);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/backup/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Backup config created');
        setShowCreate(false);
        fetchData();
      }
    } catch { toast.error('Failed to create'); }
    setCreating(false);
  };

  const runBackup = async (configId: string) => {
    toast.loading('Running backup...', { id: 'backup' });
    const res = await fetch('/api/backup/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configId }),
    });
    toast.dismiss('backup');
    if (res.ok) {
      toast.success('Backup completed');
      fetchData();
    } else toast.error('Backup failed');
  };

  if (loading) return <LoadingSpinner className="h-96" text="Loading backup data..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backup & Recovery</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage backups and restore data</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> New Config
        </button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatedCard className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Total Backups</p>
            <p className="text-2xl font-bold text-foreground">{metrics.totalBackups || 0}</p>
          </AnimatedCard>
          <AnimatedCard delay={0.1} className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Total Size</p>
            <p className="text-2xl font-bold text-foreground">{metrics.totalSize || '0 MB'}</p>
          </AnimatedCard>
          <AnimatedCard delay={0.2} className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Last Backup</p>
            <p className="text-2xl font-bold text-foreground">{metrics.lastBackup ? new Date(metrics.lastBackup).toLocaleDateString() : 'Never'}</p>
          </AnimatedCard>
        </div>
      )}

      {/* Configs */}
      <AnimatedCard delay={0.3} className="p-6">
        <h2 className="font-semibold text-foreground mb-4">Backup Configurations</h2>
        {configs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No backup configurations</p>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <div key={config.id} className="flex items-center gap-4 p-4 bg-background rounded-lg">
                <FolderArchive size={20} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{config.name}</p>
                  <p className="text-xs text-muted-foreground">Schedule: {config.schedule} | Retention: {config.retentionDays}d</p>
                </div>
                <button onClick={() => runBackup(config.id)} className="btn-outline btn-sm">
                  <Play size={14} /> Run Now
                </button>
              </div>
            ))}
          </div>
        )}
      </AnimatedCard>

      {/* Recent Jobs */}
      <AnimatedCard delay={0.4} className="p-6">
        <h2 className="font-semibold text-foreground mb-4">Recent Backup Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No backup jobs</p>
        ) : (
          <div className="space-y-2">
            {jobs.slice(0, 10).map((job) => (
              <div key={job.id} className="flex items-center gap-3 p-3 bg-background rounded-lg text-sm">
                <Clock size={16} className="text-muted-foreground" />
                <span className="flex-1 text-foreground">{job.configName || 'Backup'}</span>
                <span className={`badge ${job.status === 'COMPLETED' ? 'badge-green' : job.status === 'FAILED' ? 'badge-red' : 'badge-amber'}`}>
                  {job.status}
                </span>
                <span className="text-muted-foreground text-xs">{new Date(job.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </AnimatedCard>

      {/* Create Modal */}
      {showCreate && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Backup Config</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required /></div>
              <div><label className="label">Description</label><input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="input" /></div>
              <div><label className="label">Schedule (cron)</label><input value={form.schedule} onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))} className="input font-mono" /></div>
              <div><label className="label">Retention (days)</label><input type="number" value={form.retentionDays} onChange={(e) => setForm((p) => ({ ...p, retentionDays: +e.target.value }))} className="input" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.compression} onChange={(e) => setForm((p) => ({ ...p, compression: e.target.checked }))} className="rounded border-border text-primary" /><span className="text-sm">Compression</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.encryption} onChange={(e) => setForm((p) => ({ ...p, encryption: e.target.checked }))} className="rounded border-border text-primary" /><span className="text-sm">Encryption</span></label>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
