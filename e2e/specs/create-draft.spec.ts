/**
 * "Buat Draft Baru" — the order of what the user sees.
 *
 * Two things went wrong before: the success toast fired on the list page while
 * the navigation was still in flight, and the button re-enabled the moment the
 * mutation resolved, so a second click created a second draft from a page the
 * user had already left.
 */
import { expect, test } from '@playwright/test';
import { storageStateFor } from '../fixtures/accounts';

test.use({ storageState: storageStateFor('verifikatorA') });

const CREATE_BUTTON = /buat draft baru|membuat/i;

test.describe('creating a draft', () => {
  test('the toast appears on the draft page, not on the list', async ({ page }) => {
    await page.goto('/app/pengajuan');
    await page.getByRole('button', { name: CREATE_BUTTON }).first().click();

    // The confirmation must not be raised while we are still on the list.
    await page.waitForURL(/\/app\/pengajuan\/draft\/\d+/, { timeout: 45_000 });
    await expect(page.getByText('Draft baru berhasil dibuat')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel('Nama Pemohon')).toBeVisible();
  });

  test('the button stays disabled until the draft page is open', async ({ page }) => {
    // Hold the draft editor's own query so the window between "row created" and
    // "editor on screen" is wide enough to inspect. That window is exactly where
    // the button used to re-enable, because the mutation was already settled.
    await page.route('**/api/trpc/drafts.getById**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });

    await page.goto('/app/pengajuan');

    const button = page.getByRole('button', { name: CREATE_BUTTON }).first();

    // Waiting for the create response first is what makes this a regression
    // test: asserting straight after the click would only catch the mutation's
    // own pending state, which was never the bug.
    const created = page.waitForResponse((response) =>
      response.url().includes('/api/trpc/drafts.create')
    );
    await button.click();
    await created;

    // The row exists now and the mutation has settled — but the editor is still
    // loading, so the button must not have come back to life.
    await expect(button).toBeDisabled();
    await expect(button).toHaveText(/membuat/i);

    await page.waitForURL(/\/app\/pengajuan\/draft\/\d+/, { timeout: 45_000 });
    await expect(page.getByLabel('Nama Pemohon')).toBeVisible({ timeout: 30_000 });
  });

  test('double-clicking creates only one draft', async ({ page }) => {
    await page.goto('/app/pengajuan');

    const before = await page.getByRole('row').count();

    const button = page.getByRole('button', { name: CREATE_BUTTON }).first();
    await button.click({ clickCount: 2, delay: 50 });
    await page.waitForURL(/\/app\/pengajuan\/draft\/\d+/, { timeout: 45_000 });

    await page.goto('/app/pengajuan');
    await expect(page.getByRole('button', { name: /buat draft baru/i }).first()).toBeEnabled();
    const after = await page.getByRole('row').count();

    // Header row aside, exactly one draft should have been added.
    expect(after - before).toBeLessThanOrEqual(1);
  });

  test('the flag is stripped so a refresh does not replay the toast', async ({ page }) => {
    await page.goto('/app/pengajuan');
    await page.getByRole('button', { name: CREATE_BUTTON }).first().click();
    await page.waitForURL(/\/app\/pengajuan\/draft\/\d+/, { timeout: 45_000 });
    await expect(page.getByText('Draft baru berhasil dibuat')).toBeVisible();

    await expect(page).toHaveURL(/\/app\/pengajuan\/draft\/\d+$/, { timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel('Nama Pemohon')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Draft baru berhasil dibuat')).toHaveCount(0);
  });
});
