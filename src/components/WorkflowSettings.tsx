'use client';

import { useEffect, useState } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  Pencil,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import WorkflowProgressPanel from '@/components/WorkflowProgressPanel';
import WorkflowAssignPanel from '@/components/WorkflowAssignPanel';

type StepDraft = {
  title: string;
  description: string;
  sortOrder: number;
  stepType: string;
  actionKey: string;
  href: string;
  isRequired: boolean;
};

type WorkflowDraft = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  isActive: boolean;
  isRequired: boolean;
  audience: string;
  steps: StepDraft[];
  assigneeCount: number;
};

const ACTION_KEYS: { id: string; label: string }[] = [
  { id: 'WELCOME', label: 'Welcome / info' },
  { id: 'ENABLE_ENCRYPTION', label: 'Enable encryption' },
  { id: 'JOIN_TEAM', label: 'Join a team' },
  { id: 'CREATE_PASSWORD', label: 'Add a password' },
  { id: 'OPEN_GENERATOR', label: 'Open generator' },
  { id: 'REVIEW_HEALTH', label: 'Review password health' },
  { id: 'CUSTOM', label: 'Custom step' },
];

function emptyStep(i: number): StepDraft {
  return {
    title: '',
    description: '',
    sortOrder: i,
    stepType: 'ACTION',
    actionKey: 'CUSTOM',
    href: '',
    isRequired: true,
  };
}

