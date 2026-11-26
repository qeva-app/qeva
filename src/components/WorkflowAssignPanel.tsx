'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Person = { id: string; name: string | null; email: string };

export default function WorkflowAssignPanel({
  workflowId,
  canAssign,
  onChanged,
}: {
  workflowId: string;
  canAssign: boolean;
  onChanged?: (count: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignable, setAssignable] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/organization/workflows/${workflowId}/assignments`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        setAssignable(
          (data.assignable || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
        );
        setSelected(new Set(data.assignedUserIds || []));
        onChanged?.((data.assignedUserIds || []).length);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err.message || 'Failed to load assignees');
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [assignable, query]);

  const toggle = (id: string) => {
    if (!canAssign) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!canAssign) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organization/workflows/${workflowId}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSelected(new Set(data.assignedUserIds || []));
      onChanged?.((data.assignedUserIds || []).length);
      toast.success('Assignments saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assignments');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UserPlus size={14} /> Assign people
        </p>
        {canAssign && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || loading}
            onClick={save}
          >
            {saving ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <Save size={12} className="mr-1" />
            )}
            Save assignments
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Assigned users see this checklist even when audience is “Assigned only”.
        {canAssign ? '' : ' You can view assignees but not change them.'}
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Loading people…
        </p>
      ) : assignable.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No people available to assign
          {canAssign ? ' (managers can only assign direct reports).' : '.'}
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="h-8 pl-8"
            />
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <li key={u.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40',
                      !canAssign && 'cursor-default'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={checked}
                      disabled={!canAssign}
                      onChange={() => toggle(u.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {u.name || u.email}
                      </span>
                      {u.name && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {selected.size} selected
          </p>
        </>
      )}
    </div>
  );
}
