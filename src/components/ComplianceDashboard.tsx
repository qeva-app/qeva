'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ComplianceDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/compliance/metrics').then((r) => r.json()).then((d) => { setMetrics(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Compliance Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Overall Score', value: `${metrics?.overallScore || 0}%`, icon: <BarChart3 size={20} />, color: 'bg-primary' },
          { label: 'Policies Met', value: metrics?.policiesMet || 0, icon: <CheckCircle size={20} />, color: 'bg-success/100' },
          { label: 'Issues', value: metrics?.issues || 0, icon: <AlertTriangle size={20} />, color: 'bg-amber-500' },
        ].map((s, i) => (
          <AnimatedCard key={s.label} delay={i * 0.1} className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold text-foreground mt-1">{s.value}</p></div>
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-white`}>{s.icon}</div>
            </div>
          </AnimatedCard>
        ))}
      </div>

      {metrics?.policies && (
        <AnimatedCard delay={0.3} className="p-6">
          <h2 className="font-semibold text-foreground mb-4">Policy Status</h2>
          <div className="space-y-3">
            {metrics.policies.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                {p.met ? <CheckCircle size={18} className="text-success" /> : <AlertTriangle size={18} className="text-warning" />}
                <span className="flex-1 text-sm text-foreground">{p.name}</span>
                <span className={`badge ${p.met ? 'badge-green' : 'badge-amber'}`}>{p.met ? 'Compliant' : 'Action Required'}</span>
              </div>
            ))}
          </div>
        </AnimatedCard>
      )}
    </div>
  );
}
