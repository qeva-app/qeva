'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import SessionTimeoutWarning from '@/components/SessionTimeoutWarning';
import { CommandPalette } from '@/components/CommandPalette';
import WorkflowBanner from '@/components/WorkflowBanner';
import OrgLifecycleBanner from '@/components/OrgLifecycleBanner';
import { SessionContextProvider } from '@/contexts/SessionContext';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status !== 'authenticated') return;
    if (session?.user?.twoFactorEnabled && session.user.mfaVerified === false) {
      router.replace('/auth/mfa');
      return;
    }
    if (session?.user?.mustChangePassword) {
      router.replace('/auth/change-password');
      return;
    }
    if (session?.user?.mfaPromptPending && !session.user.twoFactorEnabled) {
      router.replace('/auth/setup-mfa');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="app-canvas min-h-screen">
        <div className="flex">
          <div className="h-screen w-[260px] shrink-0 bg-sidebar">
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-32 bg-sidebar-accent" />
              <Skeleton className="h-8 w-full bg-sidebar-accent" />
              <div className="mt-6 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full bg-sidebar-accent" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex h-14 items-center border-b border-border/70 px-6">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <SessionContextProvider>
      <SidebarProvider>
        <AppShell>{children}</AppShell>
      </SidebarProvider>
    </SessionContextProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="app-canvas min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div
        className={cn(
          'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] transition-[padding] duration-300 ease-out',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
        )}
      >
        <Header />
        <OrgLifecycleBanner />
        <WorkflowBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative mx-auto max-w-[1400px] scroll-mt-16 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8"
        >
          {children}
        </main>
      </div>
      <SessionTimeoutWarning />
      <CommandPalette />
    </div>
  );
}
