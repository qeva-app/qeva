'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Users, Search, UserCheck, UserX, Key, Shield, UserPlus, X, ChevronsUpDown } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import DirectorySyncPanel from '@/components/DirectorySyncPanel';
import { toast } from 'sonner';

type ManagerRef = { id: string; name: string | null; email: string } | null;

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  isVerified?: boolean;
  role: string;
  createdAt: string;
  managerId: string | null;
  manager: ManagerRef;
};

type RoleOption = {
  id: string;
  name: string;
  isSystem: boolean;
  organizationId: string | null;
};

function sanitizeLocal(raw: string) {
  return raw.toLowerCase().split('@')[0].replace(/[^a-z0-9._+-]/g, '');
}

function DomainEmailField({
  id,
  label,
  hint,
  value,
  onChange,
  domain,
  placeholder,
  required,
  autoFocus,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (local: string) => void;
  domain: string;
  placeholder: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {hint && <span className="text-muted-foreground font-normal"> {hint}</span>}
      </label>
      <div className="mt-1 flex items-stretch rounded-lg border border-input bg-background/90 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring overflow-hidden">
        <input
          id={id}
          className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          value={value}
          onChange={(e) => onChange(sanitizeLocal(e.target.value))}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          inputMode="email"
        />
        <span className="shrink-0 flex items-center px-3 text-sm text-muted-foreground bg-muted border-l border-input select-none">
          @{domain}
        </span>
      </div>
    </div>
  );
}

