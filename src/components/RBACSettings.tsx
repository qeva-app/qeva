'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Users,
  X,
  Save,
  Crown,
  Copy,
  Eye,
  ChevronDown,
} from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PERMISSION_GROUPS,
  ROLE_TEMPLATES,
  parseRolePermissions,
  SYSTEM_ROLE_NAMES,
} from '@/lib/rbac-catalog';

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: string | null;
  permissionList?: string[];
  isSystem: boolean;
  organizationId: string | null;
  memberCount?: number;
  /** True when count is limited to the current organization */
  memberCountScoped?: boolean;
};

type EditorState = {
  mode: 'create' | 'edit' | 'view';
  role?: RoleRow;
  /** Prefill when cloning a built-in into a custom role */
  seedFrom?: RoleRow;
};

function permsOf(role: RoleRow): string[] {
  if (role.permissionList?.length) return role.permissionList;
  return parseRolePermissions(role.permissions, role.name);
}

function RoleEditor({
  state,
  isSuperAdmin,
  onClose,
  onSaved,
}: {
  state: EditorState;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = state.mode === 'create';
  const isView = state.mode === 'view';
  const editingSystem = !!state.role?.isSystem;
  const readOnly = isView || (editingSystem && !isSuperAdmin);
  const seed = state.seedFrom;

  const [name, setName] = useState(() => {
    if (isCreate && seed) return `${seed.name} (custom)`;
    return isCreate ? '' : state.role?.name || '';
  });
  const [description, setDescription] = useState(() => {
    if (isCreate && seed) return seed.description || `Based on ${seed.name}`;
    return isCreate ? '' : state.role?.description || '';
  });
  const [selected, setSelected] = useState<string[]>(() => {
    if (isCreate && seed) return permsOf(seed);
    return isCreate ? [] : state.role ? permsOf(state.role) : [];
  });
  const [saving, setSaving] = useState(false);

  const title = isCreate
    ? seed
      ? `Duplicate ${seed.name} as custom`
      : 'Create role'
    : isView
      ? state.role?.name
      : editingSystem
        ? `Edit built-in: ${state.role?.name}`
        : `Edit role: ${state.role?.name}`;

  const toggle = (perm: string) => {
    if (readOnly) return;
    setSelected((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleGroup = (perms: string[], allOn: boolean) => {
    if (readOnly) return;
    setSelected((prev) => {
      if (allOn) return prev.filter((p) => !perms.includes(p));
      return [...new Set([...prev, ...perms])];
    });
  };

  const applyTemplate = (template: string) => {
    if (readOnly) return;
    setSelected([...(ROLE_TEMPLATES[template] || [])]);
  };

  const save = async () => {
    if (readOnly) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        permissions: selected,
      };
      const res = isCreate
        ? await fetch('/api/admin/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/roles/${state.role!.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Save failed');
        return;
      }
      toast.success(isCreate ? 'Role created' : 'Role updated');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-xl mx-4 p-6 border border-border">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {editingSystem && isSuperAdmin && !isView && (
              <p className="text-xs text-warning mt-1">
                Built-in templates apply to every organization. Change carefully.
              </p>
            )}
            {isCreate && (
              <p className="text-xs text-muted-foreground mt-1">
                Custom roles stay inside your organization. People keep this until you reassign them.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Close">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              className="input mt-1"
              value={name}
              disabled={readOnly || editingSystem}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Security auditor"
              maxLength={64}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <input
              className="input mt-1"
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
              maxLength={200}
            />
          </div>

          {!readOnly && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Start from</p>
              <div className="flex flex-wrap gap-2">
                {(['blank', 'USER', 'MANAGER', 'ADMIN'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="btn-ghost text-xs inline-flex items-center gap-1"
                  >
                    <Copy size={12} />
                    {t === 'blank' ? 'Blank' : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Permissions</p>
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            </div>
            <div className="max-h-[45vh] overflow-y-auto scrollbar-thin space-y-3 pr-1">
              {PERMISSION_GROUPS.map((group) => {
                const allOn = group.permissions.every((p) => selected.includes(p));
                return (
                  <div key={group.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-foreground">{group.label}</h3>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => toggleGroup(group.permissions, allOn)}
                        >
                          {allOn ? 'Clear' : 'All'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm}
                          className={`flex items-center gap-2 py-1 px-1 rounded ${readOnly ? '' : 'hover:bg-accent cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(perm)}
                            disabled={readOnly}
                            onChange={() => toggle(perm)}
                            className="rounded border-border text-primary"
                          />
                          <span className="text-sm text-foreground font-mono">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border">
          <button type="button" onClick={onClose} className="btn-ghost">
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              <Save size={16} />
              {saving ? 'Saving…' : 'Save role'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  delay,
  canEdit,
  canClone,
  expanded,
  onToggleExpand,
  onView,
  onEdit,
  onClone,
  onDelete,
}: {
  role: RoleRow;
  delay: number;
  canEdit: boolean;
  canClone?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onView: () => void;
  onEdit: () => void;
  onClone?: () => void;
  onDelete?: () => void;
}) {
  const perms = permsOf(role);
  const groups = PERMISSION_GROUPS.map((g) => ({
    ...g,
    active: g.permissions.filter((p) => perms.includes(p)),
  })).filter((g) => g.active.length > 0);

  return (
    <AnimatedCard delay={delay} className="flex flex-col p-0 overflow-hidden">
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            type="button"
            className="min-w-0 text-left flex-1"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            <h3 className="font-semibold text-foreground truncate flex items-center gap-1.5">
              {role.isSystem && <Crown size={14} className="text-warning shrink-0" />}
              {role.name}
              <ChevronDown
                size={16}
                className={cn(
                  'ml-0.5 shrink-0 text-muted-foreground transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {role.description || (role.isSystem ? 'Built-in role' : 'Custom role')}
            </p>
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={onView} className="p-1.5 text-muted-foreground hover:text-primary rounded" title="Open details">
              <Eye size={16} />
            </button>
            {canClone && onClone && (
              <button
                type="button"
                onClick={onClone}
                className="p-1.5 text-muted-foreground hover:text-primary rounded"
                title="Duplicate as custom role"
              >
                <Copy size={16} />
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={onEdit} className="p-1.5 text-muted-foreground hover:text-primary rounded" title="Edit">
                <Pencil size={16} />
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive rounded" title="Delete">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{perms.length} permissions</p>
        {!expanded && (
          <div className="mt-3 flex flex-wrap gap-1">
            {perms.slice(0, 4).map((p) => (
              <span key={p} className="badge-slate text-xs">
                {p.split(':')[1] || p}
              </span>
            ))}
            {perms.length > 4 && (
              <button
                type="button"
                className="badge-slate text-xs hover:bg-accent"
                onClick={onToggleExpand}
              >
                +{perms.length - 4} more
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-auto pt-3 flex items-center gap-1">
          <Users size={12} />
          {role.memberCount ?? 0}{' '}
          {role.memberCountScoped !== false ? 'in this org' : 'assigned (all orgs)'}
          {role.isSystem && <span className="ml-auto text-warning">Built-in</span>}
        </p>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-5 py-4 space-y-3">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{g.label}</p>
              <div className="flex flex-wrap gap-1">
                {g.active.map((p) => (
                  <span key={p} className="badge-slate text-xs font-mono">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {canClone && onClone && (
            <button type="button" className="btn-outline btn-sm mt-1" onClick={onClone}>
              <Copy size={14} /> Duplicate as custom role
            </button>
          )}
        </div>
      )}
    </AnimatedCard>
  );
}

export default function RBACSettings() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/roles').then((r) => r.json()),
      fetch('/api/me').then((r) => r.json()),
    ])
      .then(([rolePayload, me]) => {
        setRoles(Array.isArray(rolePayload) ? rolePayload : []);
        setIsSuperAdmin(!!me.isSuperAdmin);
        setOrgName(me.access?.orgName || null);
      })
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { builtIn, custom } = useMemo(() => {
    const builtIn = roles.filter((r) => r.isSystem || SYSTEM_ROLE_NAMES.includes(r.name as (typeof SYSTEM_ROLE_NAMES)[number]));
    const custom = roles.filter((r) => !r.isSystem && r.organizationId);
    return { builtIn, custom };
  }, [roles]);

  const deleteRole = async (role: RoleRow) => {
    if (!confirm(`Delete role “${role.name}”? Users must be reassigned first.`)) return;
    const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Delete failed');
      return;
    }
    toast.success('Role deleted');
    fetchData();
  };

  if (loading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={24} /> Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Built-in roles are shared templates. Custom roles belong to{' '}
            {orgName ? <span className="text-foreground font-medium">{orgName}</span> : 'your organization'}{' '}
            and control who can manage vaults, teams, and admin tools.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => setEditor({ mode: 'create' })}
          disabled={!orgName}
          title={!orgName ? 'Organization required to create custom roles' : undefined}
        >
          <Plus size={16} /> Create role
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Built-in roles</h2>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin
                ? 'You can edit these templates as Super Admin.'
                : 'View only - expand to see permissions, or duplicate as a custom role.'}
            </p>
          </div>
          {builtIn.length > 0 && (
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                const allOpen = builtIn.every((r) => expandedIds.has(r.id));
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (allOpen) builtIn.forEach((r) => next.delete(r.id));
                  else builtIn.forEach((r) => next.add(r.id));
                  return next;
                });
              }}
            >
              {builtIn.every((r) => expandedIds.has(r.id)) ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {builtIn.map((role, i) => (
            <RoleCard
              key={role.id}
              role={role}
              delay={i * 0.04}
              canEdit={isSuperAdmin}
              canClone={!!orgName}
              expanded={expandedIds.has(role.id)}
              onToggleExpand={() => toggleExpand(role.id)}
              onView={() => setEditor({ mode: 'view', role })}
              onEdit={() => setEditor({ mode: 'edit', role })}
              onClone={() => setEditor({ mode: 'create', seedFrom: role })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Custom roles{orgName ? ` · ${orgName}` : ''}
            </h2>
            <p className="text-xs text-muted-foreground">
              Assign these from Users. Duplicate a built-in above, or create from scratch.
            </p>
          </div>
          {custom.length > 0 && (
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                if (expandedIds.size === custom.length) {
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    custom.forEach((r) => next.delete(r.id));
                    return next;
                  });
                } else {
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    custom.forEach((r) => next.add(r.id));
                    return next;
                  });
                }
              }}
            >
              {expandedIds.size >= custom.length && custom.every((r) => expandedIds.has(r.id))
                ? 'Collapse all'
                : 'Expand all'}
            </button>
          )}
        </div>
        {custom.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <ShieldCheck className="mx-auto text-muted-foreground mb-3" size={28} />
            <p className="text-sm font-medium text-foreground">No custom roles yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Expand a built-in and use Duplicate as custom, or create a blank role.
            </p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => setEditor({ mode: 'create' })}
            >
              <Plus size={16} /> Create first role
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {custom.map((role, i) => (
              <RoleCard
                key={role.id}
                role={role}
                delay={i * 0.04}
                canEdit
                expanded={expandedIds.has(role.id)}
                onToggleExpand={() => toggleExpand(role.id)}
                onView={() => setEditor({ mode: 'view', role })}
                onEdit={() => setEditor({ mode: 'edit', role })}
                onDelete={() => deleteRole(role)}
              />
            ))}
          </div>
        )}
      </section>

      {editor && (
        <RoleEditor
          key={`${editor.mode}-${editor.role?.id || 'new'}-${editor.seedFrom?.id || ''}`}
          state={editor}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditor(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
