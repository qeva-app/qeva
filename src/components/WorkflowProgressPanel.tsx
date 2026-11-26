'use client';

import { useEffect, useState } from 'react';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type MemberRow = {
  userId: string;
  name: string | null;
  email: string;
  status: string;
  requiredDone: number;
  totalRequired: number;
  percent: number;
  completedAt: string | null;
};

export default function WorkflowProgressPanel({ workflowId }: { workflowId: string }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  } | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const load = () => {
    setLoading(true);
    fetch(`/api/organization/workflows/${workflowId}/progress`)
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) setSummary(data.summary);
        setMembers(Array.isArray(data.members) ? data.members : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users size={14} /> Member progress
        </p>
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={load}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {loading && !summary ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </p>
      ) : (
        <>
          {summary && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="secondary">{summary.completed} completed</Badge>
              <Badge variant="outline">{summary.inProgress} in progress</Badge>
              <Badge variant="outline">{summary.notStarted} not started</Badge>
            </div>
          )}
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {members.map((m) => (
              <li key={m.userId} className="space-y-1 rounded-md bg-background/70 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {m.name || m.email}
                    </p>
                    <p className="truncate text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge
                    variant={m.status === 'COMPLETED' ? 'default' : 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
                    {m.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={m.percent} className="h-1.5 flex-1" />
                  <span className="w-10 text-right text-[10px] text-muted-foreground">
                    {m.requiredDone}/{m.totalRequired}
                  </span>
                </div>
              </li>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">No org members found</p>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
