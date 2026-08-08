/**
 * Seeds the desa and accounts the suite runs as, then signs each one in through
 * the real login form and stores its session cookie.
 *
 * Logging in through the UI rather than the API is deliberate: it means every
 * run exercises the sign-in page itself before any spec starts.
 */
import fs from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';
import {
  ACCOUNTS,
  E2E_PASSWORD,
  E2E_TAG,
  KECAMATAN,
  SEED_FILE,
  STORAGE_STATE_DIR,
  VILLAGES,
  emailFor,
  storageStateFor,
  type SeedData,
} from './fixtures/accounts';
import { hashPassword, withDb } from './fixtures/db';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;

  fs.rmSync(STORAGE_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });

  const seed = await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      const villages: SeedData['villages'] = [];
      for (const village of VILLAGES) {
        const res = await client.query<{ id: string; nama_desa: string; kecamatan: string }>(
          `INSERT INTO villages
             (kode_desa, nama_desa, kecamatan, kabupaten, provinsi, nama_kepala_desa,
              juru_ukur_nama, juru_ukur_jabatan, juru_ukur_nomor_hp)
           VALUES ($1,$2,$3,'Kutai Timur','Kalimantan Timur','Kades Uji',
                   'Juru Ukur Uji','Staf','081200000001')
           RETURNING id, nama_desa, kecamatan`,
          [village.kodeDesa, village.namaDesa, village.kecamatan]
        );
        villages.push({
          id: Number(res.rows[0].id),
          namaDesa: res.rows[0].nama_desa,
          kecamatan: res.rows[0].kecamatan,
        });
      }

      const passwordHash = await hashPassword(E2E_PASSWORD);
      const users: SeedData['users'] = [];

      for (const account of ACCOUNTS) {
        const villageId =
          account.villageIndex === null ? null : villages[account.villageIndex].id;
        const kecamatan =
          account.kecamatanIndex === null ? null : KECAMATAN[account.kecamatanIndex];

        const res = await client.query<{ id: string; email: string; peran: string }>(
          `INSERT INTO users
             (nama, password_hash, nip_nik, email, peran, assigned_village_id,
              assigned_kecamatan, status, email_verified_at)
           VALUES ($1,$2,'0000000000000000',$3,$4,$5,$6,'Aktif', NOW())
           RETURNING id, email, peran`,
          [
            `E2E ${E2E_TAG} ${account.peran}`,
            passwordHash,
            emailFor(account.key),
            account.peran,
            villageId,
            kecamatan,
          ]
        );

        users.push({
          key: account.key,
          id: Number(res.rows[0].id),
          email: res.rows[0].email,
          peran: res.rows[0].peran,
        });
      }

      await client.query('COMMIT');
      return { password: E2E_PASSWORD, villages, users } satisfies SeedData;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));

  // Sign each account in through the form and keep the resulting cookie.
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const account of ACCOUNTS) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();

      // Sign-in is two steps: the email is checked first, and only then does the
      // password field mount.
      await page.goto('/sign-in');
      await page.getByLabel('Email').fill(emailFor(account.key));
      await page.getByRole('button', { name: /^masuk$/i }).click();
      // Not getByLabel: the show/hide toggle carries the same accessible name.
      const passwordField = page.getByRole('textbox', { name: 'Kata Sandi' });
      await passwordField.waitFor({ state: 'visible', timeout: 20_000 });
      await passwordField.fill(E2E_PASSWORD);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL(/\/app(\?|$|\/)/, { timeout: 30_000 });

      await context.storageState({ path: storageStateFor(account.key) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
