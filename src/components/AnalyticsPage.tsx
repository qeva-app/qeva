'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Shield, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';

const COLORS = ['hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/analytics?period=${period}`).then((r) => r.json()),
      fetch('/api/analytics/security-trends').then((r) => r.json()),
    ])
      .then(([a, t]) => {
        setAnalytics(a);
        setTrends(Array.isArray(t) ? t : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) return <LoadingSpinner className="h-96" text="Loading analytics..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <div className="flex bg-muted rounded-lg p-0.5">
          {['7d', '30d', '90d', '1y'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium rounded-md ${period === p ? 'bg-card shadow text-primary' : 'text-muted-foreground'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatedCard className="p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><BarChart3 size={18} /> Password Strength Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.strengthDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.1} className="p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp size={18} /> Security Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.2} className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Category Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics?.categoryBreakdown || []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="count" nameKey="name" label>
                  {(analytics?.categoryBreakdown || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AnimatedCard>

        <AnimatedCard delay={0.3} className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Passwords', value: analytics?.total || 0 },
              { label: 'Strong', value: analytics?.strong || 0 },
              { label: 'Medium', value: analytics?.medium || 0 },
              { label: 'Weak', value: analytics?.weak || 0 },
              { label: 'Expired', value: analytics?.expired || 0 },
              { label: 'Avg Strength', value: `${analytics?.avgStrength || 0}%` },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-xl font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
