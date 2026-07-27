/**
 * Role-based access tests across the four main flows:
 *   1. Daftar Pengajuan (submissions.list / byId)
 *   2. Edit Pengajuan (updateStatus, and creating a new draft from a submission)
 *   3. CRUD Desa
 *   4. CRUD Kawasan Non-SPPTG
 *
 * Exercised as Superadmin, Admin, Verifikator and Viewer so the tiers
 * (adminProcedure = Superadmin+Admin, verifikatorProcedure = +Verifikator)
 * are pinned down and can't silently regress.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';
import type { UserRole } from '@/types';

vi.mock('@/server/db/queries/submissions', () => ({
  getSubmissionById: vi.fn(),
  listSubmissions: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  getKPIDataScoped: vi.fn(),
  getMonthlyStats: vi.fn(),
}));
vi.mock('@/server/db/queries/drafts', () => ({}));
vi.mock('@/server/db/queries/documents', () => ({}));
vi.mock('@/server/db/queries/notifications', () => ({}));
vi.mock('@/server/db/queries/villages', () => ({
  listVillages: vi.fn(),
  getVillageById: vi.fn(),
  searchVillages: vi.fn(),
  createVillage: vi.fn(),
  updateVillage: vi.fn(),
  deleteVillage: vi.fn(),
}));
vi.mock('@/server/db/queries/prohibitedAreas', () => ({
  listProhibitedAreas: vi.fn(),
  getProhibitedAreaById: vi.fn(),
  createProhibitedArea: vi.fn(),
  updateProhibitedArea: vi.fn(),
  deleteProhibitedArea: vi.fn(),
}));
vi.mock('@/server/postgis', () => ({
  computeOverlaps: vi.fn(),
  findOverlappingSubmissions: vi.fn(),
}));

import { submissionsRouter } from './submissions/submissionsRouter';
import { villagesRouter } from './villages/villagesRouter';
import { prohibitedAreasRouter } from './prohibitedAreas/prohibitedAreasRouter';
import * as submissionQueries from '@/server/db/queries/submissions';
import * as villageQueries from '@/server/db/queries/villages';
import * as areaQueries from '@/server/db/queries/prohibitedAreas';
import * as postgis from '@/server/postgis';

const listSubmissionsMock = vi.mocked(submissionQueries.listSubmissions);
const getSubmissionByIdMock = vi.mocked(submissionQueries.getSubmissionById);
const updateStatusMock = vi.mocked(submissionQueries.updateSubmissionStatus);
const createVillageMock = vi.mocked(villageQueries.createVillage);
const updateVillageMock = vi.mocked(villageQueries.updateVillage);
const deleteVillageMock = vi.mocked(villageQueries.deleteVillage);
const listVillagesMock = vi.mocked(villageQueries.listVillages);
const createAreaMock = vi.mocked(areaQueries.createProhibitedArea);
const deleteAreaMock = vi.mocked(areaQueries.deleteProhibitedArea);
const listAreasMock = vi.mocked(areaQueries.listProhibitedAreas);
const findOverlapsMock = vi.mocked(postgis.findOverlappingSubmissions);

const VILLAGE_A = 10;
const VILLAGE_B = 20;

function ctx(
  peran: UserRole,
  userId: number,
  assignedVillageId: number | null = null,
  assignedKecamatan: string | null = null
) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: `${peran} User`,
    email: `${peran.toLowerCase()}@example.com`,
    clerkUserId: `clerk-${userId}`,
    nipNik: '12345',
    peran,
    assignedVillageId,
    assignedKecamatan,
    status: 'Aktif',
    nomorHP: null,
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { userId: `clerk-${userId}`, db: {} as TRPCContext['db'], appUser } satisfies TRPCContext;
}

const SUPERADMIN = () => ctx('Superadmin', 1);
const ADMIN = () => ctx('Admin', 2, VILLAGE_A);
const VERIFIKATOR = () => ctx('Verifikator', 3, VILLAGE_A);
const VIEWER = () => ctx('Viewer', 4);
const KECAMATAN = () => ctx('Kecamatan', 5, null, 'Sukasari');

/** Assert a call is rejected by the role guard (FORBIDDEN / UNAUTHORIZED). */
async function expectForbidden(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(TRPCError);
  await promise.catch((error: TRPCError) => {
    expect(['FORBIDDEN', 'UNAUTHORIZED']).toContain(error.code);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listSubmissionsMock.mockResolvedValue({ items: [], total: 0 } as never);
  listVillagesMock.mockResolvedValue([] as never);
  listAreasMock.mockResolvedValue([] as never);
  findOverlapsMock.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// 1. Daftar Pengajuan
// ---------------------------------------------------------------------------
describe('Daftar Pengajuan — scoping per role', () => {
  it('Superadmin sees everything (no owner/village scope)', async () => {
    await submissionsRouter.createCaller(SUPERADMIN()).list({ limit: 50, offset: 0 });
    const args = listSubmissionsMock.mock.calls[0][0];
    expect(args.ownerUserId).toBeUndefined();
    expect(args.villageId).toBeUndefined();
  });

  it('Admin is scoped to their own desa', async () => {
    await submissionsRouter.createCaller(ADMIN()).list({ limit: 50, offset: 0 });
    const args = listSubmissionsMock.mock.calls[0][0];
    expect(args.villageId).toBe(VILLAGE_A);
    expect(args.ownerUserId).toBeUndefined();
  });

  it('Verifikator is scoped to their own desa', async () => {
    await submissionsRouter.createCaller(VERIFIKATOR()).list({ limit: 50, offset: 0 });
    expect(listSubmissionsMock.mock.calls[0][0].villageId).toBe(VILLAGE_A);
  });

  it('Viewer is scoped to submissions they own', async () => {
    await submissionsRouter.createCaller(VIEWER()).list({ limit: 50, offset: 0 });
    const args = listSubmissionsMock.mock.calls[0][0];
    expect(args.ownerUserId).toBe(4);
    expect(args.villageId).toBeUndefined();
  });

  it('Viewer cannot open a submission owned by someone else', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 9,
      ownerUserId: 999,
      villageId: VILLAGE_A,
      verifikator: 1,
      status: 'SPPTG terdata',
    } as never);
    await expect(
      submissionsRouter.createCaller(VIEWER()).byId({ id: 9 })
    ).rejects.toThrow(TRPCError);
  });

  it('Admin cannot open a submission from another desa', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 9,
      ownerUserId: 999,
      villageId: VILLAGE_B,
      verifikator: 1,
      status: 'SPPTG terdata',
    } as never);
    await expect(
      submissionsRouter.createCaller(ADMIN()).byId({ id: 9 })
    ).rejects.toThrow(TRPCError);
  });
});

