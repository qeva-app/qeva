'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Search, Lock, Globe, Trash2, X, ArrowLeft, Eye, EyeOff, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { toast } from 'sonner';
import { fetchPasswordSecret } from '@/lib/fetch-password-secret';
import { copyWithAutoClear, toastCopied } from '@/lib/clipboard';

export default function TeamManagement() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', isPrivate: false, color: '#3b82f6' });
  const [creating, setCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamPasswords, setTeamPasswords] = useState<any[]>([]);
  const [loadingPasswords, setLoadingPasswords] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [detailTab, setDetailTab] = useState<'members' | 'passwords'>('members');
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('MEMBER');
  const [addingMember, setAddingMember] = useState(false);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [showAddTeamPw, setShowAddTeamPw] = useState(false);
  const [teamPwForm, setTeamPwForm] = useState({ title: '', username: '', password: '', website: '', category: '' });
  const [savingTeamPw, setSavingTeamPw] = useState(false);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const openTeam = async (team: any, tab: 'members' | 'passwords' = 'members') => {
    setSelectedTeam(team);
    setDetailTab(tab);
    setExpandedCards(new Set());
    setRevealedPasswords(new Set());

    setLoadingMembers(true);
    setLoadingPasswords(true);

    // Fetch members + passwords + org users in parallel
    const [membersRes, pwRes, usersRes] = await Promise.all([
      fetch(`/api/teams/${team.id}/members`).then(r => r.json()).catch(() => []),
      fetch(`/api/teams/${team.id}/passwords`).then(r => r.json()).catch(() => []),
      fetch('/api/users').then(r => r.json()).catch(() => []),
    ]);
    setTeamMembers(Array.isArray(membersRes) ? membersRes : []);
    setTeamPasswords(Array.isArray(pwRes) ? pwRes : []);
    setOrgUsers(Array.isArray(usersRes) ? usersRes : []);
    setLoadingMembers(false);
    setLoadingPasswords(false);
  };

  const handleAddMember = async (userId: string) => {
    setAddingMember(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: addMemberRole }),
      });
      if (res.ok) {
        toast.success('Member added');
        const data = await fetch(`/api/teams/${selectedTeam.id}/members`).then(r => r.json());
        setTeamMembers(Array.isArray(data) ? data : []);
        setAddMemberEmail('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add member');
      }
    } catch {
      toast.error('Failed to add member');
    }
    setAddingMember(false);
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this team?`)) return;
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/members?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Member removed');
        setTeamMembers((prev) => prev.filter((m) => m.userId !== userId));
      } else {
        toast.error('Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleAddTeamPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamPwForm.title || !teamPwForm.password) {
      toast.error('Title and password are required');
      return;
    }
    setSavingTeamPw(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/passwords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamPwForm),
      });
      if (res.ok) {
        toast.success('Password added to team');
        setTeamPwForm({ title: '', username: '', password: '', website: '', category: '' });
        setShowAddTeamPw(false);
        // Refresh team passwords
        const data = await fetch(`/api/teams/${selectedTeam.id}/passwords`).then(r => r.json());
        setTeamPasswords(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add password');
      }
    } catch {
      toast.error('Failed to add password');
    }
    setSavingTeamPw(false);
  };

  const ensureSecret = async (id: string, fallback?: string) => {
    if (secrets[id]) return secrets[id];
    if (fallback) {
      setSecrets((prev) => ({ ...prev, [id]: fallback }));
      return fallback;
    }
    const { password } = await fetchPasswordSecret(id);
    setSecrets((prev) => ({ ...prev, [id]: password }));
    return password;
  };

  const toggleReveal = async (pw: { id: string; decryptedPassword?: string }) => {
    if (revealedPasswords.has(pw.id)) {
      setRevealedPasswords((prev) => {
        const next = new Set(prev);
        next.delete(pw.id);
        return next;
      });
      return;
    }
    try {
      await ensureSecret(pw.id, pw.decryptedPassword || undefined);
      setRevealedPasswords((prev) => new Set(prev).add(pw.id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reveal password');
    }
  };

  const copyToClipboard = async (text: string, label: string, secret = false) => {
    try {
      if (secret) {
        await copyWithAutoClear(text);
        toastCopied(label, { secret: true });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const fetchTeams = () => {
    fetch('/api/teams')
      .then((r) => r.json())
      .then((data) => {
        setTeams(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchTeams(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Team created');
        setShowCreate(false);
        setForm({ name: '', description: '', isPrivate: false, color: '#3b82f6' });
        fetchTeams();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create team');
      }
    } catch {
      toast.error('Failed to create team');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team?')) return;
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Team deleted');
      fetchTeams();
    } else {
      toast.error('Failed to delete');
    }
  };

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner className="h-96" text="Loading teams..." />;

  // Team detail view
  if (selectedTeam) {
    const isOwnerOrAdmin = selectedTeam.role === 'OWNER' || selectedTeam.role === 'ADMIN';
    const existingMemberIds = new Set(teamMembers.map((m: any) => m.userId || m.user?.id));
    const availableUsers = orgUsers.filter((u: any) => !existingMemberIds.has(u.id));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedTeam(null); setTeamPasswords([]); setTeamMembers([]); }} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all">
            <ArrowLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg" style={{ backgroundColor: selectedTeam.color || '#6366f1' }}>
            {selectedTeam.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{selectedTeam.name}</h1>
            {selectedTeam.description && <p className="text-sm text-muted-foreground">{selectedTeam.description}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setDetailTab('members')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${detailTab === 'members' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users size={14} /> Members ({teamMembers.length})
          </button>
          <button
            onClick={() => setDetailTab('passwords')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${detailTab === 'passwords' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Lock size={14} /> Passwords ({teamPasswords.length})
          </button>
        </div>

        {/* Members Tab */}
        {detailTab === 'members' && (
          <div className="space-y-4">
            {/* Add Member */}
            {isOwnerOrAdmin && availableUsers.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Add Member</h3>
                <div className="flex gap-2">
                  <select
                    value={addMemberEmail}
                    onChange={(e) => setAddMemberEmail(e.target.value)}
                    className="select flex-1"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                    ))}
                  </select>
                  <select
                    value={addMemberRole}
                    onChange={(e) => setAddMemberRole(e.target.value)}
                    className="select w-32"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    onClick={() => addMemberEmail && handleAddMember(addMemberEmail)}
                    disabled={!addMemberEmail || addingMember}
                    className="btn-primary btn-sm"
                  >
                    {addingMember ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Member List */}
            {loadingMembers ? (
              <LoadingSpinner className="h-32" text="Loading members..." />
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <Users size={36} className="mx-auto mb-3 text-muted-foreground/20" />
                <p className="font-medium text-foreground">No members</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {teamMembers.map((member: any) => {
                  const user = member.user || member;
                  const memberName = user.name || user.email || 'Unknown';
                  const memberEmail = user.email || '';
                  const memberRole = member.role || 'MEMBER';
                  const memberId = member.userId || user.id;
                  const memberInitials = memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div key={memberId} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {memberInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{memberName}</p>
                        <p className="text-xs text-muted-foreground truncate">{memberEmail}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        memberRole === 'OWNER' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        memberRole === 'ADMIN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        memberRole === 'VIEWER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-muted text-muted-foreground'
                      }`}>{memberRole}</span>
                      {isOwnerOrAdmin && memberRole !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(memberId, memberName)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Remove member"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Passwords Tab */}
        {detailTab === 'passwords' && (
          <div className="space-y-4">
          {/* Add Password Button + Form */}
          {!showAddTeamPw ? (
            <button onClick={() => setShowAddTeamPw(true)} className="btn-primary btn-sm">
              <Plus size={14} /> Add Password
            </button>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Add Credential to {selectedTeam.name}</h3>
                  <p className="text-[11px] text-muted-foreground">This password will be visible to all team members</p>
                </div>
                <button onClick={() => setShowAddTeamPw(false)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"><X size={16} /></button>
              </div>
              <form onSubmit={handleAddTeamPassword} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Title *</label>
                    <input value={teamPwForm.title} onChange={(e) => setTeamPwForm(p => ({ ...p, title: e.target.value }))} className="input" placeholder="e.g. AWS Console" required />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input value={teamPwForm.username} onChange={(e) => setTeamPwForm(p => ({ ...p, username: e.target.value }))} className="input" placeholder="email or username" />
                  </div>
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input type="password" value={teamPwForm.password} onChange={(e) => setTeamPwForm(p => ({ ...p, password: e.target.value }))} className="input font-mono" required autoComplete="new-password" placeholder="Enter a secure password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Website</label>
                    <input value={teamPwForm.website} onChange={(e) => setTeamPwForm(p => ({ ...p, website: e.target.value }))} className="input" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <input value={teamPwForm.category} onChange={(e) => setTeamPwForm(p => ({ ...p, category: e.target.value }))} className="input" placeholder="e.g. Cloud Platforms" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={savingTeamPw} className="btn-primary btn-sm">
                    {savingTeamPw ? 'Saving...' : 'Save Credential'}
                  </button>
                  <button type="button" onClick={() => setShowAddTeamPw(false)} className="btn-ghost btn-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {loadingPasswords ? (
            <LoadingSpinner className="h-48" text="Loading passwords..." />
          ) : teamPasswords.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="font-medium text-foreground">No credentials yet</p>
              <p className="text-sm mt-1">Add passwords to this team from the Password Vault</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {teamPasswords.map((pw) => {
                const isRevealed = revealedPasswords.has(pw.id);
                const isExpanded = expandedCards.has(pw.id);
                const strengthPct = pw.strength || 0;
                const strengthColor = strengthPct >= 70 ? 'bg-emerald-500' : strengthPct >= 40 ? 'bg-amber-500' : 'bg-red-500';

                return (
                  <div key={pw.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-200">
                    {/* Card Header - clickable to expand/collapse */}
                    <div
                      className="px-5 py-4 flex items-center gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                      onClick={() => toggleCard(pw.id)}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: pw.color || selectedTeam.color || '#6366f1' }}
                      >
                        {pw.title?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{pw.title}</h3>
                        <p className="text-[11px] text-muted-foreground truncate">{pw.username}{pw.category ? `, ${pw.category}` : ''}</p>
                      </div>
                      {/* Strength pill */}
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${strengthPct >= 70 ? 'bg-emerald-500' : strengthPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}>
                        {strengthPct}%
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {/* Collapsible Fields */}
                    <div className="motion-collapse" data-open={isExpanded ? 'true' : undefined}>
                    <div className="motion-collapse-inner">
                    <div className="border-t border-border divide-y divide-border">
                      {/* Username */}
                      {pw.username && (
                        <div
                          className="px-5 py-3 flex items-center justify-between group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => copyToClipboard(pw.username, 'Username')}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">Username</p>
                            <p className="text-sm text-foreground font-mono truncate mt-0.5">{pw.username}</p>
                          </div>
                          <Copy size={14} className="text-muted-foreground/0 group-hover:text-foreground transition-colors shrink-0" />
                        </div>
                      )}

                      {/* Password */}
                      <div className="px-5 py-3 flex items-center justify-between group">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">Password</p>
                          <p className="text-sm font-mono mt-0.5 select-all">
                            {isRevealed ? (
                              <span className="motion-fade text-foreground">
                                {secrets[pw.id] || pw.decryptedPassword}
                              </span>
                            ) : (
                              <span className="text-muted-foreground tracking-widest">••••••••••••</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => toggleReveal(pw)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                            title={isRevealed ? 'Hide' : 'Reveal'}
                          >
                            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const secret = await ensureSecret(
                                  pw.id,
                                  pw.decryptedPassword || undefined
                                );
                                await copyToClipboard(secret, 'Password', true);
                              } catch (e: unknown) {
                                toast.error(
                                  e instanceof Error ? e.message : 'Failed to copy'
                                );
                              }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                            title="Copy password"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Website */}
                      {pw.website && (
                        <div
                          className="px-5 py-3 flex items-center justify-between group cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => window.open(pw.website, '_blank')}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">Website</p>
                            <p className="text-sm text-primary truncate mt-0.5">{pw.website.replace(/^https?:\/\//, '')}</p>
                          </div>
                          <ExternalLink size={14} className="text-muted-foreground/0 group-hover:text-foreground transition-colors shrink-0" />
                        </div>
                      )}
                    </div>

                    {/* Strength bar */}
                    <div className="px-5 py-2.5 bg-muted/30 border-t border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Strength</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">{strengthPct}%</span>
                      </div>
                      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                        <div
                          className={`motion-bar h-full rounded-full ${strengthColor}`}
                          style={{ width: isExpanded ? `${strengthPct}%` : '0%' }}
                        />
                      </div>
                    </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Teams & Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your teams and collaborative password sharing</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Create Team
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Teams</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teams.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium">My Teams</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teams.filter(t => t.role === 'OWNER' || t.role === 'ADMIN').length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium">Public Teams</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teams.filter(t => !t.isPrivate).length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground font-medium">Private Teams</p>
          <p className="text-2xl font-bold text-foreground mt-1">{teams.filter(t => t.isPrivate).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams..." className="input pl-9" />
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {filtered.map((team) => (
          <div key={team.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/15 transition-all">
            {/* Team Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                  style={{ backgroundColor: team.color || '#6366f1' }}
                >
                  {team.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{team.name}</h3>
                  {team.description && <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${team.isPrivate ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                {team.isPrivate ? <><Lock size={10} /> Private</> : <><Globe size={10} /> Public</>}
              </span>
            </div>

            {/* Role + stats */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  team.role === 'OWNER' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  team.role === 'ADMIN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  team.role === 'MEMBER' ? 'bg-muted text-muted-foreground' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>{team.role || 'MEMBER'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium text-foreground">{team.memberCount || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Passwords</span>
                <span className="font-medium text-foreground">{team.passwordCount || 0}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                onClick={() => openTeam(team, 'members')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                <Users size={13} /> Members
              </button>
              <button
                onClick={() => openTeam(team, 'passwords')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
              >
                <Lock size={13} /> Passwords
              </button>
              {(team.role === 'OWNER' || team.role === 'ADMIN') && (
                <button
                  onClick={() => handleDelete(team.id)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Delete team"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium text-foreground">No teams found</p>
          <p className="text-sm mt-1">Create your first team to start sharing passwords</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Create Team</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Team Name *</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="textarea" rows={3} />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))} className="rounded border-border text-primary" />
                  <span className="text-sm text-foreground">Private Team</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Color:</span>
                  <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
