import { and, count, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import { auditLogs } from '../schema';

export type AuditFilters = {
  /** Free text over actor name/email, summary, and action id. */
  search?: string;
  /** Exact action id, e.g. `users.update`. */
  aksi?: string;
  entitas?: string;
  actorId?: number;
  hasil?: 'sukses' | 'gagal';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

function buildConditions(filters: AuditFilters) {
  const conditions = [];

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        sql`${auditLogs.actorNama} ILIKE ${term}`,
        sql`${auditLogs.actorEmail} ILIKE ${term}`,
        sql`${auditLogs.ringkasan} ILIKE ${term}`,
        sql`${auditLogs.aksi} ILIKE ${term}`
      )
    );
  }

  if (filters.aksi && filters.aksi !== 'all') {
    conditions.push(eq(auditLogs.aksi, filters.aksi));
  }
  if (filters.entitas && filters.entitas !== 'all') {
    conditions.push(eq(auditLogs.entitas, filters.entitas));
  }
  if (typeof filters.actorId === 'number') {
    conditions.push(eq(auditLogs.actorId, filters.actorId));
  }
  if (filters.hasil) {
    conditions.push(eq(auditLogs.hasil, filters.hasil));
  }
  if (filters.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, new Date(`${filters.dateFrom}T00:00:00`)));
  }
  if (filters.dateTo) {
    conditions.push(lte(auditLogs.createdAt, new Date(`${filters.dateTo}T23:59:59.999`)));
  }

  return conditions;
}

/** Newest first — an audit reader almost always wants "what just happened". */
export async function listAuditLogs(filters: AuditFilters = {}) {
  const { limit = 50, offset = 0 } = filters;
  const conditions = buildConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(auditLogs)
    .where(where);

  return { items, total };
}

export async function getAuditLogById(id: number) {
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteAuditLog(id: number, tx?: DBTransaction) {
  const queryDb = tx || db;
  const deleted = await queryDb
    .delete(auditLogs)
    .where(eq(auditLogs.id, id))
    .returning({ id: auditLogs.id });
  return deleted.length > 0;
}

/** Distinct actors that appear in the trail, for the "siapa" filter. */
export async function listAuditActors() {
  return db
    .selectDistinctOn([auditLogs.actorId], {
      actorId: auditLogs.actorId,
      actorNama: auditLogs.actorNama,
      actorEmail: auditLogs.actorEmail,
    })
    .from(auditLogs)
    .orderBy(auditLogs.actorId);
}
