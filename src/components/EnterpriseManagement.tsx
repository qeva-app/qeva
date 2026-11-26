'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Users, Settings, X } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

export default function EnterpriseManagement() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', description: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/enterprise/organizations').then((r) => r.json()),
      fetch('/api/enterprise/metrics').then((r) => r.json()),
    ]).then(([o, m]) => { setOrgs(Array.isArray(o) ? o : []); setMetrics(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/enterprise/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { toast.success('Organization created'); setShowCreate(false); location.reload(); }
  };

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Enterprise Management</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={18} /> Add Organization</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgs.map((org, i) => (
          <AnimatedCard key={org.id} delay={i * 0.05} className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <Building2 size={20} className="text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{org.name}</h3>
                {org.domain && <p className="text-xs text-muted-foreground">{org.domain}</p>}
              </div>
            </div>
            {org.description && <p className="text-sm text-muted-foreground line-clamp-2">{org.description}</p>}
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Users size={14} /> {org._count?.users || 0} users
            </div>
          </AnimatedCard>
        ))}
      </div>

      {showCreate && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Create Organization</h2><button onClick={() => setShowCreate(false)}><X size={20} className="text-muted-foreground" /></button></div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required /></div>
              <div><label className="label">Domain</label><input value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} className="input" placeholder="example.com" /></div>
              <div><label className="label">Description</label><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="textarea" rows={3} /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button><button type="submit" className="btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