function ManagerPicker({
  domain,
  users,
  excludeEmailLocal,
  value,
  onChange,
}: {
  domain: string;
  users: UserRow[];
  excludeEmailLocal?: string;
  value: string;
  onChange: (local: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.isActive)
      .filter((u) => {
        const local = sanitizeLocal(u.email);
        if (excludeEmailLocal && local === excludeEmailLocal) return false;
        if (!q) return true;
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          local.includes(q)
        );
      })
      .slice(0, 8);
  }, [users, query, excludeEmailLocal]);

  const exactMatch = options.some((u) => sanitizeLocal(u.email) === sanitizeLocal(query));
  const showCustom =
    !!sanitizeLocal(query) && !exactMatch;

  const pick = (local: string) => {
    const next = sanitizeLocal(local);
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-sm font-medium text-foreground">
        Manager <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <div className="mt-1 flex items-stretch rounded-lg border border-input bg-background/90 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring overflow-hidden">
        <input
          className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          value={query}
          onChange={(e) => {
            const local = sanitizeLocal(e.target.value);
            setQuery(local);
            onChange(local);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && open && options[0]) {
              e.preventDefault();
              pick(sanitizeLocal(options[0].email));
            }
          }}
          placeholder="Search or type username"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="shrink-0 flex items-center px-3 text-sm text-muted-foreground bg-muted border-l border-input select-none">
          @{domain}
        </span>
        <button
          type="button"
          className="px-2 text-muted-foreground hover:text-foreground border-l border-input"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle manager list"
        >
          <ChevronsUpDown size={16} />
        </button>
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1">
          {options.map((u) => {
            const local = sanitizeLocal(u.email);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex flex-col"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(local)}
                >
                  <span className="font-medium text-foreground">{u.name || local}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </button>
              </li>
            );
          })}
          {showCustom && (
            <li>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-t border-border"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(query)}
              >
                Use <span className="font-medium">{sanitizeLocal(query)}@{domain}</span>
              </button>
            </li>
          )}
          {options.length === 0 && !showCustom && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No people match</li>
          )}
          {value && (
            <li>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-accent border-t border-border"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick('')}
              >
                Clear manager
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function InviteModal({
  roles,
  users,
  domain,
  onClose,
  onCreated,
}: {
  roles: RoleOption[];
  users: UserRow[];
  domain: string;
  onClose: () => void;
  onCreated: (user: UserRow) => void;
}) {
  const defaultRoleId = roles.find((r) => r.name === 'USER')?.id || roles[0]?.id || '';
  const [emailLocal, setEmailLocal] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(defaultRoleId);
  const [managerLocal, setManagerLocal] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailLocal.trim() || !name.trim() || !roleId) {
      toast.error('Email, name, and role are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailLocal: emailLocal.trim(),
          name: name.trim(),
          roleId,
          managerEmailLocal: managerLocal.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Invite failed');
        return;
      }
      toast.success(data.message || `Invite sent to ${data.email}`);
      onCreated({
        id: data.id,
        name: data.name,
        email: data.email,
        isActive: data.isActive ?? true,
        isVerified: data.isVerified ?? false,
        role: data.role || 'USER',
        createdAt: data.createdAt || new Date().toISOString(),
        managerId: data.manager?.id ?? data.managerId ?? null,
        manager: data.manager ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md border border-border p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite user</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Emails are limited to @{domain}. They get a temporary password by email.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Close">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <DomainEmailField
            id="invite-email"
            label="Email"
            value={emailLocal}
            onChange={setEmailLocal}
            domain={domain}
            placeholder="alex"
            required
            autoFocus
          />
          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Rivera"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Role</label>
            <select
              className="select mt-1"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
            >
              <optgroup label="Built-in">
                {roles
                  .filter((r) => r.isSystem)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
              {roles.some((r) => !r.isSystem) && (
                <optgroup label="Custom">
                  {roles
                    .filter((r) => !r.isSystem)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
          <ManagerPicker
            domain={domain}
            users={users}
            excludeEmailLocal={emailLocal}
            value={managerLocal}
            onChange={setManagerLocal}
          />

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving || !roleId || !domain} className="btn-primary">
              <UserPlus size={16} />
              {saving ? 'Inviting…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [managerSavingId, setManagerSavingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [orgDomain, setOrgDomain] = useState<string | null>(null);
  const [canDirectorySync, setCanDirectorySync] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/admin/roles').then((r) => r.json()),
      fetch('/api/me').then((r) => r.json()),
    ])
      .then(([userPayload, rolePayload, me]) => {
        setUsers(Array.isArray(userPayload) ? userPayload : []);
        setRoles(Array.isArray(rolePayload) ? rolePayload : []);
        setOrgDomain(typeof me.orgDomain === 'string' ? me.orgDomain.toLowerCase() : null);
        setCanDirectorySync(!!me.access?.canAccessDirectorySync);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (id: string, current: boolean) => {
    if (currentUserId && id === currentUserId) {
      toast.error('You cannot deactivate your own account here');
      return;
    }
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: !current } : u)));
      toast.success(`User ${!current ? 'activated' : 'deactivated'}`);
    } else {
      toast.error('Update failed');
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm('Send password reset to this user?')) return;
    const res = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' });
    if (res.ok) toast.success('Reset email sent');
    else toast.error('Failed');
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    if (currentUserId && userId === currentUserId) {
      toast.error('You cannot change your own role');
      return;
    }
    setAssigningId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/assign-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not assign role');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: data.role || u.role } : u))
      );
      toast.success(
        data.note
          ? `Role set to ${data.role}. They need to sign in again for it to take effect.`
          : `Role set to ${data.role}`
      );
    } finally {
      setAssigningId(null);
    }
  };

  const handleSetManager = async (userId: string, managerId: string) => {
    setManagerSavingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/manager`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: managerId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not update Reports to');
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                managerId: data.managerId ?? null,
                manager: data.manager ?? null,
              }
            : u
        )
      );
      toast.success(managerId ? 'Reports to updated' : 'Reports to cleared');
    } finally {
      setManagerSavingId(null);
    }
  };

  const roleIdForName = (name: string) => roles.find((r) => r.name === name)?.id;

  const filtered = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.manager?.email?.toLowerCase().includes(s) ||
      u.manager?.name?.toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={22} /> Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite people, set roles and Reports to, or sync from Microsoft 365.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground">{users.length} total</span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!orgDomain) {
                toast.error('Organization domain is not configured');
                return;
              }
              setInviteOpen(true);
            }}
          >
            <UserPlus size={16} /> Invite user
          </button>
        </div>
      </div>

      {canDirectorySync ? <DirectorySyncPanel onSynced={load} /> : null}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users or managers..."
          className="input pl-9"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Reports to
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const currentRoleId = roleIdForName(user.role);
              const isSelf = !!currentUserId && user.id === currentUserId;
              const managerChoices = users.filter((u) => u.id !== user.id && u.isActive);
              return (
                <tr key={user.id} className="border-b border-border hover:bg-accent">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {user.name}
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 min-w-[9rem]">
                      <Shield size={14} className="text-muted-foreground shrink-0" />
                      {isSelf ? (
                        <span className="text-sm text-foreground" title="You cannot change your own role">
                          {user.role}
                        </span>
                      ) : (
                        <select
                          className="select text-sm py-1.5"
                          disabled={assigningId === user.id || roles.length === 0}
                          value={currentRoleId || ''}
                          onChange={(e) => {
                            if (e.target.value) handleAssignRole(user.id, e.target.value);
                          }}
                        >
                          {!currentRoleId && <option value="">Select role…</option>}
                          <optgroup label="Built-in">
                            {roles
                              .filter((r) => r.isSystem)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </optgroup>
                          {roles.some((r) => !r.isSystem) && (
                            <optgroup label="Custom">
                              {roles
                                .filter((r) => !r.isSystem)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="select text-sm py-1.5 min-w-[11rem] max-w-[14rem]"
                      disabled={managerSavingId === user.id}
                      value={user.managerId || ''}
                      onChange={(e) => handleSetManager(user.id, e.target.value)}
                      title="Optional — who this person reports to"
                    >
                      <option value="">— None —</option>
                      {managerChoices.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        !user.isActive
                          ? 'badge-red'
                          : user.isVerified === false
                            ? 'badge-slate'
                            : 'badge-green'
                      }`}
                    >
                      {!user.isActive
                        ? 'Inactive'
                        : user.isVerified === false
                          ? 'Pending invite'
                          : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded"
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                        disabled={isSelf}
                      >
                        {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user.id)}
                        className="p-1.5 text-muted-foreground hover:text-warning rounded"
                        title="Reset Password"
                      >
                        <Key size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
        )}
      </div>

      {inviteOpen && orgDomain && (
        <InviteModal
          roles={roles}
          users={users}
          domain={orgDomain}
          onClose={() => setInviteOpen(false)}
          onCreated={(user) => setUsers((prev) => [user, ...prev])}
        />
      )}
    </div>
  );
}
