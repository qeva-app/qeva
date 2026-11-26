'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2, Clock } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';

type Row = {
  id: string;
  status: string;
  waitingPeriod: number;
  requestedAt?: string | null;
  accessExpiresAt?: string | null;
  grantee?: { id: string; name?: string; email?: string };
  grantor?: { id: string; name?: string; email?: string };
};

function hoursLeft(requestedAt: string | null | undefined, waitingPeriod: number): number | null {
  if (!requestedAt) return null;
  const end = new Date(requestedAt).getTime() + waitingPeriod * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((end - Date.now()) / (60 * 60 * 1000)));
}

export default function EmergencyAccessSettings() {
  const [granted, setGranted] = useState<Row[]>([]);
  const [received, setReceived] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [granteeEmail, setGranteeEmail] = useState('');
  const [waitingPeriod, setWaitingPeriod] = useState(48);
  const [orgUsers, setOrgUsers] = useState<{ id: string; email: string; name?: string }[]>([]);

  const refresh = () => {
    setLoading(true);
    fetch('/api/emergency-access')
      .then((r) => r.json())
      .then((data) => {
        setGranted(Array.isArray(data.granted) ? data.granted : []);
        setReceived(Array.isArray(data.received) ? data.received : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setOrgUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/emergency-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Request failed');
      return false;
    }
    toast.success('Updated');
    refresh();
    return true;
  };

  const grant = async () => {
    const match = orgUsers.find(
      (u) => u.email.toLowerCase() === granteeEmail.trim().toLowerCase()
    );
    if (!match) {
      toast.error('Select an organization user by email');
      return;
    }
    if (await post({ action: 'grant', granteeId: match.id, waitingPeriod })) {
      setGranteeEmail('');
    }
  };

  return (
    <AnimatedCard delay={0.08} className="p-6">
      <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <ShieldAlert size={20} /> Emergency Access
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Designate a trusted contact who can request access to your personal vault after a waiting
        period. Zero-knowledge (USER_MASTER) entries stay encrypted and are not shared.
      </p>

      <div className="p-4 bg-background rounded-lg mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Grantee email</label>
            <input
              list="emergency-org-users"
              className="input"
              value={granteeEmail}
              onChange={(e) => setGranteeEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
            <datalist id="emergency-org-users">
              {orgUsers.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name || u.email}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Waiting period (hours)</label>
            <input
              type="number"
              min={1}
              max={720}
              className="input"
              value={waitingPeriod}
              onChange={(e) => setWaitingPeriod(+e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="btn-primary btn-sm gap-1" onClick={grant}>
          <Plus size={14} /> Grant access
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">People I granted</h3>
            {granted.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <div className="space-y-2">
                {granted.map((row) => {
                  const left = hoursLeft(row.requestedAt, row.waitingPeriod);
                  return (
                    <div key={row.id} className="p-3 bg-background rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.grantee?.name || row.grantee?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.status}</span>
                      </div>
                      {row.status === 'REQUESTED' && left != null && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <Clock size={12} /> {left}h until auto-activate
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        {row.status === 'REQUESTED' && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => post({ action: 'reject', emergencyAccessId: row.id })}
                          >
                            Reject
                          </button>
                        )}
                        <button
                          type="button"
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() => post({ action: 'revoke', emergencyAccessId: row.id })}
                          aria-label="Revoke"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Access granted to me</h3>
            {received.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <div className="space-y-2">
                {received.map((row) => {
                  const left = hoursLeft(row.requestedAt, row.waitingPeriod);
                  return (
                    <div key={row.id} className="p-3 bg-background rounded-lg text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.grantor?.name || row.grantor?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.status}</span>
                      </div>
                      {row.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => post({ action: 'request', emergencyAccessId: row.id })}
                        >
                          Request access
                        </button>
                      )}
                      {row.status === 'REQUESTED' && left != null && (
                        <p className="text-xs text-muted-foreground">Waiting: {left}h remaining</p>
                      )}
                      {row.status === 'ACTIVE' && (
                        <a href={`/emergency-vault/${row.id}`} className="btn-primary btn-sm inline-flex">
                          Open emergency vault
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AnimatedCard>
  );
}
