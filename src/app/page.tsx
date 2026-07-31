'use client';

import { LandingPage } from '@/components/LandingPage';
import { useAuthRole } from '@/components/AuthRoleProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuthRole();
  const router = useRouter();

  // `src/proxy.ts` already redirects visitors who carry a session cookie, so
  // this only catches the case it cannot see: a cookie that turned out to be
  // valid after the tRPC round trip on a client-side navigation to "/".
  // `replace` (not `push`) so the back button doesn't land them here again.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/app');
    }
  }, [isAuthenticated, router]);

  // Show the spinner while auth is resolving *and* while the redirect above is
  // in flight. Rendering <LandingPage /> for signed-in users is what made the
  // landing page flash before the redirect completed.
  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return <LandingPage />;
}
