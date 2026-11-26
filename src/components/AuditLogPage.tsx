'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, History, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type AuditItem = {
  id: string;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatAction(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Prefer the credential name over the generic "password" resource label. */
function formatTarget(resource: string | null, rawDetails: string | null) {
  const d = parseDetails(rawDetails);
  const title = d?.title ?? d?.passwordTitle;
  if (typeof title === 'string' && title.trim()) return title;
  if (Array.isArray(d?.titles) && d.titles.length) {
    return d.titles.filter((t) => typeof t === 'string').join(', ') || String(d.host || resource || '-');
  }
  if (typeof d?.host === 'string' && d.host) return d.host;
  return resource || '-';
}

function formatDetails(raw: string | null) {
  const parsed = parseDetails(raw);
  if (!parsed) return raw || '-';
  const keys = Object.keys(parsed).filter((k) => !['title', 'passwordTitle', 'id', 'passwordId'].includes(k));
  if (keys.length === 0) return '-';
  const bits = keys.map((k) => `${k}: ${JSON.stringify(parsed[k])}`);
  return bits.join(' · ');
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`/api/audit?${params}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to load audit log');
    }
    return res.json() as Promise<{ items: AuditItem[]; nextCursor: string | null }>;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await load();
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await load(nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const purge = async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch('/api/audit', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to purge audit log');
      setConfirmPurge(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to purge');
    } finally {
      setPurging(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Audit trail"
        description="Your security-relevant activity on this account - logins, vault changes, tokens, and encryption."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/api/audit?format=csv">
                <Download size={14} />
                Export CSV
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmPurge(true)}
              disabled={loading || purging}
            >
              <Trash2 size={14} />
              Purge all
            </Button>
          </div>
        }
      />

      <PageBlock>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <History size={28} className="opacity-50" />
            <p className="text-sm">No audit events yet. Activity will show up here as you use Qeva.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatAction(row.action)}</td>
                    <td className="px-4 py-3 text-foreground">{formatTarget(row.resource, row.details)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.ipAddress || '-'}
                    </td>
                    <td
                      className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-muted-foreground"
                      title={formatDetails(row.details)}
                    >
                      {formatDetails(row.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor ? (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
              Load more
            </Button>
          </div>
        ) : null}
      </PageBlock>

      <AlertDialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge your audit trail?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every audit event for your account. Export CSV first if you need a
              copy. A single “Audit purged” entry will remain so the clear is itself recorded. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void purge();
              }}
              disabled={purging}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purging ? <Loader2 size={14} className="animate-spin" /> : null}
              Purge all logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
