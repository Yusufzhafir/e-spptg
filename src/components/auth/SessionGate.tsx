'use client';

import type { ReactNode } from 'react';
import { useAuthRole } from '@/components/AuthRoleProvider';

/**
 * Conditional wrappers driven by the app's own session, for marketing surfaces
 * that render differently to signed-in visitors.
 *
 * The two are deliberately asymmetric while `auth.me` is in flight:
 *
 * - `SignedIn` shows nothing, so "Buka Dashboard" never flashes at a visitor
 *   who turns out to be anonymous.
 * - `SignedOut` shows its children, because the only surface using these is the
 *   landing page, and `src/proxy.ts` redirects anyone carrying a session cookie
 *   away from it on the server. Signed-out is therefore the correct guess
 *   essentially every time — and it is what puts the "Masuk" / "Daftar" links
 *   into the prerendered HTML, where crawlers and link previews can see them.
 */
export function SignedIn({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthRole();
  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthRole();
  if (isAuthenticated) return null;
  return <>{children}</>;
}
