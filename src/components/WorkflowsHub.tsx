'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ListChecks, GitBranch, Loader2 } from 'lucide-react';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OnboardingWorkflows from '@/components/OnboardingWorkflows';
import WorkflowSettings from '@/components/WorkflowSettings';
import { cn } from '@/lib/utils';

export default function WorkflowsHub() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [canManage, setCanManage] = useState(isAdmin);
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(tabParam === 'manage' && canManage ? 'manage' : 'mine');

  useEffect(() => {
    if (isAdmin) {
      setCanManage(true);
      return;
    }
    let cancelled = false;
    fetch('/api/organization/workflows')
      .then(async (r) => {
        if (!r.ok) return { canAssign: false };
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setCanManage(!!data.canAssign || !!data.canEdit);
      })
      .catch(() => {
        if (!cancelled) setCanManage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, session?.user?.id]);

  useEffect(() => {
    if (tabParam === 'manage' && canManage) setTab('manage');
    else if (tabParam === 'mine') setTab('mine');
    else if (tab === 'manage' && !canManage) setTab('mine');
  }, [tabParam, canManage, tab]);

  const onTabChange = (value: string) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'manage') params.set('tab', 'manage');
    else params.delete('tab');
    const q = params.toString();
    router.replace(q ? `/workflows?${q}` : '/workflows');
  };

  return (
    <PageShell className="mx-auto max-w-4xl">
      <PageHeader
        title="Workflows"
        description="Checklists that get your org ready - onboarding, security hygiene, and admin-defined runs."
      />

      <PageBlock>
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList className={cn('h-10', canManage ? 'grid w-full grid-cols-2 sm:w-auto' : '')}>
            <TabsTrigger value="mine" className="gap-1.5">
              <ListChecks size={14} />
              My checklists
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="manage" className="gap-1.5">
                <GitBranch size={14} />
                Manage
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="mt-6 focus-visible:outline-none">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                </div>
              }
            >
              <OnboardingWorkflows embedded />
            </Suspense>
          </TabsContent>

          {canManage && (
            <TabsContent value="manage" className="mt-6 focus-visible:outline-none">
              <WorkflowSettings embedded />
            </TabsContent>
          )}
        </Tabs>
      </PageBlock>
    </PageShell>
  );
}
