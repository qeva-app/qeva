'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { Eye, EyeOff, Wand2, History, Smile } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import IconPicker from './IconPicker';
import { toast } from 'sonner';
import { calculatePasswordStrength } from '@/lib/password-strength';
import {
  decryptWithClientDek,
  encryptWithClientDek,
  isClientVaultUnlocked,
} from '@/lib/client-vault-crypto';
import { fetchPasswordSecret } from '@/lib/fetch-password-secret';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FeatureAccess } from '@/lib/feature-access';

interface EditPasswordModalProps {
  isOpen: boolean;
  passwordId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  rotateOnOpen?: boolean;
}

export default function EditPasswordModal({
  isOpen,
  passwordId,
  onClose,
  onSuccess,
  rotateOnOpen = false,
}: EditPasswordModalProps) {
  const [form, setForm] = useState({
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
    isGlobal: false,
    isTeam: false,
    serviceId: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [strength, setStrength] = useState(0);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<{ id: string; strength?: number; changedAt: string; changedBy?: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const canAccessGlobalVault = !!access?.canAccessGlobalVault;

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
    if (!isOpen || !passwordId) return;
    setFetching(true);
    setShowHistory(false);
    setShowPassword(false);
    setShowCurrent(false);

    Promise.all([
      fetch(`/api/passwords/${passwordId}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch(`/api/passwords/${passwordId}/history`).then((r) => r.json()),
      fetch('/api/organization/password-policy').then((r) => r.json()).catch(() => ({})),
      fetch('/api/services').then((r) => r.json()).catch(() => []),
      rotateOnOpen
        ? fetch('/api/generator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }),
          }).then((r) => r.json())
        : Promise.resolve(null),
    ])
      .then(([pw, cats, hist, policyRes, svcs, gen]) => {
        if (pw?.error) {
          toast.error(pw.error || 'Failed to load');
          onClose();
          return;
        }
        const rotationDays = policyRes?.policy?.rotationDays || 90;
        let expiry = pw.expiryDate ? String(pw.expiryDate).split('T')[0] : '';
        let newPassword = '';
        if (rotateOnOpen) {
          newPassword = gen?.passwords?.[0] || '';
          const next = new Date();
          next.setDate(next.getDate() + rotationDays);
          expiry = next.toISOString().slice(0, 10);
          setShowPassword(true);
          toast.message('New password generated — review and save to rotate');
        }
        (async () => {
          let current = '';
          let notes = '';
          try {
            if (pw.encryptionType === 'USER_MASTER' && pw.ciphertext) {
              if (!isClientVaultUnlocked()) {
                toast.error('Unlock your vault to edit this credential');
                onClose();
                return;
              }
              current = await decryptWithClientDek(pw.ciphertext);
              if (pw.notesCiphertext) {
                notes = await decryptWithClientDek(pw.notesCiphertext);
              }
            } else {
              const secret = await fetchPasswordSecret(passwordId!);
              current = secret.password;
              notes = secret.notes || '';
            }
          } catch (e: any) {
            toast.error(e?.message || 'Could not decrypt credential');
            onClose();
            return;
          }
          setForm({
            title: pw.title || '',
            username: pw.username || '',
            password: newPassword,
            website: pw.website || '',
            category: pw.category || '',
            notes,
            tags: Array.isArray(pw.tags) ? pw.tags.join(', ') : pw.tags || '',
            expiryDate: expiry,
            icon: pw.icon || '',
            color: pw.color || '#3b82f6',
            label: pw.label || '',
            isGlobal: !!pw.isGlobal,
            isTeam: !!pw.isTeam,
            serviceId: pw.serviceId || '',
          });
          setCurrentPassword(current);
          setStrength(
            newPassword ? calculatePasswordStrength(newPassword).score : pw.strength || 0
          );
          setCanEdit(pw.permissions?.canEdit !== false);
          setCategories(Array.isArray(cats) ? cats : []);
          setServices(Array.isArray(svcs) ? svcs : []);
          setHistory(Array.isArray(hist) ? hist : []);
          setFetching(false);
        })();
      })
      .catch(() => {
        toast.error('Failed to load password');
        setFetching(false);
      });
  }, [isOpen, passwordId, onClose, rotateOnOpen]);

  useEffect(() => {
    if (form.password) {
      setStrength(calculatePasswordStrength(form.password).score);
    }
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
    if (!canEdit) return;
    if (!form.title) {
      toast.error('Title is required');
      return;
    }
    if (form.isGlobal && !canAccessGlobalVault) {
      toast.error('Global vault unlocks after organization activation');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        username: form.username,
        website: form.website || '',
        category: form.category,
        tags: form.tags
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean).join(',')
          : '',
        expiryDate: form.expiryDate || null,
        icon: form.icon,
        color: form.color,
        label: form.label,
        serviceId: form.serviceId || null,
      };
      if (!form.isTeam) body.isGlobal = form.isGlobal && canAccessGlobalVault;

      const secret = form.password || currentPassword;
      if (!form.isTeam && !form.isGlobal && isClientVaultUnlocked() && secret) {
        body.clientEncrypted = true;
        body.encryptionType = 'USER_MASTER';
        body.encryptedPassword = await encryptWithClientDek(secret);
        body.encryptedNotes = form.notes
          ? await encryptWithClientDek(form.notes)
          : '';
        body.strength = calculatePasswordStrength(secret).score;
      } else {
        body.notes = form.notes;
        if (form.password) body.password = form.password;
      }

      const res = await fetch(`/api/passwords/${passwordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success('Password updated');
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update password');
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle>Edit Password</DialogTitle>
              <DialogDescription>Update credential details or rotate the secret</DialogDescription>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="btn-ghost btn-sm shrink-0"
                aria-pressed={showHistory}
              >
                <History size={16} /> {showHistory ? 'Edit' : `History (${history.length})`}
              </button>
            )}
          </div>
        </DialogHeader>

        {fetching ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : showHistory ? (
          <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-thin space-y-2">
            {history.map((h) => (
              <div key={h.id} className="p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {new Date(h.changedAt).toLocaleString()}
                  </span>
                  <PasswordStrengthIndicator score={h.strength || 0} size="sm" showLabel={false} />
                </div>
                {h.changedBy && (
                  <p className="text-xs text-muted-foreground mt-1">Changed by: {h.changedBy}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <form id="edit-password-form" onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label htmlFor="edit-title" className="label">Title *</label>
              <input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="input"
                required
                disabled={!canEdit}
              />
            </div>

            <div>
              <label htmlFor="edit-username" className="label">Username</label>
              <input
                id="edit-username"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="input"
                disabled={!canEdit}
              />
            </div>

            {currentPassword && (
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    readOnly
                    className="input pr-10 font-mono bg-muted/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="edit-password" className="label">New Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="edit-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="input pr-10 font-mono"
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  disabled={!canEdit || generating}
                  className="btn-outline shrink-0 gap-1.5"
                  aria-label="Generate secure password"
                >
                  <Wand2 size={14} /> {generating ? '…' : 'Generate'}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <PasswordStrengthIndicator score={strength} size="sm" />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="edit-website" className="label">Website</label>
              <input
                id="edit-website"
                type="url"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                className="input"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label htmlFor="edit-category" className="label">Category</label>
              <select
                id="edit-category"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="select"
                disabled={!canEdit}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {services.length > 0 && (
              <div>
                <label htmlFor="edit-service" className="label">Service</label>
                <select
                  id="edit-service"
                  value={form.serviceId}
                  onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))}
                  className="select"
                  disabled={!canEdit}
                >
                  <option value="">None</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!form.isTeam && canAccessGlobalVault && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isGlobal}
                  onChange={(e) => setForm((p) => ({ ...p, isGlobal: e.target.checked }))}
                  disabled={!canEdit}
                  className="rounded border-border"
                />
                Share with organization (Global)
              </label>
            )}

            <div>
              <label className="label">Icon</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  disabled={!canEdit}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
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
              </div>
            </div>

            <div>
              <label htmlFor="edit-notes" className="label">Notes</label>
              <textarea
                id="edit-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="textarea"
                rows={3}
                disabled={!canEdit}
              />
            </div>

            <div>
              <label htmlFor="edit-tags" className="label">Tags</label>
              <input
                id="edit-tags"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                className="input"
                placeholder="tag1, tag2, tag3"
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-expiry" className="label">Expiry Date</label>
                <input
                  id="edit-expiry"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  className="input"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label htmlFor="edit-label" className="label">Label</label>
                <input
                  id="edit-label"
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  className="input"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-color" className="label">Color</label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                  disabled={!canEdit}
                />
                <input
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="input flex-1 font-mono text-xs"
                  disabled={!canEdit}
                  aria-label="Color hex"
                />
              </div>
            </div>
          </form>
        )}

        <IconPicker
          value={form.icon}
          onChange={(iconName) => setForm((p) => ({ ...p, icon: iconName }))}
          isOpen={showIconPicker}
          onClose={() => setShowIconPicker(false)}
        />

        {!showHistory && !fetching && (
          <DialogFooter className="px-5 py-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              form="edit-password-form"
              disabled={loading || !canEdit}
              className="btn-primary"
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
