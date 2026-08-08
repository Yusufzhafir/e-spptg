/**
 * Helpers for driving the 4-step submission wizard in the browser.
 */
import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { SEED_FILE, type SeedData } from './accounts';

export function readSeed(): SeedData {
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as SeedData;
}

/** The five uploads Step 1 refuses to continue without. */
export const REQUIRED_UPLOADS = [
  'Softcopy KTP',
  'Softcopy KK',
  'Softcopy Kwitansi Jual Beli/Hibah/Keterangan Warisan',
  'Softcopy Surat Permohonan',
  'Surat Pernyataan Tidak Sengketa',
] as const;

/**
 * A minimal but genuinely valid PDF, so the upload path exercises the real
 * mime-type check rather than being waved through as an arbitrary blob.
 */
export function samplePdf(label: string): Buffer {
  return Buffer.from(
    `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj
trailer<</Root 1 0 R>>
%%EOF ${label}`,
    'utf8'
  );
}

/** Attaches a PDF to the FileUploadField whose visible label is `label`. */
export async function uploadPdf(page: Page, label: string, filename: string) {
  await page.locator(`input[id="file-${label}"]`).setInputFiles({
    name: filename,
    mimeType: 'application/pdf',
    buffer: samplePdf(filename),
  });
  // The field swaps to its uploaded state once the tRPC upload resolves.
  await expect(page.getByText(filename, { exact: false }).first()).toBeVisible({
    timeout: 45_000,
  });
}

/** Creates a fresh draft and lands on Step 1 of the wizard. */
export async function createDraft(page: Page) {
  await page.goto('/app/pengajuan');
  await page.getByRole('button', { name: /buat draft baru/i }).click();
  await page.waitForURL(/\/app\/pengajuan\/draft\/\d+/, { timeout: 45_000 });
  await expect(page.getByLabel('Nama Pemohon')).toBeVisible({ timeout: 30_000 });
}

/**
 * Fills Step 1 completely — including the five mandatory uploads — and advances
 * to Step 2. `uploads: false` skips the files, which is only useful for testing
 * that the step refuses to advance without them.
 */
export async function completeStep1(
  page: Page,
  options: { nama?: string; nik?: string; desa?: string; uploads?: boolean } = {}
) {
  const seed = readSeed();
  const desa = options.desa ?? seed.villages[0].namaDesa;

  await page.getByLabel('Nama Pemohon').fill(options.nama ?? 'E2E Pemohon Uji');
  await page.getByLabel('NIK').fill(options.nik ?? '6403030303030303');
  await page.getByLabel('Alamat KTP').fill('Jl. Poros Uji RT 01');
  await page.getByLabel('Nomor HP').fill('081200000002');

  await page.locator('#villageId').click();
  await page.getByPlaceholder(/cari desa/i).fill(desa);
  await page.getByRole('option', { name: desa }).first().click();

  if (options.uploads !== false) {
    for (const [index, label] of REQUIRED_UPLOADS.entries()) {
      await uploadPdf(page, label, `uji-${index + 1}.pdf`);
    }
  }

  await page.locator('#persetujuan').click();
}

/** Clicks "Berikutnya" and waits for the given step heading to render. */
export async function goToStep(page: Page, heading: RegExp) {
  await page.getByRole('button', { name: /^berikutnya$/i }).click();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({
    timeout: 45_000,
  });
}
