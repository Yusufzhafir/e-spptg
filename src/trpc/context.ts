import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/server/db/db';
import {
  getUserByClerkId,
  getPendingUserByEmail,
  linkClerkAccount,
  createUser,
  touchUserLastLogin,
} from '@/server/db/queries/user';

// Only rewrite "terakhir masuk" at most this often per user (avoid a write per request)
const LAST_LOGIN_THROTTLE_MS = 10 * 60 * 1000;

export async function createTRPCContext() {
  const { userId: clerkUserId } = await auth();

  let appUser: Awaited<ReturnType<typeof getUserByClerkId>> | null = null;

  if (clerkUserId) {
    appUser = await getUserByClerkId(clerkUserId);

    // Auto-provision user if not exists
    if (!appUser) {
      try {
        const clerkAuth = await clerkClient();
        const clerkUser = await clerkAuth.users.getUser(clerkUserId);

        const nipNikFromPrivateMetadata =
          (clerkUser.privateMetadata.nipNik as string) || 'TEMP';
        const email = clerkUser.emailAddresses[0]?.emailAddress || '';

        if (clerkUser) {
          // If an admin pre-registered this person from the app (a row with the
          // same email and no Clerk link yet), link that row instead of creating
          // a duplicate — preserving their assigned role and desa.
          const pending = email ? await getPendingUserByEmail(email) : undefined;
          if (pending) {
            appUser = await linkClerkAccount(pending.id, clerkUserId);
          } else {
            appUser = await createUser({
              clerkUserId: clerkUserId,
              email,
              nama: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
              nipNik: nipNikFromPrivateMetadata,
              peran: 'Viewer',
            });
          }
        }
      } catch (error) {
        console.error('Error provisioning user from Clerk:', error);
      }

      // A first page load fires several tRPC queries at once, and each builds its
      // own context, so they all try to provision the same brand-new user in
      // parallel. `users.clerk_user_id` is unique, so exactly one insert wins and
      // the rest throw — leaving those requests with appUser = null and a 401.
      // When `auth.me` happened to be one of the losers the session looked
      // unauthenticated and the sidebar rendered empty until a manual refresh.
      // Re-read before giving up: if someone else created the row, use it.
      if (!appUser) {
        appUser = await getUserByClerkId(clerkUserId);
      }
    }

    // Update last-login (throttled) so the "Terakhir Masuk" column is populated
    if (appUser) {
      const last = appUser.terakhirMasuk ? new Date(appUser.terakhirMasuk).getTime() : 0;
      if (Date.now() - last > LAST_LOGIN_THROTTLE_MS) {
        try {
          await touchUserLastLogin(appUser.id);
          appUser = { ...appUser, terakhirMasuk: new Date() };
        } catch (error) {
          console.error('Error updating last login:', error);
        }
      }
    }
  }

  return {
    db,
    userId: clerkUserId,
    appUser,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;