'use client';

import { useState, useEffect } from 'react';
import { Key, Lock, Shield, Download, Trash2, Plus, Copy, Check } from 'lucide-react';
import { useEncryption } from '@/contexts/EncryptionContext';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import PasswordPolicySettings from '@/components/PasswordPolicySettings';
import EmergencyAccessSettings from '@/components/EmergencyAccessSettings';
import MfaSettings from '@/components/MfaSettings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const TOKEN_PERMISSIONS = [
  {
    id: 'passwords:read',
    label: 'Read passwords',
    description: 'Look up and reveal logins (extension, CLI, or AI agent)',
  },
  {
    id: 'passwords:write',
    label: 'Write passwords',
    description: 'Create, update, or delete logins on your behalf',
  },
] as const;

type PermissionId = (typeof TOKEN_PERMISSIONS)[number]['id'];
type ClientKind = 'HUMAN' | 'AGENT';

function friendlyScopes(raw: unknown): string {
  let list: string[] = [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map(String);
    } catch {
      list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(raw)) {
    list = raw.map(String);
  }
  if (!list.length) return 'Full access';
  return list
    .map((id) => TOKEN_PERMISSIONS.find((p) => p.id === id)?.label || id)
    .join(', ');
}

export default function SettingsPage() {
  const { state: encState, setup, disable, unlock } = useEncryption();
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokens, setTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionId[]>([
    'passwords:read',
    'passwords:write',
  ]);
  const [clientKind, setClientKind] = useState<ClientKind>('HUMAN');
  const [createdPlainToken, setCreatedPlainToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((data) => {
        setTokens(Array.isArray(data) ? data : []);
        setLoadingTokens(false);
      })
      .catch(() => setLoadingTokens(false));
  }, []);

  const togglePermission = (id: PermissionId) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSetupEncryption = async () => {
    if (!masterPassword || masterPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (masterPassword.length < 8) {
      toast.error('Master password must be at least 8 characters');
      return;
    }
    setProcessing(true);
    const result = await setup(masterPassword);
    if (result?.recoveryData) {
      const blob = new Blob([JSON.stringify(result.recoveryData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qeva-recovery.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Encryption enabled. Recovery file downloaded.');
    } else {
      toast.error('Failed to setup encryption');
    }
    setMasterPassword('');
    setConfirmPassword('');
    setProcessing(false);
  };

  const handleDisableEncryption = async () => {
    if (!confirm('This will disable master-key encryption. Are you sure?')) return;
    setProcessing(true);
    if (!encState.isUnlocked) {
      if (!masterPassword) {
        toast.error('Enter master password to unlock, then disable');
        setProcessing(false);
        return;
      }
      const unlocked = await unlock(masterPassword);
      if (!unlocked) {
        toast.error('Invalid master password');
        setProcessing(false);
        return;
      }
    }
    const success = await disable();
    if (success) {
      toast.success('Encryption disabled');
    } else {
      toast.error('Failed to disable encryption');
    }
    setMasterPassword('');
    setProcessing(false);
  };

  const createToken = async () => {
    if (!tokenName.trim()) {
      toast.error('Give this token a name');
      return;
    }
    if (selectedPermissions.length === 0) {
      toast.error('Pick at least one permission');
      return;
    }
    setCreatingToken(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tokenName.trim(),
          scopes: selectedPermissions,
          clientKind,
        }),
      });
      if (!res.ok) {
        toast.error('Failed to create token');
        return;
      }
      const data = await res.json();
      const plain = data.plainToken as string | undefined;
      const { plainToken: _p, token: _hash, ...safe } = data;
      setTokens((prev) => [safe, ...prev]);
      setShowCreateToken(false);
      setTokenName('');
      setSelectedPermissions(['passwords:read', 'passwords:write']);
      setClientKind('HUMAN');
      setCopied(false);
      if (plain) {
        setCreatedPlainToken(plain);
      } else {
        toast.error('Token created but the secret was missing - try again');
      }
    } catch {
      toast.error('Failed to create token');
    } finally {
      setCreatingToken(false);
    }
  };

  const copyCreatedToken = async () => {
    if (!createdPlainToken) return;
    try {
      await navigator.clipboard.writeText(createdPlainToken);
      setCopied(true);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy - select the token and copy manually');
    }
  };

  const deleteToken = async (id: string) => {
    if (!confirm('Delete this token? Apps using it will stop working.')) return;
    const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTokens((prev) => prev.filter((t) => t.id !== id));
      toast.success('Token deleted');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <AnimatedCard className="p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield size={20} /> Encryption Settings
        </h2>

        <div className="p-4 rounded-lg bg-background mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-2 h-2 rounded-full ${encState.isEnabled ? (encState.isUnlocked ? 'bg-success/100' : 'bg-amber-500') : 'bg-muted-foreground'}`}
            />
            <span className="text-sm font-medium text-foreground">
              {encState.isEnabled
                ? encState.isUnlocked
                  ? 'Encryption Active & Unlocked'
                  : 'Encryption Active (Locked)'
                : 'Encryption Not Configured'}
            </span>
          </div>
        </div>

        {!encState.isEnabled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set up master-key encryption so personal passwords are wrapped with a key derived from your master
              password.
            </p>
            <div>
              <label className="label">Master Password</label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Confirm Master Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>
            <button onClick={handleSetupEncryption} disabled={processing} className="btn-primary">
              <Lock size={16} /> {processing ? 'Setting up...' : 'Enable Encryption'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {!encState.isUnlocked && (
              <div>
                <label className="label">Master Password (unlock to disable)</label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="input"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleDisableEncryption} disabled={processing} className="btn-destructive">
                {processing ? 'Processing...' : 'Disable Encryption'}
              </button>
              <a href="/encryption-recovery" className="btn-outline">
                <Download size={16} /> Recovery
              </a>
            </div>
          </div>
        )}
      </AnimatedCard>

      <MfaSettings />
      <PasswordPolicySettings />
      <EmergencyAccessSettings />

      <AnimatedCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Key size={20} /> Access Tokens
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowCreateToken(true);
              setSelectedPermissions(['passwords:read', 'passwords:write']);
              setClientKind('HUMAN');
              setTokenName('');
            }}
            className="btn-outline btn-sm"
          >
            <Plus size={14} /> New Token
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Tokens are equal for humans and AI agents - same vault access, labeled for audit.
          Use Human for the browser extension; Agent for CLI, MCP, or CI.
        </p>

        {showCreateToken && (
          <div className="mb-4 space-y-4 rounded-lg border border-border bg-background p-4">
            <div>
              <label className="label" htmlFor="token-name">
                Name
              </label>
              <input
                id="token-name"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={
                  clientKind === 'AGENT' ? 'e.g. Cursor agent' : 'e.g. Chrome on my laptop'
                }
                className="input"
                autoFocus
              />
            </div>

            <fieldset>
              <legend className="label mb-2">Who is this token for?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'HUMAN' as const,
                      label: 'Human',
                      description: 'Browser extension or personal scripts',
                    },
                    {
                      id: 'AGENT' as const,
                      label: 'AI agent',
                      description: 'CLI, MCP, Cursor, CI bots',
                    },
                  ] as const
                ).map((kind) => {
                  const checked = clientKind === kind.id;
                  return (
                    <label
                      key={kind.id}
                      className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors ${
                        checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="clientKind"
                          className="h-4 w-4 border-input"
                          checked={checked}
                          onChange={() => setClientKind(kind.id)}
                        />
                        <span className="text-sm font-medium text-foreground">{kind.label}</span>
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{kind.description}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="label mb-2">What can this token do?</legend>
              <div className="space-y-2">
                {TOKEN_PERMISSIONS.map((perm) => {
                  const checked = selectedPermissions.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-input"
                        checked={checked}
                        onChange={() => togglePermission(perm.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{perm.label}</span>
                        <span className="block text-xs text-muted-foreground">{perm.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={createToken}
                disabled={creatingToken}
                className="btn-primary btn-sm"
              >
                {creatingToken ? 'Creating…' : 'Create token'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateToken(false)}
                className="btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loadingTokens ? (
          <LoadingSpinner className="h-24" />
        ) : tokens.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No access tokens yet</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center gap-3 rounded-lg bg-background p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {token.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {String(token.clientKind || 'HUMAN') === 'AGENT' ? 'Agent' : 'Human'}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{friendlyScopes(token.scopes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteToken(token.id)}
                  className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${token.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </AnimatedCard>

      <Dialog
        open={!!createdPlainToken}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedPlainToken(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Copy your token</DialogTitle>
            <DialogDescription>
              This secret is shown only once. Paste it into the Qeva browser extension, then store it somewhere safe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="label" htmlFor="plain-token">
              Your token
            </label>
            <div className="flex gap-2">
              <input
                id="plain-token"
                readOnly
                value={createdPlainToken || ''}
                className="input font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button type="button" onClick={copyCreatedToken} className="btn-primary shrink-0 px-3">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              After you close this window you cannot view the token again. Create a new one if you lose it.
            </p>
          </div>

          <DialogFooter>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setCreatedPlainToken(null);
                setCopied(false);
              }}
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
