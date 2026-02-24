import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TRPCContext } from '@/trpc/context';

vi.mock('@/server/db/queries/villages', () => ({
  getVillageById: vi.fn(),
}));

vi.mock('@/server/db/queries/villageBoundaries', () => ({
  getByVillageId: vi.fn(),
  upsertByVillageId: vi.fn(),
  deleteByVillageId: vi.fn(),
}));

import { villageBoundariesRouter } from './villageBoundariesRouter';
import * as villageQueries from '@/server/db/queries/villages';
import * as villageBoundaryQueries from '@/server/db/queries/villageBoundaries';

const getVillageByIdMock = vi.mocked(villageQueries.getVillageById);
const getByVillageIdMock = vi.mocked(villageBoundaryQueries.getByVillageId);
const upsertByVillageIdMock = vi.mocked(villageBoundaryQueries.upsertByVillageId);
const deleteByVillageIdMock = vi.mocked(villageBoundaryQueries.deleteByVillageId);
type VillageRecord = NonNullable<
  Awaited<ReturnType<typeof villageQueries.getVillageById>>
>;

function createCtx(
  peran: 'Viewer' | 'Admin' | 'Superadmin',
  userId = 1
) {
  const appUser: NonNullable<TRPCContext['appUser']> = {
    id: userId,
    nama: 'Test User',
    email: 'test@example.com',
    clerkUserId: `clerk-${userId}`,
    nipNik: '12345',
    peran,
    assignedVillageId: null,
    status: 'Aktif',
    nomorHP: null,
    terakhirMasuk: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    userId: `clerk-${userId}`,
    db: {} as TRPCContext['db'],
    appUser,
  } satisfies TRPCContext;
}

describe('villageBoundariesRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns boundary for existing village', async () => {
    const boundary = {
      id: 10,
      villageId: 7,
      geomGeoJSON: {
        type: 'Polygon' as const,
        coordinates: [[[106.0, -6.0], [106.1, -6.0], [106.1, -6.1], [106.0, -6.0]]],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const village = { id: 7 } as VillageRecord;

    getVillageByIdMock.mockResolvedValue(village);
    getByVillageIdMock.mockResolvedValue(boundary);

    const caller = villageBoundariesRouter.createCaller(createCtx('Viewer'));
    const result = await caller.byVillageId({ villageId: 7 });

    expect(getVillageByIdMock).toHaveBeenCalledWith(7);
    expect(getByVillageIdMock).toHaveBeenCalledWith(7);
    expect(result).toEqual(boundary);
  });

  it('returns null when boundary is not available', async () => {
    const village = { id: 7 } as VillageRecord;
    getVillageByIdMock.mockResolvedValue(village);
    getByVillageIdMock.mockResolvedValue(null);

    const caller = villageBoundariesRouter.createCaller(createCtx('Viewer'));
    const result = await caller.byVillageId({ villageId: 7 });

    expect(result).toBeNull();
  });

  it('throws NOT_FOUND when village does not exist', async () => {
    getVillageByIdMock.mockResolvedValue(undefined);

    const caller = villageBoundariesRouter.createCaller(createCtx('Viewer'));
    const promise = caller.byVillageId({ villageId: 99 });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getByVillageIdMock).not.toHaveBeenCalled();
  });

  it('allows upsert for admin and superadmin', async () => {
    const boundary = {
      id: 10,
      villageId: 7,
      geomGeoJSON: {
        type: 'Polygon' as const,
        coordinates: [[[106.0, -6.0], [106.1, -6.0], [106.1, -6.1], [106.0, -6.0]]],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const village = { id: 7 } as VillageRecord;
    getVillageByIdMock.mockResolvedValue(village);
    upsertByVillageIdMock.mockResolvedValue(boundary);

    const adminCaller = villageBoundariesRouter.createCaller(createCtx('Admin'));
    const superadminCaller = villageBoundariesRouter.createCaller(
      createCtx('Superadmin')
    );

    await expect(
      adminCaller.upsert({
        villageId: 7,
        geomGeoJSON: boundary.geomGeoJSON,
      })
    ).resolves.toEqual(boundary);

    await expect(
      superadminCaller.upsert({
        villageId: 7,
        geomGeoJSON: boundary.geomGeoJSON,
      })
    ).resolves.toEqual(boundary);
  });

  it('forbids upsert for viewer', async () => {
    const caller = villageBoundariesRouter.createCaller(createCtx('Viewer'));
    const promise = caller.upsert({
      villageId: 7,
      geomGeoJSON: {
        type: 'Polygon',
        coordinates: [[[106.0, -6.0], [106.1, -6.0], [106.1, -6.1], [106.0, -6.0]]],
      },
    });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(upsertByVillageIdMock).not.toHaveBeenCalled();
  });

  it('rejects invalid polygon payload', async () => {
    const caller = villageBoundariesRouter.createCaller(createCtx('Admin'));
    const promise = caller.upsert({
      villageId: 7,
      geomGeoJSON: {
        type: 'Polygon',
        coordinates: [[[106.0, -6.0], [106.1, -6.0], [106.1, -6.1]]],
      },
    });

    await expect(promise).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(getVillageByIdMock).not.toHaveBeenCalled();
    expect(upsertByVillageIdMock).not.toHaveBeenCalled();
  });

  it('allows delete for admin and superadmin', async () => {
    const village = { id: 7 } as VillageRecord;
    getVillageByIdMock.mockResolvedValue(village);
    deleteByVillageIdMock.mockResolvedValue({ id: 10, villageId: 7 });

    const adminCaller = villageBoundariesRouter.createCaller(createCtx('Admin'));
    const superadminCaller = villageBoundariesRouter.createCaller(
      createCtx('Superadmin')
    );

    await expect(adminCaller.delete({ villageId: 7 })).resolves.toEqual({
      deleted: true,
    });
    await expect(superadminCaller.delete({ villageId: 7 })).resolves.toEqual({
      deleted: true,
    });
  });

  it('forbids delete for viewer', async () => {
    const caller = villageBoundariesRouter.createCaller(createCtx('Viewer'));
    const promise = caller.delete({ villageId: 7 });

    await expect(promise).rejects.toBeInstanceOf(TRPCError);
    await expect(promise).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(deleteByVillageIdMock).not.toHaveBeenCalled();
  });
});
