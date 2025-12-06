import { protectedProcedure, router } from '@/trpc/init';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.appUser!.id,
      nama: ctx.appUser!.nama,
      email: ctx.appUser!.email,
      peran: ctx.appUser!.peran,
      clerkUserId: ctx.userId,
    };
  }),

  getUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.appUser;
  }),
});