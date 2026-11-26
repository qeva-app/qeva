'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${params.token}`)
      .then(async (r) => {
        if (r.ok) {
          setData(await r.json());
        } else {
          const err = await r.json();
          setError(err.error || 'Link not available');
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [params.token]);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error('Failed to copy'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle size={22} className="mx-auto mb-3 text-destructive" />
          <h1 className="text-xl font-bold text-foreground mb-2">Link Unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-foreground">Shared Credential</h1>
          <p className="text-sm text-muted-foreground mt-1">Shared by {data.sharedBy} via Qeva</p>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-lg">{data.title}</h2>
          </div>

          <div className="divide-y divide-border">
            {data.username && (
              <div className="px-5 py-3 flex items-center justify-between group cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => copy(data.username, 'Username')}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Username</p>
                  <p className="text-sm text-foreground mt-0.5">{data.username}</p>
                </div>
                <Copy size={14} className="text-muted-foreground/0 group-hover:text-foreground transition-colors" />
              </div>
            )}

            <div className="px-5 py-3 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Password</p>
                <p className="text-sm mt-0.5">
                  {revealed ? (
                    <span className="text-foreground font-medium select-all">{data.password}</span>
                  ) : (
                    <span className="text-muted-foreground tracking-widest">••••••••••••</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setRevealed(!revealed)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">
                  {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copy(data.password, 'Password')} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {data.website && (
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">Website</p>
                <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-0.5 block">{data.website}</a>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Expires {new Date(data.expiresAt).toLocaleString()}</span>
            {data.viewsRemaining !== undefined && (
              <span className="ml-auto">{data.viewsRemaining} view{data.viewsRemaining !== 1 ? 's' : ''} remaining</span>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Secured by <span className="font-semibold">qeva</span><span className="text-emerald-500 font-bold">.</span>
        </p>
      </div>
    </div>
  );
}
