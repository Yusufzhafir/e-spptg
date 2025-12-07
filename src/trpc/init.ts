import { initTRPC, TRPCError } from '@trpc/server';
import { TRPCContext } from './context';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.appUser) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
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