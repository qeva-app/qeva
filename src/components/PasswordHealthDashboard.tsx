'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Copy as CopyIcon, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';

function vaultHref(pw: {
  id: string;
  title: string;
  isExpired?: boolean;
  issues?: string[];
}) {
  const params = new URLSearchParams();
  params.set('id', pw.id);
  params.set('search', pw.title);
  if (pw.isExpired || pw.issues?.some((i) => /expir/i.test(i))) {
    params.set('filter', 'expiring');
  }
  return `/vault?${params.toString()}`;
}

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default function PasswordHealthDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    fetch('/api/passwords/health')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchHealth(); }, []);

  if (loading) return <HealthSkeleton />;
  if (!data) return <div className="text-center py-16 text-muted-foreground">Failed to load health data</div>;

  const { summary, strengthDistribution, ageDistribution, reusedGroups, passwords } = data;
  const healthColor = summary.avgHealth >= 80 ? 'text-success' : summary.avgHealth >= 60 ? 'text-primary' : summary.avgHealth >= 40 ? 'text-warning' : 'text-destructive';
  const healthBg = summary.avgHealth >= 80 ? 'bg-success' : summary.avgHealth >= 60 ? 'bg-primary' : summary.avgHealth >= 40 ? 'bg-warning' : 'bg-destructive';

  return (
    <PageShell>
      <PageHeader
        title="Password Health"
        description="Monitor the strength and hygiene of your credentials"
        actions={
          <Button variant="outline" size="sm" onClick={fetchHealth}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        }
      />

      <PageBlock>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className={`font-display text-5xl font-semibold tracking-tight ${healthColor}`}>{summary.avgHealth}</p>
              <p className="mt-1 text-xs text-muted-foreground">Health Score</p>
            </div>
            <div className="flex-1">
              <div className="h-3 w-full bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-[width] duration-700 ${healthBg}`} style={{ width: `${summary.avgHealth}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Critical</span>
                <span>Weak</span>
                <span>Fair</span>
                <span>Strong</span>
                <span>Excellent</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </PageBlock>

      <PageBlock>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card className="transition-[box-shadow,border-color] hover:shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl font-semibold text-foreground">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="transition-[box-shadow,border-color] hover:shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl font-semibold text-success">{summary.healthy}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </CardContent>
        </Card>
        <Card className="transition-[box-shadow,border-color] hover:shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl font-semibold text-destructive">{summary.weak}</p>
            <p className="text-xs text-muted-foreground">Weak</p>
          </CardContent>
        </Card>
        <Link href="/vault?filter=expiring" className="block rounded-xl transition-[box-shadow,border-color] hover:shadow-sm">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="font-display text-2xl font-semibold text-warning">{summary.expired}</p>
              <p className="text-xs text-muted-foreground">Expired — open vault</p>
            </CardContent>
          </Card>
        </Link>
        <Card className="transition-[box-shadow,border-color] hover:shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl font-semibold text-primary">{summary.reused}</p>
            <p className="text-xs text-muted-foreground">Reused</p>
          </CardContent>
        </Card>
      </div>
      </PageBlock>

      <PageBlock className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Strength Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Very Strong (80+)', count: strengthDistribution.veryStrong, color: 'bg-success' },
              { label: 'Strong (60-79)', count: strengthDistribution.strong, color: 'bg-primary' },
              { label: 'Fair (40-59)', count: strengthDistribution.fair, color: 'bg-warning' },
              { label: 'Weak (0-39)', count: strengthDistribution.weak, color: 'bg-destructive' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm text-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm">Password Age</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Fresh (< 30 days)', count: ageDistribution.fresh, color: 'bg-success' },
              { label: 'Recent (30-90 days)', count: ageDistribution.recent, color: 'bg-primary' },
              { label: 'Stale (90-180 days)', count: ageDistribution.stale, color: 'bg-warning' },
              { label: 'Old (180+ days)', count: ageDistribution.old, color: 'bg-destructive' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm text-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {reusedGroups.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-sm text-destructive">
              <CopyIcon size={14} /> Reused Passwords
            </CardTitle>
            <CardDescription>These passwords are shared across multiple entries — a critical security risk</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reusedGroups.map((group: string[], i: number) => (
                <div key={i} className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                  <span className="font-medium text-destructive">{group.join(', ')}</span>
                  <span className="ml-2 text-xs text-destructive/70">— same password</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-sm">All Credentials</CardTitle>
          <CardDescription>Sorted by health score — worst first</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {passwords.map((pw: any) => (
              <Link
                key={pw.id}
                href={vaultHref(pw)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50 group"
              >
                <div className="w-8 text-center">
                  {pw.issues.length === 0 ? (
                    <CheckCircle size={16} className="mx-auto text-success" />
                  ) : (
                    <AlertTriangle size={16} className={`mx-auto ${pw.healthScore < 40 ? 'text-destructive' : 'text-warning'}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {pw.title}
                  </p>
                  {pw.issues.length > 0 && (
                    <p className="truncate text-[11px] text-muted-foreground">{pw.issues.join(', ')}</p>
                  )}
                </div>
                {pw.category && <Badge variant="secondary" className="shrink-0 text-[10px]">{pw.category}</Badge>}
                <div className="w-16 text-right">
                  <span className={`text-sm font-semibold ${pw.healthScore >= 80 ? 'text-success' : pw.healthScore >= 60 ? 'text-primary' : pw.healthScore >= 40 ? 'text-warning' : 'text-destructive'}`}>
                    {pw.healthScore}%
                  </span>
                </div>
                <div className="w-16">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${pw.healthScore >= 80 ? 'bg-success' : pw.healthScore >= 60 ? 'bg-primary' : pw.healthScore >= 40 ? 'bg-warning' : 'bg-destructive'}`}
                      style={{ width: `${pw.healthScore}%` }}
                    />
                  </div>
                </div>
                <ExternalLink size={12} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
      </PageBlock>
    </PageShell>
  );
}
