'use client';

import { useState, useEffect, useMemo } from 'react';
import { Lock, Globe, Plus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from 'next-auth/react';
import PasswordList from '@/components/PasswordList';
import Link from 'next/link';
import { PageShell, PageBlock, PageHeader } from '@/components/PageShell';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardContent className="p-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="p-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

export default function DashboardEnhanced() {
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [passwords, setPasswords] = useState<any[]>([]);
  const [vaultTab, setVaultTab] = useState<string>('personal');
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const isOrgUser = (session?.user as { accountType?: string } | undefined)?.accountType === 'ORGANIZATION';
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.json()),
      fetch('/api/dashboard/trends').then((r) => r.json()),
      fetch('/api/passwords').then((r) => r.json()),
    ])
      .then(([s, t, p]) => {
        setStats(s);
        setTrends(Array.isArray(t) ? t : []);
        setPasswords(Array.isArray(p) ? p : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const recentPasswords = useMemo(() => {
    const filtered = passwords.filter((p: any) => {
      if (vaultTab === 'personal') return !p.isGlobal && !p.isTeam;
      if (vaultTab === 'global') return p.isGlobal;
      return true;
    });
    return [...filtered]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 8);
  }, [passwords, vaultTab]);

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    {
      label: 'Total Passwords',
      value: stats?.totalPasswords || 0,
      trend: stats?.addedThisWeek != null ? `+${stats.addedThisWeek} this week` : undefined,
    },
    {
      label: 'Avg Strength',
      value: stats?.avgStrength != null ? `${stats.avgStrength}` : '—',
      trend: 'Score / 100',
    },
    {
      label: isOrgUser ? 'Org Users' : 'Teams',
      value: isOrgUser ? (stats?.totalUsers || 0) : (stats?.totalTeams || 0),
      trend: isOrgUser ? `${stats?.totalTeams || 0} teams` : undefined,
    },
    {
      label: 'Recent Activity',
      value: stats?.recentActivity || 0,
      trend: 'This week',
    },
  ];

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(205 70% 48%)',
    'hsl(var(--warning))',
    'hsl(var(--destructive))',
    'hsl(var(--muted-foreground))',
  ];

  const categoryData = stats?.categoryDistribution || [];
  const hasTrends = trends.length > 0;
  const hasCategories = categoryData.length > 0;

  return (
    <PageShell>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Vault posture and recent credentials — open the vault to manage secrets."
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/vault?action=add">
                <Plus size={14} className="mr-1" aria-hidden="true" />
                New Password
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/generator">Open Generator</Link>
            </Button>
          </>
        }
      />

      <PageBlock>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.label} className="border-border/70 shadow-none">
              <CardContent className="p-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                      {card.value}
                    </p>
                    {card.trend && (
                      <span className="truncate text-xs text-muted-foreground">{card.trend}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBlock>

      {(stats?.needsRotation ?? 0) > 0 && (
        <PageBlock>
          <Card className="border-warning/35 bg-warning/[0.06]">
            <CardContent className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-display font-semibold text-foreground">Needs rotation</p>
                <p className="text-sm text-muted-foreground">
                  {stats.expired || 0} expired, {stats.expiringSoon || 0} expiring soon
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/vault?filter=expiring">Review credentials</Link>
              </Button>
            </CardContent>
          </Card>
        </PageBlock>
      )}

      <PageBlock>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-base">
                    Security score trend
                  </CardTitle>
                  <CardDescription>Average strength of passwords you can access</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">30 days</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {hasTrends ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No password activity in the last 30 days
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Category Distribution</CardTitle>
              <CardDescription>Passwords by category in your vault</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {hasCategories ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="count"
                        nameKey="name"
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {categoryData.map((_: unknown, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Add passwords to see category breakdown
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBlock>

      <PageBlock>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base">Password Vault</CardTitle>
                <CardDescription>Recently added credentials</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Tabs value={vaultTab} onValueChange={setVaultTab}>
                  <TabsList className="h-8">
                    <TabsTrigger value="personal" className="h-7 gap-1.5 text-xs">
                      <Lock size={12} /> Personal
                    </TabsTrigger>
                    {isOrgUser && (
                      <TabsTrigger value="global" className="h-7 gap-1.5 text-xs">
                        <Globe size={12} /> Global
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link href="/vault?action=add">
                    <Plus size={14} className="mr-1" /> Add
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PasswordList
              passwords={recentPasswords}
              showActions={false}
              emptyTitle="No recent passwords"
              emptyDescription="Add a credential to see it here"
            />
          </CardContent>
        </Card>
      </PageBlock>
    </PageShell>
  );
}
