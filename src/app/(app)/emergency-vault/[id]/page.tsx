'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PasswordList from '@/components/PasswordList';
import { ShieldAlert } from 'lucide-react';

export default function EmergencyVaultPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/emergency-access/${id}/vault`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load');
        setData(json);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-muted-foreground">Loading emergency vault…</p>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <ShieldAlert className="mx-auto mb-3 text-destructive" size={36} />
        <p className="font-semibold text-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emergency Vault</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Access for {data?.grantor?.name || data?.grantor?.email}
          {data?.accessExpiresAt
            ? `, expires ${new Date(data.accessExpiresAt).toLocaleString()}`
            : ''}
        </p>
        {data?.note && (
          <p className="text-xs text-warning mt-2">{data.note}</p>
        )}
      </div>
      <PasswordList
        passwords={data?.passwords || []}
        showActions={false}
        emptyTitle="No shared credentials"
        emptyDescription="The grantor has no personal server-encrypted passwords"
      />
    </div>
  );
}
