/**
 * The accounts and desa the browser suite runs as.
 *
 * Everything is tagged with `E2E_TAG` so global-teardown can find and remove it
 * again — nothing here is meant to survive a run.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const E2E_TAG = process.env.E2E_TAG || 'pw';

/**
 * One password for every test account, generated per run unless pinned. Never
 * written to the repo — global-setup hands it to the login helper in memory and
 * stores nothing but the resulting session cookie.
 */
export const E2E_PASSWORD =
  process.env.E2E_PASSWORD || `Uji-${randomBytes(12).toString('base64url')}`;

export type RoleKey =
  | 'superadmin'
  | 'adminA'
  | 'adminB'
  | 'verifikatorA'
  | 'kecamatanSatu'
  | 'kecamatanDua'
  | 'viewer';

export type AccountSpec = {
  key: RoleKey;
  peran: 'Superadmin' | 'Admin' | 'Verifikator' | 'Kecamatan' | 'Viewer';
  /** Index into the seeded desa list, or null for roles without a desa. */
  villageIndex: number | null;
  /** Index into the seeded kecamatan names, or null. */
  kecamatanIndex: number | null;
};

export const ACCOUNTS: AccountSpec[] = [
  { key: 'superadmin', peran: 'Superadmin', villageIndex: null, kecamatanIndex: null },
  { key: 'adminA', peran: 'Admin', villageIndex: 0, kecamatanIndex: null },
  { key: 'adminB', peran: 'Admin', villageIndex: 1, kecamatanIndex: null },
  { key: 'verifikatorA', peran: 'Verifikator', villageIndex: 0, kecamatanIndex: null },
  { key: 'kecamatanSatu', peran: 'Kecamatan', villageIndex: null, kecamatanIndex: 0 },
  { key: 'kecamatanDua', peran: 'Kecamatan', villageIndex: null, kecamatanIndex: 1 },
  { key: 'viewer', peran: 'Viewer', villageIndex: null, kecamatanIndex: null },
];

export const KECAMATAN = [`E2E-${E2E_TAG} Kec Satu`, `E2E-${E2E_TAG} Kec Dua`];

/** Desa A and B share a kecamatan; desa C sits in the other one. */
export const VILLAGES = [
  { kodeDesa: `E2E${E2E_TAG}A`, namaDesa: `E2E-${E2E_TAG} Desa A`, kecamatan: KECAMATAN[0] },
  { kodeDesa: `E2E${E2E_TAG}B`, namaDesa: `E2E-${E2E_TAG} Desa B`, kecamatan: KECAMATAN[0] },
  { kodeDesa: `E2E${E2E_TAG}C`, namaDesa: `E2E-${E2E_TAG} Desa C`, kecamatan: KECAMATAN[1] },
];

export function emailFor(key: RoleKey): string {
  return `e2e-${E2E_TAG}-${key.toLowerCase()}@espptg.test`;
}

export const STORAGE_STATE_DIR = path.join(process.cwd(), 'e2e', '.auth');

export function storageStateFor(key: RoleKey): string {
  return path.join(STORAGE_STATE_DIR, `${key}.json`);
}

/** Written by global-setup so specs can read the seeded ids. */
export const SEED_FILE = path.join(process.cwd(), 'e2e', '.auth', 'seed.json');

export type SeedData = {
  password: string;
  villages: { id: number; namaDesa: string; kecamatan: string }[];
  users: { key: RoleKey; id: number; email: string; peran: string }[];
};
