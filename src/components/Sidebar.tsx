'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, KeyRound, Wand2, Import, Server, Settings, BarChart3,
  FileText, Shield, Users, ChevronLeft, ChevronRight,
  ShieldCheck, HeartPulse, ChevronDown, ListChecks, Lock, Crown, BookOpen, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSidebar } from '@/contexts/SidebarContext';
import { QevaWordmark } from '@/components/auth/AuthShowcase';
import { UserAvatar } from '@/components/UserAvatar';
import type { FeatureAccess } from '@/lib/feature-access';

type AccessKey = keyof FeatureAccess;

interface NavChild {
  label: string;
  href: string;
  orgOnly?: boolean;
  requires?: AccessKey;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
  orgOnly?: boolean;
  superAdminOnly?: boolean;
  requires?: AccessKey;
  children?: NavChild[];
}

interface NavSection {
  label: string;
  adminOnly?: boolean;
  orgOnly?: boolean;
  superAdminOnly?: boolean;
  items: NavItem[];
}

const LOCK_HINT = 'Unlocks after approval';

const navSections: NavSection[] = [
  {
    label: 'Vault',
    items: [
      {
        label: 'Password Vault', href: '/vault', icon: <KeyRound size={20} />,
        children: [
          { label: 'Personal', href: '/vault?tab=personal' },
          { label: 'Global', href: '/vault?tab=global', orgOnly: true, requires: 'canAccessGlobalVault' },
          { label: 'Teams', href: '/vault?tab=teams', orgOnly: true, requires: 'canAccessTeams' },
        ],
      },
      { label: 'Generator', href: '/generator', icon: <Wand2 size={20} /> },
      { label: 'Password Health', href: '/health', icon: <HeartPulse size={20} /> },
      { label: 'Import', href: '/import', icon: <Import size={20} /> },
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
      { label: 'Settings', href: '/settings', icon: <Settings size={20} /> },
      { label: 'Audit trail', href: '/audit', icon: <History size={20} /> },
      { label: 'Documentation', href: '/docs', icon: <BookOpen size={20} /> },
    ],
  },
  {
    label: 'Workspace',
    orgOnly: true,
    items: [
      {
        label: 'Workflows',
        href: '/workflows',
        icon: <ListChecks size={20} />,
        orgOnly: true,
      },
      { label: 'Teams', href: '/teams', icon: <Users size={20} />, orgOnly: true, requires: 'canAccessTeams' },
      { label: 'Services', href: '/services', icon: <Server size={20} />, orgOnly: true, requires: 'canAccessServices' },
      { label: 'Security Scan', href: '/security', icon: <Shield size={20} />, requires: 'canAccessSecurityScan' },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    orgOnly: true,
    items: [
      { label: 'Analytics', href: '/analytics', icon: <BarChart3 size={20} />, adminOnly: true, requires: 'canAccessAnalytics' },
      { label: 'Reports', href: '/reports', icon: <FileText size={20} />, adminOnly: true, requires: 'canAccessReports' },
      { label: 'Users', href: '/users', icon: <Users size={20} />, adminOnly: true, requires: 'canAccessUsers' },
      { label: 'Roles & Permissions', href: '/rbac', icon: <ShieldCheck size={20} />, adminOnly: true, requires: 'canAccessRBAC' },
    ],
  },
  {
    label: 'Platform',
    superAdminOnly: true,
    items: [
      { label: 'Super Admin', href: '/super-admin', icon: <Crown size={20} />, superAdminOnly: true },
    ],
  },
];

function isLocked(requires: AccessKey | undefined, access: FeatureAccess | null) {
  if (!requires || !access) return false;
  return !access[requires];
}

function SidebarChrome({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className
      )}
    >
      <div className="relative z-10 flex h-16 shrink-0 items-center justify-center px-4">
        {collapsed ? (
          <span className="font-display text-2xl font-bold tracking-tight text-white">
            q<span className="text-emerald-400">.</span>
          </span>
        ) : (
          <QevaWordmark onDark className="scale-95" />
        )}
      </div>
      <div className="relative z-10 mx-4 h-px bg-sidebar-border" />
      {children}
    </aside>
  );
}