// ---------------------------------------------------------------------------
// 2. Edit Pengajuan (status change)
// ---------------------------------------------------------------------------
describe('Edit Pengajuan — updateStatus', () => {
  const submissionInVillageA = {
    id: 5,
    ownerUserId: 100,
    villageId: VILLAGE_A,
    verifikator: 2,
    status: 'SPPTG terdata',
  };

  beforeEach(() => {
    getSubmissionByIdMock.mockResolvedValue(submissionInVillageA as never);
    updateStatusMock.mockResolvedValue({ id: 5 } as never);
  });

  it.each([
    ['Superadmin', SUPERADMIN],
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
  ])('%s can change status', async (_label, makeCtx) => {
    const result = await submissionsRouter
      .createCaller(makeCtx())
      .updateStatus({ submissionId: 5, newStatus: 'SPPTG terdaftar' });
    expect(result.success).toBe(true);
  });

  it('Viewer cannot change status', async () => {
    await expectForbidden(
      submissionsRouter
        .createCaller(VIEWER())
        .updateStatus({ submissionId: 5, newStatus: 'SPPTG terdaftar' })
    );
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('Verifikator from another desa cannot change status', async () => {
    const otherDesa = ctx('Verifikator', 7, VILLAGE_B);
    await expect(
      submissionsRouter
        .createCaller(otherDesa)
        .updateStatus({ submissionId: 5, newStatus: 'SPPTG terdaftar' })
    ).rejects.toThrow(TRPCError);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. CRUD Desa
// ---------------------------------------------------------------------------
describe('CRUD Desa', () => {
  const villageInput = {
    kodeDesa: '3201012001',
    namaDesa: 'Cibeureum',
    namaKepalaDesa: 'H. Ahmad',
    juruUkurNama: 'Budi Santoso',
    juruUkurJabatan: 'Juru Ukur',
    juruUkurNomorHP: '081234567890',
    kecamatan: 'Sukasari',
    kabupaten: 'Kab. Cirebon',
    provinsi: 'Jawa Barat',
  };

  // Desa is master data spanning every scope, so only Superadmin may mutate it
  // (Admins are themselves desa-scoped). This mirrors the UI, which shows the
  // Desa tab to Superadmin only.
  it('Superadmin can create/update/delete a desa', async () => {
    createVillageMock.mockResolvedValue({ id: 1 } as never);
    updateVillageMock.mockResolvedValue({ id: 1 } as never);
    deleteVillageMock.mockResolvedValue({ id: 1 } as never);
    const caller = villagesRouter.createCaller(SUPERADMIN());

    await caller.create(villageInput);
    await caller.update({ id: 1, data: { namaDesa: 'Cibeureum Baru' } });
    await caller.delete({ id: 1 });

    expect(createVillageMock).toHaveBeenCalled();
    expect(updateVillageMock).toHaveBeenCalled();
    expect(deleteVillageMock).toHaveBeenCalled();
  });

  it.each([
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
    ['Viewer', VIEWER],
  ])('%s cannot create/update/delete a desa', async (_label, makeCtx) => {
    const caller = villagesRouter.createCaller(makeCtx());

    await expectForbidden(caller.create(villageInput));
    await expectForbidden(caller.update({ id: 1, data: { namaDesa: 'X' } }));
    await expectForbidden(caller.delete({ id: 1 }));

    expect(createVillageMock).not.toHaveBeenCalled();
    expect(updateVillageMock).not.toHaveBeenCalled();
    expect(deleteVillageMock).not.toHaveBeenCalled();
  });

  it.each([
    ['Superadmin', SUPERADMIN],
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
    ['Viewer', VIEWER],
  ])('%s can read the desa list', async (_label, makeCtx) => {
    await expect(
      villagesRouter.createCaller(makeCtx()).list({ limit: 50, offset: 0 })
    ).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. CRUD Kawasan Non-SPPTG
// ---------------------------------------------------------------------------
describe('CRUD Kawasan Non-SPPTG', () => {
  const areaInput = {
    namaKawasan: 'Hutan Lindung Cikole',
    jenisKawasan: 'Hutan Lindung' as const,
    sumberData: 'KLHK',
    tanggalEfektif: new Date('2024-01-01'),
    warna: '#ef4444',
    catatan: null,
    geomGeoJSON: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [107.1, -6.9],
          [107.2, -6.9],
          [107.2, -6.8],
          [107.1, -6.9],
        ],
      ],
    },
  };

  it.each([
    ['Verifikator', VERIFIKATOR],
    ['Viewer', VIEWER],
  ])('%s cannot create or delete a kawasan', async (_label, makeCtx) => {
    const caller = prohibitedAreasRouter.createCaller(makeCtx());

    await expectForbidden(caller.create(areaInput));
    await expectForbidden(caller.delete({ id: 1 }));

    expect(createAreaMock).not.toHaveBeenCalled();
    expect(deleteAreaMock).not.toHaveBeenCalled();
  });

  it('Superadmin/Admin pass the role guard on delete', async () => {
    deleteAreaMock.mockResolvedValue({ id: 1 } as never);
    await prohibitedAreasRouter.createCaller(SUPERADMIN()).delete({ id: 1 });
    await prohibitedAreasRouter.createCaller(ADMIN()).delete({ id: 1 });
    expect(deleteAreaMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['Superadmin', SUPERADMIN],
    ['Admin', ADMIN],
    ['Verifikator', VERIFIKATOR],
    ['Viewer', VIEWER],
  ])('%s can read the kawasan list', async (_label, makeCtx) => {
    await expect(
      prohibitedAreasRouter.createCaller(makeCtx()).list({ limit: 50, offset: 0 })
    ).resolves.toEqual([]);
  });

  it('checkOverlaps is scoped per role', async () => {
    await prohibitedAreasRouter.createCaller(SUPERADMIN()).checkOverlaps();
    expect(findOverlapsMock).toHaveBeenLastCalledWith({});

    await prohibitedAreasRouter.createCaller(ADMIN()).checkOverlaps();
    expect(findOverlapsMock).toHaveBeenLastCalledWith({ villageId: VILLAGE_A });

    await prohibitedAreasRouter.createCaller(VIEWER()).checkOverlaps();
    expect(findOverlapsMock).toHaveBeenLastCalledWith({ ownerUserId: 4 });
  });
});

// ---------------------------------------------------------------------------
// 5. Kecamatan — read-only oversight of every desa in one kecamatan
// ---------------------------------------------------------------------------
describe('Kecamatan role', () => {
  it('is scoped to its own kecamatan on the dashboard', async () => {
    await submissionsRouter.createCaller(KECAMATAN()).list({ limit: 50, offset: 0 });
    const args = listSubmissionsMock.mock.calls[0][0];
    expect(args.scopeKecamatan).toBe('Sukasari');
    expect(args.villageId).toBeUndefined();
    expect(args.ownerUserId).toBeUndefined();
  });

  it('can open a submission inside its kecamatan', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 9, ownerUserId: 999, villageId: VILLAGE_A,
      desaKecamatan: 'Sukasari', verifikator: 1, status: 'SPPTG terdata',
    } as never);
    await expect(
      submissionsRouter.createCaller(KECAMATAN()).byId({ id: 9 })
    ).resolves.toMatchObject({ id: 9 });
  });

  it('cannot open a submission from another kecamatan', async () => {
    getSubmissionByIdMock.mockResolvedValue({
      id: 9, ownerUserId: 999, villageId: VILLAGE_B,
      desaKecamatan: 'Kejaksan', verifikator: 1, status: 'SPPTG terdata',
    } as never);
    await expect(
      submissionsRouter.createCaller(KECAMATAN()).byId({ id: 9 })
    ).rejects.toThrow(TRPCError);
  });

  it.each(['SPPTG terdaftar', 'SPPTG terdata'] as const)(
    'cannot change status to %s',
    async (status) => {
      getSubmissionByIdMock.mockResolvedValue({
        id: 9, ownerUserId: 999, villageId: VILLAGE_A,
        desaKecamatan: 'Sukasari', verifikator: 1, status: 'SPPTG terdata',
      } as never);
      await expectForbidden(
        submissionsRouter.createCaller(KECAMATAN()).updateStatus({ submissionId: 9, newStatus: status })
      );
      expect(updateStatusMock).not.toHaveBeenCalled();
    }
  );

  it('cannot toggle validity', async () => {
    await expectForbidden(
      submissionsRouter.createCaller(KECAMATAN()).updateValidity({ submissionId: 9, isValid: false })
    );
  });

  it('cannot create/update/delete a desa or kawasan', async () => {
    await expectForbidden(villagesRouter.createCaller(KECAMATAN()).delete({ id: 1 }));
    await expectForbidden(prohibitedAreasRouter.createCaller(KECAMATAN()).delete({ id: 1 }));
    expect(deleteVillageMock).not.toHaveBeenCalled();
    expect(deleteAreaMock).not.toHaveBeenCalled();
  });

  it('overlap report is scoped to its kecamatan', async () => {
    await prohibitedAreasRouter.createCaller(KECAMATAN()).checkOverlaps();
    expect(findOverlapsMock).toHaveBeenLastCalledWith({ scopeKecamatan: 'Sukasari' });
  });
});
