'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Lock, Globe, Users, ArrowLeft, Eye, EyeOff, Copy,
  ExternalLink, ChevronDown, Star,
} from 'lucide-react';
import PasswordList from '@/components/PasswordList';
import AddPasswordModal from '@/components/AddPasswordModal';
import EditPasswordModal from '@/components/EditPasswordModal';
import { toast } from 'sonner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { copyWithAutoClear, toastCopied } from '@/lib/clipboard';
import { fetchPasswordSecret } from '@/lib/fetch-password-secret';
import { needsRotation } from '@/lib/rotation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageShell, PageHeader, PageBlock } from '@/components/PageShell';
import ShareLinkDialog from '@/components/ShareLinkDialog';
import type { FeatureAccess } from '@/lib/feature-access';

function VaultSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function matchesSearch(p: Record<string, unknown>, s: string) {
  const haystack = [
    p.title,
    p.username,
    p.website,
    p.tags,
    p.notes,
    p.label,
    p.category,
    (p.team as { name?: string } | null)?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(s);
}

export default function PasswordVault() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const canAccessGlobalVault = !!access?.canAccessGlobalVault;
  const canAccessTeams = !!access?.canAccessTeams;
  const [passwords, setPasswords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [favoritesOnly, setFavoritesOnly] = useState(searchParams.get('favorites') === '1');
  const [expiringOnly, setExpiringOnly] = useState(
    searchParams.get('filter') === 'expiring' || searchParams.get('filter') === 'expired'
  );
  const [expiryWarningDays, setExpiryWarningDays] = useState(14);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<string>(searchParams.get('tab') || 'personal');
  const [showAdd, setShowAdd] = useState(searchParams.get('action') === 'add');
  const [addTeamId, setAddTeamId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(searchParams.get('id'));
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamPasswords, setTeamPasswords] = useState<any[]>([]);
  const [loadingTeamPw, setLoadingTeamPw] = useState(false);
  const [expandedTeamCards, setExpandedTeamCards] = useState<Set<string>>(new Set());
  const [revealedTeamPw, setRevealedTeamPw] = useState<Set<string>>(new Set());
  const [teamSecrets, setTeamSecrets] = useState<Record<string, string>>({});

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!access) return;
    if (
      (tab === 'global' && !access.canAccessGlobalVault) ||
      (tab === 'teams' && !access.canAccessTeams)
    ) {
      setTab('personal');
      setSelectedTeam(null);
      setTeamPasswords([]);
    }
  }, [access, tab]);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== tab) setTab(urlTab);
    if (searchParams.get('action') === 'add') setShowAdd(true);
    const filter = searchParams.get('filter');
    setExpiringOnly(filter === 'expiring' || filter === 'expired');
    const q = searchParams.get('search');
    if (q != null) setSearch(q);
    const cat = searchParams.get('category');
    if (cat != null) setCategory(cat);
    setFavoritesOnly(searchParams.get('favorites') === '1');
    const id = searchParams.get('id');
    setHighlightId(id);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep filters shareable via URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab && tab !== 'personal') params.set('tab', tab);
    if (search.trim()) params.set('search', search.trim());
    if (category && category !== 'all') params.set('category', category);
    if (favoritesOnly) params.set('favorites', '1');
    if (expiringOnly) params.set('filter', 'expiring');
    if (highlightId) params.set('id', highlightId);
    if (showAdd) params.set('action', 'add');
    const next = params.toString();
    const current = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
    if (next === current) return;
    const t = window.setTimeout(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, search.trim() ? 250 : 0);
    return () => window.clearTimeout(t);
    // shortcut: compare against window.location to avoid replace↔read loops
  }, [tab, search, category, favoritesOnly, expiringOnly, highlightId, showAdd, pathname, router]);

  // Deep-link: switch tab and scroll to credential
  useEffect(() => {
    if (!highlightId || passwords.length === 0) return;
    const pw = passwords.find((p) => p.id === highlightId);
    if (!pw) return;
    if (pw.isGlobal && canAccessGlobalVault) setTab('global');
    else if (pw.isTeam && canAccessTeams) setTab('teams');
    else setTab('personal');
    requestAnimationFrame(() => {
      document.getElementById(`pw-${highlightId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, [highlightId, passwords, canAccessGlobalVault, canAccessTeams]);

  useEffect(() => {
    fetch('/api/organization/password-policy')
      .then((r) => r.json())
      .then((d) => {
        if (d.policy?.expiryWarningDays) setExpiryWarningDays(d.policy.expiryWarningDays);
      })
      .catch(() => {});
  }, []);

  const fetchPasswords = () => {
    setLoading(true);
    fetch('/api/passwords')
      .then((r) => r.json())
      .then((data) => {
        setPasswords(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const refreshTeamPasswords = async (teamId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/passwords`);
      const data = await res.json();
      setTeamPasswords(Array.isArray(data) ? data : []);
    } catch {
      setTeamPasswords([]);
    }
  };

  useEffect(() => {
    fetchPasswords();
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canAccessTeams) {
      setUserTeams([]);
      return;
    }
    fetch('/api/teams')
      .then((r) => r.json())
      .then((data) => setUserTeams(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canAccessTeams]);

  const openTeamPasswords = async (team: any) => {
    setSelectedTeam(team);
    setLoadingTeamPw(true);
    setExpandedTeamCards(new Set());
    setRevealedTeamPw(new Set());
    await refreshTeamPasswords(team.id);
    setLoadingTeamPw(false);
  };

  const toggleTeamCard = (id: string) => {
    setExpandedTeamCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ensureTeamSecret = async (id: string, fallback?: string) => {
    if (teamSecrets[id]) return teamSecrets[id];
    if (fallback) {
      setTeamSecrets((prev) => ({ ...prev, [id]: fallback }));
      return fallback;
    }
    const { password } = await fetchPasswordSecret(id);
    setTeamSecrets((prev) => ({ ...prev, [id]: password }));
    return password;
  };

  const toggleTeamPwReveal = async (pw: { id: string; decryptedPassword?: string }) => {
    if (revealedTeamPw.has(pw.id)) {
      setRevealedTeamPw((prev) => {
        const next = new Set(prev);
        next.delete(pw.id);
        return next;
      });
      return;
    }
    try {
      await ensureTeamSecret(pw.id, pw.decryptedPassword || undefined);
      setRevealedTeamPw((prev) => new Set(prev).add(pw.id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reveal password');
    }
  };

  const copyText = async (text: string, label: string, secret = false) => {
    try {
      if (secret) await copyWithAutoClear(text);
      else await navigator.clipboard.writeText(text);
      toastCopied(label, { secret });
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/passwords/${deleteId}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Password deleted');
      fetchPasswords();
      if (selectedTeam) await refreshTeamPasswords(selectedTeam.id);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Failed to delete');
    }
    setDeleteId(null);
  };

  const handleFavorite = (id: string, next: boolean) => {
    setPasswords((prev) => prev.map((p) => (p.id === id ? { ...p, isFavorite: next } : p)));
    setTeamPasswords((prev) => prev.map((p) => (p.id === id ? { ...p, isFavorite: next } : p)));
  };

  const openAdd = (teamId?: string | null) => {
    setAddTeamId(teamId || null);
    setShowAdd(true);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return passwords
      .filter((p) => {
        if (highlightId && p.id === highlightId) return true;
        if (tab === 'personal') return !p.isGlobal && !p.isTeam;
        if (tab === 'global') return p.isGlobal;
        if (tab === 'teams') return p.isTeam;
        return true;
      })
      .filter((p) => highlightId === p.id || !favoritesOnly || p.isFavorite)
      .filter(
        (p) =>
          highlightId === p.id ||
          !expiringOnly ||
          needsRotation(p.expiryDate, { expiryWarningDays })
      )
      .filter((p) => highlightId === p.id || !s || matchesSearch(p, s))
      .filter(
        (p) =>
          highlightId === p.id || category === 'all' || !category || p.category === category
      )
      .sort((a, b) => {
        if (highlightId) {
          if (a.id === highlightId) return -1;
          if (b.id === highlightId) return 1;
        }
        if (!!b.isFavorite !== !!a.isFavorite) return a.isFavorite ? -1 : 1;
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [
    passwords,
    tab,
    search,
    category,
    favoritesOnly,
    expiringOnly,
    expiryWarningDays,
    highlightId,
  ]);

  const filteredTeamPasswords = useMemo(() => {
    const s = search.trim().toLowerCase();
    return teamPasswords
      .filter((p) => !favoritesOnly || p.isFavorite)
      .filter((p) => !s || matchesSearch(p, s))
      .filter((p) => category === 'all' || !category || p.category === category);
  }, [teamPasswords, search, category, favoritesOnly]);

  return (
    <PageShell>
      <PageHeader
        title="Password Vault"
        description={
          tab === 'teams' && !selectedTeam
            ? `${userTeams.length} teams — pick one to browse shared credentials`
            : `${tab === 'teams' ? filteredTeamPasswords.length : filtered.length} credentials`
        }
        actions={
          <Button onClick={() => openAdd(selectedTeam?.id)}>
            <Plus size={16} className="mr-1" aria-hidden="true" /> Add Password
          </Button>
        }
      />

      <PageBlock>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v);
                setSelectedTeam(null);
                setTeamPasswords([]);
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="personal" className="text-xs h-7 gap-1.5">
                  <Lock size={12} /> Personal
                </TabsTrigger>
                {canAccessGlobalVault && (
                  <TabsTrigger value="global" className="text-xs h-7 gap-1.5">
                    <Globe size={12} /> Global
                  </TabsTrigger>
                )}
                {canAccessTeams && (
                  <TabsTrigger value="teams" className="text-xs h-7 gap-1.5">
                    <Users size={12} /> Teams
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            {(tab !== 'teams' || selectedTeam) && (
              <>
                <div className="relative flex-1 w-full sm:w-auto">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, user, site, tags..."
                    className="pl-9 h-8"
                    aria-label="Search passwords"
                  />
                </div>

                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant={favoritesOnly ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setFavoritesOnly((v) => !v)}
                  aria-pressed={favoritesOnly}
                >
                  <Star size={12} fill={favoritesOnly ? 'currentColor' : 'none'} />
                  Favorites
                </Button>
                <Button
                  type="button"
                  variant={expiringOnly ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setExpiringOnly((v) => !v)}
                  aria-pressed={expiringOnly}
                >
                  Expiring
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      </PageBlock>

      {loading ? (
        <VaultSkeleton />
      ) : tab === 'teams' ? (
        selectedTeam ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setSelectedTeam(null); setTeamPasswords([]); }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Back to teams"
              >
                <ArrowLeft size={18} />
              </button>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                style={{ backgroundColor: selectedTeam.color || 'hsl(var(--primary))' }}
              >
                {selectedTeam.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-foreground">{selectedTeam.name}</h2>
                <p className="text-xs text-muted-foreground">{filteredTeamPasswords.length} credentials</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAdd(selectedTeam.id)}>
                <Plus size={14} className="mr-1" /> Add to team
              </Button>
            </div>

            {loadingTeamPw ? (
              <VaultSkeleton />
            ) : filteredTeamPasswords.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Lock size={36} className="mx-auto mb-3 text-muted-foreground/20" />
                <p className="font-medium text-foreground">No credentials in this team</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Add a shared password for this team
                </p>
                <Button size="sm" onClick={() => openAdd(selectedTeam.id)}>
                  <Plus size={14} className="mr-1" /> Add Password
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
                {filteredTeamPasswords.map((pw) => {
                  const isExp = expandedTeamCards.has(pw.id);
                  const isRev = revealedTeamPw.has(pw.id);
                  const str = pw.strength || 0;
                  const bar =
                    str >= 70 ? 'bg-success' : str >= 40 ? 'bg-warning' : 'bg-destructive';
                  return (
                    <div
                      key={pw.id}
                      className="overflow-hidden rounded-xl border border-border bg-card transition-[box-shadow,border-color] hover:shadow-md"
                      style={{
                        borderTopColor: pw.color || selectedTeam.color || 'hsl(var(--primary))',
                        borderTopWidth: '2px',
                      }}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 flex items-center gap-3 select-none hover:bg-muted/30 transition-colors"
                        onClick={() => toggleTeamCard(pw.id)}
                        aria-expanded={isExp}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: pw.color || selectedTeam.color || 'hsl(var(--primary))' }}
                        >
                          {pw.title?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm truncate">{pw.title}</h3>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {pw.username}{pw.category ? `, ${pw.category}` : ''}
                          </p>
                        </div>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary-foreground shrink-0 ${bar}`}>
                          {str}%
                        </div>
                        <ChevronDown
                          size={14}
                          className={`text-muted-foreground transition-transform duration-200 shrink-0 ${isExp ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <div className="motion-collapse" data-open={isExp ? 'true' : undefined}>
                        <div className="motion-collapse-inner">
                          <div className="border-t border-border divide-y divide-border">
                            {pw.username && (
                              <button
                                type="button"
                                className="w-full px-4 py-2.5 flex items-center justify-between group hover:bg-muted/50 transition-colors text-left"
                                onClick={() => copyText(pw.username, 'Username')}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground">Username</p>
                                  <p className="text-sm text-foreground font-mono truncate mt-0.5">{pw.username}</p>
                                </div>
                                <Copy size={13} className="text-muted-foreground/0 group-hover:text-foreground transition-colors shrink-0" />
                              </button>
                            )}
                            <div className="px-4 py-2.5 flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground">Password</p>
                                <p className="text-sm font-mono mt-0.5">
                                  {isRev ? (
                                    <span className="motion-fade text-foreground select-all">
                                      {teamSecrets[pw.id] || pw.decryptedPassword || '••••••••'}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground tracking-widest">••••••••••••</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleTeamPwReveal(pw)}
                                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                                  aria-label={isRev ? 'Hide password' : 'Show password'}
                                >
                                  {isRev ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const secret = await ensureTeamSecret(
                                        pw.id,
                                        pw.decryptedPassword || undefined
                                      );
                                      await copyText(secret || '', 'Password', true);
                                    } catch (e: unknown) {
                                      toast.error(
                                        e instanceof Error ? e.message : 'Failed to copy'
                                      );
                                    }
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                                  aria-label="Copy password"
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            </div>
                            {pw.website && (
                              <button
                                type="button"
                                className="w-full px-4 py-2.5 flex items-center justify-between group hover:bg-muted/50 transition-colors text-left"
                                onClick={() => window.open(pw.website, '_blank', 'noopener,noreferrer')}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground">Website</p>
                                  <p className="text-sm text-primary truncate mt-0.5">
                                    {pw.website.replace(/^https?:\/\//, '')}
                                  </p>
                                </div>
                                <ExternalLink size={13} className="text-muted-foreground/0 group-hover:text-foreground transition-colors shrink-0" />
                              </button>
                            )}
                          </div>
                          <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center gap-2">
                            <div className="h-1 flex-1 bg-border rounded-full overflow-hidden">
                              <div
                                className={`motion-bar h-full rounded-full ${bar}`}
                                style={{ width: isExp ? `${str}%` : '0%' }}
                              />
                            </div>
                            {pw.permissions?.canEdit && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setEditId(pw.id)}
                              >
                                Edit
                              </button>
                            )}
                            {pw.permissions?.canDelete && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(pw.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {userTeams.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <Users size={36} className="mx-auto mb-3 text-muted-foreground/20" />
                <p className="font-medium text-foreground">No teams yet</p>
                <p className="text-sm text-muted-foreground mt-1">You&apos;re not a member of any team</p>
              </div>
            ) : (
              userTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => openTeamPasswords(team)}
                  className="group cursor-pointer rounded-xl border border-border bg-card p-5 text-left transition-[box-shadow,border-color] hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                      style={{ backgroundColor: team.color || 'hsl(var(--primary))' }}
                    >
                      {team.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {team.name}
                      </h3>
                      {team.description && (
                        <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {team.memberCount ?? '—'} members
                    </span>
                    <span className="flex items-center gap-1">
                      <Lock size={12} /> {team.passwordCount ?? '—'} passwords
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )
      ) : (
        <PasswordList
          passwords={filtered}
          onEdit={setEditId}
          onDelete={(id) => setDeleteId(id)}
          onFavorite={handleFavorite}
          onRotate={setRotateId}
          onShare={(id, title) => setShareTarget({ id, title })}
          onAdd={() => openAdd()}
          expiryWarningDays={expiryWarningDays}
          highlightId={highlightId}
          emptyTitle={search || favoritesOnly || expiringOnly || category !== 'all' ? 'No matches' : 'Vault is empty'}
          emptyDescription={
            search || favoritesOnly || expiringOnly || category !== 'all'
              ? 'Try clearing filters or search.'
              : 'Add your first credential — generate a strong password in one step.'
          }
        />
      )}

      <ShareLinkDialog
        open={!!shareTarget}
        onOpenChange={(open) => !open && setShareTarget(null)}
        passwordId={shareTarget?.id || null}
        passwordTitle={shareTarget?.title}
      />

      <AddPasswordModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setAddTeamId(null); }}
        onSuccess={(created) => {
          fetchPasswords();
          if (selectedTeam) refreshTeamPasswords(selectedTeam.id);
          window.dispatchEvent(new Event('qeva:workflows-updated'));
          if (created?.id) {
            if (created.isGlobal) setTab('global');
            else if (created.isTeam && !selectedTeam) setTab('teams');
            else if (!created.isTeam) setTab('personal');
            setHighlightId(created.id);
          }
          setShowAdd(false);
          setAddTeamId(null);
          toast.success('Password saved', {
            action: {
              label: 'Add another',
              onClick: () => openAdd(selectedTeam?.id),
            },
          });
        }}
        defaultTeamId={addTeamId || selectedTeam?.id || null}
        defaultScope={addTeamId || selectedTeam ? 'team' : tab === 'global' ? 'global' : 'personal'}
      />

      <Button
        type="button"
        size="lg"
        className="fixed bottom-5 right-5 z-30 h-12 rounded-full px-5 shadow-md md:hidden mb-[env(safe-area-inset-bottom)] mr-[env(safe-area-inset-right)]"
        onClick={() => openAdd(selectedTeam?.id)}
      >
        <Plus size={18} className="mr-1" aria-hidden="true" />
        Add
      </Button>
      <EditPasswordModal
        isOpen={!!editId || !!rotateId}
        passwordId={editId || rotateId}
        rotateOnOpen={!!rotateId}
        onClose={() => { setEditId(null); setRotateId(null); }}
        onSuccess={() => {
          fetchPasswords();
          if (selectedTeam) refreshTeamPasswords(selectedTeam.id);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Password</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this password? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
