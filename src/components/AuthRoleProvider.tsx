'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { trpc } from '@/trpc/client';

type UserRole = 'Superadmin' | 'Admin' | 'Verifikator' | 'Viewer';

type User = {
  id: number;
  nama: string;
  email: string;
  peran: UserRole;
  assignedVillageId: number | null;
  clerkUserId: string;
};

type AuthRoleContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
};

const AuthRoleContext = createContext<AuthRoleContextType | undefined>(undefined);

export function AuthRoleProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const { data: userData, isLoading: userLoading, error } = trpc.auth.me.useQuery(
    undefined,
    {
      enabled: isSignedIn ?? false,
      retry: false,
    }
  );

  const isLoading = !clerkLoaded || (isSignedIn && userLoading);
  const isAuthenticated = !!(isSignedIn && !!userData && !error);
  const user = userData && !error ? userData : null;

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return user.peran === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.peran);
  };

  const value: AuthRoleContextType = {
    user,
    isAuthenticated,
    isLoading,
    hasRole,
    hasAnyRole,
  };

  return <AuthRoleContext.Provider value={value}>{children}</AuthRoleContext.Provider>;
}

export function useAuthRole() {
  const context = useContext(AuthRoleContext);
  if (!context) {
    throw new Error('useAuthRole must be used within AuthRoleProvider');
  }
  return context;
}
