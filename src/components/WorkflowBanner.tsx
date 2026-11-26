'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ListChecks, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Banner = {
  workflowId: string;
  name: string;
  href: string;
  requiredDone: number;
  totalRequired: number;
};

export default function WorkflowBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [hidden, setHidden] = useState(false);

  const isOrg =
    (session?.user as { accountType?: string } | undefined)?.accountType ===
    'ORGANIZATION';

  useEffect(() => {
    if (!isOrg) return;
    let cancelled = false;
    const refresh = () => {
      fetch('/api/workflows/me')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setBanner(data.banner || null);
        })
        .catch(() => {
          if (!cancelled) setBanner(null);
        });
    };
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener('qeva:workflows-updated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('qeva:workflows-updated', onUpdate);
    };
  }, [isOrg]);

  if (
    !isOrg ||
    !banner ||
    hidden ||
    pathname.startsWith('/workflows') ||
    pathname.startsWith('/onboarding')
  ) {
    return null;
  }

  const pct =
    banner.totalRequired > 0
      ? Math.round((banner.requiredDone / banner.totalRequired) * 100)
      : 0;

  return (
    <div className="border-b border-primary/20 bg-primary/[0.07] px-6 py-2.5">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ListChecks size={18} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              Finish {banner.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {banner.requiredDone}/{banner.totalRequired} required, {pct}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={banner.href}>Continue</Link>
          </Button>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Hide for now"
            onClick={() => setHidden(true)}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