export default function Sidebar() {
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyAccounts, setCompanyAccounts] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === 'ADMIN' || isSuperAdmin;
  // Prefer /api/me access flags (Community forces isOrgUser=false).
  const isOrgUser = access?.isOrgUser ?? false;
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.access) setAccess(data.access);
        setIsSuperAdmin(!!data.isSuperAdmin);
        setCompanyAccounts(data.edition?.edition === 'enterprise');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const nav = (opts: { collapsed: boolean; onNavigate?: () => void }) => (
    <>
      <ScrollArea className="relative z-10 flex-1 py-3">
        <nav className="space-y-4 px-2.5">
          {navSections.map((section) => {
            if (section.superAdminOnly && (!isSuperAdmin || !companyAccounts)) return null;
            if (section.adminOnly && !isAdmin) return null;
            if (section.orgOnly && !isOrgUser) return null;
            const items = section.items.filter((item) => {
              if (item.superAdminOnly && (!isSuperAdmin || !companyAccounts)) return false;
              if (item.adminOnly && !isAdmin) return false;
              if (item.orgOnly && !isOrgUser) return false;
              return true;
            });
            if (items.length === 0) return null;

            const isAdminSection = section.label === 'Admin';
            const isVaultSection = section.label === 'Vault';

            return (
              <div key={section.label} className={cn(isAdminSection && 'opacity-65')}>
                {!opts.collapsed && (
                  <div className="mb-2 px-3">
                    <span
                      className={cn(
                        'text-xs font-semibold tracking-wide uppercase',
                        isVaultSection ? 'text-sidebar-foreground/60' : 'text-sidebar-foreground/45'
                      )}
                    >
                      {section.label}
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const itemPath = item.href.split('?')[0];
                    const isActive =
                      pathname === itemPath ||
                      (itemPath !== '/' && pathname.startsWith(itemPath));
                    const isExpanded = expandedItem === item.label || (isActive && !!item.children);
                    const locked = isLocked(item.requires, access);

                    const linkClass = cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-[background-color,color,box-shadow] duration-200',
                      locked && 'cursor-not-allowed opacity-45',
                      !locked && isActive
                        ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                        : !locked && 'text-sidebar-foreground/75 hover:bg-white/[0.04] hover:text-white',
                      isAdminSection && !isActive && !locked && 'text-sidebar-foreground/55'
                    );

                    const inner = (
                      <>
                        <span
                          className={cn(
                            'shrink-0 transition-colors',
                            locked
                              ? 'text-sidebar-foreground/35'
                              : isActive
                                ? 'text-sidebar-primary'
                                : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80'
                          )}
                        >
                          {item.icon}
                        </span>
                        {!opts.collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {locked ? (
                              <Lock size={12} className="text-sidebar-foreground/35" aria-hidden="true" />
                            ) : (
                              item.children && (
                                <ChevronDown
                                  size={14}
                                  className={cn(
                                    'text-sidebar-foreground/35 transition-transform duration-200',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              )
                            )}
                          </>
                        )}
                        {isActive && !locked && (
                          <span className="absolute left-0 h-5 w-0.5 rounded-r bg-sidebar-primary" />
                        )}
                      </>
                    );

                    const navLink = locked ? (
                      <button
                        type="button"
                        className={cn(linkClass, 'relative w-full text-left')}
                        aria-disabled="true"
                        title={LOCK_HINT}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={(e) => {
                          if (item.children && !opts.collapsed) {
                            if (isActive) e.preventDefault();
                            setExpandedItem(isExpanded && expandedItem === item.label ? null : item.label);
                          }
                          opts.onNavigate?.();
                        }}
                        className={cn(linkClass, 'relative')}
                      >
                        {inner}
                      </Link>
                    );

                    return (
                      <div key={item.label} className="relative">
                        {opts.collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                            <TooltipContent side="right">
                              {locked ? `${item.label} - ${LOCK_HINT}` : item.label}
                            </TooltipContent>
                          </Tooltip>
                        ) : locked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                            <TooltipContent side="right">{LOCK_HINT}</TooltipContent>
                          </Tooltip>
                        ) : (
                          navLink
                        )}

                        {!opts.collapsed && item.children && !locked && (
                          <div
                            className="motion-collapse"
                            data-open={isExpanded ? 'true' : undefined}
                          >
                            <div className="motion-collapse-inner">
                              <div className="mb-1 ml-[26px] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                                {item.children
                                  .filter((child) => !child.orgOnly || isOrgUser)
                                  .map((child) => {
                                    const childLocked = isLocked(child.requires, access);
                                    if (childLocked) {
                                      return (
                                        <Tooltip key={child.label}>
                                          <TooltipTrigger asChild>
                                            <span className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/35">
                                              {child.label}
                                              <Lock size={10} aria-hidden="true" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="right">{LOCK_HINT}</TooltipContent>
                                        </Tooltip>
                                      );
                                    }
                                    return (
                                      <Link
                                        key={child.label}
                                        href={child.href}
                                        onClick={() => opts.onNavigate?.()}
                                        className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground/55 transition-colors hover:text-white"
                                      >
                                        {child.label}
                                      </Link>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="relative z-10 mx-4 h-px bg-sidebar-border" />

      {session?.user && (
        <div className={cn('relative z-10 shrink-0', opts.collapsed ? 'p-2.5' : 'p-3')}>
          {opts.collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/profile"
                  onClick={() => opts.onNavigate?.()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
                >
                  <UserAvatar
                    image={session.user.image}
                    name={session.user.name}
                    className="h-8 w-8"
                    fallbackClassName="bg-sidebar-primary/20 text-sidebar-primary"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {session.user.name} ({(session.user as { role?: string }).role})
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/profile"
              onClick={() => opts.onNavigate?.()}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.05]"
            >
              <UserAvatar
                image={session.user.image}
                name={session.user.name}
                className="h-9 w-9 shrink-0 ring-1 ring-sidebar-primary/30"
                fallbackClassName="bg-sidebar-primary/20 text-sidebar-primary"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">{session.user.name}</p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/45">
                  {(session.user as { role?: string }).role?.toLowerCase()}
                </p>
              </div>
            </Link>
          )}
        </div>
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop */}
      <div
        className={cn(
          'fixed left-0 top-0 z-30 hidden h-screen transition-[width] duration-300 ease-out md:block',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        <SidebarChrome collapsed={collapsed}>{nav({ collapsed })}</SidebarChrome>
        <button
          type="button"
          onClick={toggle}
          className="absolute -right-3 top-[4.5rem] z-40 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-md transition-colors hover:bg-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={14} className="text-foreground" />
          ) : (
            <ChevronLeft size={14} className="text-foreground" />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarChrome collapsed={false}>
            {nav({ collapsed: false, onNavigate: () => setMobileOpen(false) })}
          </SidebarChrome>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
