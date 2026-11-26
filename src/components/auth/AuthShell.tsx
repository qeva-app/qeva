'use client';

import AuthShowcase, { QevaWordmark } from '@/components/auth/AuthShowcase';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Frame shared by every /auth page: brand panel on the left, page content on the right. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <AuthShowcase />

      <main className="relative flex min-h-screen flex-col bg-background">
        <div className="relative flex items-center justify-between px-6 py-5 sm:px-10">
          <QevaWordmark className="lg:hidden" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 sm:px-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
