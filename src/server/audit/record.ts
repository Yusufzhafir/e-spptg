import 'server-only';
import { db } from '@/server/db/db';
import { auditLogs } from '@/server/db/schema';
import { entityForAction } from './actions';
import { redact } from './redact';

/**
 * Writes one audit entry.
 *
 * **Never throws.** An audit write failing must not turn a successful action
 * into an error the user sees — losing a log line is bad, rolling back a land
 * registration because the log table was full is worse. Failures go to the
 * server log instead, where they are visible without being destructive.
 */
export type AuditActor = {
  id: number | null;
  nama: string;
  email: string;
  peran: string;
};

export type AuditInput = {
  actor: AuditActor;
  /** Dotted action id; for mutations this is the tRPC procedure path. */
  aksi: string;
  entitasId?: number | null;
  ringkasan: string;
  sebelum?: unknown;
  sesudah?: unknown;
  hasil?: 'sukses' | 'gagal';
  galat?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actor.id,
      actorNama: input.actor.nama.slice(0, 255),
      actorEmail: input.actor.email.slice(0, 255),
      actorPeran: input.actor.peran.slice(0, 32),
      aksi: input.aksi.slice(0, 128),
      entitas: entityForAction(input.aksi),
      entitasId: input.entitasId ?? null,
      ringkasan: input.ringkasan,
      // Redaction happens here rather than at the call sites, so a new caller
      // cannot forget it and leak a password hash into the trail.
      sebelum: input.sebelum === undefined ? null : redact(input.sebelum),
      sesudah: input.sesudah === undefined ? null : redact(input.sesudah),
      hasil: input.hasil ?? 'sukses',
      galat: input.galat ?? null,
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
    });
  } catch (error) {
    console.error('[audit] gagal menulis entri audit:', error, {
      aksi: input.aksi,
      actor: input.actor.email,
    });
  }
}
