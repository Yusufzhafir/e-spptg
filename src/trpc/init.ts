import { initTRPC, TRPCError } from '@trpc/server';
import { TRPCContext } from './context';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '@/lib/account-status';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.appUser) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Deactivating a user must actually revoke access, not just grey out a row in
  // Pengaturan. `users.toggleStatus` deletes their sessions, but a request that
  // was already in flight — or a session row that outlived a failed delete —
  // would still carry every permission their peran grants. Enforced here rather
  // than in each router so it covers every procedure, present and future.
  if (ctx.appUser.status !== 'Aktif') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      appUser: ctx.appUser,
    },
  });
});

const hasRole = (allowed: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.appUser || !allowed.includes(ctx.appUser.peran)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(isAuthed);

export const adminProcedure = protectedProcedure.use(
  hasRole(['Superadmin', 'Admin'])
);

export const verifikatorProcedure = protectedProcedure.use(
  hasRole(['Superadmin', 'Admin', 'Verifikator'])
);

export const superadminProcedure = protectedProcedure.use(
  hasRole(['Superadmin'])
);
