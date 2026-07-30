'use client';

import { Toaster } from '@/components/ui/sonner';
import { useAuthRole } from '@/components/AuthRoleProvider';

/**
 * A Viewer touches this app rarely and works a single screen (Step 1), so a
 * small toast in the corner is easy to miss entirely. Give them centred,
 * larger, longer-lived messages. Staff, who work here all day, keep the
 * compact corner placement that stays out of their way.
 */
export function RoleAwareToaster() {
  const { user } = useAuthRole();
  const isViewer = user?.peran === 'Viewer';

  if (!isViewer) {
    return <Toaster position="top-right" />;
  }

  return (
    <Toaster
      position="top-center"
      duration={6000}
      toastOptions={{
        classNames: {
          toast: 'w-full sm:min-w-[420px] gap-3 p-4 shadow-lg',
          title: 'text-base font-semibold',
          description: 'text-sm leading-relaxed',
          icon: 'size-5',
        },
      }}
    />
  );
}
