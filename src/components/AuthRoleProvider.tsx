'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
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
  /** Signed link to the profile photo; null when the account has none. */
  fotoProfilUrl: string | null;
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
  /**
   * Clears the session cookie server-side, then hands `redirectTo` to the
   * browser as a full page load — never resolves, because the document it was
   * called from is replaced.
   */
  signOut: (redirectTo?: string) => Promise<void>;
  isSigningOut: boolean;
};

const AuthRoleContext = createContext<AuthRoleContextType | undefined>(undefined);

export function AuthRoleProvider({ children }: { children: ReactNode }) {
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

      // A **full document navigation**, not `router.replace` + `router.refresh`.
      //
      // Signing out changes what the server renders for every route, and a
      // client-side navigation leaves the whole authenticated tree mounted while
      // it flies. That is what made "Keluar" hang on a spinner: clearing the
      // query cache made `auth.me` fail immediately, `/app`'s layout — still
      // mounted, because its own navigation had not landed yet — read that as a
      // dead session and started a *second* sign-out towards `/sign-in`, and the
      // two `router.replace` calls raced. The URL settled on one destination and
      // the rendered tree on neither, so the app shell kept spinning until the
      // page was reloaded by hand.
      //
      // Handing the redirect to the browser throws away the React tree, Next's
      // router cache and every cached query in one step, and makes `src/proxy.ts`
      // re-read the now-cleared cookie server-side. No cache clearing is needed
      // here any more: the query client is an in-memory singleton (see
      // `src/trpc/client.tsx`) and does not survive the reload, so the next
      // account to sign in cannot see this one's data.
      //
      // `isSigningOut` is deliberately left set — the document is on its way out,
      // and clearing it would only re-enable "Keluar" for the frames in between.
      window.location.replace(redirectTo);
    },
    [utils]
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
