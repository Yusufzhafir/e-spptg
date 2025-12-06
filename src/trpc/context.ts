import { db } from '@/server/db/db';
import { getUserByClerkId } from '@/server/db/queries/user';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const createTRPCContext = async () => {
  const { userId: clerkUserId } = await auth();

  let appUser: Awaited<ReturnType<typeof getUserByClerkId>> | null = null;

  if (clerkUserId) {
    appUser = await getUserByClerkId(clerkUserId);

    // Auto-provision user if not exists
    if (!appUser) {
      const clerkAuth = await clerkClient()
      const clerkUser = await clerkAuth.users.getUser(clerkUserId)

      const nipNikFromPrivateMetadata = 
        (clerkUser.privateMetadata.nipNik) as string || 'TEMP';

      if (clerkUser) {
        const { createUser } = await import('@/server/db/queries/user');
        appUser = await createUser({
          clerkUserId: clerkUserId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          nama: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          nipNik: nipNikFromPrivateMetadata,
          peran: 'Viewer',
        });
      }
    }
  }

  return {
    db,
    userId: clerkUserId,
    appUser,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;