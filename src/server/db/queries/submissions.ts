
import { eq, desc, and, sql, getTableColumns } from 'drizzle-orm';
import { db, type DBTransaction } from '../db';
import {
    submissions,
    overlapResults,
    statusHistory
} from '../schema';
import { FeedbackData, StatusSPPTG } from '@/types';

/**
 * Get submission by ID
 */
export async function getSubmissionById(
    id: number,
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    return queryDb.query.submissions.findFirst({
        where: eq(submissions.id, id),
    });
}

export async function listSubmissions(filters: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
},
    tx?: DBTransaction
) {
    const queryDb = tx || db
    const { search, status, limit = 50, offset = 0 } = filters;

    const conditions = [];

    if (search) {
        conditions.push(
            sql`(
        ${submissions.namaPemilik} ILIKE ${`%${search}%`}
        OR ${submissions.nik} LIKE ${`%${search}%`}
        OR ${submissions.kecamatan} ILIKE ${`%${search}%`}
      )`
        );
    }

    if (status && status !== 'all') {
        conditions.push(eq(submissions.status, status as StatusSPPTG));
    }
    const {geom,...restOfTheColumn} = getTableColumns(submissions)
    const items = await queryDb.select(restOfTheColumn)
        .from(submissions)
        .where(
            conditions.length > 0 ? and(...conditions) : undefined
        ).offset(offset)
        .limit(limit)
        .orderBy(
            desc(submissions.tanggalPengajuan)
        )

    const totalResult = await queryDb
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult[0]?.count ?? 0;

    return { items, total };
}

export async function createSubmission(
    data: typeof submissions.$inferInsert,
    tx?: DBTransaction
) {
    const queryDb = tx || db;
    const result = await queryDb
        .insert(submissions)
        .values(data)
        .returning();
    return result[0];
}

export async function updateSubmissionStatus(
    id: number,
    newStatus: StatusSPPTG,
    verifikator: number,
    alasan?: string,
    feedback?: FeedbackData,
    tx?: DBTransaction
) {
    const queryDb = tx || db;

    const result = await queryDb
        .update(submissions)
        .set({
            status: newStatus,
            verifikator,
            updatedAt: new Date(),
        })
        .where(eq(submissions.id, id))
        .returning();

    if (result[0]) {
        // Insert into status_history
        await queryDb.insert(statusHistory).values({
            submissionId: id,
            statusBefore: (result[0]).status,
            statusAfter: newStatus,
            petugas: verifikator,
            alasan,
            feedback,
        });
    }

    return result[0];
}

export async function getSubmissionOverlaps(submissionId: number, tx?: DBTransaction) {
    const queryDb = tx || db;

    return queryDb.query.overlapResults.findMany({
        where: eq(overlapResults.submissionId, submissionId),
    });
}

export async function getKPIData(tx?: DBTransaction) {
    const queryDb = tx || db;
    const result = await queryDb
        .select({
            status: submissions.status,
            count: sql`count(*)`.mapWith(String),
        })
        .from(submissions)
        .groupBy(submissions.status);

    return result;
}

export async function getMonthlyStats(tx?: DBTransaction) {
    const queryDb = tx || db;
    const result = await queryDb
        .select({
            month: sql<string>`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`,
            count: sql<number>`count(*)`,
        })
        .from(submissions)
        .groupBy(sql`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${submissions.tanggalPengajuan}, 'YYYY-MM')`);

    return result;
}