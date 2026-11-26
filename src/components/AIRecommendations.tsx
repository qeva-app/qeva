'use client';

import { useState, useEffect } from 'react';
import { Brain, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AIRecommendations() {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/security/metrics')
      .then((r) => r.json())
      .then((data) => { setRecommendations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" text="Analyzing..." />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Brain size={24} /> AI Recommendations</h1>
        <p className="text-muted-foreground text-sm mt-1">Rule-based security analysis and suggestions</p>
      </div>

      {recommendations?.recommendations?.map((rec: any, i: number) => (
        <AnimatedCard key={i} delay={i * 0.05} className="p-5">
          <div className="flex items-start gap-3">
            {rec.priority === 'high' ? <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" /> : <CheckCircle size={20} className="text-success shrink-0 mt-0.5" />}
            <div>
              <h3 className="font-medium text-foreground">{rec.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
              {rec.action && <p className="text-sm text-primary mt-2 font-medium">{rec.action}</p>}
            </div>
          </div>
        </AnimatedCard>
      ))}

      {(!recommendations?.recommendations || recommendations.recommendations.length === 0) && (
        <AnimatedCard className="p-8 text-center">
          <h3 className="text-lg font-semibold text-foreground">All clear</h3>
          <p className="text-sm text-muted-foreground mt-1">No security concerns detected</p>
        </AnimatedCard>
      )}
    </div>
  );
}
