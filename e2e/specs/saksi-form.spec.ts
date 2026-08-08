/**
 * Step 2 — "Saksi Batas Lahan" form.
 *
 * Covers the searchable Sisi Batas picker, the identity fields that feed the
 * SPPTG witness block, and the edit flow (which reuses the same form and must
 * update the row in place rather than adding a second one).
 */
import { expect, test } from '@playwright/test';
import { storageStateFor } from '../fixtures/accounts';
import { completeStep1, createDraft, goToStep } from '../fixtures/wizard';

test.use({ storageState: storageStateFor('verifikatorA') });

/**
 * Opens a fresh draft, fills Step 1 (uploads included — Step 2 is unreachable
 * without them) and lands on the Lapangan step.
 */
async function openStep2(page: import('@playwright/test').Page) {
  await createDraft(page);
  await completeStep1(page, { nama: 'E2E Saksi Pemohon' });
  await goToStep(page, /^validasi lapangan$/i);
  await expect(page.getByRole('heading', { name: /saksi batas lahan/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Saksi Batas Lahan', () => {
  test('adds a witness with its identity data', async ({ page }) => {
    await openStep2(page);

    await page.getByLabel('Nama Saksi').fill('Budi Saksi');

    // Sisi Batas is a searchable combobox, not a plain select.
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Tenggara');
    await page.getByRole('option', { name: 'Tenggara' }).click();

    await page.getByLabel('Penggunaan Batas').fill('Kebun karet');
    await page.getByLabel('Umur').fill('42');
    await page.getByLabel('Pekerjaan').fill('Petani');
    await page.getByLabel('Alamat').fill('Jl. Poros Uji RT 03');
    await page.getByRole('button', { name: /^tambah$/i }).click();

    const row = page.getByRole('row', { name: /Budi Saksi/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Tenggara');
    await expect(row).toContainText('Kebun karet');
    await expect(row).toContainText('42');
    await expect(row).toContainText('Petani');
    await expect(row).toContainText('Jl. Poros Uji RT 03');

    // The form must reset, or the next "Tambah" silently re-adds the same person.
    await expect(page.getByLabel('Nama Saksi')).toHaveValue('');
    await expect(page.getByLabel('Umur')).toHaveValue('');
  });

  test('the search box filters the Sisi Batas options', async ({ page }) => {
    await openStep2(page);

    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('laut');

    await expect(page.getByRole('option', { name: 'Timur Laut' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Barat Laut' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Selatan' })).toHaveCount(0);
  });

  test('edits a witness in place instead of adding a second row', async ({ page }) => {
    await openStep2(page);

    await page.getByLabel('Nama Saksi').fill('Siti Saksi');
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Utara');
    await page.getByRole('option', { name: 'Utara', exact: true }).click();
    await page.getByLabel('Penggunaan Batas').fill('Sawah');
    await page.getByLabel('Umur').fill('35');
    await page.getByRole('button', { name: /^tambah$/i }).click();

    await expect(page.getByRole('row', { name: /Siti Saksi/ })).toBeVisible();

    await page.getByRole('button', { name: /ubah data saksi siti saksi/i }).click();

    // The form becomes an edit form, pre-filled with that row.
    await expect(page.getByText('Ubah Data Saksi')).toBeVisible();
    await expect(page.getByLabel('Nama Saksi')).toHaveValue('Siti Saksi');
    await expect(page.getByLabel('Umur')).toHaveValue('35');

    await page.getByLabel('Umur').fill('36');
    await page.getByLabel('Pekerjaan').fill('Pedagang');
    await page.getByRole('button', { name: /simpan perubahan/i }).click();

    const rows = page.getByRole('row', { name: /Siti Saksi/ });
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('36');
    await expect(rows).toContainText('Pedagang');
    await expect(page.getByText('Tambah Saksi')).toBeVisible();
  });

  test('cancelling an edit leaves the row untouched', async ({ page }) => {
    await openStep2(page);

    await page.getByLabel('Nama Saksi').fill('Andi Saksi');
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Barat Daya');
    await page.getByRole('option', { name: 'Barat Daya' }).click();
    await page.getByLabel('Penggunaan Batas').fill('Ladang');
    await page.getByRole('button', { name: /^tambah$/i }).click();

    await page.getByRole('button', { name: /ubah data saksi andi saksi/i }).click();
    await page.getByLabel('Nama Saksi').fill('Nama Yang Dibatalkan');
    // The wizard footer has its own "Batal": take the one paired with
    // "Simpan Perubahan" inside the witness form.
    await page
      .getByRole('button', { name: /simpan perubahan/i })
      .locator('xpath=preceding-sibling::button[1]')
      .click();

    await expect(page.getByRole('row', { name: /Andi Saksi/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Nama Yang Dibatalkan/ })).toHaveCount(0);
    await expect(page.getByLabel('Nama Saksi')).toHaveValue('');
  });

  test('refuses a witness with no name', async ({ page }) => {
    await openStep2(page);

    await page.getByRole('button', { name: /^tambah$/i }).click();
    await expect(page.getByText(/nama saksi harus diisi/i)).toBeVisible();
  });

  test('screenshot of the form for review', async ({ page }) => {
    await openStep2(page);

    await page.getByLabel('Nama Saksi').fill('Budi Saksi');
    await page.locator('#saksiSisi').click();
    await page.getByPlaceholder(/cari sisi batas/i).fill('Utara');
    await page.getByRole('option', { name: 'Utara', exact: true }).click();
    await page.getByLabel('Penggunaan Batas').fill('Kebun karet');
    await page.getByLabel('Umur').fill('42');
    await page.getByLabel('Pekerjaan').fill('Petani');
    await page.getByLabel('Alamat').fill('Jl. Poros Uji RT 03');
    await page.getByRole('button', { name: /^tambah$/i }).click();
    await expect(page.getByRole('row', { name: /Budi Saksi/ })).toBeVisible();

    // Kept on disk (not just attached) so the form can be eyeballed after a run.
    const card = page
      .getByRole('button', { name: /^tambah$/i })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await card.screenshot({ path: 'e2e/.artifacts/saksi-form.png' });
    await page
      .getByRole('table')
      .screenshot({ path: 'e2e/.artifacts/saksi-table.png' });
  });
});
