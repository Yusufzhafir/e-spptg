/**
 * submitDraft — the wilayah written onto a filed pengajuan.
 *
 * The kabupaten used to fall back to a hardcoded 'Cirebon', so a draft that
 * never filled in Step 2 was filed under the wrong kabupaten entirely (this is
 * a Kutai Timur deployment). It now falls back to the desa master data.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';

vi.mock('@/server/db/queries/drafts', () => ({
  getDraftById: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  getSubmissionOverlaps: vi.fn(async () => []),
  deleteSubmissionOverlaps: vi.fn(),
}));
vi.mock('@/server/db/queries/documents', () => ({
  listDocumentsByDraft: vi.fn(async () => []),
  updateDocumentSubmissionId: vi.fn(),
}));
vi.mock('@/server/db/queries/notifications', () => ({
  createNotification: vi.fn(),
}));
vi.mock('@/server/db/queries/villages', () => ({
  getVillageById: vi.fn(),
}));
vi.mock('@/server/push/notify', () => ({
  pushSubmissionEvent: vi.fn(async () => undefined),
}));
vi.mock('@/server/postgis', () => ({
  computeOverlaps: vi.fn(async () => []),
}));
vi.mock('@/server/redis/cache', () => ({
  TTL: { dashboard: 60 },
  cached: vi.fn(async (_k: string, _t: number, fn: () => unknown) => fn()),
  scopedKey: vi.fn((prefix: string) => prefix),
  invalidateDashboard: vi.fn(async () => undefined),
}));

import { submissionsRouter } from './submissionsRouter';
import * as draftQueries from '@/server/db/queries/drafts';
import * as villageQueries from '@/server/db/queries/villages';

const VILLAGE_ID = 10;

/** Captures the row handed to `tx.insert(...).values(...)`. */
const insertedRows: Record<string, unknown>[] = [];

function fakeTx() {
  return {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return { returning: async () => [{ id: 500 }] };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
}

function ctx() {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: 2,
    nama: 'Admin User',
    email: 'admin@example.com',
    passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
    nipNik: '12345',
    peran: 'Admin',
    assignedVillageId: VILLAGE_ID,
    assignedKecamatan: null,
    status: 'Aktif',
    nomorHP: null,
    fotoProfil: null,
    emailVerifiedAt: new Date(),
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    userId: 2,
    db: {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx()),
    } as unknown as TRPCContext['db'],
    appUser,
    sessionToken: 'session-2',
    resHeaders: new Headers(),
    requestMeta: { userAgent: 'vitest', ipAddress: '127.0.0.1' },
  } satisfies TRPCContext;
}

function draftWith(payload: Record<string, unknown>) {
  return {
    id: 55,
    userId: 4,
    villageId: VILLAGE_ID,
    editingSubmissionId: null,
    currentStep: 4,
    payload: {
      namaPemohon: 'Budi Santoso',
      nik: '6403011234567890',
      coordinatesGeografis: [
        { latitude: 0.52, longitude: 117.54 },
        { latitude: 0.53, longitude: 117.55 },
        { latitude: 0.54, longitude: 117.54 },
      ],
      ...payload,
    },
    lastSaved: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows.length = 0;
  vi.mocked(villageQueries.getVillageById).mockResolvedValue({
    id: VILLAGE_ID,
    namaDesa: 'Sangatta Utara',
    kecamatan: 'Sangatta Utara',
    kabupaten: 'Kutai Timur',
  } as never);
});

describe('submitDraft — kecamatan/kabupaten', () => {
  it('falls back to the desa master data when the payload has none', async () => {
    vi.mocked(draftQueries.getDraftById).mockResolvedValue(draftWith({}) as never);

    await submissionsRouter.createCaller(ctx()).submitDraft({ draftId: 55 } as never);

    expect(insertedRows[0]).toMatchObject({
      kecamatan: 'Sangatta Utara',
      kabupaten: 'Kutai Timur',
    });
    expect(insertedRows[0].kabupaten).not.toBe('Cirebon');
  });

  it('keeps what the draft itself carries', async () => {
    vi.mocked(draftQueries.getDraftById).mockResolvedValue(
      draftWith({ kecamatan: 'Bengalon', kabupaten: 'Kutai Timur' }) as never
    );

    await submissionsRouter.createCaller(ctx()).submitDraft({ draftId: 55 } as never);

    expect(insertedRows[0]).toMatchObject({
      kecamatan: 'Bengalon',
      kabupaten: 'Kutai Timur',
    });
  });

  it('leaves the columns empty rather than guessing when the desa is unknown', async () => {
    vi.mocked(villageQueries.getVillageById).mockResolvedValue(undefined as never);
    vi.mocked(draftQueries.getDraftById).mockResolvedValue(draftWith({}) as never);

    await submissionsRouter.createCaller(ctx()).submitDraft({ draftId: 55 } as never);

    expect(insertedRows[0]).toMatchObject({ kecamatan: '', kabupaten: '' });
  });
});
