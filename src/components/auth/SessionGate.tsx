'use client';

import type { ReactNode } from 'react';
import { useAuthRole } from '@/components/AuthRoleProvider';

/**
 * Conditional wrappers driven by the app's own session, for marketing surfaces
 * that render differently to signed-in visitors.
 *
 * Both render nothing while `auth.me` is still in flight. That is on purpose:
 * showing "Masuk / Daftar" and then swapping it for "Buka Dashboard" a moment
 * later is a worse first impression than a brief gap.
 */
export function SignedIn({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthRole();
  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthRole();
  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}
