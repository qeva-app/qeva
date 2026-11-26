'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Power, Ban, Search } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';

type Org = {
  id: string;
  name: string;
  domain?: string | null;
  status: string;
  contactEmail?: string | null;
  trialDays?: number | null;
  createdAt: string;
  _count?: { users: number; teams: number };
};

type WaitlistEntry = {
  id: string;
  email: string;
  company?: string | null;
  name?: string | null;
  source: string;
  createdAt: string;
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED'] as const;

function statusClass(status: string) {
  switch (status) {
    case 'PENDING':
      return 'badge-amber';
    case 'TRIAL':
      return 'badge-blue';
    case 'ACTIVE':
      return 'badge-green';
    case 'GRACE':
      return 'badge-amber';
    case 'EXPIRED':
      return 'badge-red';
    default:
      return 'badge-slate';
  }
}

export default function SuperAdminPanel() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.isSuperAdmin) {
          setAllowed(false);
          router.replace('/vault');
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAllowed(false);
          router.replace('/vault');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const load = () => {
    setLoading(true);
    const qs = status === 'ALL' ? '' : `?status=${status}`;
    Promise.all([
      fetch(`/api/admin/organizations${qs}`).then((r) => r.json()),
      fetch('/api/admin/waitlist').then((r) => r.json()),
    ])
      .then(([orgData, waitData]) => {
        setOrgs(Array.isArray(orgData) ? orgData : []);
        setWaitlist(Array.isArray(waitData) ? waitData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!allowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, status]);

  const act = async (id: string, action: 'approve' | 'activate' | 'revoke') => {
    setBusyId(id);
    const res = await fetch(`/api/admin/organizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error('Action failed');
      return;
    }
    toast.success(
      action === 'approve' ? 'Organization approved' : action === 'activate' ? 'Organization activated' : 'Organization revoked'
    );
    load();
  };

  if (allowed === null || allowed === false) {
    return <LoadingSpinner className="h-96" />;
  }

  const filtered = orgs.filter((o) => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      o.name?.toLowerCase().includes(s) ||
      o.domain?.toLowerCase().includes(s) ||
      o.contactEmail?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Approve and manage organizations across the platform</p>
        </div>
        <span className="text-sm text-muted-foreground">{orgs.length} orgs</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations..."
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="h-64" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Organization</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Users</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr key={org.id} className="border-b border-border hover:bg-accent">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Building2 size={14} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{org.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[org.domain, org.contactEmail].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusClass(org.status)}`}>{org.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{org._count?.users ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {org.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={busyId === org.id}
                          onClick={() => act(org.id, 'approve')}
                          className="rounded p-1.5 text-muted-foreground hover:text-primary"
                          title="Approve (start trial)"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {(org.status === 'TRIAL' || org.status === 'GRACE') && (
                        <button
                          type="button"
                          disabled={busyId === org.id}
                          onClick={() => act(org.id, 'activate')}
                          className="rounded p-1.5 text-muted-foreground hover:text-primary"
                          title="Activate"
                        >
                          <Power size={16} />
                        </button>
                      )}
                      {org.status !== 'EXPIRED' && (
                        <button
                          type="button"
                          disabled={busyId === org.id}
                          onClick={() => act(org.id, 'revoke')}
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                          title="Revoke"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No organizations found</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Managed hosting interest</h2>
          <span className="text-sm text-muted-foreground">{waitlist.length} entries</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Lead capture only — not provisioned tenants.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((w) => (
                <tr key={w.id} className="border-b border-border">
                  <td className="px-4 py-3 text-foreground">{w.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.company || w.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.source}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {waitlist.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No waitlist signups yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
