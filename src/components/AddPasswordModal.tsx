'use client';

import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import { Eye, EyeOff, Wand2, Globe, Lock, Smile, Users } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import IconPicker from './IconPicker';
import { toast } from 'sonner';
import { useEncryption } from '@/contexts/EncryptionContext';
import { useSession } from 'next-auth/react';
import { calculatePasswordStrength } from '@/lib/password-strength';
import { consumeVaultPrefill } from '@/lib/vault-prefill';
import {
  encryptWithClientDek,
  isClientVaultUnlocked,
} from '@/lib/client-vault-crypto';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FeatureAccess } from '@/lib/feature-access';

type VaultScope = 'personal' | 'global' | 'team';

interface AddPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (created?: { id: string; isGlobal?: boolean; isTeam?: boolean }) => void;
  defaultTeamId?: string | null;
  defaultScope?: VaultScope;
}

const emptyForm = {
  title: '',
  username: '',
  password: '',
  website: '',
  category: '',
  notes: '',
  tags: '',
  expiryDate: '',
  icon: '',
  color: '#3b82f6',
  label: '',
  teamId: '',
  serviceId: '',
};

export default function AddPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTeamId,
  defaultScope = 'personal',
}: AddPasswordModalProps) {
  const { state: encState } = useEncryption();
  const { data: session } = useSession();
  const isOrgUser = (session?.user as { accountType?: string } | undefined)?.accountType === 'ORGANIZATION';

  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const canAccessGlobalVault = !!access?.canAccessGlobalVault;
  const canAccessTeams = !!access?.canAccessTeams;
  const [form, setForm] = useState(emptyForm);
  const [scope, setScope] = useState<VaultScope>(defaultScope);
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; role?: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [batchQueue, setBatchQueue] = useState<{ password: string; title?: string }[]>([]);
  const [useMasterKey, setUseMasterKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.access) setAccess(data.access);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!access) return;
    if (
      (scope === 'global' && !access.canAccessGlobalVault) ||
      (scope === 'team' && !access.canAccessTeams)
    ) {
      setScope('personal');
    }
  }, [access, scope]);

  useEffect(() => {
    if (!isOpen) return;
    setScope(defaultTeamId ? 'team' : defaultScope);
    const prefill = consumeVaultPrefill();
    const base = { ...emptyForm, teamId: defaultTeamId || '' };
    if (prefill?.password) {
      base.password = prefill.password;
      if (prefill.title) base.title = prefill.title;
      if (prefill.username) base.username = prefill.username;
      if (prefill.website) base.website = prefill.website;
      setShowPassword(true);
    } else {
      setShowPassword(false);
    }
    if (prefill?.passwords && prefill.passwords.length > 1) {
      setBatchQueue(prefill.passwords.slice(1));
    } else {
      setBatchQueue([]);
    }
    setForm(base);
    setStrength(0);
    setUseMasterKey(!!encState.isEnabled);

    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/services')
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]));
  }, [isOpen, defaultTeamId, defaultScope, encState.isEnabled]);

  useEffect(() => {
    if (!isOpen || !canAccessTeams) {
      setTeams([]);
      return;
    }
    fetch('/api/teams')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTeams(list.filter((t: { role?: string }) => t.role !== 'VIEWER'));
      })
      .catch(() => {});
  }, [isOpen, canAccessTeams]);

  useEffect(() => {
    setStrength(form.password ? calculatePasswordStrength(form.password).score : 0);
  }, [form.password]);

  const generatePassword = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          length: 20,
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
          excludeSimilar: true,
        }),
      });
      const data = await res.json();
      if (data.passwords?.[0]) {
        setForm((prev) => ({ ...prev, password: data.passwords[0] }));
        setShowPassword(true);
      } else {
        toast.error(data.error || 'Failed to generate password');
      }
    } catch {
      toast.error('Failed to generate password');
    }
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.password) {
      toast.error('Title and password are required');
      return;
    }
    if (scope === 'team' && !form.teamId) {
      toast.error('Select a team');
      return;
    }
    if (scope === 'global' && !canAccessGlobalVault) {
      toast.error('Global vault unlocks after organization activation');
      return;
    }
    if (scope === 'team' && !canAccessTeams) {
      toast.error('Teams unlock after organization activation');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        username: form.username || undefined,
        website: form.website || '',
        category: form.category || undefined,
        tags: form.tags
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean).join(',')
          : undefined,
        expiryDate: form.expiryDate || undefined,
        icon: form.icon || undefined,
        color: form.color || undefined,
        label: form.label || undefined,
        isGlobal: scope === 'global',
        isTeam: scope === 'team',
        teamId: scope === 'team' ? form.teamId : undefined,
        serviceId: form.serviceId || null,
      };

      const wantMaster =
        scope === 'personal' && useMasterKey && encState.isEnabled;
      if (wantMaster) {
        if (!isClientVaultUnlocked()) {
          toast.error('Unlock your vault to use master-password encryption');
          setLoading(false);
          return;
        }
        payload.clientEncrypted = true;
        payload.encryptionType = 'USER_MASTER';
        payload.encryptedPassword = await encryptWithClientDek(form.password);
        if (form.notes) payload.encryptedNotes = await encryptWithClientDek(form.notes);
        payload.strength = calculatePasswordStrength(form.password).score;
      } else {
        payload.password = form.password;
        payload.notes = form.notes || undefined;
      }

      const res = await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        const summary = {
          id: created.id as string,
          isGlobal: !!created.isGlobal,
          isTeam: !!created.isTeam,
        };
        if (batchQueue.length > 0) {
          const [next, ...rest] = batchQueue;
          setBatchQueue(rest);
          setForm((prev) => ({
            ...prev,
            title: next.title || '',
            password: next.password,
            username: '',
            website: '',
          }));
          setShowPassword(true);
          toast.success(`Saved. ${rest.length + 1} remaining in batch`);
          onSuccess(summary);
        } else {
          onSuccess(summary);
          onClose();
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save password');
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle>Add Password</DialogTitle>
          <DialogDescription>Title and password are enough. Everything else is optional.</DialogDescription>
        </DialogHeader>

        {encState.isEnabled && !encState.isUnlocked && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
            <Lock size={14} aria-hidden="true" />
            Vault locked - saves with server-side encryption.
          </div>
        )}
        {batchQueue.length > 0 && (
          <div className="mx-5 mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Batch save: {batchQueue.length} more after this one.
          </div>
        )}

        <form id="add-password-form" onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label htmlFor="add-title" className="label">Title</label>
            <input
              id="add-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="input"
              placeholder="e.g. AWS Console"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="add-password" className="label mb-0">Password</label>
              <button
                type="button"
                onClick={generatePassword}
                disabled={generating}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                aria-label="Generate secure password"
              >
                <Wand2 size={12} aria-hidden="true" />
                {generating ? 'Generating…' : 'Generate strong password'}
              </button>
            </div>
            <div className="relative">
              <input
                id="add-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="input pr-10 font-mono"
                placeholder="Paste or generate…"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <PasswordStrengthIndicator score={strength} size="sm" />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="add-username" className="label">Username</label>
            <input
              id="add-username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="input"
              placeholder="email or username"
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          {isOrgUser && (canAccessGlobalVault || canAccessTeams) && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Save to</p>
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                <ScopeButton
                  active={scope === 'personal'}
                  onClick={() => setScope('personal')}
                  icon={<Lock size={14} />}
                  label="Personal"
                />
                {canAccessGlobalVault && (
                  <ScopeButton
                    active={scope === 'global'}
                    onClick={() => setScope('global')}
                    icon={<Globe size={14} />}
                    label="Global"
                  />
                )}
                {canAccessTeams && teams.length > 0 && (
                  <ScopeButton
                    active={scope === 'team'}
                    onClick={() => setScope('team')}
                    icon={<Users size={14} />}
                    label="Team"
                  />
                )}
              </div>
              {scope === 'global' && (
                <p className="mt-1.5 text-[11px] text-warning">Visible to everyone in the organization.</p>
              )}
              {scope === 'team' && (
                <div className="mt-2">
                  <label htmlFor="add-team" className="label">Team</label>
                  <select
                    id="add-team"
                    value={form.teamId}
                    onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}
                    className="select"
                    required
                  >
                    <option value="">Select team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {scope === 'personal' && (
            <label
              className={`flex items-start gap-2 text-sm ${encState.isEnabled ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-border"
                checked={encState.isEnabled && useMasterKey}
                disabled={!encState.isEnabled}
                readOnly={!encState.isEnabled}
                onChange={(e) => setUseMasterKey(e.target.checked)}
              />
              <span>
                Encrypt with master password (zero-knowledge)
                {!encState.isEnabled && (
                  <span className="block text-xs text-muted-foreground">
                    Enable encryption in Settings to use this.
                  </span>
                )}
              </span>
            </label>
          )}

          <details className="group rounded-lg border border-border/70 px-3 py-2">
            <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              More details <span className="font-normal text-muted-foreground/70">(optional)</span>
            </summary>
            <div className="space-y-3 pb-1 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-website" className="label">Website</label>
                  <input
                    id="add-website"
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                    className="input"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label htmlFor="add-category" className="label">Category</label>
                  <select
                    id="add-category"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="select"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {services.length > 0 && (
                <div>
                  <label htmlFor="add-service" className="label">Service</label>
                  <select
                    id="add-service"
                    value={form.serviceId}
                    onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))}
                    className="select"
                  >
                    <option value="">None</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Icon</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent"
                    aria-label="Choose icon"
                  >
                    {form.icon ? (() => {
                      const SelectedIcon = (LucideIcons as unknown as Record<string, ComponentType<{ size?: number; className?: string }>>)[form.icon];
                      return SelectedIcon
                        ? <SelectedIcon size={20} className="text-primary" />
                        : <Smile size={20} className="text-muted-foreground" />;
                    })() : (
                      <Smile size={20} className="text-muted-foreground" />
                    )}
                  </button>
                  <span className="text-xs text-muted-foreground">{form.icon || 'No icon'}</span>
                  {form.icon && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icon: '' }))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="add-notes" className="label">Notes</label>
                <textarea
                  id="add-notes"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="textarea"
                  rows={2}
                  placeholder="Anything else to remember…"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-tags" className="label">Tags</label>
                  <input
                    id="add-tags"
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className="input"
                    placeholder="prod, finance"
                  />
                </div>
                <div>
                  <label htmlFor="add-expiry" className="label">Expiry date</label>
                  <input
                    id="add-expiry"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-label" className="label">Label</label>
                  <input
                    id="add-label"
                    value={form.label}
                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                    className="input"
                    placeholder="Optional label"
                  />
                </div>
                <div>
                  <label htmlFor="add-color" className="label">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="add-color"
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="h-9 w-9 cursor-pointer rounded-md border border-border"
                    />
                    <input
                      value={form.color}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="input flex-1 font-mono text-xs"
                      aria-label="Color hex"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </form>

        <IconPicker
          value={form.icon}
          onChange={(iconName) => setForm((p) => ({ ...p, icon: iconName }))}
          isOpen={showIconPicker}
          onClose={() => setShowIconPicker(false)}
        />

        <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4 sm:justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" form="add-password-form" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Save Password'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-[background-color,color,box-shadow] ${
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
      aria-pressed={active}
    >
      {icon} {label}
    </button>
  );
}
