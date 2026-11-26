'use client';

import { useState, useEffect } from 'react';
import { Database, RefreshCw, Table, AlertCircle } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function DatabaseExplorer() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/database').then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" text="Loading database info..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Database size={24} /> Database Explorer</h1>

      {data?.error ? (
        <AnimatedCard className="p-6">
          <div className="flex items-center gap-3 text-destructive"><AlertCircle size={20} /><p>{data.error}</p></div>
        </AnimatedCard>
      ) : (
        <>
          <AnimatedCard className="p-6">
            <h2 className="font-semibold text-foreground mb-4">Connection Info</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(data?.connection || {}).map(([key, val]) => (
                <div key={key} className="p-3 bg-background rounded-lg">
                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                  <p className="text-sm font-medium text-foreground">{String(val)}</p>
                </div>
              ))}
            </div>
          </AnimatedCard>

          {data?.tables && (
            <AnimatedCard delay={0.1} className="p-6">
              <h2 className="font-semibold text-foreground mb-4">Tables ({data.tables.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {data.tables.map((table: any) => (
                  <div key={table.name || table} className="p-3 bg-background rounded-lg flex items-center gap-2">
                    <Table size={16} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{table.name || table}</p>
                      {table.rows !== undefined && <p className="text-xs text-muted-foreground">{table.rows} rows</p>}
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          )}
        </>
      )}
    </div>
  );
}
