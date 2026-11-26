'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';
import {
  DEFAULT_PASSWORD_POLICY,
  type PasswordPolicy,
} from '@/lib/password-policy';

export default function PasswordPolicySettings() {
  const [policy, setPolicy] = useState<PasswordPolicy>({ ...DEFAULT_PASSWORD_POLICY });
  const [canEdit, setCanEdit] = useState(false);
  const [isOrg, setIsOrg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/organization/password-policy')
      .then((r) => r.json())
      .then((data) => {
        if (data.policy) setPolicy(data.policy);
        setCanEdit(!!data.canEdit);
        setIsOrg(!!data.isOrg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/organization/password-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      });
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        toast.success('Password policy saved');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save policy');
    }
    setSaving(false);
  };

  if (loading || !isOrg) return null;

  return (
    <AnimatedCard delay={0.05} className="p-6">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shield size={20} /> Organization Password Policy
      </h2>
      {!canEdit && (
        <p className="text-sm text-muted-foreground mb-3">
          Only organization admins can edit this policy. Current rules apply to generator and new passwords.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Minimum length</label>
          <input
            type="number"
            min={4}
            max={128}
            className="input"
            disabled={!canEdit}
            value={policy.minLength}
            onChange={(e) => setPolicy((p) => ({ ...p, minLength: +e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Rotation days</label>
          <input
            type="number"
            min={7}
            max={365}
            className="input"
            disabled={!canEdit}
            value={policy.rotationDays}
            onChange={(e) => setPolicy((p) => ({ ...p, rotationDays: +e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Expiry warning (days)</label>
          <input
            type="number"
            min={1}
            max={90}
            className="input"
            disabled={!canEdit}
            value={policy.expiryWarningDays}
            onChange={(e) => setPolicy((p) => ({ ...p, expiryWarningDays: +e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Default generator mode</label>
          <select
            className="select"
            disabled={!canEdit}
            value={policy.defaultMode}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                defaultMode: e.target.value as PasswordPolicy['defaultMode'],
              }))
            }
          >
            <option value="password">Password</option>
            <option value="pronounceable">Pronounceable</option>
            <option value="passphrase">Passphrase</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {(
          [
            ['requireUpper', 'Require uppercase'],
            ['requireLower', 'Require lowercase'],
            ['requireNumber', 'Require number'],
            ['requireSymbol', 'Require symbol'],
            ['excludeSimilar', 'Exclude similar'],
            ['excludeAmbiguous', 'Exclude ambiguous'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={policy[key]}
              onChange={(e) => setPolicy((p) => ({ ...p, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      {canEdit && (
        <button type="button" className="btn-primary mt-4" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save policy'}
        </button>
      )}
    </AnimatedCard>
  );
}
