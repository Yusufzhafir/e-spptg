import { initTRPC, TRPCError } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { auth, clerkClient, createClerkClient } from '@clerk/nextjs/server';
import { getUserByClerkId } from '@/server/db/queries/user';
import { db } from '@/server/db/db';
import { Context } from './context';


// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
});
// Base router and procedure helpers

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

export const router = t.router;

export const createCallerFactory = t.createCallerFactory;

export const baseProcedure = t.procedure;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(isAuthed);

export const adminProcedure = protectedProcedure.use(hasRole(['Superadmin', 'Admin']));

export const verifikatorProcedure = protectedProcedure.use(
  hasRole(['Superadmin', 'Admin', 'Verifikator'])
);