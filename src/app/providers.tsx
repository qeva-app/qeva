'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { EncryptionProvider } from '@/contexts/EncryptionContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
          <EncryptionProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
              toastOptions={{
                style: {
                  fontSize: '14px',
                },
              }}
            />
          </EncryptionProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
