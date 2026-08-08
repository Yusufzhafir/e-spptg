/**
 * What each role can see and reach in the browser.
 *
 * This is the layer the API suite cannot touch: `RequireRole` and the nav menu
 * are client components, so a role that is correctly refused by tRPC can still
 * be shown a menu entry or a page it should never have reached.
 */
import { expect, test } from '@playwright/test';
import { storageStateFor, type RoleKey } from '../fixtures/accounts';

type NavExpectation = {
  role: RoleKey;
  /** Nav labels that must be present. */
  visible: string[];
  /** Nav labels that must not be rendered at all. */
  hidden: string[];
};

const NAV: NavExpectation[] = [
  { role: 'superadmin', visible: ['Beranda', 'Pengajuan', 'Pengaturan'], hidden: [] },
  { role: 'adminA', visible: ['Beranda', 'Pengajuan', 'Pengaturan'], hidden: [] },
  { role: 'verifikatorA', visible: ['Beranda', 'Pengajuan', 'Pengaturan'], hidden: [] },
  { role: 'kecamatanSatu', visible: ['Beranda'], hidden: ['Pengajuan', 'Pengaturan'] },
  { role: 'viewer', visible: ['Beranda', 'Pengajuan'], hidden: ['Pengaturan'] },
];

for (const { role, visible, hidden } of NAV) {
  test.describe(`nav — ${role}`, () => {
    test.use({ storageState: storageStateFor(role) });

    test('dashboard loads with the right menu', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto('/app');
      await expect(page.getByRole('button', { name: 'Beranda' })).toBeVisible();

      for (const label of visible) {
        await expect(
          page.getByRole('button', { name: label }).first(),
          `${role} should see "${label}"`
        ).toBeVisible();
      }
      for (const label of hidden) {
        await expect(
          page.getByRole('button', { name: label }),
          `${role} must not see "${label}"`
        ).toHaveCount(0);
      }

      expect(errors, `unhandled client errors for ${role}`).toEqual([]);
    });
  });
}

test.describe('page gating — Kecamatan is dashboard-only', () => {
  test.use({ storageState: storageStateFor('kecamatanSatu') });

  test('is bounced off the pengajuan page', async ({ page }) => {
    await page.goto('/app/pengajuan');
    await page.waitForURL(/\/app(\?|$)/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/app');
  });

  test('is bounced off Pengaturan', async ({ page }) => {
    await page.goto('/app/pengaturan');
    await page.waitForURL(/\/app(\?|$)/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/app');
  });
});

test.describe('page gating — Viewer', () => {
  test.use({ storageState: storageStateFor('viewer') });

  test('cannot open Pengaturan', async ({ page }) => {
    await page.goto('/app/pengaturan');
    await page.waitForURL(/\/app(\?|$)/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/app');
  });

  test('can open its own Pengajuan page', async ({ page }) => {
    await page.goto('/app/pengajuan');
    await expect(page.getByRole('heading', { name: /draft pengajuan/i })).toBeVisible();
  });
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the app redirects to sign-in', async ({ page }) => {
    await page.goto('/app');
    await page.waitForURL(/\/sign-in/, { timeout: 15_000 });
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});
