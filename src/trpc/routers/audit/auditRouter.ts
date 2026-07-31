import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, superadminProcedure } from '../../init';
import * as queries from '@/server/db/queries/audit';
import { diffFields } from '@/server/audit/redact';
import { knownActions } from '@/server/audit/actions';

/**
 * The audit trail. **Every procedure here is `superadminProcedure`** — the log
 * contains who did what to whose land claim, which is exactly the material an
 * Admin or Verifikator should not be able to browse, let alone erase.
 *
 * Deletion is exposed because it was asked for, but see the note on `delete`:
 * removing an audit entry is itself audited.
 */
const filterSchema = z.object({
  search: z.string().optional(),
  aksi: z.string().optional(),
  entitas: z.string().optional(),
  actorId: z.number().int().positive().optional(),
  hasil: z.enum(['sukses', 'gagal']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const auditRouter = router({
  list: superadminProcedure.input(filterSchema).query(async ({ input }) => {
    const { items, total } = await queries.listAuditLogs(input);
    return {
      total,
      items: items.map((row) => ({
        ...row,
        // Computed server-side so the table can show "3 kolom berubah" without
        // every row shipping two full JSON blobs to the browser.
        jumlahPerubahan: Object.keys(diffFields(row.sebelum, row.sesudah)).length,
      })),
    };
  }),

  /** Full detail for one entry, including the field-by-field change list. */
  byId: superadminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const row = await queries.getAuditLogById(input.id);
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Entri audit tidak ditemukan' });
      }
      return { ...row, perubahan: diffFields(row.sebelum, row.sesudah) };
    }),

  /** Options for the filter dropdowns. */
  filterOptions: superadminProcedure.query(async () => {
    const actors = await queries.listAuditActors();
    return {
      aksi: knownActions(),
      pelaku: actors
        .filter((a) => a.actorId !== null)
        .map((a) => ({ id: a.actorId!, nama: a.actorNama, email: a.actorEmail })),
    };
  }),

  /**
   * Remove one entry.
   *
   * The deletion is itself recorded by the audit middleware (this is a
   * mutation on a protected procedure), and the summary below carries what the
   * removed entry said. That is deliberate: an audit trail whose entries can be
   * erased without trace is worth very little, so the *fact* of a deletion
   * always survives even though the detail does not.
   */
  delete: superadminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const row = await queries.getAuditLogById(input.id);
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Entri audit tidak ditemukan' });
      }

      const removed = await queries.deleteAuditLog(input.id);

      ctx.audit.set({
        entitasId: input.id,
        ringkasan:
          `Menghapus entri audit #${input.id} — ` +
          `"${row.ringkasan}" oleh ${row.actorNama} pada ` +
          `${row.createdAt.toISOString()}`,
        sebelum: row,
      });

      return { success: removed };
    }),
});