export default function WorkflowSettings({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [isOrg, setIsOrg] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = (preferId?: string | null) => {
    setLoading(true);
    return fetch('/api/organization/workflows')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setIsOrg(false);
          setCanEdit(false);
          setCanAssign(false);
          setWorkflows([]);
          setLoading(false);
          return [];
        }
        setIsOrg(!!data.isOrg);
        setCanEdit(!!data.canEdit);
        setCanAssign(!!data.canAssign);
        const list = (data.workflows || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          type: w.type,
          description: w.description,
          isActive: w.isActive,
          isRequired: w.isRequired,
          audience: w.audience,
          assigneeCount: w.assigneeCount ?? w._count?.assignments ?? 0,
          steps: (w.steps || []).map((s: any, i: number) => ({
            title: s.title,
            description: s.description || '',
            sortOrder: s.sortOrder ?? i,
            stepType: s.stepType || 'ACTION',
            actionKey: s.actionKey || 'CUSTOM',
            href: s.href || '',
            isRequired: s.isRequired !== false,
          })),
        })) as WorkflowDraft[];
        setWorkflows(list);
        if (preferId && list.some((w) => w.id === preferId)) {
          setEditingId(preferId);
        }
        setLoading(false);
        return list;
      })
      .catch(() => {
        setLoading(false);
        return [] as WorkflowDraft[];
      });
  };

  useEffect(() => {
    load();
  }, []);

  const editing = workflows.find((w) => w.id === editingId) || null;

  const updateWorkflow = (id: string, patch: Partial<WorkflowDraft>) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const updateStep = (wfId: string, index: number, patch: Partial<StepDraft>) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== wfId) return w;
        const steps = w.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
        return { ...w, steps };
      })
    );
  };

  const save = async (wf: WorkflowDraft) => {
    if (!canEdit) return;
    setSavingId(wf.id);
    try {
      const res = await fetch(`/api/organization/workflows/${wf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wf.name,
          description: wf.description,
          isActive: wf.isActive,
          isRequired: wf.isRequired,
          audience: wf.audience,
          steps: wf.steps.map((s, i) => ({
            ...s,
            sortOrder: i,
            href: s.href || null,
            description: s.description || null,
          })),
        }),
      });
      if (res.ok) {
        toast.success('Workflow saved');
        await load(wf.id);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save workflow');
    }
    setSavingId(null);
  };

  const createCustom = async () => {
    if (!canEdit) return;
    const res = await fetch('/api/organization/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom workflow',
        type: 'CUSTOM',
        isRequired: false,
        audience: 'ASSIGNED',
        steps: [
          {
            title: 'First step',
            description: 'Describe what members should do',
            sortOrder: 0,
            stepType: 'INFO',
            actionKey: 'CUSTOM',
            isRequired: true,
          },
        ],
      }),
    });
    if (res.ok) {
      const wf = await res.json();
      toast.success('Workflow created');
      await load(wf.id);
    } else {
      const err = await res.json();
      toast.error(err.error || 'Failed to create');
    }
  };

  const remove = async (wf: WorkflowDraft) => {
    if (!canEdit || wf.slug === 'general-onboarding') return;
    if (!confirm(`Delete “${wf.name}”?`)) return;
    const res = await fetch(`/api/organization/workflows/${wf.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      setEditingId(null);
      await load();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Failed to delete');
    }
  };

  if (loading && !workflows.length) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading workflows…
      </div>
    );
  }

  if (!isOrg) {
    return embedded ? (
      <p className="text-sm text-muted-foreground">Workflows are for organization accounts.</p>
    ) : null;
  }

  if (!canEdit && !canAssign) {
    return (
      <p className="text-sm text-muted-foreground">
        Only organization admins and managers can manage workflow assignments.
      </p>
    );
  }

  const editor =
    editing && (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2"
            onClick={() => setEditingId(null)}
          >
            <ArrowLeft size={14} className="mr-1" /> All workflows
          </Button>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => save(editing)}
                disabled={savingId === editing.id}
              >
                <Save size={14} className="mr-1" />
                {savingId === editing.id ? 'Saving…' : 'Save'}
              </Button>
              {editing.slug !== 'general-onboarding' && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => remove(editing)}
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {canEdit ? 'Edit workflow' : 'Assign workflow'}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {editing.type} · {editing.steps.length} step
            {editing.steps.length === 1 ? '' : 's'}
            {editing.assigneeCount > 0
              ? ` · ${editing.assigneeCount} assigned`
              : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <Input
              disabled={!canEdit}
              value={editing.name}
              onChange={(e) => updateWorkflow(editing.id, { name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Audience</label>
            <Select
              disabled={!canEdit}
              value={editing.audience}
              onValueChange={(v) => updateWorkflow(editing.id, { audience: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All members</SelectItem>
                <SelectItem value="USER">Non-admins</SelectItem>
                <SelectItem value="ADMIN">Admins only</SelectItem>
                <SelectItem value="ASSIGNED">Assigned only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <Textarea
              disabled={!canEdit}
              value={editing.description || ''}
              onChange={(e) =>
                updateWorkflow(editing.id, { description: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={editing.isActive}
              disabled={!canEdit}
              onCheckedChange={(v) => updateWorkflow(editing.id, { isActive: v })}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={editing.isRequired}
              disabled={!canEdit}
              onCheckedChange={(v) => updateWorkflow(editing.id, { isRequired: v })}
            />
            Required (banner until done)
          </label>
        </div>

        <WorkflowAssignPanel
          workflowId={editing.id}
          canAssign={canAssign}
          onChanged={(count) => updateWorkflow(editing.id, { assigneeCount: count })}
        />

        {canEdit && <WorkflowProgressPanel workflowId={editing.id} />}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Steps</p>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateWorkflow(editing.id, {
                    steps: [...editing.steps, emptyStep(editing.steps.length)],
                  })
                }
              >
                <Plus size={14} className="mr-1" /> Add step
              </Button>
            )}
          </div>

          {editing.steps.length === 0 && (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          )}

          {editing.steps.map((step, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border/60 bg-card/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Step {i + 1}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      updateWorkflow(editing.id, {
                        steps: editing.steps.filter((_, idx) => idx !== i),
                      })
                    }
                    aria-label="Remove step"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <Input
                disabled={!canEdit}
                placeholder="Title"
                value={step.title}
                onChange={(e) => updateStep(editing.id, i, { title: e.target.value })}
              />
              <Textarea
                disabled={!canEdit}
                placeholder="Description"
                rows={2}
                value={step.description}
                onChange={(e) =>
                  updateStep(editing.id, i, { description: e.target.value })
                }
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  disabled={!canEdit}
                  value={step.stepType}
                  onValueChange={(v) => updateStep(editing.id, i, { stepType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="LINK">Link</SelectItem>
                    <SelectItem value="ACTION">Action</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  disabled={!canEdit}
                  value={step.actionKey}
                  onValueChange={(v) => updateStep(editing.id, i, { actionKey: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_KEYS.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  disabled={!canEdit}
                  placeholder="/path"
                  value={step.href}
                  onChange={(e) => updateStep(editing.id, i, { href: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={step.isRequired}
                  disabled={!canEdit}
                  onCheckedChange={(v) => updateStep(editing.id, i, { isRequired: v })}
                />
                Required step
              </label>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              size="sm"
              onClick={() => save(editing)}
              disabled={savingId === editing.id}
            >
              <Save size={14} className="mr-1" />
              {savingId === editing.id ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
              Done
            </Button>
          </div>
        )}
      </div>
    );

  const list = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display font-semibold text-foreground">
            <GitBranch size={20} /> {embedded ? 'Manage workflows' : 'Organization Workflows'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit
              ? 'Edit checklists or assign them to specific people.'
              : 'Assign workflows to your direct reports.'}
          </p>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={createCustom}>
            <Plus size={14} className="mr-1" /> New workflow
          </Button>
        )}
      </div>

      {workflows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workflows yet.</p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-xl border border-border/80">
          {workflows.map((wf) => (
            <li
              key={wf.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{wf.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{wf.type}</span>
                  <span>·</span>
                  <span>
                    {wf.steps.length} step{wf.steps.length === 1 ? '' : 's'}
                  </span>
                  <Badge variant={wf.isActive ? 'default' : 'outline'} className="ml-1 text-[10px]">
                    {wf.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {wf.isRequired && (
                    <Badge variant="secondary" className="text-[10px]">
                      Required
                    </Badge>
                  )}
                  {wf.audience === 'ASSIGNED' && (
                    <Badge variant="outline" className="text-[10px]">
                      Assigned only
                    </Badge>
                  )}
                  {wf.assigneeCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <UserPlus size={10} />
                      {wf.assigneeCount}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingId(wf.id)}
              >
                {canEdit ? (
                  <>
                    <Pencil size={14} className="mr-1" /> Edit
                  </>
                ) : (
                  <>
                    <UserPlus size={14} className="mr-1" /> Assign
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const body = editingId && editing ? editor : list;

  if (embedded) return <div className="space-y-4">{body}</div>;

  return <AnimatedCard className="p-6">{body}</AnimatedCard>;
}
