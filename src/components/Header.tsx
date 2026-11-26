'use client';

import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Search, Bell, LogOut, ChevronRight, Home, User, Settings, Shield, Menu } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/contexts/SidebarContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/UserAvatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';

const pathLabels: Record<string, string> = {
  '/': 'Password Vault',
  '/dashboard': 'Dashboard',
  '/vault': 'Password Vault',
  '/generator': 'Password Generator',
  '/import': 'Import Passwords',
  '/services': 'Services',
  '/settings': 'Settings',
  '/audit': 'Audit trail',
  '/analytics': 'Analytics',
  '/reports': 'Reports',
  '/rbac': 'Roles & Permissions',
  '/security': 'Security Scan',
  '/teams': 'Teams',
  '/profile': 'Profile',
  '/compliance': 'Compliance',
  '/enterprise': 'Enterprise',
  '/super-admin': 'Super Admin',
  '/users': 'Users',
  '/ai': 'AI Recommendations',
  '/sso': 'SSO Configuration',
  '/encryption-recovery': 'Encryption Recovery',
  '/health': 'Password Health',
  '/onboarding': 'Workflows',
  '/workflows': 'Workflows',
};

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { setMobileOpen } = useSidebar();

  const currentLabel = pathLabels[pathname] || pathname.split('/').pop() || '';

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      <div className="flex items-center gap-2 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground md:hidden"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={18} aria-hidden="true" />
        </Button>
        <Link
          href="/vault"
          aria-label="Password Vault"
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
        >
          <Home size={15} aria-hidden="true" />
        </Link>
        {pathname !== '/vault' && (
          <>
            <ChevronRight size={14} className="text-muted-foreground/40" />
            <span className="font-display text-[13px] font-semibold tracking-tight text-foreground">
              {currentLabel}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 w-56 items-center justify-start gap-2 border-border/80 bg-card/60 font-normal text-muted-foreground shadow-none md:flex"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search size={14} aria-hidden="true" />
          <span className="flex-1 text-left">Search vault…</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/80 bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground md:hidden"
          aria-label="Search vault"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search size={16} aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label="Notifications"
        >
          <Bell size={16} aria-hidden="true" />
        </Button>

        <ThemeToggle />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full"
              aria-label={`Account menu for ${session?.user?.name || 'user'}`}
            >
              <UserAvatar
                image={session?.user?.image}
                name={session?.user?.name}
                className="h-8 w-8 ring-1 ring-border"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
                  {(session?.user as { role?: string } | undefined)?.role || 'USER'}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User size={14} className="mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings size={14} className="mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/security" className="cursor-pointer">
                  <Shield size={14} className="mr-2" />
                  Security
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            >
              <LogOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
