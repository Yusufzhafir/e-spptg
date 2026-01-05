'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthRole } from '@/components/AuthRoleProvider';

type UserRole = 'Superadmin' | 'Admin' | 'Verifikator' | 'Viewer';

type RequireRoleProps = {
  children: ReactNode;
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  fallback?: ReactNode;
  redirectTo?: string;
  showError?: boolean;
};

export function RequireRole({
  children,
  requireAuth = true,
  allowedRoles,
  fallback,
  redirectTo,
  showError = false,
}: RequireRoleProps) {
  const { user, isAuthenticated, isLoading, hasAnyRole } = useAuthRole();
  const router = useRouter();

  // Determine if access should be denied
  const shouldDenyAccess = 
    (requireAuth && !isAuthenticated) ||
    (allowedRoles && allowedRoles.length > 0 && (!user || !hasAnyRole(allowedRoles)));

  // Handle redirects in useEffect
  useEffect(() => {
    if (!isLoading && shouldDenyAccess && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, shouldDenyAccess, redirectTo, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    if (redirectTo) {
      return null; // Redirect handled in useEffect
    }
    if (fallback) {
      return <>{fallback}</>;
    }
    if (showError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Akses Ditolak
            </h2>
            <p className="text-gray-600">
              Anda harus masuk untuk mengakses halaman ini.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  // Check role requirement
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !hasAnyRole(allowedRoles)) {
      if (redirectTo) {
        return null; // Redirect handled in useEffect
      }
      if (fallback) {
        return <>{fallback}</>;
      }
      if (showError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Akses Ditolak
              </h2>
              <p className="text-gray-600">
                Anda tidak memiliki izin untuk mengakses halaman ini.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Peran yang diizinkan: {allowedRoles.join(', ')}
              </p>
            </div>
          </div>
        );
      }
      return null;
    }
  }

  // All checks passed, render children
  return <>{children}</>;
}
