'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthRole } from '@/components/AuthRoleProvider';

/**
 * Sends a signed-in visitor from "/" to the dashboard. Renders nothing.
 *
 * `src/proxy.ts` already does this on the server for anyone carrying a session
 * cookie, which is what keeps the landing page out of their browser entirely.
 * This is the client-side safety net for the case the Edge cannot see, and it
 * deliberately renders no markup: the landing page must stay in the server HTML
 * unconditionally, because that HTML is the only thing crawlers and link
 * previews read.
 */
export function RedirectSignedInHome() {
  const { isAuthenticated } = useAuthRole();
  const router = useRouter();

  useEffect(() => {
    // `replace`, not `push`, so the back button does not land here again.
    if (isAuthenticated) router.replace('/app');
  }, [isAuthenticated, router]);

  return null;
}
