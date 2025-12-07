import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/server/db/db';
import { getUserByClerkId, createUser } from '@/server/db/queries/user';

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

        if (clerkUser) {
          appUser = await createUser({
            clerkUserId: clerkUserId,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            nama: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
            nipNik: nipNikFromPrivateMetadata,
            peran: 'Viewer',
          });
        }
      } catch (error) {
        console.error('Error provisioning user from Clerk:', error);
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