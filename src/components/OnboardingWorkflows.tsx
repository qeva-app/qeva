'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Step = {
  id: string;
  title: string;
  description: string | null;
  href: string | null;
  stepType: string;
  actionKey: string | null;
  isRequired: boolean;
  completed: boolean;
};

type WorkflowView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isRequired: boolean;
  steps: Step[];
  progress: {
    status: string;
    requiredDone: number;
    totalRequired: number;
  };
};

export default function OnboardingWorkflows({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('workflow');
  const [isOrg, setIsOrg] = useState<boolean | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  const load = useCallback(() => {
    return fetch('/api/workflows/me')
      .then((r) => r.json())
      .then((data) => {
        setIsOrg(!!data.isOrg);
        const list = (data.workflows || []) as WorkflowView[];
        setWorkflows(list);
        setSelectedId((prev) => {
          if (focusId && list.some((w) => w.id === focusId)) return focusId;
          if (prev && list.some((w) => w.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setIsOrg(false);
      });
  }, [focusId]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-sync auto-completions when returning to the page
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const selected = useMemo(
    () => workflows.find((w) => w.id === selectedId) || workflows[0],
    [workflows, selectedId]
  );

  const completeStep = async (workflowId: string, stepId: string) => {
    setBusyStep(stepId);
    try {
      const res = await fetch(`/api/workflows/me/${workflowId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });
      if (res.ok) {
        toast.success('Step completed');
        await load();
        window.dispatchEvent(new Event('qeva:workflows-updated'));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Could not complete step');
      }
    } catch {
      toast.error('Could not complete step');
    }
    setBusyStep(null);
  };

  const dismiss = async (workflowId: string) => {
    const res = await fetch(`/api/workflows/me/${workflowId}/dismiss`, { method: 'POST' });
    if (res.ok) {
      toast.success('Workflow dismissed');
      await load();
      window.dispatchEvent(new Event('qeva:workflows-updated'));
    } else {
      const err = await res.json();
      toast.error(err.error || 'Cannot dismiss');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading workflows…
      </div>
    );
  }

  if (!isOrg) {
    if (embedded) {
      return (
        <p className="text-sm text-muted-foreground">
          Organization workflows are only available on company accounts.
        </p>
      );
    }
    return (
      <PageShell>
        <PageHeader
          title="Workflows"
          description="Organization workflows are only available on company accounts."
        />
      </PageShell>
    );
  }

  if (!selected) {
    if (embedded) {
      return (
        <p className="text-sm text-muted-foreground">
          No active workflows for you yet. Admins can create them under Manage.
        </p>
      );
    }
    return (
      <PageShell>
        <PageHeader
          title="Workflows"
          description="No active workflows for your organization yet."
        />
      </PageShell>
    );
  }

  const pct =
    selected.progress.totalRequired > 0
      ? Math.round(
          (selected.progress.requiredDone / selected.progress.totalRequired) * 100
        )
      : selected.progress.status === 'COMPLETED'
        ? 100
        : 0;

  const body = (
    <>
      {workflows.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {workflows.map((w) => {
            const wPct =
              w.progress.totalRequired > 0
                ? Math.round((w.progress.requiredDone / w.progress.totalRequired) * 100)
                : w.progress.status === 'COMPLETED'
                  ? 100
                  : 0;
            return (
              <Button
                key={w.id}
                type="button"
                size="sm"
                variant={w.id === selected.id ? 'default' : 'outline'}
                onClick={() => setSelectedId(w.id)}
                className="gap-2"
              >
                {w.name}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    w.id === selected.id
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {wPct}%
                </span>
              </Button>
            );
          })}
        </div>
      )}

      <Card className="mb-6 overflow-hidden border-border">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {selected.name}
              </h2>
              {selected.description && (
                <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.isRequired && <Badge variant="secondary">Required</Badge>}
              <Badge
                variant={
                  selected.progress.status === 'COMPLETED' ? 'default' : 'outline'
                }
              >
                {selected.progress.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {selected.progress.requiredDone} / {selected.progress.totalRequired}{' '}
                required
              </span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} className="h-2 motion-bar" />
          </div>
          {!selected.isRequired && selected.progress.status !== 'COMPLETED' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => dismiss(selected.id)}
            >
              Dismiss
            </Button>
          )}
        </CardContent>
      </Card>

      <ol className="space-y-3">
        {selected.steps.map((step, index) => (
          <li key={step.id}>
            <Card
              className={cn(
                'transition-[border-color,background-color] duration-300',
                step.completed && 'border-success/30 bg-success/[0.04]'
              )}
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="motion-fade text-success" size={22} />
                    ) : (
                      <Circle className="text-muted-foreground/50" size={22} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      <span className="mr-2 text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      {step.title}
                      {step.isRequired && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          required
                        </span>
                      )}
                    </p>
                    {step.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {step.href && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={step.href}>
                        Open <ArrowRight size={14} className="ml-1" />
                      </Link>
                    </Button>
                  )}
                  {!step.completed && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyStep === step.id}
                      onClick={() => completeStep(selected.id, step.id)}
                    >
                      {busyStep === step.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : step.stepType === 'INFO' ? (
                        'Mark done'
                      ) : (
                        'Mark complete'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );

  if (embedded) return <div className="motion-page">{body}</div>;

  return (
    <PageShell className="mx-auto max-w-3xl">
      <PageHeader
        title="Workflows"
        description="Complete the checklists your organization requires."
      />
      <PageBlock>{body}</PageBlock>
    </PageShell>
  );
}
