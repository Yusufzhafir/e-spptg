'use client';

import { ReactNode } from 'react';
import { RoleAwareToaster } from '@/components/RoleAwareToaster';
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
    // AuthRoleProvider sits inside TRPCProvider: it resolves the session with a
    // tRPC query, so the client has to exist first.
    <TRPCProvider>
      <AuthRoleProvider>
        <ServiceWorkerRegistrar />
        <RoleAwareToaster />
        {children}
      </AuthRoleProvider>
    </TRPCProvider>
  );
}
