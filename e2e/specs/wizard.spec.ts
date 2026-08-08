/**
 * The 4-step wizard, driven the way a verifikator actually uses it.
 *
 * The two failure modes this guards against are the ones AGENTS.md calls out as
 * having caused real data loss: a step's data must be persisted *before* the
 * step changes, and a field missing from the save payload silently never lands.
 * Both only show up when you navigate away and come back.
 */
import { expect, test } from '@playwright/test';
import { storageStateFor } from '../fixtures/accounts';
import { completeStep1, createDraft, goToStep, uploadPdf } from '../fixtures/wizard';

test.use({ storageState: storageStateFor('verifikatorA') });

/** A small square well away from any real parcel. */
const POLYGON = [
  { lat: '0.500100', lon: '117.500100' },
  { lat: '0.500100', lon: '117.501100' },
  { lat: '0.501100', lon: '117.501100' },
  { lat: '0.501100', lon: '117.500100' },
];

async function fillPolygon(page: import('@playwright/test').Page) {
  for (const [index, point] of POLYGON.entries()) {
    await page.getByRole('button', { name: /tambah titik/i }).click();
    const row = page.getByRole('row').filter({ hasText: new RegExp(`^${index + 1}`) }).last();
    await row.getByPlaceholder('-6.9').fill(point.lat);
    await row.getByPlaceholder(/^1\d\d\./).fill(point.lon);
  }
}

test.describe('submission wizard', () => {
  test.slow();

  test('step 1 refuses to continue without the mandatory berkas', async ({ page }) => {
    await createDraft(page);
    await completeStep1(page, { uploads: false });
    await page.getByRole('button', { name: /^berikutnya$/i }).click();

    // Still on Berkas, with the missing uploads called out.
    await expect(page.getByRole('heading', { name: /^validasi lapangan$/i })).toHaveCount(0);
    await expect(page.getByLabel('Nama Pemohon')).toBeVisible();
  });

  test('data survives moving between steps', async ({ page }) => {
    await createDraft(page);
    await completeStep1(page, { nama: 'E2E Persistensi', nik: '6403040404040404' });
    await goToStep(page, /^validasi lapangan$/i);

    await page.getByLabel('Nama Saksi').fill('Saksi Persistensi');
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Timur');
    await page.getByRole('option', { name: 'Timur', exact: true }).click();
    await page.getByLabel('Penggunaan Batas').fill('Kebun');
    await page.getByRole('button', { name: /^tambah$/i }).click();
    await expect(page.getByRole('row', { name: /Saksi Persistensi/ })).toBeVisible();

    // Back to Berkas and forward again: both steps must still hold their data.
    await page.getByRole('button', { name: /^sebelumnya$/i }).click();
    await expect(page.getByLabel('Nama Pemohon')).toHaveValue('E2E Persistensi');
    await expect(page.getByLabel('NIK')).toHaveValue('6403040404040404');

    await goToStep(page, /^validasi lapangan$/i);
    await expect(page.getByRole('row', { name: /Saksi Persistensi/ })).toBeVisible();

    // And after a full page reload, i.e. straight from the database.
    await page.reload();
    await expect(page.getByRole('row', { name: /Saksi Persistensi/ })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('carries every step through to the Hasil summary', async ({ page }) => {
    await createDraft(page);
    await completeStep1(page, { nama: 'E2E Alur Penuh', nik: '6403050505050505' });
    await goToStep(page, /^validasi lapangan$/i);

    await page.getByLabel('Nama Saksi').fill('Saksi Alur');
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Utara');
    await page.getByRole('option', { name: 'Utara', exact: true }).click();
    await page.getByLabel('Penggunaan Batas').fill('Kebun sawit');
    await page.getByLabel('Umur').fill('44');
    await page.getByRole('button', { name: /^tambah$/i }).click();

    await fillPolygon(page);

    // Step 2 has a mandatory upload of its own.
    await uploadPdf(page, 'Berita Acara Validasi Lapangan', 'berita-acara.pdf');

    // Leaving Step 2 runs the PostGIS overlap check and then gates on an
    // explicit confirmation dialog.
    await page.getByRole('button', { name: /^berikutnya$/i }).click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 90_000 });
    await confirmDialog
      .getByText(/sudah memeriksa hasil cek tumpang tindih/i)
      .click();
    await confirmDialog.getByRole('button', { name: /^lanjutkan$/i }).click();

    await expect(page.getByRole('heading', { name: /^hasil pengajuan$/i })).toBeVisible({
      timeout: 90_000,
    });

    // The Hasil step summarises what Steps 1 and 2 collected — if any of it is
    // missing here, the payload dropped it somewhere along the way.
    await expect(page.getByText('E2E Alur Penuh')).toBeVisible();
    await expect(page.getByText('6403050505050505')).toBeVisible();
    await expect(page.getByText('Saksi Alur')).toBeVisible();
    await expect(page.getByRole('heading', { name: /keputusan status/i })).toBeVisible();
  });
});
