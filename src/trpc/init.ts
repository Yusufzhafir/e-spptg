import { initTRPC, TRPCError } from '@trpc/server';
import { TRPCContext } from './context';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '@/lib/account-status';
import { actionLabel } from '@/server/audit/actions';
import { recordAudit } from '@/server/audit/record';
import { redact } from '@/server/audit/redact';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * What a procedure can add to its own audit entry. Everything is optional: a
 * mutation that sets nothing still gets logged, just without a before/after.
 */
export type AuditDetail = {
  /** Overrides the generic "<label> oleh <nama>" summary. */
  ringkasan?: string;
  entitasId?: number | null;
  sebelum?: unknown;
  sesudah?: unknown;
};

export type AuditSlot = {
  set: (detail: AuditDetail) => void;
};

/**
 * Records every authenticated **mutation**, succeeded or failed.
 *
 * Attached to `protectedProcedure`, so it covers every write in the app
 * including procedures that do not exist yet — the action id is the tRPC path,
 * so nothing has to be registered anywhere for a new mutation to be audited.
 * Queries are deliberately not logged: they would bury the writes under noise
 * from every dashboard poll.
 *
 * A procedure that wants a before/after snapshot calls `ctx.audit.set(...)`;
 * the entry is written after the procedure returns, so the snapshot reflects
 * what actually happened rather than what was attempted.
 */
const auditMutations = t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
  let detail: AuditDetail = {};
  const slot: AuditSlot = {
    set: (d) => {
      detail = { ...detail, ...d };
    },
  };

  // `next` *merges* into the existing context, so only the new key is passed.
  // Spreading `...ctx` here would re-widen `appUser` to nullable — this
  // middleware's own `ctx` is typed as the base context, and the spread would
  // undo the narrowing `isAuthed` performed upstream.
  //
  // Exactly one `next()` call, so `ctx.audit` has one consistent type for every
  // procedure downstream, queries included (where it is simply unused).
  const result = await next({ ctx: { audit: slot } });

  // Queries are deliberately not logged, and an anonymous caller has no actor.
  if (type !== 'mutation' || !ctx.appUser) return result;

  const actor = {
    id: ctx.appUser.id,
    nama: ctx.appUser.nama,
    email: ctx.appUser.email,
    peran: ctx.appUser.peran,
  };

  // Reading the input after the fact keeps it out of the happy path; it is only
  // needed for the log line and is redacted before it is stored.
  let input: unknown = null;
  try {
    input = redact(await getRawInput());
  } catch {
    /* an unreadable input must not stop the entry being written */
  }

  const base = {
    actor,
    aksi: path,
    entitasId: detail.entitasId ?? null,
    ipAddress: ctx.requestMeta?.ipAddress ?? null,
    userAgent: ctx.requestMeta?.userAgent ?? null,
  };

  if (result.ok) {
    await recordAudit({
      ...base,
      ringkasan: detail.ringkasan ?? `${actionLabel(path)} oleh ${actor.nama}`,
      sebelum: detail.sebelum,
      // With no explicit snapshot, the input is the best record of intent.
      sesudah: detail.sesudah ?? input,
      hasil: 'sukses',
    });
  } else {
    // Failed writes are the ones worth reading: a Viewer repeatedly trying to
    // change a status shows up here and nowhere else.
    await recordAudit({
      ...base,
      ringkasan: detail.ringkasan ?? `${actionLabel(path)} GAGAL — ${actor.nama}`,
      sebelum: detail.sebelum,
      sesudah: input,
      hasil: 'gagal',
      galat: result.error instanceof Error ? result.error.message : String(result.error),
    });
  }

  return result;
});

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

export const protectedProcedure = t.procedure.use(isAuthed).use(auditMutations);

export const adminProcedure = protectedProcedure.use(
  hasRole(['Superadmin', 'Admin'])
);

export const verifikatorProcedure = protectedProcedure.use(
  hasRole(['Superadmin', 'Admin', 'Verifikator'])
);

export const superadminProcedure = protectedProcedure.use(
  hasRole(['Superadmin'])
);
