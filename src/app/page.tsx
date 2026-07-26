'use client';

import { LandingPage } from '@/components/LandingPage';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard. `replace` (not `push`) so the
  // back button doesn't land them on "/" only to bounce here again.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/app');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show the spinner while auth is resolving *and* while the redirect above is
  // in flight. Rendering <LandingPage /> for signed-in users is what made the
  // landing page flash before the redirect completed.
  if (!isLoaded || isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return <LandingPage />;
}
