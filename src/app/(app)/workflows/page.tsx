import { Suspense } from 'react';
import WorkflowsHub from '@/components/WorkflowsHub';

export default function WorkflowsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-muted-foreground">Loading workflows…</div>
      }
    >
      <WorkflowsHub />
    </Suspense>
  );
}
