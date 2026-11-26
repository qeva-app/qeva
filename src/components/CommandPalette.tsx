'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, KeyRound, Wand2, Import, Server, Settings, BarChart3,
  FileText, Shield, Users, ShieldCheck, Plus, Crown,
  Moon, Sun, LogOut, User, Lock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import type { FeatureAccess } from '@/lib/feature-access';

interface CredHit {
  id: string;
  title: string;
  username?: string | null;
  website?: string | null;
  isGlobal?: boolean;
  isTeam?: boolean;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<CredHit[]>([]);
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const { setTheme, theme } = useTheme();
  const isAdmin = session?.user?.role === 'ADMIN' || isSuperAdmin;
  const isOrgUser = (session?.user as { accountType?: string } | undefined)?.accountType === 'ORGANIZATION';

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/passwords')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCreds(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCreds([]);
      });
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.access) setAccess(data.access);
        setIsSuperAdmin(!!data.isSuperAdmin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const openCred = (c: CredHit) => {
    const tab = c.isGlobal ? 'global' : c.isTeam ? 'teams' : 'personal';
    router.push(`/vault?tab=${tab}&id=${encodeURIComponent(c.id)}`);
  };

  const orgLocked = !!access?.isPendingApproval;
  const can = (key: keyof FeatureAccess) => (access ? !!access[key] : !orgLocked);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search vault or jump to a page…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {creds.length > 0 && (
          <CommandGroup heading="Credentials">
            {creds.slice(0, 40).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.title} ${c.username || ''} ${c.website || ''}`}
                onSelect={() => runCommand(() => openCred(c))}
              >
                <KeyRound className="mr-2 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {c.username && (
                  <span className="ml-2 truncate text-xs text-muted-foreground">{c.username}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push('/vault?action=add'))}>
            <Plus className="mr-2 h-4 w-4" />
            New Password
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/generator'))}>
            <Wand2 className="mr-2 h-4 w-4" />
            Generate Password
          </CommandItem>
          {can('canAccessSecurityScan') ? (
            <CommandItem onSelect={() => runCommand(() => router.push('/security'))}>
              <Shield className="mr-2 h-4 w-4" />
              Security Scan
            </CommandItem>
          ) : isOrgUser ? (
            <CommandItem disabled value="security-locked">
              <Lock className="mr-2 h-4 w-4" />
              Security Scan — unlocks after approval
            </CommandItem>
          ) : null}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/vault'))}>
            <KeyRound className="mr-2 h-4 w-4" />
            Password Vault
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          {isOrgUser && (
            can('canAccessTeams') ? (
              <CommandItem onSelect={() => runCommand(() => router.push('/teams'))}>
                <Users className="mr-2 h-4 w-4" />
                Teams
              </CommandItem>
            ) : (
              <CommandItem disabled value="teams-locked">
                <Lock className="mr-2 h-4 w-4" />
                Teams — unlocks after approval
              </CommandItem>
            )
          )}
          {isOrgUser && (
            can('canAccessServices') ? (
              <CommandItem onSelect={() => runCommand(() => router.push('/services'))}>
                <Server className="mr-2 h-4 w-4" />
                Services
              </CommandItem>
            ) : (
              <CommandItem disabled value="services-locked">
                <Lock className="mr-2 h-4 w-4" />
                Services — unlocks after approval
              </CommandItem>
            )
          )}
          <CommandItem onSelect={() => runCommand(() => router.push('/import'))}>
            <Import className="mr-2 h-4 w-4" />
            Import Passwords
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              {(
                [
                  { href: '/analytics', label: 'Analytics', icon: BarChart3, key: 'canAccessAnalytics' as const },
                  { href: '/reports', label: 'Reports', icon: FileText, key: 'canAccessReports' as const },
                  { href: '/users', label: 'User Management', icon: Users, key: 'canAccessUsers' as const },
                  { href: '/rbac', label: 'Roles & Permissions', icon: ShieldCheck, key: 'canAccessRBAC' as const },
                ] as const
              ).map((item) =>
                can(item.key) ? (
                  <CommandItem key={item.href} onSelect={() => runCommand(() => router.push(item.href))}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                ) : (
                  <CommandItem key={item.href} disabled value={`${item.href}-locked`}>
                    <Lock className="mr-2 h-4 w-4" />
                    {item.label} — unlocks after approval
                  </CommandItem>
                )
              )}
            </CommandGroup>
          </>
        )}

        {isSuperAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Platform">
              <CommandItem onSelect={() => runCommand(() => router.push('/super-admin'))}>
                <Crown className="mr-2 h-4 w-4" />
                Super Admin
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/profile'))}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => signOut({ callbackUrl: '/auth/signin' }))}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
