'use client';

import { useState, useEffect, useRef } from 'react';
import { Server, Plus, Trash2, Globe, X, Play, Upload } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

type ServiceRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  website?: string | null;
  probeType?: string | null;
  probeUrl?: string | null;
  probeAuth?: string | null;
};

const PROBE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'http_header', label: 'HTTP API key header (e.g. Datadog)' },
  { value: 'http_bearer', label: 'HTTP Bearer token' },
  { value: 'http_basic', label: 'HTTP Basic auth' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'postgres', label: 'PostgreSQL' },
];

const emptyForm = {
  name: '',
  description: '',
  icon: '',
  category: '',
  website: '',
  probeType: '',
  probeUrl: '',
  probeAuth: '',
};

const emptyTest = {
  type: '',
  host: '',
  port: '',
  database: '',
  username: '',
  password: '',
  url: '',
  headerName: '',
  passwordId: '',
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [testTarget, setTestTarget] = useState<ServiceRow | null>(null);
  const [testForm, setTestForm] = useState(emptyTest);
  const [testing, setTesting] = useState(false);
  const [linkedPasswords, setLinkedPasswords] = useState<{ id: string; title: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchServices = () => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((d) => {
        setServices(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (!testTarget) return;
    setTestForm({
      ...emptyTest,
      type: testTarget.probeType || '',
      url: testTarget.probeUrl || '',
      headerName: testTarget.probeAuth || '',
    });
    fetch(`/api/passwords?serviceId=${encodeURIComponent(testTarget.id)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setLinkedPasswords(list.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })));
      })
      .catch(() => setLinkedPasswords([]));
  }, [testTarget]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        probeType: form.probeType || null,
        probeUrl: form.probeUrl || null,
        probeAuth: form.probeAuth || null,
      }),
    });
    if (res.ok) {
      toast.success('Service added');
      setShowCreate(false);
      setForm(emptyForm);
      fetchServices();
    } else toast.error('Failed to add');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    fetchServices();
  };

  const runTest = async () => {
    if (!testTarget) return;
    setTesting(true);
    try {
      const portNum = testForm.port ? Number(testForm.port) : undefined;
      const body: Record<string, unknown> = {
        serviceId: testTarget.id,
        type: testForm.type || testTarget.probeType || undefined,
        host: testForm.host || undefined,
        port: Number.isFinite(portNum) ? portNum : undefined,
        database: testForm.database || undefined,
        username: testForm.username || undefined,
        password: testForm.password || undefined,
        url: testForm.url || undefined,
        headerName: testForm.headerName || undefined,
      };
      if (testForm.passwordId) body.passwordId = testForm.passwordId;

      const res = await fetch('/api/services/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Test failed');
      } else if (data.success) {
        toast.success(data.message || 'Credentials work');
      } else {
        toast.error(data.message || 'Credentials failed');
      }
    } catch {
      toast.error('Test request failed');
    }
    setTesting(false);
  };

  const onProfileFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.json')) {
      toast.error('Only JSON connection profiles are allowed (no drivers)');
      return;
    }
    if (file.size > 32_768) {
      toast.error('Profile too large (max 32KB)');
      return;
    }
    const text = await file.text();
    try {
      const profile = JSON.parse(text);
      setTestForm((p) => ({
        ...p,
        type: profile.type || p.type,
        host: profile.host || '',
        port: profile.port != null ? String(profile.port) : '',
        database: profile.database || '',
        username: profile.username || '',
        password: profile.password || '',
        url: profile.url || p.url,
        headerName: profile.headerName || p.headerName,
      }));
      toast.success('Profile loaded (data only - not executed)');
    } catch {
      toast.error('Invalid JSON profile');
    }
  };

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog apps and validate credentials with built-in probes. Driver uploads are not allowed.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} /> Add Service
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {services.map((s, i) => (
          <AnimatedCard key={s.id} delay={i * 0.05} className="p-5">
            <div className="flex items-start justify-between mb-2">
              <Server size={20} className="text-primary" />
              <div className="flex gap-1">
                <button
                  onClick={() => setTestTarget(s)}
                  className="p-1 text-muted-foreground hover:text-primary"
                  title="Test credentials"
                >
                  <Play size={16} />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="font-semibold text-foreground">{s.name}</h3>
            {s.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
            )}
            {s.category && <span className="badge-blue mt-2">{s.category}</span>}
            {s.probeType && (
              <span className="badge-blue mt-2 ml-1">{s.probeType}</span>
            )}
            {s.website && (
              <a
                href={s.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
              >
                <Globe size={12} />
                {s.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </AnimatedCard>
        ))}
      </div>

      {showCreate && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Service</h2>
              <button onClick={() => setShowCreate(false)}>
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="textarea"
                  rows={2}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                  className="input"
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="label">Probe type</label>
                <select
                  value={form.probeType}
                  onChange={(e) => setForm((p) => ({ ...p, probeType: e.target.value }))}
                  className="input"
                >
                  {PROBE_OPTIONS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.probeType.startsWith('http_') && (
                <div>
                  <label className="label">Probe URL</label>
                  <input
                    value={form.probeUrl}
                    onChange={(e) => setForm((p) => ({ ...p, probeUrl: e.target.value }))}
                    className="input"
                    placeholder="https://api.example.com/validate"
                  />
                </div>
              )}
              {form.probeType === 'http_header' && (
                <div>
                  <label className="label">API key header name</label>
                  <input
                    value={form.probeAuth}
                    onChange={(e) => setForm((p) => ({ ...p, probeAuth: e.target.value }))}
                    className="input"
                    placeholder="DD-API-KEY"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {testTarget && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Test - {testTarget.name}</h2>
              <button onClick={() => setTestTarget(null)}>
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Uses allowlisted probes only. Upload a JSON connection profile if you want - never DLL/JAR drivers.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Probe type</label>
                <select
                  value={testForm.type}
                  onChange={(e) => setTestForm((p) => ({ ...p, type: e.target.value }))}
                  className="input"
                >
                  {PROBE_OPTIONS.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {(testForm.type === 'sqlserver' || testForm.type === 'postgres') && (
                <>
                  <div>
                    <label className="label">Host</label>
                    <input
                      value={testForm.host}
                      onChange={(e) => setTestForm((p) => ({ ...p, host: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Port</label>
                      <input
                        value={testForm.port}
                        onChange={(e) => setTestForm((p) => ({ ...p, port: e.target.value }))}
                        className="input"
                        placeholder={testForm.type === 'postgres' ? '5432' : '1433'}
                      />
                    </div>
                    <div>
                      <label className="label">Database</label>
                      <input
                        value={testForm.database}
                        onChange={(e) => setTestForm((p) => ({ ...p, database: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                </>
              )}

              {testForm.type.startsWith('http_') && (
                <div>
                  <label className="label">URL</label>
                  <input
                    value={testForm.url}
                    onChange={(e) => setTestForm((p) => ({ ...p, url: e.target.value }))}
                    className="input"
                    placeholder="https://"
                  />
                </div>
              )}
              {testForm.type === 'http_header' && (
                <div>
                  <label className="label">Header name</label>
                  <input
                    value={testForm.headerName}
                    onChange={(e) => setTestForm((p) => ({ ...p, headerName: e.target.value }))}
                    className="input"
                  />
                </div>
              )}

              {(testForm.type === 'http_basic' ||
                testForm.type === 'sqlserver' ||
                testForm.type === 'postgres') && (
                <div>
                  <label className="label">Username</label>
                  <input
                    value={testForm.username}
                    onChange={(e) => setTestForm((p) => ({ ...p, username: e.target.value }))}
                    className="input"
                    autoComplete="off"
                  />
                </div>
              )}

              <div>
                <label className="label">
                  {testForm.type === 'http_bearer' || testForm.type === 'http_header'
                    ? 'Token / API key'
                    : 'Password'}
                </label>
                <input
                  type="password"
                  value={testForm.password}
                  onChange={(e) => setTestForm((p) => ({ ...p, password: e.target.value }))}
                  className="input"
                  autoComplete="new-password"
                />
              </div>

              {linkedPasswords.length > 0 && (
                <div>
                  <label className="label">Or use linked vault entry</label>
                  <select
                    value={testForm.passwordId}
                    onChange={(e) => setTestForm((p) => ({ ...p, passwordId: e.target.value }))}
                    className="input"
                  >
                    <option value="">Paste credentials above</option>
                    {linkedPasswords.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => onProfileFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="btn-ghost w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} /> Load JSON profile
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setTestTarget(null)} className="btn-ghost">
                  Cancel
                </button>
                <button type="button" onClick={runTest} disabled={testing} className="btn-primary">
                  <Play size={16} />
                  {testing ? 'Testing…' : 'Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
