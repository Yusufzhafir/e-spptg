'use client';

import { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { TRPCProvider } from '@/trpc/client';
import { AuthRoleProvider } from '@/components/AuthRoleProvider';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

/**
 * All client-side providers. Split out of the root layout so that layout can
 * stay a server component and export `metadata` (per-page browser titles, PWA
 * manifest, theme colour).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    // Point Clerk at our own branded routes instead of its hosted pages.
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <TRPCProvider>
        <AuthRoleProvider>
          <ServiceWorkerRegistrar />
          <Toaster position="top-right" />
          {children}
        </AuthRoleProvider>
      </TRPCProvider>
    </ClerkProvider>
  );
}
