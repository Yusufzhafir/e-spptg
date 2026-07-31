'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/trpc/client';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '@/lib/account-status';

type UserRole = 'Superadmin' | 'Admin' | 'Verifikator' | 'Kecamatan' | 'Viewer';

type User = {
  id: number;
  nama: string;
  email: string;
  peran: UserRole;
  assignedVillageId: number | null;
  assignedKecamatan: string | null;
  nomorHP: string | null;
  nipNik: string;
};

type AuthRoleContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Signed in, but the app account has been switched off. Distinct from "not
   * authenticated" so the shell can say why instead of showing a generic error
   * or an empty dashboard.
   */
  isDeactivated: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  /** Clears the session cookie server-side, then drops all cached queries. */
  signOut: (redirectTo?: string) => Promise<void>;
  isSigningOut: boolean;
};

const AuthRoleContext = createContext<AuthRoleContextType | undefined>(undefined);

export function AuthRoleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The session cookie is HttpOnly, so the client cannot tell in advance whether
  // it is signed in — `auth.me` is the check. It is allowed to fail (401 on
  // public pages is the normal case), hence `retry: false`.
  const {
    data: userData,
    isLoading: userLoading,
    error,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // The vanilla client rather than `useMutation`: that hook returns a fresh
  // object every render, which would make `signOut` change identity every render
  // and re-fire any effect that depends on it. `utils` is stable.
  const utils = trpc.useUtils();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(
    async (redirectTo = '/') => {
      setIsSigningOut(true);
      try {
        await utils.client.auth.logout.mutate();
      } catch {
        // A failed logout still has to get the user out of the app: the cookie
        // may already be invalid, which is exactly when this throws.
      }
      // Wipe every cached query, not just auth.me — otherwise the next account
      // to sign in on this browser briefly sees the previous user's data.
      queryClient.clear();
      router.replace(redirectTo);
      router.refresh();
    },
    [utils, queryClient, router]
  );

  const isDeactivated = error?.message === ACCOUNT_DEACTIVATED_MESSAGE;
  const user = (userData as User | undefined) && !error ? (userData as User) : null;
  const isAuthenticated = !!user;

  const hasRole = (role: UserRole): boolean => user?.peran === role;

  const hasAnyRole = (roles: UserRole[]): boolean =>
    !!user && roles.includes(user.peran);

  const value: AuthRoleContextType = {
    user,
    isAuthenticated,
    isLoading: userLoading,
    isDeactivated,
    hasRole,
    hasAnyRole,
    signOut,
    isSigningOut,
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
