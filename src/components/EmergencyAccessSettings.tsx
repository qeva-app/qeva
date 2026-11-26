'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2, Clock } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';

type Row = {
  id: string;
  status: string;
  waitingPeriod: number;
  createdAt?: string;
  requestedAt?: string | null;
  accessExpiresAt?: string | null;
  grantee?: { id: string; name?: string; email?: string };
  grantor?: { id: string; name?: string; email?: string };
};

/** Waiting clock starts at grant (createdAt), or legacy requestedAt if set. */
function unlockAtMs(row: Row): number | null {
  if (row.status === 'ACTIVE' || row.status === 'REVOKED') return null;
  const startIso = row.requestedAt || row.createdAt;
  if (!startIso) return null;
  return new Date(startIso).getTime() + row.waitingPeriod * 60 * 60 * 1000;
}

function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function statusLabel(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'REQUESTED':
      return 'Waiting to unlock';
    case 'ACTIVE':
      return 'Vault open';
    case 'REVOKED':
      return 'Revoked';
    default:
      return status;
  }
}

export default function EmergencyAccessSettings() {
  const [granted, setGranted] = useState<Row[]>([]);
  const [received, setReceived] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [granteeEmail, setGranteeEmail] = useState('');
  const [waitingPeriod, setWaitingPeriod] = useState(48);
  const [accessEndsAt, setAccessEndsAt] = useState('');
  const [orgUsers, setOrgUsers] = useState<{ id: string; email: string; name?: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = (silent = false) => {
    if (!silent) setLoading(true);
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

  const anyWaiting = [...granted, ...received].some((row) => {
    const end = unlockAtMs(row);
    return end != null && end > now;
  });

  useEffect(() => {
    if (!anyWaiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyWaiting]);

  // When the last wait ends, re-fetch so the server can flip APPROVED → ACTIVE.
  useEffect(() => {
    if (anyWaiting) return;
    const overdue = [...granted, ...received].some((row) => {
      if (row.status !== 'APPROVED' && row.status !== 'REQUESTED') return false;
      return unlockAtMs(row) != null;
    });
    if (overdue) refresh(true);
  }, [anyWaiting]);

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
    const email = granteeEmail.trim();
    if (!email) {
      toast.error('Enter the grantee email');
      return;
    }
    const payload: Record<string, unknown> = {
      action: 'grant',
      granteeEmail: email,
      waitingPeriod,
    };
    if (accessEndsAt) {
      payload.accessExpiresAt = new Date(accessEndsAt).toISOString();
    }
    if (await post(payload)) {
      setGranteeEmail('');
      setAccessEndsAt('');
    }
  };

  return (
    <AnimatedCard delay={0.08} className="p-6">
      <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <ShieldAlert size={20} /> Emergency Access
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Granting gives that person emergency vault access after the waiting period (no extra
        request step). You can revoke while it is waiting or after. Only personal server-encrypted
        (PUBLIC_KEY) passwords are shared; zero-knowledge (USER_MASTER) entries stay private.
      </p>

      <div className="p-4 bg-background rounded-lg mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Grantee email</label>
            <input
              list="emergency-org-users"
              className="input"
              value={granteeEmail}
              onChange={(e) => setGranteeEmail(e.target.value)}
              placeholder="trusted@email.com"
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
              min={0}
              max={720}
              className="input"
              value={waitingPeriod}
              onChange={(e) => setWaitingPeriod(+e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">0 = unlock as soon as you grant.</p>
          </div>
          <div>
            <label className="label">Access ends after unlock (optional)</label>
            <input
              type="datetime-local"
              className="input"
              value={accessEndsAt}
              onChange={(e) => setAccessEndsAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              When the open vault window ends. Blank = 7 days from unlock.
            </p>
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
                  const unlockAt = unlockAtMs(row);
                  const msLeft = unlockAt != null ? unlockAt - now : null;
                  const expiry = formatExpiry(row.accessExpiresAt);
                  const pending = row.status === 'APPROVED' || row.status === 'REQUESTED';
                  return (
                    <div key={row.id} className="p-3 bg-background rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.grantee?.name || row.grantee?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span>
                      </div>
                      {pending && msLeft != null && msLeft > 0 && (
                        <p className="text-xs text-warning flex items-center gap-1 font-mono tabular-nums">
                          <Clock size={12} /> Opens in {formatCountdown(msLeft)}
                        </p>
                      )}
                      {expiry && (
                        <p className="text-xs text-muted-foreground">
                          {row.status === 'ACTIVE' ? 'Access ends' : 'Access ends after unlock'}:{' '}
                          {expiry}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        {pending && (
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => post({ action: 'reject', emergencyAccessId: row.id })}
                          >
                            Cancel
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
            <p className="text-xs text-muted-foreground mb-2">
              After the waiting period from when they granted you, open their emergency vault here.
            </p>
            {received.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <div className="space-y-2">
                {received.map((row) => {
                  const unlockAt = unlockAtMs(row);
                  const msLeft = unlockAt != null ? unlockAt - now : null;
                  const expiry = formatExpiry(row.accessExpiresAt);
                  const pending = row.status === 'APPROVED' || row.status === 'REQUESTED';
                  const ready = row.status === 'ACTIVE' || (pending && msLeft != null && msLeft <= 0);
                  return (
                    <div key={row.id} className="p-3 bg-background rounded-lg text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.grantor?.name || row.grantor?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span>
                      </div>
                      {expiry && (
                        <p className="text-xs text-muted-foreground">
                          {row.status === 'ACTIVE' ? 'Access ends' : 'Access ends after unlock'}:{' '}
                          {expiry}
                        </p>
                      )}
                      {pending && msLeft != null && msLeft > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono tabular-nums">
                          <Clock size={12} /> Opens in {formatCountdown(msLeft)}
                        </p>
                      )}
                      {ready && (
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
